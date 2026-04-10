/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { extractUserId } from '../core/auth/extract-user-id';
import { AssignRoleDto } from './dto/assign-role.dto';
import { AdminUpdateProfileDto } from './dto/admin-update-profile.dto';
import { UpdateRequestTypeDto } from '../requests/dto/update-request-type.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Get('users/:id')
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Get('users/:id/roles')
  getUserRoles(@Param('id') id: string) {
    return this.adminService.getUserRoles(id);
  }

  @Post('users/:id/roles')
  assignRole(
    @CurrentUser('userId') adminId: string,
    @Param('id') userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.adminService.assignRole(adminId, userId, dto);
  }

  @Delete('users/:id/roles/:roleId')
  removeRole(
    @CurrentUser('userId') adminId: string,
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.adminService.removeRole(adminId, userId, roleId);
  }

  @Put('users/:id/profile')
  updateUserProfile(
    @CurrentUser('userId') adminId: string,
    @Param('id') userId: string,
    @Body() dto: AdminUpdateProfileDto,
  ) {
    return this.adminService.updateUserProfile(adminId, userId, dto);
  }

  @Get('roles')
  getRoles() {
    return this.adminService.getRoles();
  }

  // 🔥 AUDIT LOG İÇİN REQ PARAMETRESİ EKLENDİ 🔥
  @Post('users')
  createUser(@Request() req: any, @Body() data: any) {
    return this.adminService.createUser(extractUserId(req), data);
  }

  // 🔥 AUDIT LOG İÇİN REQ PARAMETRESİ EKLENDİ 🔥
  @Put('users/:id')
  updateUser(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.adminService.updateUser(extractUserId(req), id, data);
  }

  // 🔥 AUDIT LOG İÇİN REQ PARAMETRESİ EKLENDİ 🔥
  @Delete('users/:id')
  deleteUser(@Request() req: any, @Param('id') id: string) {
    return this.adminService.deleteUser(extractUserId(req), id);
  }

  @Get('requests')
  getAllRequests() {
    return this.adminService.getAllRequests();
  }

  @Get('requests/:id')
  getRequestById(@Param('id') id: string) {
    return this.adminService.getRequestById(id);
  }

  @Delete('requests/:id')
  deleteRequest(@Param('id') id: string) {
    return this.adminService.deleteRequest(id);
  }

  @Post('requests/bulk-delete')
  bulkDelete(@Body('ids') ids: string[]) {
    return this.adminService.bulkDeleteRequests(ids);
  }

  // 🔥 BİLDİRİM (NOTIFICATION) ENDPOINTLERİ 🔥

  @Get('notifications')
  getNotifications(@Request() req: any) {
    return this.adminService.getNotifications(extractUserId(req));
  }

  @Post('notifications/:id/read')
  markNotificationAsRead(@Request() req: any, @Param('id') id: string) {
    return this.adminService.markNotificationAsRead(extractUserId(req), id);
  }

  @Post('notifications/read-all')
  markAllNotificationsAsRead(@Request() req: any) {
    return this.adminService.markAllNotificationsAsRead(extractUserId(req));
  }

  @Delete('notifications')
  deleteNotifications(@Request() req: any, @Body('ids') ids: string[]) {
    return this.adminService.deleteNotifications(extractUserId(req), ids);
  }

  // 🔥 AYARLAR VE GÜVENLİK (SETTINGS) ENDPOINTLERİ 🔥

  @Get('settings/preferences')
  getPreferences(@Request() req: any) {
    return this.adminService.getPreferences(extractUserId(req));
  }

  @Put('settings/preferences')
  updatePreferences(@Request() req: any, @Body() body: any) {
    return this.adminService.updatePreferences(extractUserId(req), body);
  }

  @Post('settings/change-password')
  changePassword(@Request() req: any, @Body() body: any) {
    return this.adminService.changePassword(extractUserId(req), body);
  }

  @Get('settings/me')
  getMe(@Request() req: any) {
    return this.adminService.getMe(extractUserId(req));
  }

  @Put('settings/me')
  updateMe(@Request() req: any, @Body() body: any) {
    return this.adminService.updateMe(extractUserId(req), body);
  }

  // 🔥 TALEP TİPLERİ (REQUEST TYPES) ENDPOINTLERİ 🔥

  @Get('request-types')
  getRequestTypes() {
    return this.adminService.getRequestTypes();
  }

  @Post('request-types')
  createRequestType(@Body() data: any) {
    return this.adminService.createRequestType(data);
  }

  @Get('request-types/:id')
  getRequestTypeById(@Param('id') id: string) {
    return this.adminService.getRequestTypeById(id);
  }

  @Patch('request-types/:id')
  updateRequestType(@Param('id') id: string, @Body() dto: UpdateRequestTypeDto) {
    return this.adminService.updateRequestType(id, dto);
  }

  @Post('request-types/bulk-delete')
  bulkDeleteRequestTypes(@Body('ids') ids: string[]) {
    return this.adminService.bulkDeleteRequestTypes(ids);
  }

  // 🔥 AUDIT & LOGIN LOGLARI (SİSTEM GEÇMİŞİ) 🔥
  @Get('audit-logs')
  getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getAuditLogs({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 100,
      search,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ORGANIZATION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  @Get('organization')
  getOrganization() {
    return this.adminService.getOrganization();
  }

  // CAMPUS
  @Get('campuses')
  getCampuses() {
    return this.adminService.getCampuses();
  }

  @Post('campuses')
  createCampus(@Request() req: any, @Body() data: any) {
    return this.adminService.createCampus(extractUserId(req), data);
  }

  @Put('campuses/:id')
  updateCampus(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.adminService.updateCampus(extractUserId(req), id, data);
  }

  @Delete('campuses/:id')
  deleteCampus(@Request() req: any, @Param('id') id: string) {
    return this.adminService.deleteCampus(extractUserId(req), id);
  }

  // FACULTY
  @Get('faculties')
  getFaculties() {
    return this.adminService.getFaculties();
  }

  @Post('faculties')
  createFaculty(@Request() req: any, @Body() data: any) {
    return this.adminService.createFaculty(extractUserId(req), data);
  }

  @Put('faculties/:id')
  updateFaculty(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.adminService.updateFaculty(extractUserId(req), id, data);
  }

  @Delete('faculties/:id')
  deleteFaculty(@Request() req: any, @Param('id') id: string) {
    return this.adminService.deleteFaculty(extractUserId(req), id);
  }

  // DEPARTMENT
  @Get('departments')
  getDepartments() {
    return this.adminService.getDepartments();
  }

  @Post('departments')
  createDepartment(@Request() req: any, @Body() data: any) {
    return this.adminService.createDepartment(extractUserId(req), data);
  }

  @Put('departments/:id')
  updateDepartment(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.adminService.updateDepartment(extractUserId(req), id, data);
  }

  @Delete('departments/:id')
  deleteDepartment(@Request() req: any, @Param('id') id: string) {
    return this.adminService.deleteDepartment(extractUserId(req), id);
  }

  // UNIT
  @Get('units')
  getUnits() {
    return this.adminService.getUnits();
  }

  @Post('units')
  createUnit(@Request() req: any, @Body() data: any) {
    return this.adminService.createUnit(extractUserId(req), data);
  }

  @Put('units/:id')
  updateUnit(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.adminService.updateUnit(extractUserId(req), id, data);
  }

  @Delete('units/:id')
  deleteUnit(@Request() req: any, @Param('id') id: string) {
    return this.adminService.deleteUnit(extractUserId(req), id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ROLES FULL CRUD
  // ─────────────────────────────────────────────────────────────────────────

  @Get('roles-full')
  getRolesFull() {
    return this.adminService.getRolesFull();
  }

  @Post('roles')
  createRole(@Request() req: any, @Body() data: any) {
    return this.adminService.createRole(extractUserId(req), data);
  }

  @Put('roles/:id')
  updateRole(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.adminService.updateRole(extractUserId(req), id, data);
  }

  @Delete('roles/:id')
  deleteRole(@Request() req: any, @Param('id') id: string) {
    return this.adminService.deleteRole(extractUserId(req), id);
  }

  @Get('permissions')
  getPermissions() {
    return this.adminService.getPermissions();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESOURCES CRUD
  // ─────────────────────────────────────────────────────────────────────────

  @Get('resources')
  getResources() {
    return this.adminService.getResources();
  }

  @Post('resources')
  createResource(@Request() req: any, @Body() data: any) {
    return this.adminService.createResource(extractUserId(req), data);
  }

  @Get('resources/:id')
  getResourceById(@Param('id') id: string) {
    return this.adminService.getResourceById(id);
  }

  @Put('resources/:id')
  updateResource(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.adminService.updateResource(extractUserId(req), id, data);
  }

  @Patch('resources/:id')
  patchResource(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.adminService.updateResource(extractUserId(req), id, data);
  }

  @Put('resources/:id/availability')
  replaceResourceAvailability(
    @Request() req: any,
    @Param('id') id: string,
    @Body('slots') slots: any[],
  ) {
    return this.adminService.replaceResourceAvailability(extractUserId(req), id, slots ?? []);
  }

  @Delete('resources/:id')
  deleteResource(@Request() req: any, @Param('id') id: string) {
    return this.adminService.deleteResource(extractUserId(req), id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // READ-ONLY LISTS
  // ─────────────────────────────────────────────────────────────────────────

  @Get('reservations')
  getReservations() {
    return this.adminService.getReservations();
  }

  @Get('appointments')
  getAppointments() {
    return this.adminService.getAppointments();
  }

  @Get('tickets')
  getTickets() {
    return this.adminService.getTickets();
  }

  @Get('sla')
  getSLAPolicies() {
    return this.adminService.getSLAPolicies();
  }

  @Get('sla/overview')
  getSLAOverview() {
    return this.adminService.getSLAOverview();
  }

  @Post('sla')
  createSLAPolicy(@Request() req: any, @Body() data: any) {
    return this.adminService.createSLAPolicy(extractUserId(req), data);
  }

  @Get('sla/:id')
  getSLAPolicyById(@Param('id') id: string) {
    return this.adminService.getSLAPolicyById(id);
  }

  @Patch('sla/:id')
  updateSLAPolicy(@Request() req: any, @Param('id') id: string, @Body() data: any) {
    return this.adminService.updateSLAPolicy(extractUserId(req), id, data);
  }

  @Delete('sla/:id')
  deleteSLAPolicy(@Request() req: any, @Param('id') id: string) {
    return this.adminService.deleteSLAPolicy(extractUserId(req), id);
  }

  @Get('equipment')
  getEquipmentRequests() {
    return this.adminService.getEquipmentRequests();
  }

  @Get('internships')
  getInternships() {
    return this.adminService.getInternships();
  }

  @Get('procurement')
  getProcurementRequests() {
    return this.adminService.getProcurementRequests();
  }

  @Get('events')
  getEventRequests() {
    return this.adminService.getEventRequests();
  }

  @Get('access-requests')
  getAccessRequests() {
    return this.adminService.getAdminAccessRequests();
  }

  @Get('system-events')
  getSystemEvents() {
    return this.adminService.getSystemEvents();
  }

  @Get('webhook-logs')
  getWebhookLogs() {
    return this.adminService.getWebhookLogs();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORKFLOWS CRUD
  // ─────────────────────────────────────────────────────────────────────────

  @Get('workflows-admin')
  getWorkflows() {
    return this.adminService.getWorkflows();
  }

  @Post('workflows-admin')
  createWorkflow(@Request() req: any, @Body() data: any) {
    return this.adminService.createWorkflow(extractUserId(req), data);
  }

  @Delete('workflows-admin/:id')
  deleteWorkflow(@Request() req: any, @Param('id') id: string) {
    return this.adminService.deleteWorkflow(extractUserId(req), id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REPORTS / ANALYTICS
  // ─────────────────────────────────────────────────────────────────────────

  @Get('reports')
  getReports() {
    return this.adminService.getReports();
  }

  @Get('metrics')
  getMetrics() {
    return this.adminService.getDashboardMetrics();
  }

  @Get('dashboard/summary')
  getDashboardSummary() {
    return this.adminService.getDashboardMetrics();
  }

  @Get('analytics/overview')
  getAnalyticsOverview() {
    return this.adminService.getAnalyticsOverview();
  }

  @Get('analytics')
  getAnalytics() {
    return this.adminService.getAnalyticsOverview();
  }

  @Get('login-history')
  getLoginHistory(@Request() req: any) {
    return this.adminService.getLoginHistory(extractUserId(req));
  }

  @Get('integrations')
  getIntegrations() {
    return this.adminService.getIntegrations();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACADEMIC TERMS
  // ─────────────────────────────────────────────────────────────────────────

  @Get('academic-terms')
  getAcademicTerms() {
    return this.adminService.getAcademicTerms();
  }

  @Post('academic-terms')
  createAcademicTerm(@Body() data: any) {
    return this.adminService.createAcademicTerm(data);
  }

  @Patch('academic-terms/:id')
  updateAcademicTerm(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateAcademicTerm(id, data);
  }
}
