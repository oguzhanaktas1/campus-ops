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

let _counter = 90000;
const nextNo = (prefix: string) =>
  `${prefix}-${String(++_counter).padStart(6, '0')}`;
const requestStatusIn = (
  status: RequestStatus,
  statuses: readonly RequestStatus[],
) => statuses.includes(status);

// ── Content Pools ──────────────────────────────────────────────────────────

const IT_CATEGORIES = ['network', 'hardware', 'software', 'access', 'email', 'printing'];
const IT_SYSTEMS = [
  'Campus Network', 'Email System', 'Student Portal', 'Library System',
  'VPN', 'Printer', 'ERP', 'Video Conferencing', 'WiFi', 'Active Directory',
];
const IT_TITLES = [
  'Computer not turning on - urgent help needed',
  'Cannot connect to campus network',
  'Corporate email password reset required',
  'VPN connection keeps dropping',
  'Printer driver not recognized',
  'Unable to log in to student portal',
  'Teams application fails to launch',
  'Monitor not receiving signal',
  'Mouse and keyboard not working',
  'Computer extremely slow - cleanup required',
  'Antivirus update error',
  'Software license has expired',
  'Database connection error',
  'Server backup failure occurred',
  'WiFi password not working',
  'Screen saver lock issue',
  'Cannot access file server',
  'Webcam not recognized - online class issue',
  'Audio driver error',
  'USB device not recognized',
  'Outlook synchronization issue',
  'Remote Desktop connection failure',
  'Campus card access system malfunction',
  'Projector connection problem',
  'Internet speed extremely slow',
];

const IT_CMT_USER = [
  'My computer has not turned on since this morning, I have an exam today.',
  'My internet keeps disconnecting, I cannot upload my assignment.',
  'I entered my password incorrectly several times, my account is locked.',
  'The issue is still ongoing, when will it be resolved?',
  'Thank you, the issue has been resolved!',
  'Can you connect remotely? I am not in the office.',
  'The same issue exists on the library computer too.',
  'This is urgent, a meeting is about to start.',
  'I installed the driver but it keeps throwing an error.',
];
const IT_CMT_STAFF = [
  'We have received your request and will get back to you as soon as possible.',
  'We investigated the issue and identified a server-side problem.',
  'The driver has been updated, please restart your computer.',
  'Your password has been reset, the new password was sent to your email.',
  'Could you share your TeamViewer ID for remote connection?',
  'A hardware failure was detected, equipment replacement is required.',
  'The software has been reinstalled, the issue is resolved.',
  'Our IT team has been dispatched to your location and will arrive within 30 minutes.',
  'There is scheduled maintenance on the network infrastructure, downtime is expected.',
  'We have escalated the issue to the escalation team.',
  'Closing the ticket, the issue has been resolved.',
  'Firewall rule has been updated, please try again.',
  'Insufficient RAM detected, we recommend an upgrade.',
];
const IT_CMT_INTERNAL = [
  'User credentials verified, this is a genuine issue.',
  'Check the switch port, there may be a physical connection problem.',
  'This issue has been reported before.',
  'Equipment can be replaced under warranty.',
  'Escalate to L2 support team.',
  'Root cause analysis needed, this is a recurring issue.',
];

const EQ_NAMES = [
  'Projector', 'Laptop', 'External Hard Drive', 'Webcam', 'Microphone Set',
  'Tablet', 'Printer', 'Scanner', 'UPS Power Supply', 'Ethernet Cable',
  'HDMI Cable', '27" Monitor', 'Keyboard', 'Mouse', 'USB Hub',
  'Raspberry Pi Kit', 'Arduino Kit', 'Sensor Kit', 'Oscilloscope', 'Multimeter',
];
const EQ_CATS = ['AV_EQUIPMENT', 'COMPUTING', 'NETWORKING', 'LAB_EQUIPMENT', 'PERIPHERAL'];
const EQ_TITLES = [
  'Projector request for seminar',
  'Laptop request for project development',
  'External hard drive for data collection',
  'Camera kit for remote teaching',
  'Measurement device for lab work',
  'HDMI adapter for presentation',
  'Extra monitor request - development environment',
  'Sensor kit for experiment setup',
  'Arduino kit for graduation project',
  'Sound system for symposium',
  'Microscope and lab equipment request',
  'Laptop - field research work',
];
const EQ_CMT_USER = [
  'I need a projector this weekend for my project presentation.',
  'I need equipment for my lab work, is it in stock?',
  'When can I pick it up?',
  'Thank you, I have collected the equipment.',
  'Equipment has been returned.',
  'Deadline is approaching, this is needed urgently.',
];
const EQ_CMT_STAFF = [
  'Stock check completed, equipment is available.',
  'Equipment reserved, please come to our office for pickup.',
  'Equipment is not available on the specified date.',
  'Technical review completed, eligibility confirmed.',
  'Not in stock, procurement lead time is 3-5 business days.',
  'Equipment delivered, please update the system.',
  'Return procedure completed.',
];

const DOC_TYPES = [
  'TRANSCRIPT', 'ENROLLMENT_CERTIFICATE', 'STUDENT_CERTIFICATE',
  'DIPLOMA', 'DISCIPLINARY_RECORD', 'GRADUATION_STATUS',
];
const DOC_TITLES = [
  'Transcript request - English',
  'Student certificate - scholarship application',
  'Graduation status document',
  'Enrollment certificate - visa application',
  'Disciplinary record - job application',
  'Certified transcript - graduate school application',
  'English enrollment certificate',
  'Transcript - internship application',
];
const DOC_CMT_USER = [
  'I urgently need this document for my scholarship application.',
  'I have a visa appointment, how long will this take?',
  'Will the document be in English?',
  'Thank you, I have received the document.',
  'How many copies can be issued?',
  'Can it be sent by email?',
];
const DOC_CMT_STAFF = [
  'Your document is being prepared and will be ready within 2-3 business days.',
  'Your document is ready, you can collect it from the Student Affairs office.',
  'Your transcript has been approved and stamped.',
  'You must come in person with your ID.',
  'A notarized power of attorney is required for proxy pickup.',
  'Your document has been sent by email.',
];

