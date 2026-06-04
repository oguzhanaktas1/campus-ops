/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../core/prisma/prisma.service';
import {
  RequestStatus,
  PriorityLevel,
  FileCategory,
  Prisma,
} from '@prisma/client';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import {
  buildWorkflowSummary,
  deriveAppointmentTargetUser,
} from '../workflow/workflow-summary';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateInternshipDto } from './dto/create-internship.dto';
import { CreateGenericRequestDto } from './dto/create-generic-request.dto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import 'multer';
import {
  assertSafeUpload,
  buildStorageObjectKey,
} from '../files/file-security';
import { FilesService } from '../files/files.service';
import { RabbitmqPublisher } from '../infrastructure/rabbitmq/rabbitmq.publisher';
import { RoutingKeys } from '../infrastructure/rabbitmq/routing-keys';
@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);
  private supabase: SupabaseClient | null;
  private readonly MAX_TOTAL_STORAGE = 50 * 1024 * 1024;

  constructor(
    private prisma: PrismaService,
    private workflowEngine: WorkflowEngineService,
    private filesService: FilesService,
    private mq: RabbitmqPublisher,
  ) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    } else {
      this.supabase = null;
      this.logger.warn(
        'SUPABASE_URL or SUPABASE_KEY is missing. File storage features are disabled.',
      );
    }
  }

  private getSupabaseClient(): SupabaseClient {
    if (!this.supabase) {
      throw new InternalServerErrorException(
        'File storage is not configured. Set SUPABASE_URL and SUPABASE_KEY to enable uploads.',
      );
    }

    return this.supabase;
  }

  private async getInternshipWorkflowDefinitionId(
    requestTypeId: string,
    currentWorkflowDefinitionId?: string | null,
  ) {
    if (currentWorkflowDefinitionId) return currentWorkflowDefinitionId;

    const workflow = await this.prisma.workflowDefinition.findUnique({
      where: { key: 'WF_INTERNSHIP_REQUEST_V1' },
      select: { id: true },
    });

    if (!workflow) return null;

    await this.prisma.requestType.update({
      where: { id: requestTypeId },
      data: { workflowDefinitionId: workflow.id },
    });

    return workflow.id;
  }

  async getTotalUsedStorage(userId: string): Promise<number> {
    const files = await this.prisma.file.findMany({
      where: { uploadedByUserId: userId },
      select: { fileSizeBytes: true },
    });
    return files.reduce((sum, file) => sum + (file.fileSizeBytes || 0), 0);
  }

  private toTrimmedString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toInt(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private toFloat(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number.parseFloat(String(value));
    return Number.isNaN(parsed) ? null : parsed;
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    }
    return Boolean(value);
  }

  private toDate(value: unknown): Date | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private buildRequestFormData(request: any) {
    switch (request.requestType?.key) {
      case 'DOCUMENT_REQUEST':
        return request.documentRequest
          ? {
              documentType: request.documentRequest.documentType,
              language: request.documentRequest.language,
              copiesCount: request.documentRequest.copiesCount,
              deliveryMethod: request.documentRequest.deliveryMethod,
              deliveryAddress: request.documentRequest.deliveryAddress,
              description: request.description,
            }
          : {};
      case 'ROOM_RESERVATION':
        return request.roomReservationRequest
          ? {
              resourceId: request.roomReservationRequest.resourceId,
              eventName: request.roomReservationRequest.eventName,
              reservationPurpose:
                request.roomReservationRequest.reservationPurpose,
              attendeeCount: request.roomReservationRequest.attendeeCount,
              startAt: request.roomReservationRequest.startAt,
              endAt: request.roomReservationRequest.endAt,
              requiresSecurityApproval:
                request.roomReservationRequest.requiresSecurityApproval,
              requiresTechnicalSupport:
                request.roomReservationRequest.requiresTechnicalSupport,
              setupNotes: request.roomReservationRequest.setupNotes,
              description: request.description,
            }
          : {};
      case 'APPOINTMENT':
        return request.appointmentRequest
          ? {
              targetUserId: request.appointmentRequest.targetUserId,
              appointmentType: request.appointmentRequest.appointmentType,
              topic: request.appointmentRequest.topic,
              details: request.appointmentRequest.details,
              preferredStartAt: request.appointmentRequest.preferredStartAt,
              preferredEndAt: request.appointmentRequest.preferredEndAt,
            }
          : {};
      case 'PROCUREMENT_REQUEST':
        return request.procurementRequest
          ? {
              itemName: request.procurementRequest.itemName,
              itemCategory: request.procurementRequest.itemCategory,
              quantity: request.procurementRequest.quantity,
              unitPriceEstimate: request.procurementRequest.unitPriceEstimate
                ? Number(request.procurementRequest.unitPriceEstimate)
                : null,
              vendorPreference: request.procurementRequest.vendorPreference,
              justification: request.procurementRequest.justification,
              budgetCode: request.procurementRequest.budgetCode,
              priority: request.priority,
            }
          : {};
      case 'ACCESS_REQUEST':
        return request.accessRequest
          ? {
              accessType: request.accessRequest.accessType,
              targetResource: request.accessRequest.targetResource,
              requestedRoleOrPermission:
                request.accessRequest.requestedRoleOrPermission,
              justification: request.accessRequest.justification,
              startAt: request.accessRequest.startAt,
              endAt: request.accessRequest.endAt,
            }
          : {};
      case 'EVENT_REQUEST':
        return request.eventRequest
          ? {
              eventName: request.eventRequest.eventName,
              eventType: request.eventRequest.eventType,
              description: request.eventRequest.description,
              expectedAttendance: request.eventRequest.expectedAttendance,
              locationPreference: request.eventRequest.locationPreference,
              startAt: request.eventRequest.startAt,
              endAt: request.eventRequest.endAt,
              needsBudget: request.eventRequest.needsBudget,
              estimatedBudget: request.eventRequest.estimatedBudget
                ? Number(request.eventRequest.estimatedBudget)
                : null,
              needsPosterApproval: request.eventRequest.needsPosterApproval,
              needsSecuritySupport: request.eventRequest.needsSecuritySupport,
              needsTechnicalSupport:
                request.eventRequest.needsTechnicalSupport,
            }
          : {};
      case 'EQUIPMENT':
        return request.equipmentRequest
          ? {
              labResourceId: request.equipmentRequest.labResourceId,
              equipmentName: request.equipmentRequest.equipmentName,
              equipmentCategory: request.equipmentRequest.equipmentCategory,
              quantity: request.equipmentRequest.quantity,
              purpose: request.equipmentRequest.purpose,
              neededFrom: request.equipmentRequest.neededFrom,
              neededUntil: request.equipmentRequest.neededUntil,
              urgencyReason: request.equipmentRequest.urgencyReason,
            }
          : {};
      case 'INTERNSHIP_REQUEST':
        return request.internshipRequest
          ? {
              companyName: request.internshipRequest.companyName,
              companySector: request.internshipRequest.companySector,
              companyContactName: request.internshipRequest.companyContactName,
              companyContactEmail:
                request.internshipRequest.companyContactEmail,
              internshipType: request.internshipRequest.internshipType,
              workMode: request.internshipRequest.workMode,
              startDate: request.internshipRequest.startDate,
              endDate: request.internshipRequest.endDate,
              durationDays: request.internshipRequest.durationDays,
              insuranceRequired:
                request.internshipRequest.insuranceRequired,
            }
          : {};
      default:
        return request.dynamicData || {};
    }
  }

  private async applyTypedRequestUpdate(
    tx: Prisma.TransactionClient,
    userId: string,
    requestId: string,
    typeKey: string,
    data: any,
    existingRequest: any,
  ): Promise<{
    title?: string | null;
    description?: string | null;
    priority?: PriorityLevel;
    dynamicData?: Record<string, unknown>;
  }> {
    switch (typeKey) {
      case 'DOCUMENT_REQUEST': {
        const current = await tx.documentRequest.findUnique({
          where: { requestId },
        });
        if (!current) break;

        const documentType =
          this.toTrimmedString(data.documentType) ?? current.documentType;
        const language =
          this.toTrimmedString(data.language) ?? current.language ?? null;
        const copiesCount = this.toInt(data.copiesCount) ?? current.copiesCount;
        const deliveryMethod =
          this.toTrimmedString(data.deliveryMethod) ?? current.deliveryMethod;
        const deliveryAddress =
          this.toTrimmedString(data.deliveryAddress) ?? null;
        const description = this.toTrimmedString(data.description);

        await tx.documentRequest.update({
          where: { requestId },
          data: {
            documentType,
            language,
            copiesCount,
            deliveryMethod,
            deliveryAddress,
          },
        });

        return {
          title: `${documentType} Request`,
          description,
        };
      }
      case 'ROOM_RESERVATION': {
        const current = await tx.roomReservationRequest.findUnique({
          where: { requestId },
        });
        if (!current) break;

        const resourceId =
          this.toTrimmedString(data.resourceId) ?? current.resourceId;
        const resource = await tx.resource.findUnique({ where: { id: resourceId } });
        if (!resource) {
          throw new NotFoundException('Selected resource not found.');
        }

        const eventName =
          this.toTrimmedString(data.eventName) ?? current.eventName;
        const reservationPurpose =
          this.toTrimmedString(data.reservationPurpose) ??
          current.reservationPurpose;
        const attendeeCount =
          this.toInt(data.attendeeCount) ?? current.attendeeCount;
        const startAt = this.toDate(data.startAt) ?? current.startAt;
        const endAt = this.toDate(data.endAt) ?? current.endAt;
        if (startAt >= endAt) {
          throw new BadRequestException(
            'End time must be after start time.',
          );
        }
        const requiresSecurityApproval =
          data.requiresSecurityApproval !== undefined
            ? this.toBoolean(data.requiresSecurityApproval)
            : current.requiresSecurityApproval;
        const requiresTechnicalSupport =
          data.requiresTechnicalSupport !== undefined
            ? this.toBoolean(data.requiresTechnicalSupport)
            : current.requiresTechnicalSupport;
        const setupNotes = this.toTrimmedString(data.setupNotes);
        const description =
          this.toTrimmedString(data.description) ?? reservationPurpose;

        await tx.roomReservationRequest.update({
          where: { requestId },
          data: {
            resourceId,
            eventName,
            reservationPurpose,
            attendeeCount,
            startAt,
            endAt,
            requiresSecurityApproval,
            requiresTechnicalSupport,
            setupNotes,
          },
        });

        return {
          title: `${resource.name} - ${eventName}`,
          description,
        };
      }
      case 'APPOINTMENT': {
        const current = await tx.appointmentRequest.findUnique({
          where: { requestId },
        });
        if (!current) break;

        const targetUserId =
          this.toTrimmedString(data.targetUserId) ?? current.targetUserId;
        if (targetUserId === userId) {
          throw new BadRequestException('Cannot book appointment with yourself.');
        }
        const targetUser = await tx.user.findUnique({ where: { id: targetUserId } });
        if (!targetUser) {
          throw new NotFoundException('Selected person not found.');
        }

        const appointmentType =
          this.toTrimmedString(data.appointmentType) ??
          current.appointmentType;
        const topic = this.toTrimmedString(data.topic) ?? current.topic;
        const details =
          this.toTrimmedString(data.details) ?? current.details ?? null;
        const preferredStartAt =
          this.toDate(data.preferredStartAt) ?? current.preferredStartAt;
        const preferredEndAt =
          this.toDate(data.preferredEndAt) ?? current.preferredEndAt;
        if (
          preferredStartAt &&
          preferredEndAt &&
          preferredStartAt >= preferredEndAt
        ) {
          throw new BadRequestException(
            'Preferred end must be after preferred start.',
          );
        }

        await tx.appointmentRequest.update({
          where: { requestId },
          data: {
            targetUserId,
            appointmentType,
            topic,
            details,
            preferredStartAt,
            preferredEndAt,
          },
        });

        return {
          title: `Appointment: ${topic}`,
          description: details,
        };
      }
      case 'PROCUREMENT_REQUEST': {
        const current = await tx.procurementRequest.findUnique({
          where: { requestId },
        });
        if (!current) break;

        const itemName = this.toTrimmedString(data.itemName) ?? current.itemName;
        const itemCategory =
          this.toTrimmedString(data.itemCategory) ?? current.itemCategory;
        const quantity = this.toInt(data.quantity) ?? current.quantity;
        const unitPriceEstimate =
          this.toFloat(data.unitPriceEstimate) ??
          (current.unitPriceEstimate ? Number(current.unitPriceEstimate) : null);
        const vendorPreference =
          this.toTrimmedString(data.vendorPreference) ?? null;
        const justification =
          this.toTrimmedString(data.justification) ?? current.justification;
        const budgetCode = this.toTrimmedString(data.budgetCode) ?? null;
        const priority =
          (this.toTrimmedString(data.priority) as PriorityLevel | null) ??
          existingRequest.priority;
        const totalEstimate =
          unitPriceEstimate !== null ? unitPriceEstimate * quantity : null;

        await tx.procurementRequest.update({
          where: { requestId },
          data: {
            itemName,
            itemCategory,
            quantity,
            unitPriceEstimate,
            totalEstimate,
            vendorPreference,
            justification,
            budgetCode,
          },
        });

        return {
          title: `Procurement: ${itemName} (${quantity})`,
          description: justification,
          priority,
        };
      }
      case 'ACCESS_REQUEST': {
        const current = await tx.accessRequest.findUnique({
          where: { requestId },
        });
        if (!current) break;

        const accessType =
          this.toTrimmedString(data.accessType) ?? current.accessType;
        const targetResource =
          this.toTrimmedString(data.targetResource) ?? current.targetResource;
        const requestedRoleOrPermission =
          this.toTrimmedString(data.requestedRoleOrPermission) ?? null;
        const justification =
          this.toTrimmedString(data.justification) ?? current.justification;
        const startAt = this.toDate(data.startAt) ?? current.startAt;
        const endAt = this.toDate(data.endAt) ?? current.endAt;

        await tx.accessRequest.update({
          where: { requestId },
          data: {
            accessType,
            targetResource,
            requestedRoleOrPermission,
            justification,
            startAt,
            endAt,
          },
        });

        return {
          title: `Access Request: ${targetResource}`,
          description: justification,
        };
      }
      case 'EVENT_REQUEST': {
        const current = await tx.eventRequest.findUnique({
          where: { requestId },
        });
        if (!current) break;

        const eventName =
          this.toTrimmedString(data.eventName) ?? current.eventName;
        const eventType =
          this.toTrimmedString(data.eventType) ?? current.eventType;
        const description =
          this.toTrimmedString(data.description) ?? current.description;
        const expectedAttendance =
          this.toInt(data.expectedAttendance) ?? current.expectedAttendance;
        const locationPreference =
          this.toTrimmedString(data.locationPreference) ?? null;
        const startAt = this.toDate(data.startAt) ?? current.startAt;
        const endAt = this.toDate(data.endAt) ?? current.endAt;
        if (startAt >= endAt) {
          throw new BadRequestException('End date must be after start date.');
        }
        const needsBudget =
          data.needsBudget !== undefined
            ? this.toBoolean(data.needsBudget)
            : current.needsBudget;
        const estimatedBudget =
          this.toFloat(data.estimatedBudget) ??
          (current.estimatedBudget ? Number(current.estimatedBudget) : null);
        const needsPosterApproval =
          data.needsPosterApproval !== undefined
            ? this.toBoolean(data.needsPosterApproval)
            : current.needsPosterApproval;
        const needsSecuritySupport =
          data.needsSecuritySupport !== undefined
            ? this.toBoolean(data.needsSecuritySupport)
            : current.needsSecuritySupport;
        const needsTechnicalSupport =
          data.needsTechnicalSupport !== undefined
            ? this.toBoolean(data.needsTechnicalSupport)
            : current.needsTechnicalSupport;

        await tx.eventRequest.update({
          where: { requestId },
          data: {
            eventName,
            eventType,
            description,
            expectedAttendance,
            locationPreference,
            startAt,
            endAt,
            needsBudget,
            estimatedBudget: needsBudget ? estimatedBudget : null,
            needsPosterApproval,
            needsSecuritySupport,
            needsTechnicalSupport,
          },
        });

        return {
          title: eventName,
          description,
        };
      }
      case 'EQUIPMENT': {
        const current = await tx.equipmentRequest.findUnique({
          where: { requestId },
        });
        if (!current) break;

        const labResourceId =
          this.toTrimmedString(data.labResourceId) ?? current.labResourceId;
        const equipmentName =
          this.toTrimmedString(data.equipmentName) ?? current.equipmentName;
        const equipmentCategory =
          this.toTrimmedString(data.equipmentCategory) ??
          current.equipmentCategory;
        const quantity = this.toInt(data.quantity) ?? current.quantity;
        const purpose =
          this.toTrimmedString(data.purpose) ?? current.purpose;
        const neededFrom = this.toDate(data.neededFrom) ?? current.neededFrom;
        const neededUntil =
          this.toDate(data.neededUntil) ?? current.neededUntil;
        if (neededFrom && neededUntil && neededFrom >= neededUntil) {
          throw new BadRequestException(
            'Return date must be after pickup date.',
          );
        }
        const urgencyReason =
          this.toTrimmedString(data.urgencyReason) ?? null;

        await tx.equipmentRequest.update({
          where: { requestId },
          data: {
            labResourceId,
            equipmentName,
            equipmentCategory,
            quantity,
            purpose,
            neededFrom,
            neededUntil,
            urgencyReason,
          },
        });

        return {
          title: `${equipmentCategory} Request: ${equipmentName} (x${quantity})`,
          description: purpose,
        };
      }
      case 'INTERNSHIP_REQUEST': {
        const current = await tx.internshipRequest.findUnique({
          where: { requestId },
        });
        if (!current) break;

        const companyName =
          this.toTrimmedString(data.companyName) ?? current.companyName;
        const companySector =
          this.toTrimmedString(data.companySector) ?? null;
        const companyContactName =
          this.toTrimmedString(data.companyContactName) ?? null;
        const companyContactEmail =
          this.toTrimmedString(data.companyContactEmail) ?? null;
        const internshipType =
          this.toTrimmedString(data.internshipType) ??
          current.internshipType;
        const workMode =
          this.toTrimmedString(data.workMode) ?? current.workMode;
        const startDate = this.toDate(data.startDate) ?? current.startDate;
        const endDate = this.toDate(data.endDate) ?? current.endDate;
        if (startDate >= endDate) {
          throw new BadRequestException('End date cannot be before start date.');
        }
        const durationDays =
          this.toInt(data.durationDays) ?? current.durationDays;
        const insuranceRequired =
          data.insuranceRequired !== undefined
            ? this.toBoolean(data.insuranceRequired)
            : current.insuranceRequired;

        await tx.internshipRequest.update({
          where: { requestId },
          data: {
            companyName,
            companySector,
            companyContactName,
            companyContactEmail,
            internshipType,
            workMode,
            startDate,
            endDate,
            durationDays,
            insuranceRequired,
          },
        });

        return {
          title: `${internshipType} Internship at ${companyName}`,
        };
      }
      default: {
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
        const dynamicData: Record<string, unknown> = {};
        for (const key in data) {
          if (!standardKeys.includes(key)) dynamicData[key] = data[key];
        }

        let finalDescription =
          this.toTrimmedString(data.description) ?? existingRequest.description;
        if (data.preferredDate) {
          finalDescription =
            (finalDescription ? `${finalDescription}\n` : '') +
            `Preferred Date: ${data.preferredDate}`;
        }
        if (data.preferredTime) {
          finalDescription =
            (finalDescription ? `${finalDescription}\n` : '') +
            `Preferred Time: ${data.preferredTime}`;
        }

        return {
          title: data.title || existingRequest.title,
          description: finalDescription,
          priority: data.priority || existingRequest.priority,
          dynamicData,
        };
      }
    }

    return {
      title: existingRequest.title,
      description: existingRequest.description,
      priority: existingRequest.priority,
      dynamicData: existingRequest.dynamicData || {},
    };
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

      const workflowDefinitionId = await this.getInternshipWorkflowDefinitionId(
        requestType.id,
        requestType.workflowDefinitionId,
      );

      const studentProfile = await this.prisma.userProfile.findUnique({
        where: { userId },
        select: { facultyId: true, departmentId: true, unitId: true },
      });

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
            facultyId: studentProfile?.facultyId ?? null,
            departmentId: studentProfile?.departmentId ?? null,
            unitId: studentProfile?.unitId ?? null,
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

        if (workflowDefinitionId) {
          const workflowStatus = await this.workflowEngine.bootstrapInstance(
            tx,
            req.id,
            workflowDefinitionId,
          );

          if (workflowStatus && workflowStatus !== RequestStatus.SUBMITTED) {
            await tx.request.update({
              where: { id: req.id },
              data: { status: workflowStatus },
            });

            await tx.requestStatusHistory.create({
              data: {
                requestId: req.id,
                oldStatus: RequestStatus.SUBMITTED,
                newStatus: workflowStatus,
                changedByUserId: userId,
                changeReason: 'Workflow moved to Advisor Review.',
              },
            });
          }
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

      if (data.attachmentFileIds?.length) {
        for (const fileId of data.attachmentFileIds) {
          const fileExists = await this.prisma.file.findUnique({ where: { id: fileId } });
          if (fileExists) {
            await this.prisma.fileLink.create({
              data: {
                fileId,
                entityType: 'Request',
                entityId: newRequest.id,
                relationType: 'ATTACHMENT',
                requestId: newRequest.id,
              },
            });
          }
        }
      }

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

    if (reqType.key === 'IT_SUPPORT') {
      throw new BadRequestException(
        'Students cannot create IT tickets. IT tickets are only available for faculty and eligible staff.',
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
      'attachmentFileIds',
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
      objectPath: string;
    }> = [];

    if (files && files.length > 0) {
      for (const file of files) {
        assertSafeUpload(file);
        const objectPath = buildStorageObjectKey(userId, file.originalname);
        const { error: uploadError } = await this.getSupabaseClient().storage
          .from('campusops-files')
          .upload(objectPath, file.buffer, { contentType: file.mimetype });

        if (uploadError)
          throw new InternalServerErrorException(
            `Supabase Error: ${uploadError.message}`,
          );

        uploadedFilesMeta.push({
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          objectPath,
        });
      }
    }

    const newRequest = await this.prisma.$transaction(async (tx) => {
      const initialStatus = 'SUBMITTED';
      const req = await tx.request.create({
        data: {
          requestNo,
          title: data.title,
          description: finalDescription,
          requestTypeId: reqType.id,
          requesterUserId: userId,
          currentAssigneeUserId: assignedUserId,
          status: initialStatus,
          submittedAt: new Date(),
          priority: data.priority || 'MEDIUM',
          dynamicData: dynamicAnswers,
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId: req.id,
          oldStatus: null,
          newStatus: initialStatus,
          changedByUserId: userId,
          changeReason: 'Request submitted by student.',
        },
      });

      if (!reqType.workflowDefinitionId && assignedUserId) {
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
            storagePath: meta.objectPath,
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

        // ── RabbitMQ: attachment.process ────────────────────────────────────
        this.mq.publish({
          event: RoutingKeys.ATTACHMENT_PROCESS,
          occurredAt: new Date().toISOString(),
          attachmentId: savedFile.id,
          requestId: req.id,
          storageKey: meta.objectPath,
          mimeType: meta.mimeType,
        } as any);
      }

      if (Array.isArray(data.attachmentFileIds) && data.attachmentFileIds.length > 0) {
        for (const fileId of data.attachmentFileIds as string[]) {
          const fileExists = await tx.file.findUnique({ where: { id: fileId } });
          if (fileExists) {
            await tx.fileLink.create({
              data: {
                fileId,
                entityType: 'Request',
                entityId: req.id,
                relationType: 'ATTACHMENT',
                requestId: req.id,
              },
            });
          }
        }
      }

      if (!reqType.workflowDefinitionId && assignedUserId) {
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

      if (reqType.workflowDefinitionId) {
        const workflowStatus = await this.workflowEngine.bootstrapInstance(
          tx,
          req.id,
          reqType.workflowDefinitionId,
        );

        if (workflowStatus && workflowStatus !== initialStatus) {
          await tx.request.update({
            where: { id: req.id },
            data: { status: workflowStatus },
          });

          await tx.requestStatusHistory.create({
            data: {
              requestId: req.id,
              oldStatus: initialStatus,
              newStatus: workflowStatus,
              changedByUserId: userId,
              changeReason: 'Workflow started.',
            },
          });
        }
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
      include: { requestType: true, workflowInstance: { select: { id: true } } },
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
            await this.getSupabaseClient().storage
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
      objectPath: string;
    }> = [];

    if (files && files.length > 0) {
      for (const file of files) {
        assertSafeUpload(file);
        const objectPath = buildStorageObjectKey(userId, file.originalname);
        const { error: uploadError } = await this.getSupabaseClient().storage
          .from('campusops-files')
          .upload(objectPath, file.buffer, { contentType: file.mimetype });

        if (uploadError)
          throw new InternalServerErrorException(
            `Supabase Error: ${uploadError.message}`,
          );

        uploadedFilesMeta.push({
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          objectPath,
        });
      }
    }

    const updatedRequest = await this.prisma.$transaction(async (tx) => {
      const typedUpdate = await this.applyTypedRequestUpdate(
        tx,
        userId,
        requestId,
        existingRequest.requestType.key,
        data,
        existingRequest,
      );

      const requestUpdateData: Prisma.RequestUpdateInput = {
        title: typedUpdate.title ?? existingRequest.title,
        description:
          typedUpdate.description !== undefined
            ? typedUpdate.description
            : existingRequest.description,
        priority: typedUpdate.priority ?? existingRequest.priority,
      };

      if (typedUpdate.dynamicData !== undefined && typedUpdate.dynamicData !== null) {
        requestUpdateData.dynamicData =
          typedUpdate.dynamicData as Prisma.InputJsonValue;
      } else if (
        typedUpdate.dynamicData === undefined &&
        existingRequest.dynamicData !== null &&
        existingRequest.dynamicData !== undefined
      ) {
        requestUpdateData.dynamicData =
          existingRequest.dynamicData as Prisma.InputJsonValue;
      }

      const req = await tx.request.update({
        where: { id: requestId },
        data: requestUpdateData,
      });

      for (const meta of uploadedFilesMeta) {
        const savedFile = await tx.file.create({
          data: {
            storageProvider: 'SUPABASE',
            bucketName: 'campusops-files',
            storagePath: meta.objectPath,
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

      if (!existingRequest.workflowInstance) {
        const revisionAction = await tx.approvalAction.findFirst({
          where: { requestId: req.id, actionType: 'REQUEST_REVISION' },
          orderBy: { createdAt: 'desc' },
        });
        if (revisionAction?.actionByUserId) {
          const prevAssignment = await tx.requestAssignment.findFirst({
            where: { requestId: req.id, assignedToUserId: revisionAction.actionByUserId },
            orderBy: { assignedAt: 'desc' },
          });
          if (prevAssignment) {
            await tx.requestAssignment.update({
              where: { id: prevAssignment.id },
              data: { isActive: true, unassignedAt: null },
            });
          } else {
            await tx.requestAssignment.create({
              data: {
                requestId: req.id,
                assignedToUserId: revisionAction.actionByUserId,
                assignedByUserId: userId,
                assignmentNote: 'Resubmitted after revision.',
              },
            });
          }
          await tx.request.update({
            where: { id: req.id },
            data: { currentAssigneeUserId: revisionAction.actionByUserId },
          });
          await tx.notification.create({
            data: {
              userId: revisionAction.actionByUserId,
              requestId: req.id,
              type: 'IN_APP',
              title: '🔄 Request Resubmitted',
              message: `The student has revised and resubmitted the ${existingRequest.requestType?.name ?? 'request'} request. It requires your review again.`,
              actionUrl: `/faculty/approvals?id=${req.id}`,
            },
          });
        }
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

    await this.workflowEngine.processAction(
      userId,
      ['STUDENT'],
      updatedRequest.id,
      {
        action: 'submit',
        comment: 'Student updated details and resubmitted the request.',
      },
    );

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
          select: {
            id: true,
            commentText: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                profile: { select: { fullName: true } },
                primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
              },
            },
          },
        },
        approvalActions: {
          select: {
            id: true,
            actionType: true,
            decisionNote: true,
            createdAt: true,
            actionBy: {
              select: {
                id: true,
                email: true,
                profile: { select: { fullName: true } },
                primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
              },
            },
            workflowInstanceStep: {
              select: { workflowStep: { select: { id: true, stepKey: true, stepName: true } } },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        statusHistory: { orderBy: { changedAt: 'desc' } },
        workflowInstance: {
          select: {
            id: true,
            status: true,
            currentStepId: true,
            currentStep: { select: { id: true, stepName: true, stepKey: true } },
            workflowDefinition: {
              select: {
                name: true,
                steps: {
                  select: {
                    id: true,
                    stepKey: true,
                    stepName: true,
                    stepType: true,
                    stepOrder: true,
                    slaHours: true,
                    configJson: true,
                    assignedRole: { select: { name: true } },
                    assignedUnit: { select: { id: true, name: true } },
                    assignedUser: {
                      select: {
                        id: true,
                        email: true,
                        profile: { select: { fullName: true } },
                        primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
                      },
                    },
                  },
                  orderBy: { stepOrder: 'asc' },
                },
              },
            },
            instanceSteps: {
              select: {
                id: true,
                workflowStepId: true,
                status: true,
                actionTaken: true,
                actionNote: true,
                isOverdue: true,
                startedAt: true,
                completedAt: true,
                dueAt: true,
                assignedTo: {
                  select: {
                    id: true,
                    email: true,
                    profile: { select: { fullName: true } },
                    primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
                  },
                },
                actionBy: {
                  select: {
                    id: true,
                    email: true,
                    profile: { select: { fullName: true } },
                    primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        documentRequest: true,
        roomReservationRequest: {
          include: {
            resource: {
              select: {
                id: true,
                name: true,
                resourceType: true,
                locationText: true,
                capacity: true,
              },
            },
          },
        },
        appointmentRequest: {
          include: {
            targetUser: {
              select: {
                id: true,
                email: true,
                profile: { select: { fullName: true } },
                primaryRoles: { select: { role: { select: { name: true } } }, take: 1 },
              },
            },
          },
        },
        procurementRequest: true,
        accessRequest: true,
        eventRequest: true,
        equipmentRequest: {
          include: {
            labResource: {
              select: {
                id: true,
                name: true,
                resourceType: true,
                locationText: true,
              },
            },
          },
        },
        internshipRequest: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Talep bulunamadı veya erişim yetkiniz yok.');
    }

    const workflowInstance = request.workflowInstance;

    return {
      id: request.id,
      requestNo: request.requestNo,
      title: request.title,
      description: request.description,
      status: request.status,
      displayStatus: workflowInstance?.currentStep?.stepKey ?? request.status,
      currentStepName: workflowInstance?.currentStep?.stepName ?? null,
      priority: request.priority,
      type: request.requestType?.key || 'unknown',
      typeName: request.requestType?.name || 'Bilinmeyen Tür',
      formSchema: request.requestType?.formSchemaJson || null,

      dynamicData: request.dynamicData || {},
      formData: this.buildRequestFormData(request),
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
      approvalHistory: request.approvalActions.map((action) => ({
        id: action.id,
        actionType: action.actionType,
        decisionNote: action.decisionNote,
        createdAt: action.createdAt,
        actor: {
          id: action.actionBy.id,
          fullName: action.actionBy.profile?.fullName || action.actionBy.email,
          email: action.actionBy.email,
          role: action.actionBy.primaryRoles?.[0]?.role?.name ?? null,
        },
        workflowStep: action.workflowInstanceStep?.workflowStep
          ? {
              id: action.workflowInstanceStep.workflowStep.id,
              key: action.workflowInstanceStep.workflowStep.stepKey,
              name: action.workflowInstanceStep.workflowStep.stepName,
            }
          : null,
      })),
      attachments:
        (request as any).fileLinks
          ? await Promise.all(
              (request as any).fileLinks.map(async (fl: any) => ({
                id: fl.file?.id,
                name: fl.file?.originalFileName,
                size: fl.file?.fileSizeBytes
                  ? `${(fl.file.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`
                  : '0 MB',
                url: fl.file ? await this.filesService.createSignedUrl(fl.file) : null,
              })),
            )
          : [],
      comments:
        (request as any).comments?.map((c: any) => ({
          id: c.id,
          authorId: c.user?.id ?? null,
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
      workflow: buildWorkflowSummary(workflowInstance, request.status, {
        targetUser: deriveAppointmentTargetUser(request),
      }),
    };
  }

  // Öğrenci için Talep Türlerini (Request Types) getiren servis
  async getRequestTypes() {
    return this.prisma.requestType.findMany({
      where: {
        key: {
          in: [
            'ACCESS_REQUEST',
            'APPOINTMENT',
            'DOCUMENT_REQUEST',
            'EQUIPMENT',
            'EVENT_REQUEST',
            'INTERNSHIP_REQUEST',
            'PROCUREMENT_REQUEST',
            'ROOM_RESERVATION',
          ],
        },
      },
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
            workflowInstance: {
              include: {
                currentStep: { select: { stepKey: true, stepName: true } },
              },
            },
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
      displayStatus: r.request.workflowInstance?.currentStep?.stepKey ?? r.request.status,
      currentStepName: r.request.workflowInstance?.currentStep?.stepName ?? null,
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
            workflowInstance: {
              include: {
                currentStep: { select: { stepKey: true, stepName: true } },
              },
            },
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
      displayStatus: (r.request as any).workflowInstance?.currentStep?.stepKey ?? r.request.status,
      currentStepName: (r.request as any).workflowInstance?.currentStep?.stepName ?? null,
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
      attachments: await Promise.all(
        r.request.fileLinks.map((fl: any) =>
          this.filesService.buildAttachmentResponse(fl.file),
        ),
      ),
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

      return await Promise.all(files.map(async (file) => {
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
          url: await this.filesService.createSignedUrl(file),
          uploadedAt: formattedDate,
          relatedTo: file.links?.[0]?.request?.title || 'Personal Storage',
        };
      }));
    } catch (error) {
      console.error('getMyFiles Hatası:', error);
      throw new InternalServerErrorException(
        'Dosyalar getirilirken bir hata oluştu.',
      );
    }
  }

  async uploadGeneralFile(userId: string, file: Express.Multer.File) {
    assertSafeUpload(file);
    const usedStorage = await this.getTotalUsedStorage(userId);
    if (usedStorage + file.size > this.MAX_TOTAL_STORAGE) {
      throw new PayloadTooLargeException(
        `Storage full. Remaining: ${((this.MAX_TOTAL_STORAGE - usedStorage) / 1024 / 1024).toFixed(2)} MB`,
      );
    }

    const objectPath = buildStorageObjectKey(userId, file.originalname);

    const UPLOAD_TIMEOUT_MS = 60_000;

    const uploadPromise = this.getSupabaseClient().storage
      .from('campusops-files')
      .upload(objectPath, file.buffer, { contentType: file.mimetype });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('UPLOAD_TIMEOUT')), UPLOAD_TIMEOUT_MS),
    );

    let result: Awaited<typeof uploadPromise>;
    try {
      result = await Promise.race([uploadPromise, timeoutPromise]);
    } catch (err: any) {
      throw new InternalServerErrorException(
        err?.message === 'UPLOAD_TIMEOUT'
          ? 'File upload timed out. Please try again.'
          : `Supabase Error: ${String(err?.message ?? err)}`,
      );
    }

    if (result.error) {
      throw new InternalServerErrorException(`Supabase Error: ${result.error.message}`);
    }

    const savedFile = await this.prisma.file.create({
      data: {
        storageProvider: 'SUPABASE',
        bucketName: 'campusops-files',
        storagePath: objectPath,
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
      const objectPath = this.filesService.extractObjectPath(file.storagePath);
      if (objectPath) {
        await this.getSupabaseClient().storage
          .from('campusops-files')
          .remove([objectPath]);
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
      where: {
        userId: userId,
        AND: [
          {
            OR: [
              { requestId: null },
              { request: { requesterUserId: userId } },
            ],
          },
          {
            OR: [
              { actionUrl: null },
              { actionUrl: { startsWith: '/student' } },
            ],
          },
        ],
        NOT: [
          {
            title: {
              contains: 'Document Request Submitted',
              mode: 'insensitive',
            },
          },
          {
            title: {
              contains: 'Reservation Request Submitted',
              mode: 'insensitive',
            },
          },
        ],
      },
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
