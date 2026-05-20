export const RealtimeRooms = {
  user: (userId: string) => `user:${userId}`,
  role: (role: string) => `role:${role}`,
  subrole: (subRole: string) => `subrole:${subRole}`,
  faculty: (facultyId: string) => `faculty:${facultyId}`,
  department: (departmentId: string) => `department:${departmentId}`,
  unit: (unitId: string) => `unit:${unitId}`,
  request: (requestId: string) => `request:${requestId}`,
  ticket: (ticketId: string) => `ticket:${ticketId}`,
  workflow: (workflowInstanceId: string) => `workflow:${workflowInstanceId}`,
  portal: (portal: string) => `portal:${portal}`,
};
