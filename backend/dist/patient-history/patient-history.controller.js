"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientHistoryController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const patient_history_service_1 = require("./patient-history.service");
const patient_history_dto_1 = require("./dto/patient-history.dto");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
let PatientHistoryController = class PatientHistoryController {
    constructor(service) {
        this.service = service;
    }
    async createPatient(dto) {
        return this.service.createPatientProfile(dto);
    }
    async listPatients(skip, take, search) {
        return this.service.listPatients({ skip: Number(skip) || 0, take: Number(take) || 20, search });
    }
    async getPatient(id) {
        return this.service.getPatientProfile(id);
    }
    async getPatientByCase(caseNumber) {
        return this.service.getPatientByCaseNumber(caseNumber);
    }
    async updatePatient(id, dto) {
        return this.service.updatePatientProfile(id, dto);
    }
    async deletePatient(id) {
        return this.service.deletePatientProfile(id);
    }
    async addEmergencyContact(patientId, dto) {
        return this.service.addEmergencyContact(patientId, dto);
    }
    async updateEmergencyContact(id, dto) {
        return this.service.updateEmergencyContact(id, dto);
    }
    async deleteEmergencyContact(id) {
        return this.service.deleteEmergencyContact(id);
    }
    async createMedicalHistory(dto) {
        return this.service.createMedicalHistory(dto);
    }
    async getMedicalHistory(id) {
        return this.service.getMedicalHistory(id);
    }
    async listMedicalHistories(patientId) {
        return this.service.listMedicalHistories(patientId);
    }
    async updateMedicalHistory(id, dto) {
        return this.service.updateMedicalHistory(id, dto);
    }
    async deleteMedicalHistory(id) {
        return this.service.deleteMedicalHistory(id);
    }
    async triggerAiAnalysis(id, dto) {
        return this.service.triggerAiAnalysis(id, dto);
    }
    async reviewHistory(id, dto, req) {
        const reviewerId = req.user?.id || 'system';
        return this.service.reviewHistory(id, reviewerId, dto);
    }
};
exports.PatientHistoryController = PatientHistoryController;
__decorate([
    (0, common_1.Post)('patients'),
    (0, roles_decorator_1.Roles)('DOCTOR', 'ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new patient profile' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [patient_history_dto_1.CreatePatientProfileDto]),
    __metadata("design:returntype", Promise)
], PatientHistoryController.prototype, "createPatient", null);
__decorate([
    (0, common_1.Get)('patients'),
    (0, roles_decorator_1.Roles)('DOCTOR', 'ADMIN', 'LAB_SCIENTIST'),
    (0, swagger_1.ApiOperation)({ summary: 'List patients with optional search' }),
    __param(0, (0, common_1.Query)('skip')),
    __param(1, (0, common_1.Query)('take')),
    __param(2, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String]),
    __metadata("design:returntype", Promise)
], PatientHistoryController.prototype, "listPatients", null);
__decorate([
    (0, common_1.Get)('patients/:id'),
    (0, roles_decorator_1.Roles)('DOCTOR', 'ADMIN', 'LAB_SCIENTIST'),
    (0, swagger_1.ApiOperation)({ summary: 'Get patient profile by ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PatientHistoryController.prototype, "getPatient", null);
__decorate([
    (0, common_1.Get)('patients/case/:caseNumber'),
    (0, roles_decorator_1.Roles)('DOCTOR', 'ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Get patient by case number' }),
    __param(0, (0, common_1.Param)('caseNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PatientHistoryController.prototype, "getPatientByCase", null);
__decorate([
    (0, common_1.Put)('patients/:id'),
    (0, roles_decorator_1.Roles)('DOCTOR', 'ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Update patient profile' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, patient_history_dto_1.UpdatePatientProfileDto]),
    __metadata("design:returntype", Promise)
], PatientHistoryController.prototype, "updatePatient", null);
__decorate([
    (0, common_1.Delete)('patients/:id'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete patient profile' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PatientHistoryController.prototype, "deletePatient", null);
__decorate([
    (0, common_1.Post)('patients/:patientId/emergency-contacts'),
    (0, roles_decorator_1.Roles)('DOCTOR', 'ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Add emergency contact to patient' }),
    __param(0, (0, common_1.Param)('patientId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, patient_history_dto_1.EmergencyContactDto]),
    __metadata("design:returntype", Promise)
], PatientHistoryController.prototype, "addEmergencyContact", null);
__decorate([
    (0, common_1.Put)('emergency-contacts/:id'),
    (0, roles_decorator_1.Roles)('DOCTOR', 'ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Update emergency contact' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PatientHistoryController.prototype, "updateEmergencyContact", null);
__decorate([
    (0, common_1.Delete)('emergency-contacts/:id'),
    (0, roles_decorator_1.Roles)('DOCTOR', 'ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete emergency contact' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PatientHistoryController.prototype, "deleteEmergencyContact", null);
__decorate([
    (0, common_1.Post)('medical-histories'),
    (0, roles_decorator_1.Roles)('DOCTOR', 'ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new medical history record' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [patient_history_dto_1.CreateMedicalHistoryDto]),
    __metadata("design:returntype", Promise)
], PatientHistoryController.prototype, "createMedicalHistory", null);
__decorate([
    (0, common_1.Get)('medical-histories/:id'),
    (0, roles_decorator_1.Roles)('DOCTOR', 'ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Get medical history by ID with all related data' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PatientHistoryController.prototype, "getMedicalHistory", null);
__decorate([
    (0, common_1.Get)('patients/:patientId/medical-histories'),
    (0, roles_decorator_1.Roles)('DOCTOR', 'ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'List medical histories for a patient' }),
    __param(0, (0, common_1.Param)('patientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PatientHistoryController.prototype, "listMedicalHistories", null);
__decorate([
    (0, common_1.Put)('medical-histories/:id'),
    (0, roles_decorator_1.Roles)('DOCTOR', 'ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Update medical history (top-level fields)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PatientHistoryController.prototype, "updateMedicalHistory", null);
__decorate([
    (0, common_1.Delete)('medical-histories/:id'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete medical history' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PatientHistoryController.prototype, "deleteMedicalHistory", null);
__decorate([
    (0, common_1.Post)('medical-histories/:id/ai-analysis'),
    (0, roles_decorator_1.Roles)('DOCTOR', 'ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Trigger AI analysis on medical history' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, patient_history_dto_1.TriggerAiAnalysisDto]),
    __metadata("design:returntype", Promise)
], PatientHistoryController.prototype, "triggerAiAnalysis", null);
__decorate([
    (0, common_1.Post)('medical-histories/:id/review'),
    (0, roles_decorator_1.Roles)('DOCTOR', 'ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Mark medical history as reviewed by clinician' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, patient_history_dto_1.ReviewHistoryDto, Object]),
    __metadata("design:returntype", Promise)
], PatientHistoryController.prototype, "reviewHistory", null);
exports.PatientHistoryController = PatientHistoryController = __decorate([
    (0, swagger_1.ApiTags)('Patient History'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [patient_history_service_1.PatientHistoryService])
], PatientHistoryController);