const COMPANIES = [
  'TechSoft Software Inc.', 'Metro Finance Group', 'National Airlines',
  'Microsoft Corp.', 'Google LLC', 'Amazon Web Services',
  'Bosch GmbH', 'Ford Motor Company', 'Arcelik Electronics', 'TelecomPlus',
  'Garanti BBVA Bank', 'National Bank', 'CellularOne', 'Vodafone',
  'Siemens AG', 'ABB Ltd.', 'Ericsson AB', 'Global Holding Corp.',
  'Sunrise Technologies', 'Defense Systems Co.', 'AeroTech Ltd.', 'NetSolutions', 'DataBridge',
];
const SECTORS = ['TECHNOLOGY', 'FINANCE', 'MANUFACTURING', 'TELECOMMUNICATIONS', 'AVIATION', 'ENERGY', 'DEFENSE'];
const INT_TYPES = ['SUMMER_INTERNSHIP', 'LONG_TERM_INTERNSHIP', 'MANDATORY_INTERNSHIP'];
const INT_TITLES = [
  'Mandatory Internship Application - Summer Term',
  'Voluntary Internship - Long Term',
  'Summer Internship Application',
  'Graduation Internship Application',
  'Short-Term Internship Request',
];
const INT_CMT_STUDENT = [
  'I have attached the company acceptance letter and required documents.',
  'Is it possible to change my advisor?',
  'My internship period may be extended, is an update needed?',
  'I have made the corrections, please review again.',
  'What documents are needed for insurance?',
];
const INT_CMT_ADVISOR = [
  'Company information looks suitable, forwarding to the coordinator.',
  'Insurance document is missing, please complete it.',
  'The start date is very close, please apply earlier next time.',
  'Revision requested, please update the company contact information.',
  'Approved, enjoy your internship!',
  'Company accreditation confirmed.',
];
const INT_CMT_COORD = [
  'Application reviewed and found suitable.',
  'Company accreditation is being checked.',
  'Required documents completed, being processed for approval.',
  'Internship duration does not comply with regulations, revision required.',
  'Social security registration will be completed, please verify your information.',
];

const ROOM_PURPOSES = [
  'Academic meeting', 'Project defense', 'Seminar', 'Conference',
  'Group study', 'Exam', 'Event', 'Club meeting', 'Workshop',
  'Graduation ceremony rehearsal', 'Press conference',
];
const ROOM_TITLES = [
  'Conference hall reservation - Dean meeting',
  'Seminar room - Graduation project presentation',
  'Laboratory reservation - Project work',
  'Meeting room reservation',
  'Amphitheater - Graduation ceremony',
  'Symposium hall reservation',
  'Classroom reservation - Private lesson',
  'Conference room - Committee meeting',
];
const ROOM_CMT_USER = [
  'We need the room for our group project presentation.',
  'Technical equipment (projector, sound system) is required.',
  'Attendee count may change.',
  'Has the reservation been confirmed?',
  'Thank you for the approval.',
];
const ROOM_CMT_STAFF = [
  'Room is available, reservation approved.',
  'There is another reservation at the specified time.',
  'Awaiting security approval.',
  'Technical support team will be arranged.',
  'Please leave the room clean after the event.',
  'Approval granted, good luck with your work.',
];

const APPT_TYPES = [
  'ACADEMIC_CONSULTATION', 'THESIS_GUIDANCE', 'CAREER_CONSULTATION',
  'PERSONAL_ISSUE', 'PROJECT_MEETING', 'RESEARCH_DISCUSSION',
];
const APPT_TOPICS = [
  'Course advising and grade appeal',
  'Thesis topic selection',
  'Internship consultation',
  'Project progress meeting',
  'Graduation requirements discussion',
  'Research assistant position',
  'Academic performance counseling',
  'Scholarship recommendation letter',
  'Doctoral program information',
];
const APPT_TITLES = [
  'Advising appointment - Thesis topic',
  'Academic counseling - Grade appeal',
  'Project meeting appointment',
  'Internship consultation',
  'Graduation status review',
  'Research project discussion',
];
const APPT_CMT_STUDENT = [
  'I need help with course selection.',
  'I would like to discuss my thesis topic.',
  'Are you available on Wednesdays?',
  'Thank you, the appointment has been confirmed.',
  'I may need to cancel the appointment.',
];
const APPT_CMT_FACULTY = [
  'Your appointment has been confirmed, I will be expecting you at the specified time.',
  'I am busy this week, can we reschedule to next week?',
  'I recommend bringing the relevant documents beforehand.',
  'The appointment meeting has been completed.',
  'My office hours are between 14:00-16:00.',
];

const ACCESS_TYPES = ['SYSTEM_ACCESS', 'BUILDING_ACCESS', 'LAB_ACCESS', 'NETWORK_ACCESS', 'DATABASE_ACCESS'];
const ACCESS_TARGETS = [
  'Student Information System', 'Research Database', 'Server Room',
  'Laboratory B-201', 'Secure Network Segment', 'ERP System',
  'Campus VPN', 'Library Database', 'Archive Building', 'Data Center',
];
const ACCESS_TITLES = [
  'Database access for research project',
  'Lab B-201 card entry authorization',
  'Server room access authorization',
  'Campus VPN access request',
  'Student information system administrator access',
  'Research network access authorization',
];
const ACCESS_CMT_USER = [
  'I need this access for my research project.',
  'My advisor approved it, can you approve it as well?',
  'When will the access be activated?',
  'Access has been granted, thank you.',
];
const ACCESS_CMT_STAFF = [
  'Checking compliance with security protocols.',
  'Forwarded to the IT team.',
  'The access authorization document needs to be signed.',
  'Access has been defined and activated.',
  'The specified access is against system policy.',
  'Additional security training must be completed.',
];

const PROC_ITEMS = [
  'Laptop', 'Monitor 27"', 'Ergonomic Chair', 'Desktop Computer',
  'Printer Toner', 'Software License (MATLAB)', 'Adobe Creative Cloud License',
  'Microscope', 'Sensor Kit', 'Network Switch', 'NAS Storage',
];
const PROC_CATS = ['ELECTRONICS', 'FURNITURE', 'SOFTWARE_LICENSE', 'OFFICE_SUPPLIES', 'LAB_EQUIPMENT'];
const PROC_TITLES = [
  'Laptop purchase for office',
  'Equipment for research laboratory',
  'Software license renewal - MATLAB',
  'Ergonomic furniture - academic offices',
  'Network infrastructure upgrade equipment',
  'Storage system expansion',
  'Office supplies procurement - annual',
];
const PROC_CMT_STAFF = [
  'Technical specifications reviewed and found suitable.',
  'Budget line checked, sufficient.',
  'Vendor quotes received.',
  'Invoice and delivery process initiated.',
  'An equivalent product can be suggested to reduce cost.',
  'Purchase approval required from higher authority.',
  'Delivery completed and added to inventory.',
];

