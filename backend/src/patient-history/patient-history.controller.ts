import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PatientHistoryService } from './patient-history.service';
import {
  CreatePatientProfileDto,
  UpdatePatientProfileDto,
  EmergencyContactDto,
  CreateMedicalHistoryDto,
  TriggerAiAnalysisDto,
  ReviewHistoryDto,
} from './dto/patient-history.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Patient History')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class PatientHistoryController {
  constructor(private readonly service: PatientHistoryService) {}

  // ═══════════════════════════════════════════════════════
  // PATIENT PROFILE ENDPOINTS
  // ═══════════════════════════════════════════════════════

  @Post('patients')
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Create a new patient profile' })
  async createPatient(@Body() dto: CreatePatientProfileDto) {
    return this.service.createPatientProfile(dto);
  }

  @Get('patients')
  @Roles('DOCTOR', 'ADMIN', 'LAB_SCIENTIST')
  @ApiOperation({ summary: 'List patients with optional search' })
  async listPatients(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('search') search?: string,
  ) {
    return this.service.listPatients({ skip: Number(skip) || 0, take: Number(take) || 20, search });
  }

  @Get('patients/:id')
  @Roles('DOCTOR', 'ADMIN', 'LAB_SCIENTIST')
  @ApiOperation({ summary: 'Get patient profile by ID' })
  async getPatient(@Param('id') id: string) {
    return this.service.getPatientProfile(id);
  }

  @Get('patients/case/:caseNumber')
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Get patient by case number' })
  async getPatientByCase(@Param('caseNumber') caseNumber: string) {
    return this.service.getPatientByCaseNumber(caseNumber);
  }

  @Put('patients/:id')
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Update patient profile' })
  async updatePatient(@Param('id') id: string, @Body() dto: UpdatePatientProfileDto) {
    return this.service.updatePatientProfile(id, dto);
  }

  @Delete('patients/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete patient profile' })
  async deletePatient(@Param('id') id: string) {
    return this.service.deletePatientProfile(id);
  }

  // ═══════════════════════════════════════════════════════
  // EMERGENCY CONTACT ENDPOINTS
  // ═══════════════════════════════════════════════════════

  @Post('patients/:patientId/emergency-contacts')
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Add emergency contact to patient' })
  async addEmergencyContact(
    @Param('patientId') patientId: string,
    @Body() dto: EmergencyContactDto,
  ) {
    return this.service.addEmergencyContact(patientId, dto);
  }

  @Put('emergency-contacts/:id')
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Update emergency contact' })
  async updateEmergencyContact(
    @Param('id') id: string,
    @Body() dto: Partial<EmergencyContactDto>,
  ) {
    return this.service.updateEmergencyContact(id, dto);
  }

  @Delete('emergency-contacts/:id')
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Delete emergency contact' })
  async deleteEmergencyContact(@Param('id') id: string) {
    return this.service.deleteEmergencyContact(id);
  }

  // ═══════════════════════════════════════════════════════
  // MEDICAL HISTORY ENDPOINTS
  // ═══════════════════════════════════════════════════════

  @Post('medical-histories')
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Create a new medical history record' })
  async createMedicalHistory(@Body() dto: CreateMedicalHistoryDto) {
    return this.service.createMedicalHistory(dto);
  }

  @Get('medical-histories/:id')
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Get medical history by ID with all related data' })
  async getMedicalHistory(@Param('id') id: string) {
    return this.service.getMedicalHistory(id);
  }

  @Get('patients/:patientId/medical-histories')
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'List medical histories for a patient' })
  async listMedicalHistories(@Param('patientId') patientId: string) {
    return this.service.listMedicalHistories(patientId);
  }

  @Put('medical-histories/:id')
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Update medical history (top-level fields)' })
  async updateMedicalHistory(
    @Param('id') id: string,
    @Body() dto: Partial<CreateMedicalHistoryDto>,
  ) {
    return this.service.updateMedicalHistory(id, dto);
  }

  @Delete('medical-histories/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete medical history' })
  async deleteMedicalHistory(@Param('id') id: string) {
    return this.service.deleteMedicalHistory(id);
  }

  // ═══════════════════════════════════════════════════════
  // AI ANALYSIS ENDPOINTS
  // ═══════════════════════════════════════════════════════

  @Post('medical-histories/:id/ai-analysis')
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Trigger AI analysis on medical history' })
  async triggerAiAnalysis(
    @Param('id') id: string,
    @Body() dto: TriggerAiAnalysisDto,
  ) {
    return this.service.triggerAiAnalysis(id, dto);
  }

  // ═══════════════════════════════════════════════════════
  // CLINICIAN REVIEW ENDPOINTS
  // ═══════════════════════════════════════════════════════

  @Post('medical-histories/:id/review')
  @Roles('DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Mark medical history as reviewed by clinician' })
  async reviewHistory(
    @Param('id') id: string,
    @Body() dto: ReviewHistoryDto,
    @Req() req: any,
  ) {
    const reviewerId = req.user?.id || 'system';
    return this.service.reviewHistory(id, reviewerId, dto);
  }
}
