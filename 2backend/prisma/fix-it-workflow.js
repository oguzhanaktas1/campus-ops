// One-time fix: removes duplicate IT workflow transitions and recreates them correctly.
// Run with: node prisma/fix-it-workflow.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const workflow = await prisma.workflowDefinition.findUnique({
    where: { key: 'WF_IT_SUPPORT_V1' },
  });

  if (!workflow) {
    console.error('WF_IT_SUPPORT_V1 not found in DB');
    return;
  }

  const steps = await prisma.workflowStep.findMany({
    where: { workflowDefinitionId: workflow.id },
    select: { id: true, stepKey: true },
  });

  const stepMap = Object.fromEntries(steps.map((s) => [s.stepKey, s.id]));
  console.log('Steps found:', Object.keys(stepMap).join(', '));

  const deleted = await prisma.workflowTransition.deleteMany({
    where: { workflowDefinitionId: workflow.id },
  });
  console.log(`Deleted ${deleted.count} old transitions`);

  const transitions = [
    { from: 'SUBMIT',             to: 'IT_REVIEW',         action: 'SUBMIT' },
    { from: 'IT_REVIEW',          to: 'MANAGER_APPROVAL',  action: 'APPROVE' },
    { from: 'IT_REVIEW',          to: 'REVISION',          action: 'REQUEST_REVISION' },
    { from: 'IT_REVIEW',          to: 'REJECTED_END',      action: 'REJECT' },
    { from: 'MANAGER_APPROVAL',   to: 'APPROVED_END',      action: 'APPROVE' },
    { from: 'MANAGER_APPROVAL',   to: 'REVISION',          action: 'REQUEST_REVISION' },
    { from: 'MANAGER_APPROVAL',   to: 'REJECTED_END',      action: 'REJECT' },
    { from: 'REVISION',           to: 'IT_REVIEW',         action: 'SUBMIT' },
  ];

  for (const t of transitions) {
    const fromStepId = stepMap[t.from];
    const toStepId   = stepMap[t.to] ?? null;

    if (!fromStepId) { console.warn(`  SKIP (step not found): ${t.from}`); continue; }
    if (t.to && !toStepId) { console.warn(`  SKIP (step not found): ${t.to}`); continue; }

    await prisma.workflowTransition.create({
      data: { workflowDefinitionId: workflow.id, fromStepId, toStepId, actionType: t.action },
    });
    console.log(`  Created: ${t.from} → ${t.to} (${t.action})`);
  }

  console.log('Done.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
