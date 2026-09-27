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
exports.LabsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const roles_guard_1 = require("../common/guards/roles.guard");
const labs_service_1 = require("./labs.service");
const create_lab_order_dto_1 = require("./dto/create-lab-order.dto");
const create_lab_result_dto_1 = require("./dto/create-lab-result.dto");
let LabsController = class LabsController {
    constructor(labsService) {
        this.labsService = labsService;
    }
    async createOrder(patientId, dto, req) {
        return this.labsService.createOrder(patientId, dto, req.user.id);
    }
    async getResults(patientId, req) {
        if (req.user.role === 'PATIENT' && req.user.id !== patientId) {
            throw new common_1.ForbiddenException('Cannot access other patients\' results');
        }
        return this.labsService.getResults(patientId);
    }
    async getResult(patientId, resultId, req) {
        if (req.user.role === 'PATIENT' && req.user.id !== patientId) {
            throw new common_1.ForbiddenException('Cannot access other patients\' results');
        }
        const result = await this.labsService.getResult(patientId, resultId);
        if (!result) {
            throw new common_1.NotFoundException('Lab result not found');
        }
        return result;
    }
    async createResult(patientId, dto, file, req) {
        if (req.user.role === 'PATIENT' && req.user.id !== patientId) {
            throw new common_1.ForbiddenException('Cannot upload results for other patients');
        }
        const result = await this.labsService.createResult(patientId, dto, file, req.user);
        this.labsService.triggerAIAnalysis(result.id).catch((err) => {
            console.error('AI analysis failed:', err);
        });
        return result;
    }
    async verifyResult(patientId, resultId, req) {
        return this.labsService.verifyResult(patientId, resultId, req.user.id);
    }
};
exports.LabsController = LabsController;
__decorate([
    (0, common_1.Post)(':patientId/orders'),
    (0, roles_decorator_1.Roles)('DOCTOR', 'LAB_SCIENTIST', 'ADMIN'),
    __param(0, (0, common_1.Param)('patientId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_lab_order_dto_1.CreateLabOrderDto, Object]),
    __metadata("design:returntype", Promise)
], LabsController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Get)(':patientId/results'),
    (0, roles_decorator_1.Roles)('PATIENT', 'DOCTOR', 'LAB_SCIENTIST', 'ADMIN'),
    __param(0, (0, common_1.Param)('patientId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], LabsController.prototype, "getResults", null);
__decorate([
    (0, common_1.Get)(':patientId/results/:resultId'),
    (0, roles_decorator_1.Roles)('PATIENT', 'DOCTOR', 'LAB_SCIENTIST', 'ADMIN'),
    __param(0, (0, common_1.Param)('patientId')),
    __param(1, (0, common_1.Param)('resultId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], LabsController.prototype, "getResult", null);
__decorate([
    (0, common_1.Post)(':patientId/results'),
    (0, roles_decorator_1.Roles)('PATIENT', 'DOCTOR', 'LAB_SCIENTIST', 'ADMIN'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: 10 * 1024 * 1024 } })),
    __param(0, (0, common_1.Param)('patientId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_lab_result_dto_1.CreateLabResultDto, Object, Object]),
    __metadata("design:returntype", Promise)
], LabsController.prototype, "createResult", null);
__decorate([
    (0, common_1.Patch)(':patientId/results/:resultId/verify'),
    (0, roles_decorator_1.Roles)('LAB_SCIENTIST', 'ADMIN'),
    __param(0, (0, common_1.Param)('patientId')),
    __param(1, (0, common_1.Param)('resultId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], LabsController.prototype, "verifyResult", null);
exports.LabsController = LabsController = __decorate([
    (0, common_1.Controller)('labs'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [labs_service_1.LabsService])
], LabsController);
