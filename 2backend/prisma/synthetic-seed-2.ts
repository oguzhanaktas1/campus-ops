import {
  PrismaClient,
  RequestStatus,
  PriorityLevel,
  WorkflowActionType,
  TicketStatus,
  AppointmentStatus,
  ReservationStatus,
  AuditActionType,
  NotificationType,
  NotificationStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

// ── Utilities ──────────────────────────────────────────────────────────────
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const maybe = (prob = 0.5) => Math.random() < prob;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const addHours = (d: Date, h: number) =>
  new Date(d.getTime() + h * 3_600_000);
const addDays = (d: Date, n: number) =>
  new Date(d.getTime() + n * 86_400_000);
const randDate = (start: Date, end: Date) =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

// Start at 200000 to avoid collision with synthetic-seed.ts (starts at 90000)
let _counter = 200000;
const nextNo = (prefix: string) =>
  `${prefix}-${String(++_counter).padStart(6, '0')}`;
const requestStatusIn = (
  status: RequestStatus,
  statuses: readonly RequestStatus[],
) => statuses.includes(status);

// ── Content Pools ──────────────────────────────────────────────────────────

const IT_TITLES_2 = [
  'Laptop fan making loud noise',
  'Blue screen of death on workstation',
  'Cannot access campus email from home',
  'VPN authentication failing repeatedly',
  'Missing network drive after Windows update',
  'Zoom meeting echo and feedback issue',
  'USB ports not working on desktop',
  'Scanner not detected by system',
  'Outlook calendar not syncing',
  'Cannot print from new laptop',
  'Operating system update failure',
  'Two-factor authentication issue',
  'Wireless keyboard disconnecting randomly',
  'Cannot access SharePoint documents',
  'Screen flickering on external monitor',
  'Application freezing when opening large files',
  'IP address conflict on network',
  'Antivirus blocking legitimate software',
  'Campus portal login loop',
  'Hard drive making clicking sounds',
  'Remote desktop black screen',
  'Google Meet microphone not detected',
  'Power button unresponsive on laptop',
  'Cannot install required software - permissions denied',
  'Network switch port failure in Lab B',
];
const IT_CATS_2 = ['hardware', 'software', 'network', 'email', 'access', 'audio_video', 'printing'];
const IT_SYSTEMS_2 = [
  'Zoom', 'SharePoint', 'Campus LMS', 'ERP Portal', 'Library Catalog',
  'Student Email', 'VPN Client', 'Active Directory', 'Network Storage', 'Print Server',
];
const IT_CMT_USER_2 = [
  'This is blocking me from attending online classes.',
  'I submitted the required form, still waiting.',
  'The issue started after the last Windows update.',
  'I restarted the machine but the problem persists.',
  'This is the third time this month, please escalate.',
  'I need remote support as I cannot come to the office.',
  'Is there an ETA for the fix?',
  'My colleague has the same problem on a different machine.',
];
const IT_CMT_STAFF_2 = [
  'Ticket received, assigning to Level 2 support.',
  'Ran remote diagnostics, issue is on the driver side.',
  'Factory reset applied, please check functionality.',
  'Updated firmware, please confirm if resolved.',
  'Hardware replacement has been ordered.',
  'Escalating to network team for investigation.',
  'Issue reproduced in test environment, fix in progress.',
  'Temporary workaround sent to user email.',
  'Closing after user confirmation of resolution.',
  'Scheduled on-site visit for Thursday morning.',
];
const IT_CMT_INTERNAL_2 = [
  'Known issue with latest Windows patch - hot fix pending.',
  'Check BIOS version, may need update.',
  'Cable fault suspected, physical inspection needed.',
  'VLAN misconfiguration, routing team to review.',
];

const EQ_TITLES_2 = [
  'High-speed camera for lab experiments',
  'Drawing tablet for design department',
  'Portable PA system for outdoor event',
  'DSLR camera for student project',
  '3D printer filament roll - PLA',
  'Soldering station request for electronics lab',
  'Battery backup UPS for server rack',
  'Wireless presenter clicker',
  'Portable whiteboard for seminar',
  'Spectrum analyzer for RF lab',
  'Drone kit for engineering project',
  'External SSD for data backup',
];
const EQ_CMT_USER_2 = [
  'This is required for my final year project defense.',
  'Our department has been waiting for this for two weeks.',
  'I can pick it up anytime, just let me know.',
  'Do I need to sign a usage agreement?',
  'Is there an alternative model available?',
];
const EQ_CMT_STAFF_2 = [
  'Checking with warehouse, will update shortly.',
  'Item reserved, please come to storeroom B.',
  'Quantity only partially available.',
  'Procurement needed, expected delivery in 5 days.',
  'Usage log must be completed on return.',
  'Approved, item ready for pickup after 14:00.',
];

const DOC_TITLES_2 = [
  'Certificate of enrollment - bank application',
  'Transcript with GPA - graduate application',
  'Student certificate - driving license application',
  'Diploma replacement - original lost',
  'Official transcript - embassy notarization',
  'Graduation document - employer request',
  'Enrollment certificate in English',
  'Disciplinary clearance certificate',
];
const DOC_CMT_USER_2 = [
  'I need this document by the end of the week.',
  'Please include official university stamp.',
  'Can it be apostilled?',
  'I authorized proxy pickup, form attached.',
  'Embassy requires certified translation - is that possible?',
];
const DOC_CMT_STAFF_2 = [
  'Document prepared, you can collect from window 3.',
  'Processing will take 3 business days.',
  'You must come in person with your student ID.',
  'Digital copy also sent to your university email.',
  'Apostille service not available in-house, refer to notary.',
];

const COMPANIES_2 = [
  'Aselsan Defense Technologies', 'Tübitak Research Center', 'Roketsan Industries',
  'Turkcell Innovation Lab', 'Arçelik Smart Home', 'Havelsan Defense',
  'Netaş Telecommunications', 'Türk Telekom R&D', 'Vestel Technology',
  'BIM Integrated Systems', 'Migros Digital', 'Teknosa', 'Huawei Turkey',
  'STM Defense', 'Baykar Technologies', 'Ford Otosan', 'Tofaş Automotive',
  'Sabancı University TTO', 'Koç Innovation Center', 'ODTÜ Teknokent',
];
const SECTORS_2 = ['DEFENSE', 'TECHNOLOGY', 'AUTOMOTIVE', 'RETAIL', 'TELECOMMUNICATIONS', 'ENERGY', 'FINANCE'];
const INT_TITLES_2 = [
  'Defense industry internship application',
  'R&D internship - academic project extension',
  'Software engineering internship - summer',
  'Mechanical engineering co-op placement',
  'Data analyst internship application',
  'Embedded systems internship',
  'Marketing internship - digital focus',
];
const INT_CMT_STUDENT_2 = [
  'All required documents have been uploaded.',
  'Advisor confirmed eligibility via email.',
  'Company requires SGK registration before start date.',
  'Duration extended by one month with advisor approval.',
  'Online internship mode requested due to location.',
];
const INT_CMT_ADVISOR_2 = [
  'Student is eligible, forwarding to coordinator.',
  'Work plan document needs to be revised.',
  'Company accreditation is pending from registry.',
  'Approved, registration to be completed this week.',
];
const INT_CMT_COORD_2 = [
  'SGK registration will be initiated upon approval.',
  'Company visited for accreditation last semester.',
  'Duration complies with department regulations.',
  'Processing final approval, expect within 3 days.',
];

const ROOM_TITLES_2 = [
  'Seminar room for visiting professor lecture',
  'Conference hall - industry partnership meeting',
  'Classroom for make-up exam session',
  'Lab for certified training program',
  'Amphitheater reservation - orientation day',
  'Board room - faculty council meeting',
  'Outdoor area - graduation ceremony rehearsal',
  'Study hall - group thesis defense preparation',
];
const ROOM_PURPOSES_2 = [
  'Visiting professor lecture', 'Industry partnership meeting', 'Make-up exam',
  'Certified training', 'Orientation', 'Faculty council', 'Graduation rehearsal', 'Thesis defense',
];
const ROOM_CMT_USER_2 = [
  'We need tables arranged in a U-shape.',
  'Audio system and microphone required.',
  'Expected 80 attendees, please confirm capacity.',
  'Will we have Wi-Fi access during the event?',
];
const ROOM_CMT_STAFF_2 = [
  'Confirmed, caretaker will set up before your session.',
  'Technical team will arrive 30 minutes early.',
  'Room layout request forwarded to facilities.',
  'Wi-Fi credentials will be provided on the day.',
  'Capacity is 120, your request is within limits.',
];

const APPT_TITLES_2 = [
  'Consultation - capstone project direction',
  'Grade appeal discussion',
  'Research collaboration proposal',
  'Pre-graduation checklist review',
  'Scholarship recommendation letter request',
  'Academic performance recovery plan',
  'Master thesis chapter review',
];
const APPT_TOPICS_2 = [
  'Capstone project direction and scope',
  'Grade appeal for midterm exam',
  'Joint research paper collaboration',
  'Graduation checklist and missing credits',
  'Letter of recommendation for scholarship',
  'Recovery plan after academic probation',
  'First three chapters of master thesis',
];
const APPT_CMT_STUDENT_2 = [
  'I have prepared the documents for review.',
  'Can we meet earlier in the week?',
  'I will bring my laptop with the draft.',
  'Please let me know if I need to reschedule.',
];
const APPT_CMT_FACULTY_2 = [
  'Confirmed, please bring your study materials.',
  'I can meet between 10:00-12:00 on Wednesday.',
  'Appointment rescheduled, check your notifications.',
  'Meeting notes will be shared after the session.',
];

const ACCESS_TITLES_2 = [
  'Research lab access - night shift experiment',
  'ERP system read access for analysis project',
  'CCTV monitoring room access authorization',
  'Hazardous materials lab B-108 entry permit',
  'Server rack room access for maintenance',
  'Library archive room access request',
  'Chemistry lab fume hood access',
];
const ACCESS_CMT_USER_2 = [
  'Supervisor has verbally approved this request.',
  'The access is needed urgently for ongoing experiment.',
  'Previous access was revoked during audit, requesting reinstatement.',
  'This is a temporary need, maximum two weeks.',
];
const ACCESS_CMT_STAFF_2 = [
  'Access policy review required before activation.',
  'Supervisor written approval needed.',
  'Access granted for 30 days, renewable.',
  'Security training certificate must be uploaded first.',
  'Card system updated, access is now active.',
];

const PROC_TITLES_2 = [
  'Industrial IoT sensors for research project',
  'High-performance GPU workstation',
  'Server rack expansion - 2U blade',
  'Classroom furniture upgrade - ergonomic chairs',
  'Annual cloud license renewal - Microsoft 365',
  'Lab consumables - chemistry department',
  'Digital oscilloscope - electronics lab',
  'Video surveillance system upgrade',
];
const PROC_ITEMS_2 = [
  'IoT Sensor Array', 'GPU Workstation (RTX 4090)', '2U Server Blade',
  'Ergonomic Office Chair', 'Microsoft 365 License (50 seats)', 'Lab Chemicals Bundle',
  'Digital Oscilloscope', 'IP Camera (8-pack)', 'NAS Storage (48TB)',
];
const PROC_CMT_STAFF_2 = [
  'Three vendor quotes received, comparing now.',
  'Budget code verified with finance department.',
  'Tender process required above 50,000 TRY threshold.',
  'Technical specification sheet approved by department head.',
  'Order placed, delivery expected in 10 business days.',
  'Item arrived, serial numbers recorded in inventory.',
];

const EVENT_TITLES_2 = [
  'International Student Summit 2025',
  'Women in Engineering Panel',
  'Annual Research Symposium',
  'Startup Pitch Competition',
  'Cultural Heritage Festival',
  'AI Ethics Forum',
  'Campus Photography Contest',
  'Alumni Networking Night',
  'Green Campus Sustainability Fair',
  'Cybersecurity Awareness Week',
  'Mental Health Awareness Walk',
  'Tech Talks: Industry Meets Academia',
  'Language Exchange Meet-up',
  'Innovation & Design Showcase',
];
const EVENT_TYPES_2 = ['CONFERENCE', 'SEMINAR', 'WORKSHOP', 'CULTURAL', 'SPORTS', 'CAREER_FAIR', 'SOCIAL'];
const EVT_CMT_ORG_2 = [
  'Venue confirmed, catering also arranged.',
  'Social media promotion campaign launched.',
  'Sponsor logos have been updated on materials.',
  'Volunteer list finalized, 20 confirmed.',
  'Live stream setup requested from AV team.',
];
const EVT_CMT_COORD_2 = [
  'Security plan submitted to campus safety office.',
  'Dean approved event, budget confirmed.',
  'Parking area reserved for attendees.',
  'Post-event report template sent to organizer.',
  'Fire warden assignment completed.',
];

const NAMES_FIRST = [
  'James', 'Emma', 'Michael', 'Sophia', 'William', 'Olivia', 'Daniel', 'Emily',
  'Matthew', 'Sarah', 'David', 'Isabella', 'Andrew', 'Mia', 'Thomas', 'Charlotte',
  'Joseph', 'Amelia', 'Christopher', 'Laura', 'Alexander', 'Grace', 'Benjamin', 'Chloe',
  'Ethan', 'Zoe', 'Noah', 'Lily', 'Liam', 'Natalie',
];
const NAMES_LAST = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Wilson', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin',
  'Thompson', 'Moore', 'Young', 'Clark',
];