const EVENT_TYPES = ['CONFERENCE', 'SEMINAR', 'WORKSHOP', 'CULTURAL', 'SPORTS', 'CAREER_FAIR', 'SOCIAL'];
const EVENT_TITLES = [
  'Artificial Intelligence and Future Careers Conference',
  'Career Days 2024',
  'Entrepreneurship Workshop',
  'Science Festival',
  'Alumni Day Event',
  'Sustainability Panel',
  'Robotics Competition',
  'Coding Bootcamp',
  'Music Festival',
  'Sports Day',
  'Technology Fair',
  'Hackathon 2024',
  'Human Resources Seminar',
  'Nature Photography Exhibition',
];
const EVT_CMT_ORG = [
  'I am attaching the list of required equipment for the event.',
  'The number of attendees may increase, we are planning flexibly.',
  'Sponsorship agreement has been finalized.',
  'Revision requests have been updated.',
  'Poster design is complete, submitting for approval.',
];
const EVT_CMT_COORD = [
  'Event plan is being reviewed.',
  'Security team has been informed.',
  'Venue and technical equipment have been arranged.',
  'Event approved, good luck!',
  'Budget line is being reviewed.',
  'Security measures will be increased based on attendance count.',
];

const NAMES_FIRST = [
  'James', 'Emma', 'Michael', 'Sophia', 'William', 'Olivia', 'Daniel', 'Emily',
  'Matthew', 'Sarah', 'David', 'Isabella', 'Andrew', 'Mia', 'Thomas', 'Charlotte',
  'Joseph', 'Amelia', 'Christopher', 'Laura',
];
const NAMES_LAST = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Wilson', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin',
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
  | 'REVISION';

function scenarioToStatus(s: Scenario): RequestStatus {
  if (s === 'COMPLETED') return RequestStatus.COMPLETED;
  if (s === 'REJECTED_EARLY' || s === 'REJECTED_LATE') return RequestStatus.REJECTED;
  if (s === 'REVISION') return RequestStatus.REVISION_REQUESTED;
  if (s === 'WAITING_APPROVAL') return RequestStatus.WAITING_APPROVAL;
  return RequestStatus.IN_REVIEW;
}

