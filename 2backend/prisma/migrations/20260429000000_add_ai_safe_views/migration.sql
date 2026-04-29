-- AI Safe Views: read-only views for AI assistant access
-- All views exclude deleted records and sensitive columns.

CREATE OR REPLACE VIEW "ai_requests_view" AS
SELECT
  r."id",
  r."requestNo"             AS request_no,
  r."title",
  r."description",
  r."status",
  r."priority",
  r."requesterUserId"       AS requester_user_id,
  r."currentAssigneeUserId" AS assignee_user_id,
  r."facultyId"             AS faculty_id,
  r."departmentId"          AS department_id,
  r."unitId"                AS unit_id,
  rt."key"                  AS request_type_key,
  rt."name"                 AS request_type_name,
  r."submittedAt"           AS submitted_at,
  r."dueAt"                 AS due_at,
  r."createdAt"             AS created_at,
  r."updatedAt"             AS updated_at
FROM "Request" r
LEFT JOIN "RequestType" rt ON rt."id" = r."requestTypeId"
WHERE r."deletedAt" IS NULL;

CREATE OR REPLACE VIEW "ai_tickets_view" AS
SELECT
  t."id",
  t."requestId"          AS request_id,
  t."reportedByUserId"   AS reported_by_user_id,
  t."assignedItUserId"   AS assigned_it_user_id,
  t."category",
  t."subcategory",
  t."ticketStatus"       AS ticket_status,
  t."affectedSystem"     AS affected_system,
  t."resolutionSummary"  AS resolution_summary,
  t."resolvedAt"         AS resolved_at,
  t."closedAt"           AS closed_at,
  t."createdAt"          AS created_at,
  t."updatedAt"          AS updated_at,
  r."title"              AS request_title,
  r."status"             AS request_status,
  r."priority"           AS request_priority,
  r."dueAt"              AS due_at,
  r."facultyId"          AS faculty_id,
  r."departmentId"       AS department_id
FROM "ItTicket" t
JOIN "Request" r ON r."id" = t."requestId"
WHERE r."deletedAt" IS NULL;

CREATE OR REPLACE VIEW "ai_approvals_view" AS
SELECT
  aa."id",
  aa."requestId"       AS request_id,
  aa."actionType"      AS action_type,
  aa."actionByUserId"  AS action_by_user_id,
  aa."decisionNote"    AS decision_note,
  aa."createdAt"       AS created_at,
  r."title"            AS request_title,
  rt."key"             AS request_type_key,
  rt."name"            AS request_type_name,
  r."status"           AS request_status,
  r."priority"         AS request_priority,
  r."requesterUserId"  AS request_owner_id
FROM "ApprovalAction" aa
JOIN "Request" r ON r."id" = aa."requestId"
LEFT JOIN "RequestType" rt ON rt."id" = r."requestTypeId"
WHERE r."deletedAt" IS NULL;

CREATE OR REPLACE VIEW "ai_users_limited_view" AS
SELECT
  u."id",
  p."fullName"     AS full_name,
  u."email",
  u."status",
  p."facultyId"    AS faculty_id,
  p."departmentId" AS department_id,
  p."unitId"       AS unit_id,
  u."createdAt"    AS created_at
FROM "User" u
LEFT JOIN "UserProfile" p ON p."userId" = u."id"
WHERE u."deletedAt" IS NULL;

CREATE OR REPLACE VIEW "ai_dashboard_view" AS
SELECT
  u."id" AS user_id,
  COUNT(DISTINCT CASE WHEN r."requesterUserId" = u."id" THEN r."id" END)
    AS total_created_requests,
  COUNT(DISTINCT CASE WHEN r."currentAssigneeUserId" = u."id" THEN r."id" END)
    AS total_assigned_requests,
  COUNT(DISTINCT CASE WHEN r."requesterUserId" = u."id"
    AND r."status" IN ('DRAFT','SUBMITTED','IN_REVIEW','WAITING_APPROVAL') THEN r."id" END)
    AS open_requests,
  COUNT(DISTINCT CASE WHEN r."requesterUserId" = u."id"
    AND r."status" = 'WAITING_APPROVAL' THEN r."id" END)
    AS pending_approvals,
  COUNT(DISTINCT CASE WHEN r."requesterUserId" = u."id"
    AND r."status" = 'APPROVED' THEN r."id" END)
    AS approved_requests,
  COUNT(DISTINCT CASE WHEN r."requesterUserId" = u."id"
    AND r."status" = 'REJECTED' THEN r."id" END)
    AS rejected_requests
FROM "User" u
LEFT JOIN "Request" r
  ON (r."requesterUserId" = u."id" OR r."currentAssigneeUserId" = u."id")
  AND r."deletedAt" IS NULL
WHERE u."deletedAt" IS NULL
GROUP BY u."id";