// ── Types ──────────────────────────────────────────────────────────────────

type WFStep = {
  id: string;
  stepKey: string;
  stepOrder: number;
  stepName: string;
  stepType: string;
};

type WFCtx = { definitionId: string; steps: WFStep[] };

type Scenario =
  | 'COMPLETED'
  | 'IN_REVIEW_EARLY'
  | 'IN_REVIEW_MID'
  | 'WAITING_APPROVAL'
  | 'REJECTED_EARLY'
  | 'REJECTED_LATE'
  | 'REVISION'
  | 'OVERDUE';

function scenarioToStatus(s: Scenario): RequestStatus {
  if (s === 'COMPLETED') return RequestStatus.COMPLETED;
  if (s === 'REJECTED_EARLY' || s === 'REJECTED_LATE') return RequestStatus.REJECTED;
  if (s === 'REVISION') return RequestStatus.REVISION_REQUESTED;
  if (s === 'WAITING_APPROVAL') return RequestStatus.WAITING_APPROVAL;
  if (s === 'OVERDUE') return RequestStatus.IN_REVIEW;
  return RequestStatus.IN_REVIEW;
}

function pickScenario(): Scenario {
  const r = Math.random();
  if (r < 0.25) return 'COMPLETED';
  if (r < 0.35) return 'IN_REVIEW_EARLY';
  if (r < 0.45) return 'IN_REVIEW_MID';
  if (r < 0.55) return 'WAITING_APPROVAL';
  if (r < 0.63) return 'REJECTED_EARLY';
  if (r < 0.71) return 'REJECTED_LATE';
  if (r < 0.80) return 'REVISION';
  return 'OVERDUE';
}

// ── Workflow helpers ───────────────────────────────────────────────────────

