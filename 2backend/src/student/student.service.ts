/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../core/prisma/prisma.service';
import { RequestStatus, PriorityLevel, FileCategory } from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateInternshipDto } from './dto/create-internship.dto';
import { CreateGenericRequestDto } from './dto/create-generic-request.dto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import 'multer';
@Injectable()
export class StudentService {
  private supabase: SupabaseClient;
  private readonly MAX_TOTAL_STORAGE = 50 * 1024 * 1024;

  constructor(private prisma: PrismaService) {
    this.supabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_KEY as string,
    );
  }

  async getTotalUsedStorage(userId: string): Promise<number> {
    const files = await this.prisma.file.findMany({
      where: { uploadedByUserId: userId },
      select: { fileSizeBytes: true },
    });
    return files.reduce((sum, file) => sum + (file.fileSizeBytes || 0), 0);
  }

  async createInternshipRequest(
    userId: string,
    data: CreateInternshipDto,
  ): Promise<{ message: string; requestNo: string; requestId: string }> {
    try {
      let requestType = await this.prisma.requestType.findUnique({
        where: { key: 'INTERNSHIP_REQUEST' },
      });

      if (!requestType) {
        requestType = await this.prisma.requestType.create({
          data: {
            key: 'INTERNSHIP_REQUEST',
            name: 'Internship Application',
            category: 'ACADEMIC',
            description: 'Student internship application processes',
          },
        });
      }

      const requestNo = `INT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

      const newRequest = await this.prisma.$transaction(async (tx) => {
        const req = await tx.request.create({
          data: {
            requestNo: requestNo,
            title: data.title || 'Internship Application',
            requestTypeId: requestType.id,
            requesterUserId: userId,
            status: RequestStatus.SUBMITTED,
            submittedAt: new Date(),
            priority: PriorityLevel.MEDIUM,
            currentAssigneeUserId: data.advisorUserId || null,
            internshipRequest: {
              create: {
                studentUserId: userId,
                companyName: data.companyName,
                companySector: data.companySector,
                companyContactName: data.companyContactName,
                companyContactEmail: data.companyContactEmail,
                internshipType: data.internshipType,
                workMode: data.workMode,
                startDate: new Date(data.startDate),
                endDate: new Date(data.endDate),
                durationDays: data.durationDays,
                insuranceRequired: data.insuranceRequired,
              },
            },
          },
        });

        await tx.requestStatusHistory.create({
          data: {
            requestId: req.id,
            oldStatus: null,
            newStatus: RequestStatus.SUBMITTED,
            changedByUserId: userId,
            changeReason: 'Internship request submitted by student.',
          },
        });

        if (data.advisorUserId) {
          await tx.requestAssignment.create({
            data: {
              requestId: req.id,
              assignedToUserId: data.advisorUserId,
              assignedByUserId: userId,
            },
          });
        }

        return req;
      });

      // 🔥 AUDIT LOG EKLENDİ 🔥
      await this.prisma.auditLog.create({
        data: {
          userId: userId,
          actionType: 'CREATE',
          entityType: 'Request',
          entityId: newRequest.id,
        },
      });

      return {
        message: 'Internship request successfully created.',
        requestNo: String(newRequest.requestNo),
        requestId: String(newRequest.id),
      };
    } catch (error) {
      console.error('Internship request error:', error);
      throw new InternalServerErrorException(
        'Failed to save request. Please try again.',
      );
    }
  }

  async createGenericRequest(
    userId: string,
    data: any,
    files?: Array<Express.Multer.File>,
  ) {
    let reqType = await this.prisma.requestType.findUnique({
      where: { key: data.typeKey },
    });

    if (!reqType) {
      reqType = await this.prisma.requestType.create({
        data: {
          key: data.typeKey,
          name: data.typeKey.replace('_', ' ').toUpperCase(),
          category: 'GENERAL',
        },
      });
    }

    if (files && files.length > 0) {
      const incomingSize = files.reduce((sum, f) => sum + f.size, 0);
      const usedStorage = await this.getTotalUsedStorage(userId);
      if (usedStorage + incomingSize > this.MAX_TOTAL_STORAGE) {
        throw new PayloadTooLargeException(
          'Not enough storage. 50MB limit reached.',
        );
      }
    }

    const standardKeys = [
      'typeKey',
      'title',
      'description',
      'priority',
      'facultyUserId',
      'preferredDate',
      'preferredTime',
    ];
    const dynamicAnswers = {};
    for (const key in data) {
      if (!standardKeys.includes(key)) dynamicAnswers[key] = data[key];
    }

    const requestNo = `REQ-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    let finalDescription = data.description;
    if (data.preferredDate)
      finalDescription += `\nPreferred Date: ${data.preferredDate}`;
    if (data.preferredTime)
      finalDescription += `\nPreferred Time: ${data.preferredTime}`;

    const assignedUserId =
      data.facultyUserId &&
      data.facultyUserId !== 'none' &&
      data.facultyUserId.trim() !== ''
        ? data.facultyUserId.trim()
        : null;

    // 🔥 ÇÖZÜM BURASI: DİZİYE TİP EKLENDİ 🔥
    const uploadedFilesMeta: Array<{
      originalName: string;
      mimeType: string;
      size: number;
      url: string;
    }> = [];

    if (files && files.length > 0) {
      for (const file of files) {
        const uniqueFileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
        const { error: uploadError } = await this.supabase.storage
          .from('campusops-files')
          .upload(uniqueFileName, file.buffer, { contentType: file.mimetype });

        if (uploadError)
          throw new InternalServerErrorException(
            `Supabase Error: ${uploadError.message}`,
          );

        const { data: urlData } = this.supabase.storage
          .from('campusops-files')
          .getPublicUrl(uniqueFileName);

        uploadedFilesMeta.push({
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: urlData.publicUrl,
        });
      }
    }

    const newRequest = await this.prisma.$transaction(async (tx) => {
      const req = await tx.request.create({
        data: {
          requestNo,
          title: data.title,
          description: finalDescription,
          requestTypeId: reqType.id,
          requesterUserId: userId,
          currentAssigneeUserId: assignedUserId,
          status: 'SUBMITTED',
          submittedAt: new Date(),
          priority: data.priority || 'MEDIUM',
          dynamicData: dynamicAnswers,
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId: req.id,
          oldStatus: null,
          newStatus: 'SUBMITTED',
          changedByUserId: userId,
          changeReason: 'Request submitted by student.',
        },
      });

      if (assignedUserId) {
        await tx.requestAssignment.create({
          data: {
            requestId: req.id,
            assignedToUserId: assignedUserId,
            assignedByUserId: userId,
          },
        });
      }

      for (const meta of uploadedFilesMeta) {
        const savedFile = await tx.file.create({
          data: {
            storageProvider: 'SUPABASE',
            bucketName: 'campusops-files',
            storagePath: meta.url,
            originalFileName: meta.originalName,
            mimeType: meta.mimeType,
            fileSizeBytes: meta.size,
            fileCategory: 'DOCUMENT',
            uploadedByUserId: userId,
          },
        });

        await tx.fileLink.create({
          data: {
            fileId: savedFile.id,
            entityType: 'Request',
            entityId: req.id,
            relationType: 'ATTACHMENT',
            requestId: req.id,
          },
        });
      }

      if (assignedUserId) {
        await tx.notification.create({
          data: {
            userId: assignedUserId,
            requestId: req.id,
            type: 'IN_APP',
            title: 'New Student Request',
            message: `A new ${reqType.name} request has been submitted and assigned to you.`,
            actionUrl: `/faculty/approvals?id=${req.id}`,
          },
        });
      }

      // 🔥 AUDIT LOG EKLENDİ 🔥
      await tx.auditLog.create({
        data: {
          userId: userId,
          actionType: 'CREATE',
          entityType: 'Request',
          entityId: req.id,
        },
      });

      return req;
    });

    return { message: 'Success', requestId: newRequest.id };
  }

  async updateGenericRequest(
    userId: string,
    requestId: string,
    data: any,
    files?: Array<Express.Multer.File>,
  ) {
    const existingRequest = await this.prisma.request.findFirst({
      where: { id: requestId, requesterUserId: userId },
      include: { requestType: true },
    });

    if (!existingRequest)
      throw new NotFoundException('Request not found or access denied.');
    if (existingRequest.status !== 'REVISION_REQUESTED') {
      throw new BadRequestException(
        'You can only update requests that are marked as "Revision Requested".',
      );
    }

    if (files && files.length > 0) {
      const incomingSize = files.reduce((sum, f) => sum + f.size, 0);
      const usedStorage = await this.getTotalUsedStorage(userId);
      if (usedStorage + incomingSize > this.MAX_TOTAL_STORAGE) {
        throw new PayloadTooLargeException(
          'Not enough storage. 50MB limit reached.',
        );
      }
    }

    const standardKeys = [
      'typeKey',
      'title',
      'description',
      'priority',
      'facultyUserId',
      'preferredDate',
      'preferredTime',
      'deletedFileIds',
    ];
    const dynamicAnswers = {};
    for (const key in data) {
      if (!standardKeys.includes(key)) dynamicAnswers[key] = data[key];
    }

    let finalDescription = data.description;
    if (data.preferredDate)
      finalDescription += `\nPreferred Date: ${data.preferredDate}`;
    if (data.preferredTime)
      finalDescription += `\nPreferred Time: ${data.preferredTime}`;

    if (data.deletedFileIds) {
      try {
        const fileIdsToDelete = JSON.parse(data.deletedFileIds);
        if (Array.isArray(fileIdsToDelete) && fileIdsToDelete.length > 0) {
          const filesToDelete = await this.prisma.file.findMany({
            where: { id: { in: fileIdsToDelete }, uploadedByUserId: userId },
          });

          const fileNames = filesToDelete
            .map((f) => f.storagePath.split('/').pop())
            .filter(Boolean);
          if (fileNames.length > 0)
            await this.supabase.storage
              .from('campusops-files')
              .remove(fileNames as string[]);

          await this.prisma.file.deleteMany({
            where: { id: { in: filesToDelete.map((f) => f.id) } },
          });
        }
      } catch (err) {
        console.error('File deletion error:', err);
      }
    }

    // 🔥 ÇÖZÜM BURASI: DİZİYE TİP EKLENDİ 🔥
    const uploadedFilesMeta: Array<{
      originalName: string;
      mimeType: string;
      size: number;
      url: string;
    }> = [];

    if (files && files.length > 0) {
      for (const file of files) {
        const uniqueFileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
        const { error: uploadError } = await this.supabase.storage
          .from('campusops-files')
          .upload(uniqueFileName, file.buffer, { contentType: file.mimetype });

        if (uploadError)
          throw new InternalServerErrorException(
            `Supabase Error: ${uploadError.message}`,
          );

        const { data: urlData } = this.supabase.storage
          .from('campusops-files')
          .getPublicUrl(uniqueFileName);

        uploadedFilesMeta.push({
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: urlData.publicUrl,
        });
      }
    }

    const updatedRequest = await this.prisma.$transaction(async (tx) => {
      const req = await tx.request.update({
        where: { id: requestId },
        data: {
          title: data.title || existingRequest.title,
          description: finalDescription,
          priority: data.priority || existingRequest.priority,
          dynamicData: dynamicAnswers,
          status: 'SUBMITTED',
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId: req.id,
          oldStatus: existingRequest.status,
          newStatus: 'SUBMITTED',
          changedByUserId: userId,
          changeReason: 'Student updated details and resubmitted the request.',
        },
      });

      for (const meta of uploadedFilesMeta) {
        const savedFile = await tx.file.create({
          data: {
            storageProvider: 'SUPABASE',
            bucketName: 'campusops-files',
            storagePath: meta.url,
            originalFileName: meta.originalName,
            mimeType: meta.mimeType,
            fileSizeBytes: meta.size,
            fileCategory: 'DOCUMENT',
            uploadedByUserId: userId,
          },
        });

        await tx.fileLink.create({
          data: {
            fileId: savedFile.id,
            entityType: 'Request',
            entityId: req.id,
            relationType: 'ATTACHMENT',
            requestId: req.id,
          },
        });
      }

      if (existingRequest.currentAssigneeUserId) {
        await tx.requestAssignment.updateMany({
          where: {
            requestId: req.id,
            assignedToUserId: existingRequest.currentAssigneeUserId,
          },
          data: { isActive: true },
        });

        await tx.notification.create({
          data: {
            userId: existingRequest.currentAssigneeUserId,
            requestId: req.id,
            type: 'IN_APP',
            title: '🔄 Request Resubmitted',
            message: `The student has revised and resubmitted the ${existingRequest.requestType.name} request. It requires your approval again.`,
            actionUrl: `/faculty/approvals?id=${req.id}`,
          },
        });
      }

      // 🔥 AUDIT LOG EKLENDİ 🔥
      await tx.auditLog.create({
        data: {
          userId: userId,
          actionType: 'UPDATE',
          entityType: 'Request',
          entityId: req.id,
        },
      });

      return req;
    });

    return {
      message: 'Successfully updated and resubmitted',
      requestId: updatedRequest.id,
    };
  }

  // 🔥 ÇOKLU ATAMA DESTEĞİ VE STAFF GÖSTERİMİ İÇİN GÜNCELLENDİ 🔥
  async getMyRequests(userId: string, type?: string, category?: string) {
    const requestTypeFilter: any = {};
    if (type) requestTypeFilter.key = { equals: type, mode: 'insensitive' };
    if (category) requestTypeFilter.category = category.toUpperCase();

    const requests = await this.prisma.request.findMany({
      where: {
        requesterUserId: userId,
        ...(Object.keys(requestTypeFilter).length > 0
          ? { requestType: requestTypeFilter }
          : {}),
      },
      include: {
        requestType: true,
        // Faculty (Hoca) Atamaları
        assignments: {
          include: {
            assignedTo: { include: { profile: true } },
          },
        },
        // 🔥 Staff (Personel) Atamaları 🔥
        currentAssignee: {
          include: { profile: true },
        },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((req) => {
      // Hoca Atamalarını Birleştir
      const assignedNames = req.assignments
        .map((a) => a.assignedTo.profile?.fullName)
        .filter(Boolean)
        .join(', ');

      return {
        id: req.id,
        requestNo: req.requestNo,
        title: req.title,
        type: req.requestType.key,
        typeName: req.requestType.name,
        status: req.status,
        priority: req.priority,
        createdAt: req.createdAt,
        dueAt: req.dueAt || null,
        assignedToName: assignedNames || null, // Faculty / Hoca
        currentAssigneeName: req.currentAssignee?.profile?.fullName || null, // 🔥 Staff / Personel 🔥
        commentCount: req._count.comments,
      };
    });
  }

  // 🔥 ÇOKLU ATAMA DESTEĞİ VE EDİT İÇİN VERİ ÇEKME 🔥
  async getRequestById(userId: string, id: string) {
    const request = await this.prisma.request.findFirst({
      where: { id: id, requesterUserId: userId },
      include: {
        requestType: true,
        requester: {
          include: {
            profile: {
              include: {
                faculty: { select: { name: true } },
                department: { select: { name: true } },
                unit: { select: { name: true } },
              },
            },
            primaryRoles: { include: { role: true } },
          },
        },
        assignments: {
          include: {
            assignedTo: { include: { profile: true } },
          },
        },
        fileLinks: { include: { file: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              include: {
                profile: true,
                primaryRoles: { include: { role: true } },
              },
            },
          },
        },
        // 🔥 1. EKSİK OLAN SORGULAMA BURASI: Timeline verilerini DB'den çek
        statusHistory: { orderBy: { changedAt: 'desc' } },
      },
    });

    if (!request) {
      throw new NotFoundException('Talep bulunamadı veya erişim yetkiniz yok.');
    }

    return {
      id: request.id,
      requestNo: request.requestNo,
      title: request.title,
      description: request.description,
      status: request.status,
      priority: request.priority,
      type: request.requestType?.key || 'unknown',
      typeName: request.requestType?.name || 'Bilinmeyen Tür',
      formSchema: request.requestType?.formSchemaJson || null,

      dynamicData: request.dynamicData || {},
      requester: request.requester
        ? {
            id: request.requester.id,
            email: request.requester.email,
            fullName: request.requester.profile?.fullName || request.requester.email,
            role:
              request.requester.primaryRoles?.[0]?.role?.name ||
              'STUDENT',
            faculty: request.requester.profile?.faculty?.name || null,
            department:
              request.requester.profile?.department?.name ||
              request.requester.profile?.unit?.name ||
              null,
            studentNumber: request.requester.profile?.studentNumber || null,
            staffNumber: request.requester.profile?.staffNumber || null,
            title: request.requester.profile?.title || null,
          }
        : null,
      assignedFacultyId:
        request.assignments?.[0]?.assignedToUserId ||
        request.currentAssigneeUserId ||
        null,

      createdAt: request.createdAt,
      dueAt: request.dueAt || null,
      assignedToNames: request.assignments
        .map((a) => a.assignedTo.profile?.fullName)
        .filter(Boolean),
      attachments:
        (request as any).fileLinks?.map((fl: any) => ({
          id: fl.file?.id,
          name: fl.file?.originalFileName,
          size: fl.file?.fileSizeBytes
            ? `${(fl.file.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`
            : '0 MB',
          url: fl.file?.storagePath,
        })) || [],
      comments:
        (request as any).comments?.map((c: any) => ({
          id: c.id,
          author: c.user?.profile?.fullName || c.user?.email || 'İsimsiz',
          authorRole:
            c.user?.primaryRoles?.[0]?.role?.name?.toLowerCase() || 'student',
          content: c.commentText,
          createdAt:
            c.createdAt instanceof Date
              ? c.createdAt.toISOString()
              : c.createdAt,
        })) || [],

      // 🔥 2. FRONTEND'E GÖNDERİLECEK VERİ BURASI: Timeline'ı haritala
      timeline: request.statusHistory.map((h) => ({
        id: h.id,
        status: h.newStatus,
        date: h.changedAt,
        note: h.changeReason || 'Status updated.',
      })),
    };
  }

  // Öğrenci için Talep Türlerini (Request Types) getiren servis
  async getRequestTypes() {
    return this.prisma.requestType.findMany({
      where: { isActive: true },
      select: {
        id: true,
        key: true,
        name: true,
        category: true, // 🔥 İŞTE EKSİK OLAN VE SİSTEMİ KURTARACAK SATIR 🔥
        description: true,
        formSchemaJson: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async addCommentToRequest(
    userId: string,
    requestId: string,
    commentText: string,
  ) {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new Error('Request not found.');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, primaryRoles: { include: { role: true } } },
    });

    const userRoleName = user?.primaryRoles[0]?.role?.name || 'STUDENT';

    if (userRoleName === 'STUDENT' && request.requesterUserId !== userId) {
      throw new Error('You can only comment on your own requests.');
    }

    const newComment = await this.prisma.requestComment.create({
      data: {
        requestId: requestId,
        userId: userId,
        commentText: commentText,
        isInternal: false,
      },
    });

    // 🔥 AUDIT LOG EKLENDİ 🔥
    await this.prisma.auditLog.create({
      data: {
        userId: userId,
        actionType: 'CREATE',
        entityType: 'RequestComment',
        entityId: newComment.id,
      },
    });

    return {
      id: newComment.id,
      author: user?.profile?.fullName || user?.email,
      authorRole: userRoleName.toLowerCase(),
      content: newComment.commentText,
      createdAt: newComment.createdAt.toISOString(),
    };
  }

  async getFacultyMembers() {
    return this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        primaryRoles: { some: { role: { name: 'FACULTY' } } },
      },
      select: {
        id: true,
        profile: {
          select: {
            fullName: true,
            title: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { profile: { firstName: 'asc' } },
    });
  }

  // ─── INTERNSHIP DEDICATED ENDPOINTS ─────────────────────────────────────

  async getInternships(userId: string) {
    const records = await this.prisma.internshipRequest.findMany({
      where: { studentUserId: userId },
      include: {
        request: {
          include: {
            requestType: { select: { id: true, key: true, name: true } },
          },
        },
        advisor: {
          include: { profile: { select: { fullName: true, title: true } } },
        },
        term: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => ({
      id: r.request.id,
      internshipId: r.id,
      requestNo: r.request.requestNo,
      title: r.request.title,
      status: r.request.status,
      priority: r.request.priority,
      companyName: r.companyName,
      companySector: r.companySector,
      internshipType: r.internshipType,
      workMode: r.workMode,
      startDate: r.startDate,
      endDate: r.endDate,
      durationDays: r.durationDays,
      insuranceRequired: r.insuranceRequired,
      advisorName: r.advisor?.profile?.fullName ?? null,
      advisorTitle: r.advisor?.profile?.title ?? null,
      term: r.term ?? null,
      createdAt: r.createdAt,
    }));
  }

  async getInternshipById(userId: string, requestId: string) {
    const r = await this.prisma.internshipRequest.findFirst({
      where: { requestId, studentUserId: userId },
      include: {
        request: {
          include: {
            requestType: true,
            statusHistory: { orderBy: { changedAt: 'asc' } },
            fileLinks: { include: { file: true } },
            comments: {
              where: { isInternal: false },
              orderBy: { createdAt: 'asc' },
              include: { user: { include: { profile: true } } },
            },
          },
        },
        advisor: { include: { profile: true } },
        term: true,
      },
    });

    if (!r) throw new NotFoundException('Internship request not found.');

    return {
      id: r.request.id,
      internshipId: r.id,
      requestNo: r.request.requestNo,
      title: r.request.title,
      description: r.request.description,
      status: r.request.status,
      priority: r.request.priority,
      createdAt: r.createdAt,
      companyName: r.companyName,
      companySector: r.companySector,
      companyContactName: r.companyContactName,
      companyContactEmail: r.companyContactEmail,
      internshipType: r.internshipType,
      workMode: r.workMode,
      startDate: r.startDate,
      endDate: r.endDate,
      durationDays: r.durationDays,
      insuranceRequired: r.insuranceRequired,
      currentStageNote: r.currentStageNote,
      finalDecisionNote: r.finalDecisionNote,
      advisor: r.advisor
        ? {
            id: r.advisor.id,
            fullName: r.advisor.profile?.fullName ?? r.advisor.email,
            title: r.advisor.profile?.title ?? null,
          }
        : null,
      term: r.term ?? null,
      attachments: r.request.fileLinks.map((fl: any) => ({
        id: fl.file.id,
        name: fl.file.originalFileName,
        size: fl.file.fileSizeBytes,
        url: fl.file.storagePath,
      })),
      comments: r.request.comments.map((c: any) => ({
        id: c.id,
        author: c.user?.profile?.fullName ?? c.user?.email ?? 'Unknown',
        content: c.commentText,
        createdAt: c.createdAt,
      })),
      timeline: r.request.statusHistory.map((h: any) => ({
        id: h.id,
        status: h.newStatus,
        date: h.changedAt,
        note: h.changeReason,
      })),
    };
  }

  async getMyAppointments(userId: string) {
    const appointments = await this.prisma.request.findMany({
      where: {
        requesterUserId: userId,
        requestType: { key: { in: ['appointment', 'career_appointment'] } },
      },
      include: {
        requestType: true,
        currentAssignee: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return appointments.map((apt) => ({
      id: apt.id,
      title: apt.title,
      with: apt.currentAssignee?.profile?.fullName || 'Atama Bekleniyor',
      date: apt.dueAt || apt.createdAt,
      time: '10:00 AM',
      duration: 30,
      location: 'Ofis / Online',
      status: apt.status.toLowerCase(),
      notes: apt.description,
    }));
  }

  async getMyReservations(userId: string) {
    const reservations = await this.prisma.request.findMany({
      where: {
        requesterUserId: userId,
        requestType: { category: 'RESERVATION' },
      },
      include: { requestType: true },
      orderBy: { createdAt: 'desc' },
    });

    return reservations.map((res) => ({
      id: res.id,
      roomName: res.title,
      building: res.requestType.name,
      date: res.dueAt || res.createdAt,
      startTime: '09:00',
      endTime: '11:00',
      capacity: 20,
      purpose: res.description,
      status: res.status.toLowerCase(),
    }));
  }

  async getMyFiles(userId: string) {
    try {
      const files = await this.prisma.file.findMany({
        where: { uploadedByUserId: userId },
        include: {
          links: {
            include: { request: { select: { title: true, id: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return files.map((file) => {
        const extension =
          file.originalFileName?.split('.').pop()?.toUpperCase() || 'FILE';
        let formattedDate = 'Unknown Date';
        if (file.createdAt) {
          formattedDate = new Date(file.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }
        return {
          id: file.id,
          name: file.originalFileName || 'Unnamed File',
          size: `${((file.fileSizeBytes || 0) / 1024 / 1024).toFixed(2)} MB`,
          rawSize: file.fileSizeBytes || 0,
          type: extension,
          url: file.storagePath,
          uploadedAt: formattedDate,
          relatedTo: file.links?.[0]?.request?.title || 'Personal Storage',
        };
      });
    } catch (error) {
      console.error('getMyFiles Hatası:', error);
      throw new InternalServerErrorException(
        'Dosyalar getirilirken bir hata oluştu.',
      );
    }
  }

  async uploadGeneralFile(userId: string, file: Express.Multer.File) {
    const usedStorage = await this.getTotalUsedStorage(userId);
    if (usedStorage + file.size > this.MAX_TOTAL_STORAGE) {
      throw new PayloadTooLargeException(
        `Storage full. Remaining: ${((this.MAX_TOTAL_STORAGE - usedStorage) / 1024 / 1024).toFixed(2)} MB`,
      );
    }

    const uniqueFileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    const { error: uploadError } = await this.supabase.storage
      .from('campusops-files')
      .upload(uniqueFileName, file.buffer, { contentType: file.mimetype });

    if (uploadError) {
      throw new InternalServerErrorException(
        `Supabase Error: ${uploadError.message}`,
      );
    }

    const { data: urlData } = this.supabase.storage
      .from('campusops-files')
      .getPublicUrl(uniqueFileName);

    const savedFile = await this.prisma.file.create({
      data: {
        storageProvider: 'SUPABASE',
        bucketName: 'campusops-files',
        storagePath: urlData.publicUrl,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        fileCategory: FileCategory.DOCUMENT,
        uploadedByUserId: userId,
      },
    });

    // 🔥 AUDIT LOG EKLENDİ 🔥
    await this.prisma.auditLog.create({
      data: {
        userId: userId,
        actionType: 'UPLOAD',
        entityType: 'File',
        entityId: savedFile.id,
      },
    });

    return savedFile;
  }

  async deleteFile(userId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, uploadedByUserId: userId },
    });

    if (!file) throw new NotFoundException('File not found or access denied.');

    try {
      const fileName = file.storagePath.split('/').pop();
      if (fileName) {
        await this.supabase.storage.from('campusops-files').remove([fileName]);
      }
    } catch (error) {
      console.error('Supabase file deletion error:', error);
    }

    await this.prisma.file.delete({ where: { id: fileId } });

    // 🔥 AUDIT LOG EKLENDİ 🔥
    await this.prisma.auditLog.create({
      data: {
        userId: userId,
        actionType: 'DELETE',
        entityType: 'File',
        entityId: fileId,
      },
    });

    return { message: 'File successfully deleted.' };
  }

  // 🔥 ÖĞRENCİ BİLDİRİMLERİ (IN-APP) 🔥
  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // 🔥 SEÇİLİ BİLDİRİMLERİ TOPLU SİLME 🔥
  async deleteNotifications(userId: string, ids: string[]) {
    await this.prisma.notification.deleteMany({
      where: {
        userId: userId,
        id: { in: ids }, // Sadece gönderilen ID'leri sil
      },
    });

    return { message: 'Bildirimler başarıyla silindi.' };
  }

  async markNotificationAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId: userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllNotificationsAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // 🔥 1. BİLDİRİM TERCİHLERİNİ GETİR 🔥
  async getPreferences(userId: string) {
    let prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    // Eğer kullanıcının tercihi yoksa (ilk giriş) default olarak oluştur
    if (!prefs) {
      prefs = await this.prisma.notificationPreference.create({
        data: { userId },
      });
    }
    return prefs;
  }

  // 🔥 2. BİLDİRİM TERCİHLERİNİ GÜNCELLE 🔥
  async updatePreferences(userId: string, data: any) {
    return this.prisma.notificationPreference.update({
      where: { userId },
      data,
    });
  }

  // 🔥 3. ŞİFRE DEĞİŞTİRME 🔥
  async changePassword(userId: string, body: any) {
    const { currentPassword, newPassword } = body;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User not found.');

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid)
      throw new BadRequestException('Current password is incorrect!');
    if (newPassword.length < 6)
      throw new BadRequestException(
        'New password must be at least 6 characters long.',
      );

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    // 🔥 AUDIT LOG EKLENDİ 🔥
    await this.prisma.auditLog.create({
      data: {
        userId: userId,
        actionType: 'UPDATE',
        entityType: 'UserPassword',
        entityId: userId,
      },
    });

    return { message: 'Password successfully updated.' };
  }

  // ─── UPDATE OWN PROFILE ──────────────────────────────────────────────────

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found.');

    if (dto.phoneNumber !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { phoneNumber: dto.phoneNumber || null },
      });
    }

    const firstName = dto.firstName ?? user.profile?.firstName ?? '';
    const lastName = dto.lastName ?? user.profile?.lastName ?? '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    return this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        firstName,
        lastName,
        fullName,
        bio: dto.bio ?? null,
        address: dto.address ?? null,
      },
      update: {
        firstName: dto.firstName !== undefined ? dto.firstName : user.profile?.firstName ?? '',
        lastName: dto.lastName !== undefined ? dto.lastName : user.profile?.lastName ?? '',
        fullName,
        bio: dto.bio !== undefined ? dto.bio : user.profile?.bio,
        address: dto.address !== undefined ? dto.address : user.profile?.address,
      },
    });
  }
}
