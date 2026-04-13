/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { PriorityLevel, RequestStatus } from '@prisma/client';
import { CreateRequestDto } from './dto/create-request.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { WorkflowEngineService } from '../workflow/workflow-engine.service';
import { SlaService } from '../workflow/sla.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { FilesService } from '../files/files.service';
import {
  CacheKeys,
  CacheTtls,
  getPortalFromRoles,
} from '../infrastructure/cache/cache-keys';

const OPEN_STATUSES: RequestStatus[] = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL'];
const INTERNAL_ROLES = ['STAFF', 'FACULTY', 'ADMIN'];

function makeRequestNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `REQ-${ymd}-${rand}`;
}

const requesterInclude = {
  id: true,
  email: true,
  profile: { select: { fullName: true, firstName: true, studentNumber: true, title: true } },
} as const;

const assigneeInclude = {
  id: true,
  email: true,
  profile: { select: { fullName: true, title: true } },
} as const;

function deriveWorkflowStepStatus(params: {
  instanceStep: any;
  isCurrent: boolean;
  requestStatus: RequestStatus;
}) {
  const { instanceStep, isCurrent, requestStatus } = params;

  if (instanceStep?.isOverdue) return 'warning';
  if (isCurrent && requestStatus === RequestStatus.REJECTED) return 'failed';
  if (isCurrent && requestStatus === RequestStatus.REVISION_REQUESTED) {
    return 'warning';
  }
  if (isCurrent) return 'active';
  if (instanceStep?.status === 'COMPLETED') return 'completed';
  if (instanceStep?.status === 'FAILED') return 'failed';
  return 'pending';
}

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private workflowEngine: WorkflowEngineService,
    private slaService: SlaService,
    private cacheService: CacheService,
    private filesService: FilesService,
  ) {}

  private assertRequestAccess(req: any, userId: string, roles: string[]) {
    const isAdmin = roles.includes('ADMIN');
    const isStudent = roles.includes('STUDENT') && !isAdmin;

    if (isAdmin) return;

    const isOwner = req.requesterUserId === userId;
    const isAssigned =
      req.currentAssigneeUserId === userId ||
      (req.assignments ?? []).some(
        (assignment: any) =>
          assignment.assignedToUserId === userId && assignment.isActive !== false,
      );
    const isWatcher = (req.watchers ?? []).some((w: any) => w.userId === userId);

    if (isOwner || isAssigned || isWatcher) return;

    if (isStudent || !OPEN_STATUSES.includes(req.status)) {
      throw new ForbiddenException('Access denied.');
    }
  }

  private canManageWatcher(targetUserId: string, actorUserId: string, roles: string[]) {
    if (targetUserId === actorUserId) return true;
    return roles.some((role) => INTERNAL_ROLES.includes(role));
  }

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateRequestDto) {
    const reqType = await this.prisma.requestType.findUnique({ where: { id: dto.requestTypeId } });
    if (!reqType) throw new NotFoundException('Request type not found.');
    if (!reqType.isActive) throw new ForbiddenException('This request type is inactive.');

    let requestNo = makeRequestNo();
    while (await this.prisma.request.findUnique({ where: { requestNo } })) {
      requestNo = makeRequestNo();
    }

    const created = await this.prisma.$transaction(async (tx) => {
      // Determine initial status: bootstrap workflow if request type has one
      let initialStatus = RequestStatus.SUBMITTED;

      const req = await tx.request.create({
        data: {
          requestNo,
          requestTypeId: dto.requestTypeId,
          requesterUserId: userId,
          title: dto.title,
          description: dto.description ?? null,
          priority: dto.priority ?? PriorityLevel.MEDIUM,
          status: initialStatus,
          submittedAt: new Date(),
          currentAssigneeUserId: dto.currentAssigneeUserId ?? null,
          facultyId: dto.facultyId ?? null,
          departmentId: dto.departmentId ?? null,
          unitId: dto.unitId ?? null,
          dynamicData: (dto.dynamicData as any) ?? undefined,
        },
        include: {
          requestType: { select: { id: true, key: true, name: true, category: true, workflowDefinitionId: true } },
          requester: { select: requesterInclude },
        },
      });

      await tx.requestStatusHistory.create({
        data: {
          requestId: req.id,
          oldStatus: null,
          newStatus: initialStatus,
          changedByUserId: userId,
          changeReason: 'Request submitted.',
        },
      });

      await this.slaService.startRequestSla(tx, req.id);

      // Bootstrap workflow if request type has a workflow definition
      const wfDefId = (req.requestType as any).workflowDefinitionId as string | null;
      if (wfDefId) {
        const wfStatus = await this.workflowEngine.bootstrapInstance(tx, req.id, wfDefId);
        if (wfStatus && wfStatus !== initialStatus) {
          await tx.request.update({ where: { id: req.id }, data: { status: wfStatus } });
          await tx.requestStatusHistory.create({
            data: {
              requestId: req.id,
              oldStatus: initialStatus,
              newStatus: wfStatus,
              changedByUserId: userId,
              changeReason: 'Workflow started.',
            },
          });
        }
      }

      return req;
    });

    await Promise.all([
      this.cacheService.bumpVersion(CacheKeys.version('admin:requests:list')),
      this.cacheService.bumpVersion(
        CacheKeys.version('admin:dashboard:summary'),
      ),
    ]);

    return created;
  }

  // ─── MY REQUESTS ──────────────────────────────────────────────────────────

  async findMy(userId: string, type?: string, status?: string) {
    const requests = await this.prisma.request.findMany({
      where: {
        requesterUserId: userId,
        ...(type ? { requestType: { key: type } } : {}),
        ...(status ? { status: status.toUpperCase() as RequestStatus } : {}),
      },
      include: {
        requestType: { select: { id: true, key: true, name: true, category: true } },
        currentAssignee: { select: assigneeInclude },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r: any) => this.toListItem(r));
  }

  // ─── INBOX ────────────────────────────────────────────────────────────────

  async findInbox(userId: string, roles: string[]) {
    const isAdmin = roles.includes('ADMIN');
    const isStaff = roles.includes('STAFF');
    const isFaculty = roles.includes('FACULTY');

    if (!isAdmin && !isStaff && !isFaculty) return [];

    const where = isAdmin
      ? { status: { in: OPEN_STATUSES } }
      : {
          status: { in: OPEN_STATUSES },
          OR: [
            { currentAssigneeUserId: userId },
            { assignments: { some: { assignedToUserId: userId, isActive: true } } },
            { currentAssigneeUserId: null as string | null },
          ],
        };

    const requests = await this.prisma.request.findMany({
      where,
      include: {
        requestType: { select: { id: true, key: true, name: true, category: true } },
        requester: { select: requesterInclude },
        currentAssignee: { select: assigneeInclude },
        assignments: {
          where: { isActive: true },
          select: { assignedToUserId: true },
        },
        _count: { select: { comments: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 100,
    });

    return requests.map((r: any) => this.toListItem(r, userId));
  }

  // ─── DETAIL ───────────────────────────────────────────────────────────────

  async findById(userId: string, roles: string[], requestId: string) {
    const portal = getPortalFromRoles(roles);
    const version = await this.cacheService.getVersion(
      CacheKeys.version(`request:detail:${requestId}`),
    );
    const cacheKey = CacheKeys.requestDetail(portal, requestId, userId, version);

    return this.cacheService.getOrSet(cacheKey, CacheTtls.medium, async () => {
      const canSeeInternal = roles.some((r) => INTERNAL_ROLES.includes(r));

      const req: any = await this.prisma.request.findUnique({
        where: { id: requestId },
        include: {
          requestType: true,
          requester: {
            include: {
              profile: { include: { faculty: true, department: true } },
            },
          },
          currentAssignee: { select: assigneeInclude },
          statusHistory: { orderBy: { changedAt: 'asc' } },
          comments: {
            where: canSeeInternal ? {} : { isInternal: false },
            include: {
              user: { select: requesterInclude },
              replies: {
                where: canSeeInternal ? {} : { isInternal: false },
                include: { user: { select: requesterInclude } },
                orderBy: { createdAt: 'asc' },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
          watchers: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  profile: { select: { fullName: true } },
                },
              },
            },
          },
          assignments: {
            include: {
              assignedTo: { select: assigneeInclude },
              assignedBy: { select: assigneeInclude },
            },
            orderBy: { assignedAt: 'desc' },
          },
          approvalActions: {
            include: {
              actionBy: { select: requesterInclude },
              workflowInstanceStep: {
                include: { workflowStep: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          workflowInstance: {
            include: {
              currentStep: true,
              workflowDefinition: {
                include: { steps: { orderBy: { stepOrder: 'asc' } } },
              },
              instanceSteps: { orderBy: { createdAt: 'asc' } },
            },
          },
          fileLinks: {
            include: {
              file: {
                select: {
                  id: true,
                  originalFileName: true,
                  fileSizeBytes: true,
                  mimeType: true,
                  bucketName: true,
                  storagePath: true,
                },
              },
            },
          },
          _count: { select: { comments: true } },
        },
      });

      if (!req) throw new NotFoundException('Request not found.');

      this.assertRequestAccess(req, userId, roles);

      const attachments = await Promise.all(
        req.fileLinks.map((fl: any) => this.filesService.buildAttachmentResponse(fl.file)),
      );

      return {
      request: {
        id: req.id,
        requestNo: req.requestNo,
        title: req.title,
        description: req.description,
        status: req.status,
        priority: req.priority,
        createdAt: req.createdAt,
        submittedAt: req.submittedAt,
        dueAt: req.dueAt,
        dynamicData: req.dynamicData,
        requestType: req.requestType,
        requester: {
          id: req.requester.id,
          email: req.requester.email,
          fullName: req.requester.profile?.fullName ?? req.requester.email,
          studentNumber: req.requester.profile?.studentNumber ?? null,
          faculty: req.requester.profile?.faculty?.name ?? null,
          department: req.requester.profile?.department?.name ?? null,
        },
        currentAssignee: req.currentAssignee
          ? {
              id: req.currentAssignee.id,
              email: req.currentAssignee.email,
              fullName: req.currentAssignee.profile?.fullName ?? req.currentAssignee.email,
            }
          : null,
      },
      statusHistory: req.statusHistory,
      comments: req.comments.map((c: any) => ({
        id: c.id,
        commentText: c.commentText,
        isInternal: c.isInternal,
        parentCommentId: c.parentCommentId,
        createdAt: c.createdAt,
        author: {
          id: c.user.id,
          fullName: c.user.profile?.fullName ?? c.user.email,
        },
        replies: (c.replies ?? []).map((r: any) => ({
          id: r.id,
          commentText: r.commentText,
          isInternal: r.isInternal,
          createdAt: r.createdAt,
          author: {
            id: r.user.id,
            fullName: r.user.profile?.fullName ?? r.user.email,
          },
        })),
      })),
      watchers: req.watchers.map((w: any) => ({
        userId: w.userId,
        fullName: w.user?.profile?.fullName ?? w.user?.email ?? '',
      })),
      assignments: req.assignments.map((assignment: any) => ({
        id: assignment.id,
        assignedAt: assignment.assignedAt,
        unassignedAt: assignment.unassignedAt,
        isActive: assignment.isActive,
        note: assignment.assignmentNote,
        assignedTo: assignment.assignedTo
          ? {
              id: assignment.assignedTo.id,
              email: assignment.assignedTo.email,
              fullName:
                assignment.assignedTo.profile?.fullName ??
                assignment.assignedTo.email,
            }
          : null,
        assignedBy: assignment.assignedBy
          ? {
              id: assignment.assignedBy.id,
              email: assignment.assignedBy.email,
              fullName:
                assignment.assignedBy.profile?.fullName ??
                assignment.assignedBy.email,
            }
          : null,
      })),
      approvalHistory: req.approvalActions.map((action: any) => ({
        id: action.id,
        actionType: action.actionType,
        decisionNote: action.decisionNote,
        createdAt: action.createdAt,
        actor: {
          id: action.actionBy.id,
          fullName: action.actionBy.profile?.fullName ?? action.actionBy.email,
        },
        workflowStep: action.workflowInstanceStep?.workflowStep
          ? {
              id: action.workflowInstanceStep.workflowStep.id,
              key: action.workflowInstanceStep.workflowStep.stepKey,
              name: action.workflowInstanceStep.workflowStep.stepName,
            }
          : null,
      })),
      workflow: req.workflowInstance
        ? {
            status: req.workflowInstance.status,
            currentStep: req.workflowInstance.currentStep?.stepName ?? null,
            workflowName: req.workflowInstance.workflowDefinition?.name ?? null,
            steps:
              req.workflowInstance.workflowDefinition?.steps?.map((step: any) => {
                const instanceStep = req.workflowInstance.instanceSteps.find(
                  (item: any) => item.workflowStepId === step.id,
                );
                return {
                  id: step.id,
                  label: step.stepName,
                  status: deriveWorkflowStepStatus({
                    instanceStep,
                    isCurrent: step.id === req.workflowInstance.currentStepId,
                    requestStatus: req.status,
                  }),
                  dueAt: instanceStep?.dueAt ?? null,
                  isOverdue: instanceStep?.isOverdue ?? false,
                };
              }) ?? [],
          }
        : null,
      attachments,
      };
    });
  }

  // ─── ACTIONS ──────────────────────────────────────────────────────────────

  async processAction(
    userId: string,
    roles: string[],
    requestId: string,
    dto: import('../workflow/dto/process-action.dto').ProcessActionDto,
  ) {
    const result = await this.workflowEngine.processAction(
      userId,
      roles,
      requestId,
      dto,
    );

    await Promise.all([
      this.cacheService.bumpVersion(
        CacheKeys.version(`request:detail:${requestId}`),
      ),
      this.cacheService.bumpVersion(CacheKeys.version('admin:requests:list')),
      this.cacheService.bumpVersion(
        CacheKeys.version('admin:dashboard:summary'),
      ),
      this.cacheService.bumpVersion(CacheKeys.version('faculty:approvals:list')),
      this.cacheService.bumpVersion(CacheKeys.version('staff:tickets:list')),
    ]);

    return result;
  }

  // ─── COMMENTS ─────────────────────────────────────────────────────────────

  async addComment(userId: string, roles: string[], requestId: string, dto: AddCommentDto) {
    const req = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: {
        watchers: true,
        assignments: { where: { isActive: true } },
      },
    });
    if (!req) throw new NotFoundException('Request not found.');
    this.assertRequestAccess(req, userId, roles);

    const canSeeInternal = roles.some((r) => INTERNAL_ROLES.includes(r));
    const isInternal = dto.isInternal === true && canSeeInternal;

    const comment: any = await this.prisma.requestComment.create({
      data: {
        requestId,
        userId,
        commentText: dto.commentText,
        isInternal,
        parentCommentId: dto.parentCommentId ?? null,
      },
      include: { user: { select: requesterInclude } },
    });

    const isFirstResponseActor = roles.some((role) =>
      INTERNAL_ROLES.includes(role),
    );

    if (isFirstResponseActor) {
      await this.prisma.$transaction(async (tx) => {
        await this.slaService.markFirstResponse(tx, requestId);
      });
    }

    const response = {
      id: comment.id,
      commentText: comment.commentText,
      isInternal: comment.isInternal,
      parentCommentId: comment.parentCommentId,
      createdAt: comment.createdAt,
      author: {
        id: comment.user.id,
        fullName: comment.user.profile?.fullName ?? comment.user.email,
      },
    };

    await this.cacheService.bumpVersion(
      CacheKeys.version(`request:detail:${requestId}`),
    );

    return response;
  }

  async getComments(userId: string, roles: string[], requestId: string) {
    const req = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: {
        watchers: true,
        assignments: { where: { isActive: true } },
      },
    });
    if (!req) throw new NotFoundException('Request not found.');
    this.assertRequestAccess(req, userId, roles);

    const canSeeInternal = roles.some((r) => INTERNAL_ROLES.includes(r));
    return this.prisma.requestComment.findMany({
      where: {
        requestId,
        parentCommentId: null,
        ...(canSeeInternal ? {} : { isInternal: false }),
      },
      include: {
        user: { select: requesterInclude },
        replies: {
          where: canSeeInternal ? {} : { isInternal: false },
          include: { user: { select: requesterInclude } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── WATCHERS ─────────────────────────────────────────────────────────────

  async addWatcher(requestId: string, watchUserId: string, actorUserId: string, roles: string[]) {
    const req = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: {
        watchers: true,
        assignments: { where: { isActive: true } },
      },
    });
    if (!req) throw new NotFoundException('Request not found.');
    this.assertRequestAccess(req, actorUserId, roles);
    if (!this.canManageWatcher(watchUserId, actorUserId, roles)) {
      throw new ForbiddenException('You cannot manage watchers for another user.');
    }
    try {
      const watcher = await this.prisma.requestWatcher.create({
        data: { requestId, userId: watchUserId },
      });
      await this.cacheService.bumpVersion(
        CacheKeys.version(`request:detail:${requestId}`),
      );
      return watcher;
    } catch {
      throw new ConflictException('User is already watching this request.');
    }
  }

  async removeWatcher(
    requestId: string,
    watchUserId: string,
    actorUserId: string,
    roles: string[],
  ) {
    const req = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: {
        watchers: true,
        assignments: { where: { isActive: true } },
      },
    });
    if (!req) throw new NotFoundException('Request not found.');
    this.assertRequestAccess(req, actorUserId, roles);
    if (!this.canManageWatcher(watchUserId, actorUserId, roles)) {
      throw new ForbiddenException('You cannot manage watchers for another user.');
    }

    const w = await this.prisma.requestWatcher.findUnique({
      where: { requestId_userId: { requestId, userId: watchUserId } },
    });
    if (!w) throw new NotFoundException('Watcher not found.');
    await this.prisma.requestWatcher.delete({
      where: { requestId_userId: { requestId, userId: watchUserId } },
    });
    await this.cacheService.bumpVersion(
      CacheKeys.version(`request:detail:${requestId}`),
    );
    return { message: 'Watcher removed.' };
  }

  // ─── PRIVATE ──────────────────────────────────────────────────────────────

  private toListItem(r: any, currentUserId?: string) {
    const assignedToMe =
      !!currentUserId &&
      (r.currentAssignee?.id === currentUserId ||
        (r.assignments ?? []).some(
          (assignment: any) => assignment.assignedToUserId === currentUserId,
        ));

    return {
      id: r.id,
      requestNo: r.requestNo,
      title: r.title,
      status: r.status,
      priority: r.priority,
      createdAt: r.createdAt,
      submittedAt: r.submittedAt,
      dueAt: r.dueAt,
      requestType: r.requestType,
      requester: r.requester
        ? { id: r.requester.id, fullName: r.requester.profile?.fullName ?? r.requester.email }
        : null,
      currentAssignee: r.currentAssignee
        ? { id: r.currentAssignee.id, fullName: r.currentAssignee.profile?.fullName ?? r.currentAssignee.email }
        : null,
      assignedToMe,
      commentCount: r._count?.comments ?? 0,
    };
  }
}