async function buildWFSteps(
  wfInstanceId: string,
  ctx: WFCtx,
  scenario: Scenario,
  baseTime: Date,
  actors: { id: string }[],
  requesterId: string,
): Promise<string | null> {
  const actionSteps = ctx.steps.filter(
    (s) => s.stepType !== 'START' && s.stepType !== 'END' && s.stepKey !== 'REVISION',
  );
  const approvedEnd = ctx.steps.find(
    (s) => s.stepType === 'END' && !s.stepKey.includes('REJECTED'),
  );
  const rejectedEnd = ctx.steps.find(
    (s) => s.stepType === 'END' && s.stepKey.includes('REJECTED'),
  );
  const revisionStep = ctx.steps.find((s) => s.stepKey === 'REVISION');
  const startStep = ctx.steps.find((s) => s.stepType === 'START');

  if (startStep) {
    await prisma.workflowInstanceStep.create({
      data: {
        workflowInstanceId: wfInstanceId,
        workflowStepId: startStep.id,
        assignedToUserId: requesterId,
        startedAt: baseTime,
        completedAt: addHours(baseTime, 0.1),
        status: 'COMPLETED',
        actionTaken: WorkflowActionType.SUBMIT,
        actionByUserId: requesterId,
        actionNote: 'Request submitted.',
        createdAt: baseTime,
        updatedAt: baseTime,
      },
    });
  }

  if (actors.length === 0) actors = [{ id: requesterId }];
  let currentStepId: string | null = null;
  let t = addHours(baseTime, rand(1, 4));

  const APPROVE_NOTES = [
    'Approved, requirements met.',
    'Reviewed and found compliant.',
    'Cleared at this stage.',
    'Approved by committee.',
    'No issues found, proceeding.',
  ];
  const REJECT_NOTES = [
    'Rejected: missing required documentation.',
    'Not eligible under current policy.',
    'Budget constraint — cannot approve.',
    'Duplicate request detected.',
    'Does not meet compliance standards.',
  ];
  const REVISION_NOTES = [
    'Please resubmit with updated supporting documents.',
    'Company contact information is incomplete.',
    'Incorrect form version submitted.',
    'Justification section needs elaboration.',
    'Supervisor signature missing.',
  ];

  async function completeStep(step: WFStep, action: WorkflowActionType, note: string) {
    const start = t;
    const end = addHours(start, rand(2, 48));
    const actor = pick(actors);
    await prisma.workflowInstanceStep.create({
      data: {
        workflowInstanceId: wfInstanceId,
        workflowStepId: step.id,
        assignedToUserId: actor.id,
        startedAt: start,
        completedAt: end,
        status: 'COMPLETED',
        actionTaken: action,
        actionByUserId: actor.id,
        actionNote: note,
        createdAt: start,
        updatedAt: end,
      },
    });
    t = end;
    return actor.id;
  }

  async function activeStep(step: WFStep) {
    const actor = pick(actors);
    await prisma.workflowInstanceStep.create({
      data: {
        workflowInstanceId: wfInstanceId,
        workflowStepId: step.id,
        assignedToUserId: actor.id,
        startedAt: t,
        status: 'IN_PROGRESS',
        createdAt: t,
        updatedAt: t,
      },
    });
    currentStepId = step.id;
  }

  if (scenario === 'COMPLETED') {
    for (const step of actionSteps) {
      await completeStep(step, WorkflowActionType.APPROVE, pick(APPROVE_NOTES));
    }
    if (approvedEnd) {
      await prisma.workflowInstanceStep.create({
        data: {
          workflowInstanceId: wfInstanceId,
          workflowStepId: approvedEnd.id,
          status: 'COMPLETED',
          startedAt: t,
          completedAt: t,
          createdAt: t,
          updatedAt: t,
        },
      });
      currentStepId = approvedEnd.id;
    }
  } else if (scenario === 'IN_REVIEW_EARLY' || scenario === 'OVERDUE') {
    if (actionSteps[0]) await activeStep(actionSteps[0]);
  } else if (scenario === 'IN_REVIEW_MID') {
    for (let i = 0; i < Math.min(1, actionSteps.length - 1); i++) {
      await completeStep(actionSteps[i], WorkflowActionType.APPROVE, pick(APPROVE_NOTES));
    }
    const active = actionSteps[1] ?? actionSteps[0];
    if (active) await activeStep(active);
  } else if (scenario === 'WAITING_APPROVAL') {
    for (let i = 0; i < actionSteps.length - 1; i++) {
      await completeStep(actionSteps[i], WorkflowActionType.APPROVE, pick(APPROVE_NOTES));
    }
    const last = actionSteps[actionSteps.length - 1];
    if (last) await activeStep(last);
  } else if (scenario === 'REJECTED_EARLY') {
    if (actionSteps[0]) {
      await completeStep(actionSteps[0], WorkflowActionType.REJECT, pick(REJECT_NOTES));
    }
    if (rejectedEnd) {
      await prisma.workflowInstanceStep.create({
        data: {
          workflowInstanceId: wfInstanceId,
          workflowStepId: rejectedEnd.id,
          status: 'COMPLETED',
          startedAt: t,
          completedAt: t,
          createdAt: t,
          updatedAt: t,
        },
      });
      currentStepId = rejectedEnd.id;
    }
  } else if (scenario === 'REJECTED_LATE') {
    for (let i = 0; i < actionSteps.length; i++) {
      const isLast = i === actionSteps.length - 1;
      await completeStep(
        actionSteps[i],
        isLast ? WorkflowActionType.REJECT : WorkflowActionType.APPROVE,
        isLast ? pick(REJECT_NOTES) : pick(APPROVE_NOTES),
      );
    }
    if (rejectedEnd) {
      await prisma.workflowInstanceStep.create({
        data: {
          workflowInstanceId: wfInstanceId,
          workflowStepId: rejectedEnd.id,
          status: 'COMPLETED',
          startedAt: t,
          completedAt: t,
          createdAt: t,
          updatedAt: t,
        },
      });
      currentStepId = rejectedEnd.id;
    }
  } else if (scenario === 'REVISION') {
    if (actionSteps[0]) {
      await completeStep(actionSteps[0], WorkflowActionType.REQUEST_REVISION, pick(REVISION_NOTES));
    }
    if (revisionStep) {
      await prisma.workflowInstanceStep.create({
        data: {
          workflowInstanceId: wfInstanceId,
          workflowStepId: revisionStep.id,
          assignedToUserId: requesterId,
          startedAt: t,
          status: 'IN_PROGRESS',
          createdAt: t,
          updatedAt: t,
        },
      });
      currentStepId = revisionStep.id;
    }
  }

  return currentStepId;
}

async function attachWF(
  requestId: string,
  ctx: WFCtx,
  scenario: Scenario,
  createdAt: Date,
  endedAt: Date | null,
  actors: { id: string }[],
  requesterId: string,
) {
  const wfStatus =
    scenario === 'COMPLETED' ? 'COMPLETED'
    : scenario === 'REJECTED_EARLY' || scenario === 'REJECTED_LATE' ? 'REJECTED'
    : 'IN_PROGRESS';

  const instance = await prisma.workflowInstance.create({
    data: {
      workflowDefinitionId: ctx.definitionId,
      requestId,
      status: wfStatus,
      startedAt: createdAt,
      endedAt,
      createdAt,
      updatedAt: createdAt,
    },
  });

  const currentStepId = await buildWFSteps(
    instance.id, ctx, scenario, createdAt, actors, requesterId,
  );

  await prisma.workflowInstance.update({
    where: { id: instance.id },
    data: { currentStepId },
  });

  await prisma.request.update({
    where: { id: requestId },
    data: { workflowInstanceId: instance.id },
  });
}

async function addComments(
  requestId: string,
  requesterId: string,
  staffIds: string[],
  userPool: string[],
  staffPool: string[],
  internalPool: string[],
  baseTime: Date,
  count = rand(3, 7),
) {
  let t = addHours(baseTime, rand(1, 8));
  let firstId: string | null = null;

  for (let i = 0; i < count; i++) {
    const isInternal = internalPool.length > 0 && maybe(0.12);
    const isStaff = maybe(0.5);
    const uid =
      isInternal || isStaff
        ? staffIds.length > 0 ? pick(staffIds) : requesterId
        : requesterId;
    const pool =
      isInternal ? internalPool : isStaff ? staffPool : userPool;
    const text = pool.length > 0 ? pick(pool) : pick(staffPool);
    t = addHours(t, rand(1, 36));

    const c = await prisma.requestComment.create({
      data: {
        requestId,
        userId: uid,
        commentText: text,
        isInternal,
        parentCommentId: i > 0 && firstId && maybe(0.3) ? firstId : null,
        createdAt: t,
        updatedAt: t,
      },
    });
    if (i === 0) firstId = c.id;
  }
}

async function addStatusHistory(
  requestId: string,
  actorId: string,
  scenario: Scenario,
  baseTime: Date,
) {
  type E = { old: RequestStatus | null; next: RequestStatus; note: string; delay: number };
  const entries: E[] = [
    { old: null, next: RequestStatus.SUBMITTED, note: 'Request submitted.', delay: 0.1 },
  ];

  if (scenario === 'COMPLETED') {
    entries.push(
      { old: RequestStatus.SUBMITTED, next: RequestStatus.IN_REVIEW, note: 'Taken into review.', delay: rand(1, 6) },
      { old: RequestStatus.IN_REVIEW, next: RequestStatus.APPROVED, note: 'Approved by reviewer.', delay: rand(24, 96) },
      { old: RequestStatus.APPROVED, next: RequestStatus.COMPLETED, note: 'Process completed.', delay: rand(48, 120) },
    );
  } else if (scenario === 'IN_REVIEW_EARLY' || scenario === 'OVERDUE') {
    entries.push(
      { old: RequestStatus.SUBMITTED, next: RequestStatus.IN_REVIEW, note: 'Taken into review.', delay: rand(1, 6) },
    );
  } else if (scenario === 'IN_REVIEW_MID') {
    entries.push(
      { old: RequestStatus.SUBMITTED, next: RequestStatus.IN_REVIEW, note: 'Taken into review.', delay: rand(1, 6) },
    );
  } else if (scenario === 'WAITING_APPROVAL') {
    entries.push(
      { old: RequestStatus.SUBMITTED, next: RequestStatus.IN_REVIEW, note: 'Taken into review.', delay: rand(1, 6) },
      { old: RequestStatus.IN_REVIEW, next: RequestStatus.WAITING_APPROVAL, note: 'Sent to upper management for approval.', delay: rand(12, 48) },
    );
  } else if (scenario === 'REJECTED_EARLY') {
    entries.push(
      { old: RequestStatus.SUBMITTED, next: RequestStatus.IN_REVIEW, note: 'Taken into review.', delay: rand(1, 6) },
      { old: RequestStatus.IN_REVIEW, next: RequestStatus.REJECTED, note: 'Rejected: criteria not met.', delay: rand(12, 48) },
    );
  } else if (scenario === 'REJECTED_LATE') {
    entries.push(
      { old: RequestStatus.SUBMITTED, next: RequestStatus.IN_REVIEW, note: 'Taken into review.', delay: rand(1, 6) },
      { old: RequestStatus.IN_REVIEW, next: RequestStatus.WAITING_APPROVAL, note: 'Escalated for final approval.', delay: rand(24, 72) },
      { old: RequestStatus.WAITING_APPROVAL, next: RequestStatus.REJECTED, note: 'Final stage rejection.', delay: rand(24, 72) },
    );
  } else if (scenario === 'REVISION') {
    entries.push(
      { old: RequestStatus.SUBMITTED, next: RequestStatus.IN_REVIEW, note: 'Taken into review.', delay: rand(1, 6) },
      { old: RequestStatus.IN_REVIEW, next: RequestStatus.REVISION_REQUESTED, note: 'Revision requested from applicant.', delay: rand(12, 36) },
    );
  }

  let cumulativeHours = 0;
  for (const e of entries) {
    cumulativeHours += e.delay;
    await prisma.requestStatusHistory.create({
      data: {
        requestId,
        oldStatus: e.old,
        newStatus: e.next,
        changedByUserId: actorId,
        changeReason: e.note,
        changedAt: addHours(baseTime, cumulativeHours),
      },
    });
  }
}