function pickScenario(): Scenario {
  const r = Math.random();
  if (r < 0.40) return 'COMPLETED';
  if (r < 0.55) return 'IN_REVIEW_EARLY';
  if (r < 0.65) return 'IN_REVIEW_MID';
  if (r < 0.75) return 'WAITING_APPROVAL';
  if (r < 0.85) return 'REJECTED_EARLY';
  if (r < 0.93) return 'REJECTED_LATE';
  return 'REVISION';
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

  const APPROVE_NOTES = ['Approved.', 'Found suitable.', 'Reviewed and approved.', 'Requirements met.'];
  const REJECT_NOTES = ['Requirements not met.', 'Missing document.', 'Not eligible.', 'Against policy.'];
  const REVISION_NOTES = ['Document missing, please complete.', 'Information insufficient.', 'Please make the necessary updates.'];

  async function completeStep(step: WFStep, action: WorkflowActionType, note: string) {
    const start = t;
    const end = addHours(start, rand(2, 24));
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
  } else if (scenario === 'IN_REVIEW_EARLY') {
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
        isLast ? 'Non-compliance detected at the final stage.' : pick(APPROVE_NOTES),
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
) {
  const count = rand(2, 5);
  let t = addHours(baseTime, rand(1, 8));
  let firstId: string | null = null;

  for (let i = 0; i < count; i++) {
    const isInternal = internalPool.length > 0 && maybe(0.15);
    const isStaff = maybe(0.5);
    const uid =
      isInternal || isStaff
        ? staffIds.length > 0
          ? pick(staffIds)
          : requesterId
        : requesterId;
    const pool =
      isInternal ? internalPool : isStaff ? staffPool : userPool;
    const text = pool.length > 0 ? pick(pool) : pick(staffPool);
    t = addHours(t, rand(1, 24));

    const c = await prisma.requestComment.create({
      data: {
        requestId,
        userId: uid,
        commentText: text,
        isInternal,
        parentCommentId: i > 0 && firstId && maybe(0.25) ? firstId : null,
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
      { old: RequestStatus.SUBMITTED, next: RequestStatus.IN_REVIEW, note: 'Request taken into review.', delay: rand(1, 6) },
      { old: RequestStatus.IN_REVIEW, next: RequestStatus.APPROVED, note: 'Approved.', delay: rand(24, 72) },
      { old: RequestStatus.APPROVED, next: RequestStatus.COMPLETED, note: 'Completed.', delay: rand(72, 120) },
    );
  } else if (scenario === 'IN_REVIEW_EARLY' || scenario === 'IN_REVIEW_MID') {
    entries.push(
      { old: RequestStatus.SUBMITTED, next: RequestStatus.IN_REVIEW, note: 'Request taken into review.', delay: rand(1, 6) },
    );
  } else if (scenario === 'WAITING_APPROVAL') {
    entries.push(
      { old: RequestStatus.SUBMITTED, next: RequestStatus.IN_REVIEW, note: 'Request taken into review.', delay: rand(1, 6) },
      { old: RequestStatus.IN_REVIEW, next: RequestStatus.WAITING_APPROVAL, note: 'Sent for higher approval.', delay: rand(12, 48) },
    );
  } else if (scenario === 'REJECTED_EARLY') {
    entries.push(
      { old: RequestStatus.SUBMITTED, next: RequestStatus.IN_REVIEW, note: 'Request taken into review.', delay: rand(1, 6) },
      { old: RequestStatus.IN_REVIEW, next: RequestStatus.REJECTED, note: 'Rejection decision issued.', delay: rand(12, 48) },
    );
  } else if (scenario === 'REJECTED_LATE') {
    entries.push(
      { old: RequestStatus.SUBMITTED, next: RequestStatus.IN_REVIEW, note: 'Request taken into review.', delay: rand(1, 6) },
      { old: RequestStatus.IN_REVIEW, next: RequestStatus.WAITING_APPROVAL, note: 'Sent for higher approval.', delay: rand(24, 72) },
      { old: RequestStatus.WAITING_APPROVAL, next: RequestStatus.REJECTED, note: 'Rejected at the final stage.', delay: rand(24, 72) },
    );
  } else if (scenario === 'REVISION') {
    entries.push(
      { old: RequestStatus.SUBMITTED, next: RequestStatus.IN_REVIEW, note: 'Request taken into review.', delay: rand(1, 6) },
      { old: RequestStatus.IN_REVIEW, next: RequestStatus.REVISION_REQUESTED, note: 'Revision requested.', delay: rand(12, 36) },
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
      status: maybe(0.7) ? NotificationStatus.READ : NotificationStatus.DELIVERED,
      isRead: maybe(0.7),
      createdAt: at,
      updatedAt: at,
    },
  });
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Synthetic data seed starting...\n');

  // ── Load existing data ────────────────────────────────────────────────────
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
  type SyntheticSlaPolicy = (typeof slaPolicies)[number];
  const slaPolicyKey = (requestTypeId: string | null, priority: PriorityLevel | null) =>
    `${requestTypeId ?? '*'}:${priority ?? '*'}`;
  const slaPolicyByScope = new Map(
    slaPolicies.map((policy) => [
      slaPolicyKey(policy.requestTypeId, policy.priority),
      policy,
    ]),
  );
  const resolveSlaPolicy = (
    requestTypeId: string,
    priority: PriorityLevel,
  ): SyntheticSlaPolicy | null =>
    slaPolicyByScope.get(slaPolicyKey(requestTypeId, priority)) ??
    slaPolicyByScope.get(slaPolicyKey(requestTypeId, null)) ??
    slaPolicyByScope.get(slaPolicyKey(null, priority)) ??
    null;
  const addSlaLifecycleEvents = async (params: {
    requestId: string;
    policy: SyntheticSlaPolicy | null;
    createdAt: Date;
    completedAt: Date | null;
  }) => {
    const { requestId, policy, createdAt, completedAt } = params;
    if (!policy) return;

    const firstResponseAt = addHours(createdAt, rand(1, 8));
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
      await prisma.slaEvent.create({
        data: {
          requestId,
          slaPolicyId: policy.id,
          eventType:
            firstResponseAt.getTime() <= createdAt.getTime() + policy.firstResponseMinutes * 60_000
              ? 'FIRST_RESPONSE_MET'
              : 'FIRST_RESPONSE_BREACHED',
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

    if (completedAt && policy.resolutionMinutes) {
      await prisma.slaEvent.create({
        data: {
          requestId,
          slaPolicyId: policy.id,
          eventType:
            completedAt.getTime() <= createdAt.getTime() + policy.resolutionMinutes * 60_000
              ? 'RESOLUTION_MET'
              : 'RESOLUTION_BREACHED',
          occurredAt: completedAt,
          resolvedAt: completedAt,
          createdAt,
        },
      });
    }
  };
  await prisma.slaEvent.deleteMany({ where: { eventType: 'first_response' } });
  const terms = await prisma.academicTerm.findMany();
  const faculties = await prisma.faculty.findMany();
  const departments = await prisma.department.findMany();

  // ── 1. IT SUPPORT — 120 ───────────────────────────────────────────────────
  console.log('⚙️  IT Support (120)...');
  const itRT = rtMap.get('IT_SUPPORT')!;
  const itWF = wfMap.get('IT_SUPPORT');

  for (let i = 0; i < 120; i++) {
    const requester = pick([...students, ...faculty, ...staff]);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const createdAt = randDate(daysAgo(180), daysAgo(1));
    const priority = pick([
      PriorityLevel.LOW, PriorityLevel.MEDIUM, PriorityLevel.MEDIUM,
      PriorityLevel.HIGH, PriorityLevel.URGENT,
    ]);
    const category = pick(IT_CATEGORIES);
    const affectedSystem = pick(IT_SYSTEMS);
    const title = pick(IT_TITLES);
    const itAgent = itAgents.length > 0 ? pick(itAgents) : pick(allStaff);
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(24, 120)) : null;
    const slaPolicy = resolveSlaPolicy(itRT.id, priority);

    const itTicketStatus = pick([
      TicketStatus.RESOLVED, TicketStatus.RESOLVED, TicketStatus.RESOLVED,
      TicketStatus.CLOSED, TicketStatus.CLOSED,
      TicketStatus.OPEN, TicketStatus.IN_PROGRESS,
      TicketStatus.WAITING_USER, TicketStatus.TRIAGED,
    ]);

    const req = await prisma.request.create({
      data: {
        requestTypeId: itRT.id,
        requestNo: nextNo('IT'),
        title,
        description: `${title}. Category: ${category}. Affected system: ${affectedSystem}.`,
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
          requestStatusIn(status, [RequestStatus.IN_REVIEW, RequestStatus.COMPLETED]) ||
          itTicketStatus === TicketStatus.WAITING_USER
            ? itAgent.id : null,
        category,
        subcategory: maybe(0.5) ? pick(['network_hardware', 'driver_issue', 'account_access', 'software_install']) : null,
        ticketStatus: itTicketStatus,
        affectedSystem,
        assetId: maybe(0.4) ? `ASSET-${rand(1000, 9999)}` : null,
        locationText: maybe(0.5) ? pick(['Engineering Block A', 'Library', 'Dormitory', 'Administrative Building', 'Cafeteria']) : null,
        incidentStartedAt: maybe(0.6) ? addHours(createdAt, -rand(1, 24)) : null,
        resolutionSummary: completedAt ? pick([
          'Driver updated.', 'Network settings adjusted.',
          'Password reset.', 'Hardware replaced.', 'Software reinstalled.',
        ]) : null,
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
      IT_CMT_USER, IT_CMT_STAFF, IT_CMT_INTERNAL, createdAt);
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

    await addNotif(requester.id, req.id, 'Your IT Support Request Has Been Received',
      `Your request "${title}" has been received.`, addHours(createdAt, 0.2));

    await addSlaLifecycleEvents({
      requestId: req.id,
      policy: slaPolicy,
      createdAt,
      completedAt,
    });
  }
  console.log('  ✓ 120 IT ticket');

  // ── 2. EQUIPMENT — 60 ────────────────────────────────────────────────────
  console.log('⚙️  Equipment (60)...');
  const eqRT = rtMap.get('EQUIPMENT')!;
  const eqWF = wfMap.get('EQUIPMENT');

  for (let i = 0; i < 60; i++) {
    const requester = pick([...students, ...faculty]);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const createdAt = randDate(daysAgo(180), daysAgo(1));
    const title = pick(EQ_TITLES);
    const eqName = pick(EQ_NAMES);
    const labRes = labs.length > 0 && maybe(0.35) ? pick(labs) : null;
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(24, 96)) : null;

    const req = await prisma.request.create({
      data: {
        requestTypeId: eqRT.id,
        requestNo: nextNo('EQ'),
        title,
        description: `${eqName} request. Purpose: ${pick(['Project work', 'Seminar presentation', 'Lab experiment', 'Research'])}.`,
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
        equipmentCategory: pick(EQ_CATS),
        quantity: rand(1, 5),
        purpose: pick(['Project presentation', 'Lab work', 'Research', 'Training', 'Seminar']),
        neededFrom,
        neededUntil: addDays(neededFrom, rand(1, 7)),
        urgencyReason: maybe(0.25) ? 'Deadline is approaching.' : null,
        stockCheckStatus: pick(['IN_STOCK', 'OUT_OF_STOCK', 'RESERVED', null, null]),
        procurementRequired: maybe(0.15),
        estimatedCost: maybe(0.3) ? rand(500, 15000) : null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    if (eqWF) {
      await attachWF(req.id, eqWF, scenario, createdAt, completedAt, allStaff, requester.id);
    }
    await addComments(req.id, requester.id, allStaff.map((u) => u.id),
      EQ_CMT_USER, EQ_CMT_STAFF, [], createdAt);
    await addStatusHistory(req.id, requester.id, scenario, createdAt);
    await addNotif(requester.id, req.id, 'Your Equipment Request Has Been Received',
      `Your ${eqName} request has been processed.`, addHours(createdAt, 0.2));
  }
  console.log('  ✓ 60 equipment');

  // ── 3. ROOM RESERVATION — 50 ─────────────────────────────────────────────
  console.log('⚙️  Room Reservation (50)...');
  const rrRT = rtMap.get('ROOM_RESERVATION')!;
  const rrWF = wfMap.get('ROOM_RESERVATION');
  const roomFallback = resources[0];

  for (let i = 0; i < 50; i++) {
    const requester = pick([...students, ...faculty]);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const createdAt = randDate(daysAgo(120), daysAgo(1));
    const title = pick(ROOM_TITLES);
    const resource = (rooms.length > 0 ? pick(rooms) : roomFallback);
    if (!resource) continue;
    const startAt = addDays(createdAt, rand(3, 21));
    const endAt = addHours(startAt, rand(1, 4));
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(24, 72)) : null;
    const resStatus =
      status === RequestStatus.COMPLETED ? ReservationStatus.APPROVED
      : status === RequestStatus.REJECTED ? ReservationStatus.REJECTED
      : ReservationStatus.PENDING;

    const req = await prisma.request.create({
      data: {
        requestTypeId: rrRT.id,
        requestNo: nextNo('RR'),
        title,
        description: `Reservation request for ${pick(ROOM_PURPOSES)}.`,
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
        reservationPurpose: pick(ROOM_PURPOSES),
        attendeeCount: rand(10, 200),
        startAt,
        endAt,
        reservationStatus: resStatus,
        requiresSecurityApproval: maybe(0.35),
        requiresTechnicalSupport: maybe(0.3),
        setupNotes: maybe(0.4) ? 'Projector and whiteboard required.' : null,
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
          description: pick(ROOM_PURPOSES),
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
      ROOM_CMT_USER, ROOM_CMT_STAFF, [], createdAt);
    await addStatusHistory(req.id, requester.id, scenario, createdAt);
    await addNotif(requester.id, req.id, 'Your Reservation Request Has Been Received',
      `Your reservation request "${title}" has been received.`, addHours(createdAt, 0.2));
  }
  console.log('  ✓ 50 room reservation');

  // ── 4. DOCUMENT REQUEST — 40 ─────────────────────────────────────────────
  console.log('⚙️  Document Request (40)...');
  const docRT = rtMap.get('DOCUMENT_REQUEST')!;
  const docWF = wfMap.get('DOCUMENT_REQUEST');

  for (let i = 0; i < 40; i++) {
    const requester = pick(students);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const createdAt = randDate(daysAgo(120), daysAgo(1));
    const docType = pick(DOC_TYPES);
    const title = pick(DOC_TITLES);
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(24, 72)) : null;

    const req = await prisma.request.create({
      data: {
        requestTypeId: docRT.id,
        requestNo: nextNo('DOC'),
        title,
        description: `${docType} document request.`,
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
        copiesCount: rand(1, 3),
        deliveryMethod: pick(['IN_PERSON', 'EMAIL', 'POST']),
        deliveryAddress: maybe(0.3) ? 'Student Affairs Office' : null,
        issuedAt: completedAt,
        createdAt,
        updatedAt: createdAt,
      },
    });

    if (docWF) {
      await attachWF(req.id, docWF, scenario, createdAt, completedAt, allStaff, requester.id);
    }
    await addComments(req.id, requester.id, allStaff.map((u) => u.id),
      DOC_CMT_USER, DOC_CMT_STAFF, [], createdAt);
    await addStatusHistory(req.id, requester.id, scenario, createdAt);
    await addNotif(requester.id, req.id, 'Your Document Request Has Been Received',
      `Your ${docType} request has been processed.`, addHours(createdAt, 0.2));
  }
  console.log('  ✓ 40 document');

  // ── 5. INTERNSHIP REQUEST — 40 ────────────────────────────────────────────
  console.log('⚙️  Internship (40)...');
  const intRT = rtMap.get('INTERNSHIP_REQUEST')!;
  const intWF = wfMap.get('INTERNSHIP_REQUEST');
  const term = terms.length > 0 ? pick(terms) : null;

  for (let i = 0; i < 40; i++) {
    const requester = pick(students);
    const advisor = advisors.length > 0 ? pick(advisors) : pick(faculty);
    const scenario = pick<Scenario>([
      'COMPLETED', 'COMPLETED',
      'IN_REVIEW_EARLY', 'IN_REVIEW_MID', 'WAITING_APPROVAL',
      'REJECTED_EARLY', 'REVISION',
    ]);
    const status = scenarioToStatus(scenario);
    const createdAt = randDate(daysAgo(180), daysAgo(7));
    const title = pick(INT_TITLES);
    const companyName = pick(COMPANIES);
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(48, 120)) : null;
    const startDate = addDays(createdAt, rand(30, 90));
    const durationDays = rand(30, 90);

    const req = await prisma.request.create({
      data: {
        requestTypeId: intRT.id,
        requestNo: nextNo('INT'),
        title,
        description: `Internship application at ${companyName}.`,
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
        companySector: pick(SECTORS),
        companyContactName: `${pick(NAMES_FIRST)} ${pick(NAMES_LAST)}`,
        companyContactEmail: `hr@${companyName.toLowerCase().replace(/[\s.,]/g, '').replace(/[^a-z0-9]/g, '').slice(0, 20)}.com`,
        internshipType: pick(INT_TYPES),
        startDate,
        endDate: addDays(startDate, durationDays),
        durationDays,
        workMode: pick(['ONSITE', 'HYBRID', 'REMOTE']),
        insuranceRequired: maybe(0.7),
        termId: term?.id ?? null,
        currentStageNote: maybe(0.4) ? 'Process is ongoing.' : null,
        finalDecisionNote: completedAt
          ? pick(['Internship successfully approved.', 'All requirements have been met.'])
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
      INT_CMT_STUDENT, [...INT_CMT_ADVISOR, ...INT_CMT_COORD], [], createdAt);
    await addStatusHistory(req.id, requester.id, scenario, createdAt);
    await addNotif(requester.id, req.id, 'Your Internship Application Has Been Received',
      `Your internship application at ${companyName} has been processed.`, addHours(createdAt, 0.2));
  }
  console.log('  ✓ 40 internship');

  // ── 6. APPOINTMENT — 30 ──────────────────────────────────────────────────
  console.log('⚙️  Appointment (30)...');
  const apptRT = rtMap.get('APPOINTMENT')!;
  const apptWF = wfMap.get('APPOINTMENT');

  for (let i = 0; i < 30; i++) {
    const requester = pick(students);
    const target = pick([...faculty, ...(advisors.length > 0 ? advisors : [])]);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const createdAt = randDate(daysAgo(90), daysAgo(1));
    const title = pick(APPT_TITLES);
    const topic = pick(APPT_TOPICS);
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(24, 48)) : null;
    const preferredStart = addDays(createdAt, rand(3, 14));

    const req = await prisma.request.create({
      data: {
        requestTypeId: apptRT.id,
        requestNo: nextNo('APT'),
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
          locationText: pick(['Office 301', 'Meeting Room A', 'Online (Teams)', 'Library']),
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
        appointmentType: pick(APPT_TYPES),
        topic,
        details: maybe(0.5) ? `Detailed discussion on ${topic}.` : null,
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
      APPT_CMT_STUDENT, APPT_CMT_FACULTY, [], createdAt);
    await addStatusHistory(req.id, requester.id, scenario, createdAt);
    await addNotif(target.id, req.id, 'New Appointment Request',
      `${requester.profile?.fullName ?? 'Student'} has requested an appointment.`, addHours(createdAt, 0.2));
  }
  console.log('  ✓ 30 appointment');

  // ── 7. ACCESS REQUEST — 30 ───────────────────────────────────────────────
  console.log('⚙️  Access Request (30)...');
  const accRT = rtMap.get('ACCESS_REQUEST')!;
  const accWF = wfMap.get('ACCESS_REQUEST');

  for (let i = 0; i < 30; i++) {
    const requester = pick([...students, ...faculty, ...staff]);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const createdAt = randDate(daysAgo(120), daysAgo(1));
    const title = pick(ACCESS_TITLES);
    const accessType = pick(ACCESS_TYPES);
    const targetResource = pick(ACCESS_TARGETS);
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(24, 96)) : null;

    const req = await prisma.request.create({
      data: {
        requestTypeId: accRT.id,
        requestNo: nextNo('ACC'),
        title,
        description: `${targetResource} access request.`,
        status,
        priority: PriorityLevel.MEDIUM,
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
        requestedRoleOrPermission: maybe(0.5) ? pick(['READ', 'READ_WRITE', 'ADMIN']) : null,
        justification: pick([
          'Required for the scope of the research project.',
          'Access needed for job duties.',
          'My advisor approved it.',
          'Project deadline is approaching.',
        ]),
        startAt,
        endAt: maybe(0.6) ? addDays(startAt, rand(30, 365)) : null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    if (accWF) {
      await attachWF(req.id, accWF, scenario, createdAt, completedAt, allStaff, requester.id);
    }
    await addComments(req.id, requester.id, allStaff.map((u) => u.id),
      ACCESS_CMT_USER, ACCESS_CMT_STAFF, [], createdAt);
    await addStatusHistory(req.id, requester.id, scenario, createdAt);
    await addNotif(requester.id, req.id, 'Your Access Request Has Been Received',
      `Your ${targetResource} access request has been received.`, addHours(createdAt, 0.2));
  }
  console.log('  ✓ 30 access request');

  // ── 8. PROCUREMENT REQUEST — 30 ──────────────────────────────────────────
  console.log('⚙️  Procurement (30)...');
  const procRT = rtMap.get('PROCUREMENT_REQUEST')!;
  const procWF = wfMap.get('PROCUREMENT_REQUEST');

  for (let i = 0; i < 30; i++) {
    const requester = pick([...faculty, ...staff]);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const createdAt = randDate(daysAgo(180), daysAgo(7));
    const title = pick(PROC_TITLES);
    const itemName = pick(PROC_ITEMS);
    const qty = rand(1, 10);
    const unitPrice = rand(1000, 50000);
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(72, 240)) : null;

    const req = await prisma.request.create({
      data: {
        requestTypeId: procRT.id,
        requestNo: nextNo('PROC'),
        title,
        description: `${itemName} purchase request. Quantity: ${qty}.`,
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
        itemCategory: pick(PROC_CATS),
        quantity: qty,
        unitPriceEstimate: unitPrice,
        totalEstimate: unitPrice * qty,
        vendorPreference: maybe(0.4) ? pick(['TechStore', 'MediaMarkt', 'IT Distributor']) : null,
        justification: pick([
          'Required for the research project.',
          'Existing equipment is faulty.',
          'Capacity increase is required.',
          'New academic office setup.',
        ]),
        budgetCode: maybe(0.6) ? `BDG-${rand(100, 999)}` : null,
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
      [], PROC_CMT_STAFF, [], createdAt);
    await addStatusHistory(req.id, requester.id, scenario, createdAt);
    await addNotif(requester.id, req.id, 'Your Procurement Request Has Been Received',
      `Your ${itemName} purchase request has been processed.`, addHours(createdAt, 0.2));
  }
  console.log('  ✓ 30 procurement');

  // ── 9. EVENT REQUEST — 30 ────────────────────────────────────────────────
  console.log('⚙️  Event Request (30)...');
  const evRT = rtMap.get('EVENT_REQUEST')!;
  const evWF = wfMap.get('EVENT_REQUEST');

  for (let i = 0; i < 30; i++) {
    const requester = organizers.length > 0 ? pick(organizers) : pick([...students, ...faculty]);
    const scenario = pickScenario();
    const status = scenarioToStatus(scenario);
    const createdAt = randDate(daysAgo(150), daysAgo(7));
    const title = pick(EVENT_TITLES);
    const eventType = pick(EVENT_TYPES);
    const expectedAttendance = rand(50, 500);
    const startAt = addDays(createdAt, rand(14, 60));
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(48, 168)) : null;

    const req = await prisma.request.create({
      data: {
        requestTypeId: evRT.id,
        requestNo: nextNo('EVT'),
        title,
        description: `Event organization request of type ${eventType}.`,
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
        description: `${title} - ${eventType} event`,
        expectedAttendance,
        locationPreference: maybe(0.6)
          ? pick(['Main Campus Amphitheater', 'Conference Hall', 'Open Area', 'Sports Field'])
          : null,
        startAt,
        endAt: addHours(startAt, rand(2, 8)),
        needsBudget: maybe(0.5),
        estimatedBudget: maybe(0.4) ? rand(5000, 100000) : null,
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
      EVT_CMT_ORG, EVT_CMT_COORD, [], createdAt);
    await addStatusHistory(req.id, requester.id, scenario, createdAt);
    await addNotif(requester.id, req.id, 'Your Event Request Has Been Received',
      `Your event request "${title}" has been processed.`, addHours(createdAt, 0.2));
  }
  console.log('  ✓ 30 event request');

  // ── 10. EVENT CREATION REQUEST — 10 ──────────────────────────────────────
  console.log('⚙️  Event Creation Request (10)...');
  const ecrRT = rtMap.get('EVENT_CREATION_REQUEST')!;
  const ecrWF = wfMap.get('EVENT_CREATION_REQUEST');

  for (let i = 0; i < 10; i++) {
    const organizer = organizers.length > 0 ? pick(organizers) : pick(faculty);
    const scenario = pick<Scenario>([
      'COMPLETED', 'COMPLETED', 'IN_REVIEW_MID', 'WAITING_APPROVAL', 'REJECTED_EARLY',
    ]);
    const status = scenarioToStatus(scenario);
    const createdAt = randDate(daysAgo(150), daysAgo(14));
    const title = pick(EVENT_TITLES);
    const eventType = pick(EVENT_TYPES);
    const completedAt = status === RequestStatus.COMPLETED ? addHours(createdAt, rand(72, 240)) : null;
    const proposedStart = addDays(createdAt, rand(21, 90));
    const minAttendance = rand(30, 100);
    const targetAttendance = minAttendance + rand(50, 400);
    const regStart = addDays(createdAt, rand(5, 15));
    const regEnd = addDays(proposedStart, -3);

    const plan = await prisma.eventPlan.create({
      data: {
        organizerUserId: organizer.id,
        title,
        description: `${eventType} event plan`,
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
        requestNo: nextNo('ECR'),
        title: `Event Creation: ${title}`,
        description: `Event creation request of type ${eventType}.`,
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
        locationText: pick(['Main Campus', 'City Campus', 'Amphitheater']),
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
          locationText: pick(['Main Amphitheater', 'Conference Hall', 'Open Area']),
          startAt: proposedStart,
          endAt: addHours(proposedStart, rand(2, 8)),
          status: maybe(0.5) ? 'PUBLISHED' : 'CONFIRMED',
          minimumAttendance: minAttendance,
          targetAttendance,
          registrationStartAt: regStart,
          registrationEndAt: regEnd,
          registrationCount: rand(50, 200),
          publishedAt: completedAt,
          confirmedAt: completedAt,
          createdAt,
          updatedAt: completedAt ?? createdAt,
        },
      });

      const regCount = rand(30, Math.min(100, students.length));
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

      // Pre-registrations on the plan
      const preCount = rand(10, Math.min(50, students.length));
      const preUsed = new Set<string>();
      for (let j = 0; j < preCount; j++) {
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
      EVT_CMT_ORG, EVT_CMT_COORD, [], createdAt);
    await addStatusHistory(req.id, organizer.id, scenario, createdAt);
    await addNotif(organizer.id, req.id, 'Your Event Creation Request Has Been Received',
      `Your creation request for "${title}" has been processed.`, addHours(createdAt, 0.2));
  }
  console.log('  ✓ 10 event creation request');

  // ── 11. Audit Logs — 500 ─────────────────────────────────────────────────
  console.log('⚙️  Audit logs (500)...');
  const allReqs = await prisma.request.findMany({ select: { id: true }, take: 200 });
  const AUDIT_ACTIONS: AuditActionType[] = [
    AuditActionType.CREATE, AuditActionType.UPDATE, AuditActionType.APPROVE,
    AuditActionType.REJECT, AuditActionType.STATUS_CHANGE, AuditActionType.ASSIGN,
    AuditActionType.LOGIN, AuditActionType.LOGOUT, AuditActionType.EXPORT,
  ];
  const UAS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (Linux; Android 12; Pixel 6)',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
  ];

  for (let i = 0; i < 500; i++) {
    const actor = pick(allUsers);
    const action = pick(AUDIT_ACTIONS);
    const useReq = allReqs.length > 0 && maybe(0.6);
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        actionType: action,
        entityType: useReq ? 'Request' : pick(['User', 'Role', 'Resource', 'WorkflowInstance']),
        entityId: useReq ? pick(allReqs).id : actor.id,
        ipAddress: `${rand(10, 200)}.${rand(0, 255)}.${rand(0, 255)}.${rand(1, 254)}`,
        userAgent: pick(UAS),
        createdAt: randDate(daysAgo(180), daysAgo(0)),
      },
    });
  }
  console.log('  ✓ 500 audit logs');

  // ── 12. System Events — 200 ───────────────────────────────────────────────
  console.log('⚙️  System events (200)...');
  const SYS_KEYS = [
    'workflow.step.completed', 'workflow.step.escalated', 'sla.breach.detected',
    'request.status.changed', 'ticket.assigned', 'email.sent', 'email.failed',
    'login.success', 'login.failed', 'system.startup', 'integration.webhook.sent',
    'notification.delivered', 'integration.webhook.failed', 'scheduler.run',
  ];
  const SYS_MSGS = [
    'Workflow step completed.', 'SLA breach detected.', 'Email sent.',
    'User logged in.', 'Error occurred, will retry.', 'System started.',
    'Webhook delivered successfully.', 'Notification delivered.', 'Scheduler executed.',
    'Connection timed out.', 'Request rejected.', 'Cache cleared.',
  ];

  for (let i = 0; i < 200; i++) {
    await prisma.systemEvent.create({
      data: {
        eventKey: pick(SYS_KEYS),
        severity: pick(['INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'DEBUG']),
        sourceService: pick(['workflow-engine', 'notification-service', 'it-support', 'auth-service', 'email-service', 'scheduler']),
        entityType: maybe(0.6) ? pick(['Request', 'User', 'WorkflowInstance']) : null,
        entityId: allReqs.length > 0 && maybe(0.5) ? pick(allReqs).id : pick(allUsers).id,
        message: pick(SYS_MSGS),
        createdAt: randDate(daysAgo(180), daysAgo(0)),
      },
    });
  }
  console.log('  ✓ 200 system events');

  // ── 13. Login History — 150 ───────────────────────────────────────────────
  console.log('⚙️  Login history (150)...');
  for (let i = 0; i < 150; i++) {
    const u = pick(allUsers);
    const loginAt = randDate(daysAgo(60), daysAgo(0));
    await prisma.loginHistory.create({
      data: {
        userId: u.id,
        loginAt,
        logoutAt: maybe(0.7) ? addHours(loginAt, rand(1, 8)) : null,
        ipAddress: `${rand(10, 200)}.${rand(0, 255)}.${rand(0, 255)}.${rand(1, 254)}`,
        userAgent: pick(UAS),
        success: maybe(0.92),
        failureReason: maybe(0.08) ? pick(['Wrong password', 'Account locked', 'IP blocked']) : null,
        createdAt: loginAt,
      },
    });
  }
  console.log('  ✓ 150 login records');

  // ── 14. AI Conversations — 30 ─────────────────────────────────────────────
  console.log('⚙️  AI conversations (30)...');
  const PORTALS = ['student', 'faculty', 'staff', 'admin', 'organizer'];
  const AI_QA = [
    { q: 'How do I apply for an internship?', a: 'To apply for an internship, first contact your advisor, then go to the "Internship Application" section in the portal and follow the steps.' },
    { q: 'How can I open an IT support ticket?', a: 'Click on "IT Support" from the left menu, press the "New Request" button, select the issue category and fill out the form.' },
    { q: 'How can I get my transcript?', a: 'Select the transcript option from the "Document Requests" section and complete the application. It will be ready within 2-3 business days.' },
    { q: 'When will my reservation request be approved?', a: 'Reservation requests are usually processed within 1-2 business days. Check your notifications for real-time status.' },
    { q: 'What should I do to make an appointment?', a: 'Select an available time slot from the "Appointment Requests" section and create a request. You will receive a notification when the faculty member approves it.' },
    { q: 'How can I track the status of my request?', a: 'You can view all your active and past requests from the "My Requests" page. The workflow steps are displayed on each request detail page.' },
    { q: 'How do I return equipment?', a: 'Return the borrowed equipment to the Lab Technical Office on the specified date. The system will be updated automatically.' },
  ];

  for (let i = 0; i < 30; i++) {
    const u = pick(allUsers);
    const portal = pick(PORTALS);
    const sessionId = `sess-synth-${i}-${Date.now()}`;
    const createdAt = randDate(daysAgo(60), daysAgo(0));

    try {
      const conv = await prisma.aiConversation.create({
        data: {
          userId: u.id,
          portal,
          sessionId,
          createdAt,
          updatedAt: createdAt,
        },
      });

      const qa = pick(AI_QA);
      await prisma.aiMessage.create({
        data: {
          conversationId: conv.id,
          userId: u.id,
          messageType: 'USER',
          content: qa.q,
          createdAt,
        },
      });
      await prisma.aiMessage.create({
        data: {
          conversationId: conv.id,
          userId: u.id,
          messageType: 'ASSISTANT',
          content: qa.a,
          createdAt: addHours(createdAt, 0.01),
        },
      });

      // Sometimes add follow-up
      if (maybe(0.4)) {
        const qa2 = pick(AI_QA);
        await prisma.aiMessage.create({
          data: {
            conversationId: conv.id,
            userId: u.id,
            messageType: 'USER',
            content: qa2.q,
            createdAt: addHours(createdAt, 0.05),
          },
        });
        await prisma.aiMessage.create({
          data: {
            conversationId: conv.id,
            userId: u.id,
            messageType: 'ASSISTANT',
            content: qa2.a,
            createdAt: addHours(createdAt, 0.06),
          },
        });
      }
    } catch { /* skip session uniqueness conflicts */ }
  }
  console.log('  ✓ 30 AI conversations');

  // ── 15. Extra email logs — 100 ────────────────────────────────────────────
  console.log('⚙️  Email logs (100)...');
  const freshReqs = await prisma.request.findMany({ select: { id: true }, take: 300 });
  const EMAIL_TEMPLATES = [
    'request.submitted', 'request.approved', 'request.rejected',
    'request.revision_requested', 'notification.general', 'ticket.assigned',
  ];
  const EMAIL_SUBJECTS = [
    'Your Request Has Been Received', 'Your Request Has Been Approved', 'Your Request Has Been Rejected',
    'Revision Required', 'IT Support - Assignment Notification', 'New Notification',
  ];

  for (let i = 0; i < 100; i++) {
    const u = pick(allUsers);
    const req = freshReqs.length > 0 ? pick(freshReqs) : null;
    const sent = maybe(0.85);
    const createdAt = randDate(daysAgo(180), daysAgo(0));
    await prisma.emailLog.create({
      data: {
        userId: u.id,
        requestId: req?.id ?? null,
        toEmail: u.email,
        subject: pick(EMAIL_SUBJECTS),
        templateKey: pick(EMAIL_TEMPLATES),
        status: sent ? NotificationStatus.DELIVERED : NotificationStatus.FAILED,
        errorMessage: !sent ? 'SMTP timeout' : null,
        sentAt: sent ? addHours(createdAt, 0.1) : null,
        createdAt,
        updatedAt: createdAt,
      },
    });
  }
  console.log('  ✓ 100 email logs');

  // ── Summary ───────────────────────────────────────────────────────────────
  const [reqCount, commentCount, wfCount, notifCount, auditCount, sysCount] = await Promise.all([
    prisma.request.count(),
    prisma.requestComment.count(),
    prisma.workflowInstance.count(),
    prisma.notification.count(),
    prisma.auditLog.count(),
    prisma.systemEvent.count(),
  ]);

  console.log('\n✅ Synthetic seed completed!');
  console.log(`   Requests        : ${reqCount}`);
  console.log(`   Comments        : ${commentCount}`);
  console.log(`   WF Instances    : ${wfCount}`);
  console.log(`   Notifications   : ${notifCount}`);
  console.log(`   Audit Logs      : ${auditCount}`);
  console.log(`   System Events   : ${sysCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Synthetic seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