async function addNotif(
  userId: string,
  requestId: string,
  title: string,
  message: string,
  at: Date,
) {
  await prisma.notification.create({
    data: {
      userId,
      requestId,
      type: NotificationType.IN_APP,
      title,
      message,
      status: maybe(0.65) ? NotificationStatus.READ : NotificationStatus.DELIVERED,
      isRead: maybe(0.65),
      createdAt: at,
      updatedAt: at,
    },
  });
}

type SyntheticSlaPolicy = {
  id: string;
  requestTypeId: string | null;
  priority: PriorityLevel | null;
  firstResponseMinutes: number | null;
  resolutionMinutes: number | null;
};

async function addSlaEvents(
  requestId: string,
  policy: SyntheticSlaPolicy | null,
  createdAt: Date,
  completedAt: Date | null,
  isOverdue: boolean,
) {
  if (!policy) return;

  const firstResponseAt = addHours(createdAt, rand(1, 12));
  await prisma.slaEvent.create({
    data: {
      requestId,
      slaPolicyId: policy.id,
      eventType: 'FIRST_RESPONSE_STARTED',
      occurredAt: createdAt,
      resolvedAt: firstResponseAt,
      createdAt,
    },
  });

  if (policy.firstResponseMinutes) {
    const metFirstResponse =
      !isOverdue &&
      firstResponseAt.getTime() <= createdAt.getTime() + policy.firstResponseMinutes * 60_000;
    await prisma.slaEvent.create({
      data: {
        requestId,
        slaPolicyId: policy.id,
        eventType: metFirstResponse ? 'FIRST_RESPONSE_MET' : 'FIRST_RESPONSE_BREACHED',
        occurredAt: firstResponseAt,
        resolvedAt: firstResponseAt,
        createdAt,
      },
    });
  }

  await prisma.slaEvent.create({
    data: {
      requestId,
      slaPolicyId: policy.id,
      eventType: 'RESOLUTION_STARTED',
      occurredAt: createdAt,
      resolvedAt: completedAt,
      createdAt,
    },
  });

  if (isOverdue && policy.resolutionMinutes) {
    // Overdue = breached — deadline was in the past
    const breachAt = addHours(createdAt, policy.resolutionMinutes / 60 + rand(1, 48));
    await prisma.slaEvent.create({
      data: {
        requestId,
        slaPolicyId: policy.id,
        eventType: 'RESOLUTION_BREACHED',
        occurredAt: breachAt,
        resolvedAt: null,
        createdAt,
      },
    });
  } else if (completedAt && policy.resolutionMinutes) {
    const met =
      completedAt.getTime() <= createdAt.getTime() + policy.resolutionMinutes * 60_000;
    await prisma.slaEvent.create({
      data: {
        requestId,
        slaPolicyId: policy.id,
        eventType: met ? 'RESOLUTION_MET' : 'RESOLUTION_BREACHED',
        occurredAt: completedAt,
        resolvedAt: completedAt,
        createdAt,
      },
    });
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Synthetic Seed #2 starting (~1000 requests)...\n');

  const allUsers = await prisma.user.findMany({
    include: { primaryRoles: { include: { role: true } }, profile: true },
  });

  const byRole = (name: string) =>
    allUsers.filter((u) => u.primaryRoles.some((r) => r.role.name === name));

  const students = byRole('STUDENT');
  const faculty = byRole('FACULTY');
  const staff = byRole('STAFF');
  const admins = byRole('ADMIN');
  const advisors = byRole('ADVISOR');
  const itAgents = byRole('IT_AGENT');
  const itManagers = byRole('IT_MANAGER');
  const organizers = byRole('ORGANIZER');

  if (students.length === 0) throw new Error('Run users seed first.');

  const allStaff = [...staff, ...faculty, ...admins];

  const rts = await prisma.requestType.findMany();
  const rtMap = new Map(rts.map((r) => [r.key, r]));

  const wfDefs = await prisma.workflowDefinition.findMany({
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  });
  const wfMap = new Map<string, WFCtx>();
  for (const wf of wfDefs) {
    const rt = rts.find((r) => r.workflowDefinitionId === wf.id);
    if (rt) {
      wfMap.set(rt.key, {
        definitionId: wf.id,
        steps: wf.steps.map((s) => ({
          id: s.id,
          stepKey: s.stepKey,
          stepOrder: s.stepOrder,
          stepName: s.stepName,
          stepType: s.stepType as string,
        })),
      });
    }
  }

  const resources = await prisma.resource.findMany({ where: { isActive: true } });
  const rooms = resources.filter((r) => r.resourceType === 'ROOM');
  const labs = resources.filter((r) => r.resourceType === 'LAB');

  const slaPolicies = await prisma.slaPolicy.findMany();
  const slaPolicyKey = (reqTypeId: string | null, priority: PriorityLevel | null) =>
    `${reqTypeId ?? '*'}:${priority ?? '*'}`;
  const slaPolicyByScope = new Map(
    slaPolicies.map((p) => [slaPolicyKey(p.requestTypeId, p.priority), p]),
  );
  const resolveSla = (requestTypeId: string, priority: PriorityLevel) =>
    slaPolicyByScope.get(slaPolicyKey(requestTypeId, priority)) ??
    slaPolicyByScope.get(slaPolicyKey(requestTypeId, null)) ??
    slaPolicyByScope.get(slaPolicyKey(null, priority)) ??
    null;

  const terms = await prisma.academicTerm.findMany();

  // ── 1. IT SUPPORT — 100 ───────────────────────────────────────────────────
  console.log('⚙️  IT Support (100)...');
  const itRT = rtMap.get('IT_SUPPORT')!;
  const itWF = wfMap.get('IT_SUPPORT');

  for (let i = 0; i < 100; i++) {
    const requester = pick([...students, ...faculty, ...staff]);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const isOverdue = scenario === 'OVERDUE';
    const createdAt = isOverdue
      ? randDate(daysAgo(240), daysAgo(45))
      : randDate(daysAgo(200), daysAgo(1));
    const priority = pick([
      PriorityLevel.LOW, PriorityLevel.MEDIUM, PriorityLevel.MEDIUM,
      PriorityLevel.HIGH, PriorityLevel.URGENT,
    ]);
    const category = pick(IT_CATS_2);
    const affectedSystem = pick(IT_SYSTEMS_2);
    const title = pick(IT_TITLES_2);
    const itAgent = itAgents.length > 0 ? pick(itAgents) : pick(allStaff);
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(24, 120)) : null;
    const slaPolicy = resolveSla(itRT.id, priority);

    const itTicketStatus = pick([
      TicketStatus.RESOLVED, TicketStatus.RESOLVED,
      TicketStatus.CLOSED, TicketStatus.OPEN,
      TicketStatus.IN_PROGRESS, TicketStatus.WAITING_USER,
    ]);

    const req = await prisma.request.create({
      data: {
        requestTypeId: itRT.id,
        requestNo: nextNo('IT2'),
        title,
        description: `${title}. Category: ${category}. Affected system: ${affectedSystem}. ${isOverdue ? '[OVERDUE - SLA breached]' : ''}`,
        status,
        priority,
        requesterUserId: requester.id,
        currentAssigneeUserId:
          requestStatusIn(status, [RequestStatus.IN_REVIEW, RequestStatus.WAITING_APPROVAL])
            ? itAgent.id : null,
        submittedAt: addHours(createdAt, 0.1),
        completedAt,
        closedAt: completedAt,
        createdAt,
        updatedAt: addHours(createdAt, rand(1, 10)),
      },
    });

    await prisma.itTicket.create({
      data: {
        requestId: req.id,
        reportedByUserId: requester.id,
        assignedItUserId:
          requestStatusIn(status, [RequestStatus.IN_REVIEW, RequestStatus.COMPLETED])
            ? itAgent.id : null,
        category,
        subcategory: maybe(0.5) ? pick(['network_hardware', 'driver_issue', 'account_access', 'software_install']) : null,
        ticketStatus: itTicketStatus,
        affectedSystem,
        assetId: maybe(0.4) ? `ASSET2-${rand(1000, 9999)}` : null,
        locationText: maybe(0.5)
          ? pick(['Engineering Block B', 'Central Library', 'Dormitory Block 3', 'Rector Building', 'Cafeteria'])
          : null,
        incidentStartedAt: maybe(0.6) ? addHours(createdAt, -rand(1, 48)) : null,
        resolutionSummary: completedAt
          ? pick(['Issue resolved after patch.', 'Hardware replaced.', 'Password reset applied.', 'Network reconfigured.'])
          : null,
        resolvedAt: completedAt,
        slaPolicyId: slaPolicy?.id ?? null,
        createdAt,
        updatedAt: addHours(createdAt, rand(1, 5)),
      },
    });

    if (itWF) {
      await attachWF(req.id, itWF, scenario, createdAt, completedAt,
        [...itAgents, ...(itManagers.length > 0 ? itManagers : []), ...allStaff],
        requester.id);
    }
    await addComments(req.id, requester.id, allStaff.map((u) => u.id),
      IT_CMT_USER_2, IT_CMT_STAFF_2, IT_CMT_INTERNAL_2, createdAt);
    await addStatusHistory(req.id, requester.id, scenario, createdAt);

    if (requestStatusIn(status, [RequestStatus.IN_REVIEW, RequestStatus.WAITING_APPROVAL, RequestStatus.COMPLETED])) {
      await prisma.requestAssignment.create({
        data: {
          requestId: req.id,
          assignedToUserId: itAgent.id,
          assignedByUserId: admins.length > 0 ? pick(admins).id : itAgent.id,
          assignmentNote: 'Assigned for IT support.',
          assignedAt: addHours(createdAt, rand(1, 4)),
          isActive: status !== RequestStatus.COMPLETED,
        },
      });
    }

    await addNotif(requester.id, req.id, 'IT Support Request Received',
      `Your request "${title}" has been received.`, addHours(createdAt, 0.2));

    await addSlaEvents(req.id, slaPolicy, createdAt, completedAt, isOverdue);
  }
  console.log('  ✓ 100 IT tickets');

  // ── 2. EQUIPMENT — 100 ───────────────────────────────────────────────────
  console.log('⚙️  Equipment (100)...');
  const eqRT = rtMap.get('EQUIPMENT')!;
  const eqWF = wfMap.get('EQUIPMENT');

  for (let i = 0; i < 100; i++) {
    const requester = pick([...students, ...faculty]);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const isOverdue = scenario === 'OVERDUE';
    const createdAt = isOverdue
      ? randDate(daysAgo(200), daysAgo(40))
      : randDate(daysAgo(200), daysAgo(1));
    const title = pick(EQ_TITLES_2);
    const eqName = pick(['Projector', 'Camera Kit', 'Drone', 'Oscilloscope', '3D Printer', 'Drawing Tablet', 'PA System', 'SSD']);
    const labRes = labs.length > 0 && maybe(0.35) ? pick(labs) : null;
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(24, 96)) : null;
    const slaPolicy = resolveSla(eqRT.id, PriorityLevel.MEDIUM);

    const req = await prisma.request.create({
      data: {
        requestTypeId: eqRT.id,
        requestNo: nextNo('EQ2'),
        title,
        description: `${eqName} equipment request. Purpose: ${pick(['Graduation project', 'Lab experiment', 'Research', 'Seminar', 'Conference'])}.`,
        status,
        priority: pick([PriorityLevel.LOW, PriorityLevel.MEDIUM, PriorityLevel.HIGH]),
        requesterUserId: requester.id,
        submittedAt: addHours(createdAt, 0.1),
        completedAt,
        createdAt,
        updatedAt: createdAt,
      },
    });

    const neededFrom = addDays(createdAt, rand(3, 14));
    await prisma.equipmentRequest.create({
      data: {
        requestId: req.id,
        requesterUserId: requester.id,
        labResourceId: labRes?.id ?? null,
        equipmentName: eqName,
        equipmentCategory: pick(['AV_EQUIPMENT', 'COMPUTING', 'NETWORKING', 'LAB_EQUIPMENT', 'PERIPHERAL']),
        quantity: rand(1, 3),
        purpose: pick(['Lab work', 'Research project', 'Training', 'Conference', 'Seminar presentation']),
        neededFrom,
        neededUntil: addDays(neededFrom, rand(1, 7)),
        urgencyReason: isOverdue ? 'Overdue — original deadline passed.' : (maybe(0.25) ? 'Urgent deadline.' : null),
        stockCheckStatus: pick(['IN_STOCK', 'OUT_OF_STOCK', 'RESERVED', null]),
        procurementRequired: maybe(0.15),
        estimatedCost: maybe(0.3) ? rand(500, 20000) : null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    if (eqWF) {
      await attachWF(req.id, eqWF, scenario, createdAt, completedAt, allStaff, requester.id);
    }
    await addComments(req.id, requester.id, allStaff.map((u) => u.id),
      EQ_CMT_USER_2, EQ_CMT_STAFF_2, [], createdAt);
    await addStatusHistory(req.id, requester.id, scenario, createdAt);
    await addNotif(requester.id, req.id, 'Equipment Request Received',
      `Your ${eqName} request has been registered.`, addHours(createdAt, 0.2));
    await addSlaEvents(req.id, slaPolicy, createdAt, completedAt, isOverdue);
  }
  console.log('  ✓ 100 equipment');

  // ── 3. ROOM RESERVATION — 100 ─────────────────────────────────────────────
  console.log('⚙️  Room Reservation (100)...');
  const rrRT = rtMap.get('ROOM_RESERVATION')!;
  const rrWF = wfMap.get('ROOM_RESERVATION');
  const roomFallback = resources[0];

  for (let i = 0; i < 100; i++) {
    const requester = pick([...students, ...faculty]);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const isOverdue = scenario === 'OVERDUE';
    const createdAt = isOverdue
      ? randDate(daysAgo(180), daysAgo(30))
      : randDate(daysAgo(150), daysAgo(1));
    const title = pick(ROOM_TITLES_2);
    const resource = rooms.length > 0 ? pick(rooms) : roomFallback;
    if (!resource) continue;
    const startAt = addDays(createdAt, rand(3, 21));
    const endAt = addHours(startAt, rand(1, 5));
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(24, 72)) : null;
    const resStatus =
      status === RequestStatus.COMPLETED ? ReservationStatus.APPROVED
      : status === RequestStatus.REJECTED ? ReservationStatus.REJECTED
      : ReservationStatus.PENDING;
    const slaPolicy = resolveSla(rrRT.id, PriorityLevel.MEDIUM);

    const req = await prisma.request.create({
      data: {
        requestTypeId: rrRT.id,
        requestNo: nextNo('RR2'),
        title,
        description: `Room reservation for ${pick(ROOM_PURPOSES_2)}.`,
        status,
        priority: PriorityLevel.MEDIUM,
        requesterUserId: requester.id,
        submittedAt: addHours(createdAt, 0.1),
        completedAt,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.roomReservationRequest.create({
      data: {
        requestId: req.id,
        resourceId: resource.id,
        requesterUserId: requester.id,
        eventName: title,
        reservationPurpose: pick(ROOM_PURPOSES_2),
        attendeeCount: rand(15, 250),
        startAt,
        endAt,
        reservationStatus: resStatus,
        requiresSecurityApproval: maybe(0.3),
        requiresTechnicalSupport: maybe(0.35),
        setupNotes: maybe(0.4) ? 'Projector, microphone and stage required.' : null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    if (status === RequestStatus.COMPLETED) {
      const approver = pick(allStaff);
      await prisma.reservation.create({
        data: {
          resourceId: resource.id,
          requestId: req.id,
          reservedByUserId: requester.id,
          title,
          status: ReservationStatus.APPROVED,
          startAt,
          endAt,
          approvedByUserId: approver.id,
          approvedAt: completedAt,
          createdAt,
          updatedAt: completedAt ?? createdAt,
        },
      });
      await prisma.calendarEvent.create({
        data: {
          userId: requester.id,
          title,
          description: pick(ROOM_PURPOSES_2),
          startDate: startAt,
          endDate: endAt,
          requestId: req.id,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }

    if (rrWF) {
      await attachWF(req.id, rrWF, scenario, createdAt, completedAt, allStaff, requester.id);
    }
    await addComments(req.id, requester.id, allStaff.map((u) => u.id),
      ROOM_CMT_USER_2, ROOM_CMT_STAFF_2, [], createdAt);
    await addStatusHistory(req.id, requester.id, scenario, createdAt);
    await addNotif(requester.id, req.id, 'Reservation Request Received',
      `Your reservation "${title}" has been registered.`, addHours(createdAt, 0.2));
    await addSlaEvents(req.id, slaPolicy, createdAt, completedAt, isOverdue);
  }
  console.log('  ✓ 100 room reservation');

  // ── 4. DOCUMENT REQUEST — 100 ─────────────────────────────────────────────
  console.log('⚙️  Document Request (100)...');
  const docRT = rtMap.get('DOCUMENT_REQUEST')!;
  const docWF = wfMap.get('DOCUMENT_REQUEST');

  for (let i = 0; i < 100; i++) {
    const requester = pick(students);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const isOverdue = scenario === 'OVERDUE';
    const createdAt = isOverdue
      ? randDate(daysAgo(180), daysAgo(30))
      : randDate(daysAgo(150), daysAgo(1));
    const docType = pick(['TRANSCRIPT', 'ENROLLMENT_CERTIFICATE', 'STUDENT_CERTIFICATE', 'DIPLOMA', 'DISCIPLINARY_RECORD', 'GRADUATION_STATUS']);
    const title = pick(DOC_TITLES_2);
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(24, 72)) : null;
    const slaPolicy = resolveSla(docRT.id, PriorityLevel.MEDIUM);

    const req = await prisma.request.create({
      data: {
        requestTypeId: docRT.id,
        requestNo: nextNo('DOC2'),
        title,
        description: `${docType} document request. ${isOverdue ? 'Request is overdue.' : ''}`,
        status,
        priority: PriorityLevel.MEDIUM,
        requesterUserId: requester.id,
        submittedAt: addHours(createdAt, 0.1),
        completedAt,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.documentRequest.create({
      data: {
        requestId: req.id,
        requesterUserId: requester.id,
        documentType: docType,
        language: maybe(0.4) ? 'EN' : 'TR',
        copiesCount: rand(1, 4),
        deliveryMethod: pick(['IN_PERSON', 'EMAIL', 'POST']),
        deliveryAddress: maybe(0.3) ? 'Student Affairs, Main Building' : null,
        issuedAt: completedAt,
        createdAt,
        updatedAt: createdAt,
      },
    });

    if (docWF) {
      await attachWF(req.id, docWF, scenario, createdAt, completedAt, allStaff, requester.id);
    }
    await addComments(req.id, requester.id, allStaff.map((u) => u.id),
      DOC_CMT_USER_2, DOC_CMT_STAFF_2, [], createdAt);
    await addStatusHistory(req.id, requester.id, scenario, createdAt);
    await addNotif(requester.id, req.id, 'Document Request Received',
      `Your ${docType} request has been registered.`, addHours(createdAt, 0.2));
    await addSlaEvents(req.id, slaPolicy, createdAt, completedAt, isOverdue);
  }
  console.log('  ✓ 100 document');

  // ── 5. INTERNSHIP REQUEST — 100 ───────────────────────────────────────────
  console.log('⚙️  Internship (100)...');
  const intRT = rtMap.get('INTERNSHIP_REQUEST')!;
  const intWF = wfMap.get('INTERNSHIP_REQUEST');
  const term = terms.length > 0 ? pick(terms) : null;

  for (let i = 0; i < 100; i++) {
    const requester = pick(students);
    const advisor = advisors.length > 0 ? pick(advisors) : pick(faculty);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const isOverdue = scenario === 'OVERDUE';
    const createdAt = isOverdue
      ? randDate(daysAgo(220), daysAgo(60))
      : randDate(daysAgo(200), daysAgo(7));
    const title = pick(INT_TITLES_2);
    const companyName = pick(COMPANIES_2);
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(48, 120)) : null;
    const startDate = addDays(createdAt, rand(30, 90));
    const durationDays = rand(30, 90);
    const slaPolicy = resolveSla(intRT.id, PriorityLevel.MEDIUM);

    const req = await prisma.request.create({
      data: {
        requestTypeId: intRT.id,
        requestNo: nextNo('INT2'),
        title,
        description: `Internship application at ${companyName}. ${isOverdue ? '[Overdue - awaiting response]' : ''}`,
        status,
        priority: PriorityLevel.MEDIUM,
        requesterUserId: requester.id,
        currentAssigneeUserId:
          requestStatusIn(status, [RequestStatus.IN_REVIEW, RequestStatus.WAITING_APPROVAL])
            ? advisor.id : null,
        submittedAt: addHours(createdAt, 0.1),
        completedAt,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.internshipRequest.create({
      data: {
        requestId: req.id,
        studentUserId: requester.id,
        advisorUserId: advisor.id,
        companyName,
        companySector: pick(SECTORS_2),
        companyContactName: `${pick(NAMES_FIRST)} ${pick(NAMES_LAST)}`,
        companyContactEmail: `contact@${companyName.toLowerCase().replace(/[\s.,&]/g, '').replace(/[^a-z0-9]/g, '').slice(0, 18)}.com`,
        internshipType: pick(['SUMMER_INTERNSHIP', 'LONG_TERM_INTERNSHIP', 'MANDATORY_INTERNSHIP']),
        startDate,
        endDate: addDays(startDate, durationDays),
        durationDays,
        workMode: pick(['ONSITE', 'HYBRID', 'REMOTE']),
        insuranceRequired: maybe(0.7),
        termId: term?.id ?? null,
        currentStageNote: maybe(0.4) ? 'Process ongoing.' : null,
        finalDecisionNote: completedAt
          ? pick(['All requirements satisfied.', 'Internship formally approved.', 'Compliant with regulations.'])
          : null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    if (intWF) {
      const actors = [...(advisors.length > 0 ? advisors : faculty), ...allStaff];
      await attachWF(req.id, intWF, scenario, createdAt, completedAt, actors, requester.id);
    }
    await addComments(req.id, requester.id,
      [...advisors.map((u) => u.id), ...allStaff.map((u) => u.id)],
      INT_CMT_STUDENT_2, [...INT_CMT_ADVISOR_2, ...INT_CMT_COORD_2], [], createdAt);
    await addStatusHistory(req.id, requester.id, scenario, createdAt);
    await addNotif(requester.id, req.id, 'Internship Application Received',
      `Your application to ${companyName} has been registered.`, addHours(createdAt, 0.2));
    await addSlaEvents(req.id, slaPolicy, createdAt, completedAt, isOverdue);
  }
  console.log('  ✓ 100 internship');

  // ── 6. APPOINTMENT — 100 ─────────────────────────────────────────────────
  console.log('⚙️  Appointment (100)...');
  const apptRT = rtMap.get('APPOINTMENT')!;
  const apptWF = wfMap.get('APPOINTMENT');

  for (let i = 0; i < 100; i++) {
    const requester = pick(students);
    const target = pick([...faculty, ...(advisors.length > 0 ? advisors : [])]);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const isOverdue = scenario === 'OVERDUE';
    const createdAt = isOverdue
      ? randDate(daysAgo(120), daysAgo(20))
      : randDate(daysAgo(100), daysAgo(1));
    const title = pick(APPT_TITLES_2);
    const topic = pick(APPT_TOPICS_2);
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(24, 48)) : null;
    const preferredStart = addDays(createdAt, rand(3, 14));
    const slaPolicy = resolveSla(apptRT.id, PriorityLevel.MEDIUM);

    const req = await prisma.request.create({
      data: {
        requestTypeId: apptRT.id,
        requestNo: nextNo('APT2'),
        title,
        description: topic,
        status,
        priority: PriorityLevel.MEDIUM,
        requesterUserId: requester.id,
        submittedAt: addHours(createdAt, 0.1),
        completedAt,
        createdAt,
        updatedAt: createdAt,
      },
    });

    let actualApptId: string | null = null;
    if (status === RequestStatus.COMPLETED) {
      const apptStatus = maybe(0.6) ? AppointmentStatus.COMPLETED : AppointmentStatus.CONFIRMED;
      const appt = await prisma.appointment.create({
        data: {
          requesterUserId: requester.id,
          hostUserId: target.id,
          title,
          description: topic,
          locationText: pick(['Office 201', 'Meeting Room B', 'Online (Zoom)', 'Library Study Room']),
          startAt: preferredStart,
          endAt: addHours(preferredStart, 1),
          status: apptStatus,
          confirmedAt: completedAt,
          completedAt: apptStatus === AppointmentStatus.COMPLETED ? completedAt : null,
          createdAt,
          updatedAt: createdAt,
        },
      });
      actualApptId = appt.id;
      await prisma.calendarEvent.create({
        data: {
          userId: requester.id,
          title,
          description: topic,
          startDate: preferredStart,
          endDate: addHours(preferredStart, 1),
          requestId: req.id,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }

    await prisma.appointmentRequest.create({
      data: {
        requestId: req.id,
        requesterUserId: requester.id,
        targetUserId: target.id,
        appointmentType: pick(['ACADEMIC_CONSULTATION', 'THESIS_GUIDANCE', 'CAREER_CONSULTATION', 'PERSONAL_ISSUE', 'PROJECT_MEETING']),
        topic,
        details: maybe(0.5) ? `Detailed discussion on: ${topic}.` : null,
        preferredStartAt: preferredStart,
        preferredEndAt: addHours(preferredStart, 1),
        actualAppointmentId: actualApptId,
        createdAt,
        updatedAt: createdAt,
      },
    });

    if (apptWF) {
      await attachWF(req.id, apptWF, scenario, createdAt, completedAt,
        [...faculty, ...allStaff], requester.id);
    }
    await addComments(req.id, requester.id,
      [...faculty.map((u) => u.id), ...allStaff.map((u) => u.id)],
      APPT_CMT_STUDENT_2, APPT_CMT_FACULTY_2, [], createdAt);
    await addStatusHistory(req.id, requester.id, scenario, createdAt);
    await addNotif(target.id, req.id, 'New Appointment Request',
      `${requester.profile?.fullName ?? 'Student'} requested an appointment: ${topic}`, addHours(createdAt, 0.2));
    await addSlaEvents(req.id, slaPolicy, createdAt, completedAt, isOverdue);
  }
  console.log('  ✓ 100 appointment');

  // ── 7. ACCESS REQUEST — 100 ───────────────────────────────────────────────
  console.log('⚙️  Access Request (100)...');
  const accRT = rtMap.get('ACCESS_REQUEST')!;
  const accWF = wfMap.get('ACCESS_REQUEST');

  for (let i = 0; i < 100; i++) {
    const requester = pick([...students, ...faculty, ...staff]);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const isOverdue = scenario === 'OVERDUE';
    const createdAt = isOverdue
      ? randDate(daysAgo(180), daysAgo(30))
      : randDate(daysAgo(150), daysAgo(1));
    const title = pick(ACCESS_TITLES_2);
    const accessType = pick(['SYSTEM_ACCESS', 'BUILDING_ACCESS', 'LAB_ACCESS', 'NETWORK_ACCESS', 'DATABASE_ACCESS']);
    const targetResource = pick(['Research Lab B-108', 'ERP System', 'CCTV Room', 'Server Rack Hall', 'Library Archive', 'Chemistry Lab', 'Data Center']);
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(24, 96)) : null;
    const slaPolicy = resolveSla(accRT.id, PriorityLevel.MEDIUM);

    const req = await prisma.request.create({
      data: {
        requestTypeId: accRT.id,
        requestNo: nextNo('ACC2'),
        title,
        description: `${targetResource} access request. ${isOverdue ? '[Awaiting review - overdue]' : ''}`,
        status,
        priority: pick([PriorityLevel.MEDIUM, PriorityLevel.HIGH]),
        requesterUserId: requester.id,
        submittedAt: addHours(createdAt, 0.1),
        completedAt,
        createdAt,
        updatedAt: createdAt,
      },
    });

    const startAt = addDays(createdAt, rand(1, 7));
    await prisma.accessRequest.create({
      data: {
        requestId: req.id,
        requesterUserId: requester.id,
        accessType,
        targetResource,
        requestedRoleOrPermission: maybe(0.5) ? pick(['READ', 'READ_WRITE', 'ADMIN', 'VISITOR']) : null,
        justification: pick([
          'Required for assigned research project.',
          'Job function requires regular access.',
          'Advisor approval confirmed.',
          'Temporary access for maintenance work.',
          'Experiment requires after-hours lab access.',
        ]),
        startAt,
        endAt: maybe(0.6) ? addDays(startAt, rand(14, 365)) : null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    if (accWF) {
      await attachWF(req.id, accWF, scenario, createdAt, completedAt, allStaff, requester.id);
    }
    await addComments(req.id, requester.id, allStaff.map((u) => u.id),
      ACCESS_CMT_USER_2, ACCESS_CMT_STAFF_2, [], createdAt);
    await addStatusHistory(req.id, requester.id, scenario, createdAt);
    await addNotif(requester.id, req.id, 'Access Request Received',
      `Your ${targetResource} access request has been registered.`, addHours(createdAt, 0.2));
    await addSlaEvents(req.id, slaPolicy, createdAt, completedAt, isOverdue);
  }
  console.log('  ✓ 100 access request');

  // ── 8. PROCUREMENT REQUEST — 100 ─────────────────────────────────────────
  console.log('⚙️  Procurement (100)...');
  const procRT = rtMap.get('PROCUREMENT_REQUEST')!;
  const procWF = wfMap.get('PROCUREMENT_REQUEST');

  for (let i = 0; i < 100; i++) {
    const requester = pick([...faculty, ...staff]);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const isOverdue = scenario === 'OVERDUE';
    const createdAt = isOverdue
      ? randDate(daysAgo(200), daysAgo(45))
      : randDate(daysAgo(180), daysAgo(7));
    const title = pick(PROC_TITLES_2);
    const itemName = pick(PROC_ITEMS_2);
    const qty = rand(1, 15);
    const unitPrice = rand(2000, 80000);
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(72, 240)) : null;
    const slaPolicy = resolveSla(procRT.id, PriorityLevel.MEDIUM);

    const req = await prisma.request.create({
      data: {
        requestTypeId: procRT.id,
        requestNo: nextNo('PROC2'),
        title,
        description: `${itemName} procurement request. Quantity: ${qty}. ${isOverdue ? '[Pending — budget review overdue]' : ''}`,
        status,
        priority: pick([PriorityLevel.MEDIUM, PriorityLevel.HIGH]),
        requesterUserId: requester.id,
        submittedAt: addHours(createdAt, 0.1),
        completedAt,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.procurementRequest.create({
      data: {
        requestId: req.id,
        requesterUserId: requester.id,
        itemName,
        itemCategory: pick(['ELECTRONICS', 'FURNITURE', 'SOFTWARE_LICENSE', 'OFFICE_SUPPLIES', 'LAB_EQUIPMENT']),
        quantity: qty,
        unitPriceEstimate: unitPrice,
        totalEstimate: unitPrice * qty,
        vendorPreference: maybe(0.4) ? pick(['Dell Turkey', 'Lenovo Partner', 'Amazon Business', 'Local IT Distributor']) : null,
        justification: pick([
          'Required for approved research grant project.',
          'Existing equipment beyond repair.',
          'Capacity expansion per department plan.',
          'New academic year setup.',
          'IT infrastructure upgrade roadmap.',
        ]),
        budgetCode: maybe(0.6) ? `BDG2-${rand(100, 999)}` : null,
        procurementStatus:
          status === RequestStatus.COMPLETED ? 'COMPLETED'
          : status === RequestStatus.REJECTED ? 'REJECTED'
          : 'IN_PROGRESS',
        createdAt,
        updatedAt: createdAt,
      },
    });

    if (procWF) {
      await attachWF(req.id, procWF, scenario, createdAt, completedAt, allStaff, requester.id);
    }
    await addComments(req.id, requester.id, allStaff.map((u) => u.id),
      [], PROC_CMT_STAFF_2, [], createdAt, rand(2, 5));
    await addStatusHistory(req.id, requester.id, scenario, createdAt);
    await addNotif(requester.id, req.id, 'Procurement Request Received',
      `Your request for ${itemName} has been registered.`, addHours(createdAt, 0.2));
    await addSlaEvents(req.id, slaPolicy, createdAt, completedAt, isOverdue);
  }
  console.log('  ✓ 100 procurement');

  // ── 9. EVENT REQUEST — 100 ───────────────────────────────────────────────
  console.log('⚙️  Event Request (100)...');
  const evRT = rtMap.get('EVENT_REQUEST')!;
  const evWF = wfMap.get('EVENT_REQUEST');

  for (let i = 0; i < 100; i++) {
    const requester = organizers.length > 0 ? pick(organizers) : pick([...students, ...faculty]);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const isOverdue = scenario === 'OVERDUE';
    const createdAt = isOverdue
      ? randDate(daysAgo(200), daysAgo(40))
      : randDate(daysAgo(180), daysAgo(7));
    const title = pick(EVENT_TITLES_2);
    const eventType = pick(EVENT_TYPES_2);
    const expectedAttendance = rand(30, 600);
    const startAt = addDays(createdAt, rand(14, 60));
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(48, 168)) : null;
    const slaPolicy = resolveSla(evRT.id, PriorityLevel.MEDIUM);

    const req = await prisma.request.create({
      data: {
        requestTypeId: evRT.id,
        requestNo: nextNo('EVT2'),
        title,
        description: `Event request: ${eventType}. Expected attendance: ${expectedAttendance}.`,
        status,
        priority: PriorityLevel.MEDIUM,
        requesterUserId: requester.id,
        submittedAt: addHours(createdAt, 0.1),
        completedAt,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.eventRequest.create({
      data: {
        requestId: req.id,
        organizerUserId: requester.id,
        eventName: title,
        eventType,
        description: `${title} — ${eventType}`,
        expectedAttendance,
        locationPreference: maybe(0.6)
          ? pick(['Main Amphitheater', 'Conference Center', 'Sports Hall', 'Open Garden'])
          : null,
        startAt,
        endAt: addHours(startAt, rand(2, 8)),
        needsBudget: maybe(0.5),
        estimatedBudget: maybe(0.4) ? rand(10000, 150000) : null,
        needsPosterApproval: maybe(0.4),
        needsSecuritySupport: expectedAttendance > 200,
        needsTechnicalSupport: maybe(0.6),
        createdAt,
        updatedAt: createdAt,
      },
    });

    if (evWF) {
      await attachWF(req.id, evWF, scenario, createdAt, completedAt, allStaff, requester.id);
    }
    await addComments(req.id, requester.id, allStaff.map((u) => u.id),
      EVT_CMT_ORG_2, EVT_CMT_COORD_2, [], createdAt);
    await addStatusHistory(req.id, requester.id, scenario, createdAt);
    await addNotif(requester.id, req.id, 'Event Request Received',
      `Your event request "${title}" has been registered.`, addHours(createdAt, 0.2));
    await addSlaEvents(req.id, slaPolicy, createdAt, completedAt, isOverdue);
  }
  console.log('  ✓ 100 event request');

  // ── 10. EVENT CREATION REQUEST — 100 ─────────────────────────────────────
  console.log('⚙️  Event Creation Request (100)...');
  const ecrRT = rtMap.get('EVENT_CREATION_REQUEST')!;
  const ecrWF = wfMap.get('EVENT_CREATION_REQUEST');

  for (let i = 0; i < 100; i++) {
    const organizer = organizers.length > 0 ? pick(organizers) : pick(faculty);
    const scenario = pick<Scenario>([
      'COMPLETED', 'COMPLETED', 'IN_REVIEW_MID', 'WAITING_APPROVAL',
      'REJECTED_EARLY', 'REVISION', 'OVERDUE',
    ]);
    const status = scenarioToStatus(scenario);
    const isOverdue = scenario === 'OVERDUE';
    const createdAt = isOverdue
      ? randDate(daysAgo(200), daysAgo(45))
      : randDate(daysAgo(180), daysAgo(14));
    const title = pick(EVENT_TITLES_2);
    const eventType = pick(EVENT_TYPES_2);
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(72, 240)) : null;
    const proposedStart = addDays(createdAt, rand(21, 90));
    const minAttendance = rand(30, 100);
    const targetAttendance = minAttendance + rand(50, 400);
    const regStart = addDays(createdAt, rand(5, 15));
    const regEnd = addDays(proposedStart, -3);
    const slaPolicy = resolveSla(ecrRT.id, PriorityLevel.HIGH);

    const plan = await prisma.eventPlan.create({
      data: {
        organizerUserId: organizer.id,
        title,
        description: `${eventType} event plan — seed 2`,
        eventType,
        tentativeStartAt: proposedStart,
        tentativeEndAt: addHours(proposedStart, rand(2, 8)),
        targetAttendance,
        minimumAttendance: minAttendance,
        registrationStartAt: regStart,
        registrationEndAt: regEnd,
        status:
          status === RequestStatus.COMPLETED ? 'APPROVED'
          : status === RequestStatus.REJECTED ? 'REJECTED'
          : 'PENDING',
        createdAt,
        updatedAt: createdAt,
      },
    });

    const req = await prisma.request.create({
      data: {
        requestTypeId: ecrRT.id,
        requestNo: nextNo('ECR2'),
        title: `Event Creation: ${title}`,
        description: `Event creation request — ${eventType}.`,
        status,
        priority: PriorityLevel.HIGH,
        requesterUserId: organizer.id,
        submittedAt: addHours(createdAt, 0.1),
        completedAt,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.eventCreationRequest.create({
      data: {
        requestId: req.id,
        eventPlanId: plan.id,
        organizerUserId: organizer.id,
        title,
        description: `${eventType} event`,
        eventType,
        proposedStartAt: proposedStart,
        proposedEndAt: addHours(proposedStart, rand(2, 8)),
        locationText: pick(['Main Campus', 'City Campus', 'Amphitheater', 'Sports Complex']),
        minimumAttendance: minAttendance,
        targetAttendance,
        registrationStartAt: regStart,
        registrationEndAt: regEnd,
        expectedBudget: maybe(0.6) ? rand(10000, 200000) : null,
        status:
          status === RequestStatus.COMPLETED ? 'APPROVED'
          : status === RequestStatus.REJECTED ? 'REJECTED'
          : 'PENDING',
        createdAt,
        updatedAt: createdAt,
      },
    });

    if (status === RequestStatus.COMPLETED) {
      const event = await prisma.event.create({
        data: {
          eventPlanId: plan.id,
          organizerUserId: organizer.id,
          title,
          eventType,
          locationText: pick(['Main Amphitheater', 'Conference Hall', 'Open Area', 'Sports Hall']),
          startAt: proposedStart,
          endAt: addHours(proposedStart, rand(2, 8)),
          status: maybe(0.5) ? 'PUBLISHED' : 'CONFIRMED',
          minimumAttendance: minAttendance,
          targetAttendance,
          registrationStartAt: regStart,
          registrationEndAt: regEnd,
          registrationCount: rand(50, 250),
          publishedAt: completedAt,
          confirmedAt: completedAt,
          createdAt,
          updatedAt: completedAt ?? createdAt,
        },
      });

      const regCount = rand(30, Math.min(80, students.length));
      const used = new Set<string>();
      for (let j = 0; j < regCount; j++) {
        const s = pick(students);
        if (used.has(s.id)) continue;
        used.add(s.id);
        try {
          await prisma.eventRegistration.create({
            data: {
              eventId: event.id,
              userId: s.id,
              status: pick(['REGISTERED', 'ATTENDED', 'CANCELLED']),
              registeredAt: randDate(regStart, proposedStart),
            },
          });
        } catch { /* dup */ }
      }

      const preUsed = new Set<string>();
      for (let j = 0; j < rand(10, Math.min(40, students.length)); j++) {
        const s = pick(students);
        if (preUsed.has(s.id)) continue;
        preUsed.add(s.id);
        try {
          await prisma.eventPlanRegistration.create({
            data: {
              eventPlanId: plan.id,
              userId: s.id,
              status: 'REGISTERED',
              registeredAt: randDate(createdAt, regStart),
            },
          });
        } catch { /* dup */ }
      }
    }

    if (ecrWF) {
      await attachWF(req.id, ecrWF, scenario, createdAt, completedAt, allStaff, organizer.id);
    }
    await addComments(req.id, organizer.id, allStaff.map((u) => u.id),
      EVT_CMT_ORG_2, EVT_CMT_COORD_2, [], createdAt);
    await addStatusHistory(req.id, organizer.id, scenario, createdAt);
    await addNotif(organizer.id, req.id, 'Event Creation Request Received',
      `Your creation request for "${title}" has been registered.`, addHours(createdAt, 0.2));
    await addSlaEvents(req.id, slaPolicy, createdAt, completedAt, isOverdue);
  }
  console.log('  ✓ 100 event creation request');

  // ── Summary ───────────────────────────────────────────────────────────────
  const [reqCount, commentCount, wfCount, notifCount, slaEventCount] = await Promise.all([
    prisma.request.count(),
    prisma.requestComment.count(),
    prisma.workflowInstance.count(),
    prisma.notification.count(),
    prisma.slaEvent.count(),
  ]);

  console.log('\n✅ Synthetic Seed #2 completed!');
  console.log(`   Total Requests   : ${reqCount}`);
  console.log(`   Total Comments   : ${commentCount}`);
  console.log(`   WF Instances     : ${wfCount}`);
  console.log(`   Notifications    : ${notifCount}`);
  console.log(`   SLA Events       : ${slaEventCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed #2 error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
