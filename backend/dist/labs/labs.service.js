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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const s3_service_1 = require("../common/services/s3.service");
const ai_gateway_service_1 = require("../ai/ai-gateway.service");
const SUPPORTED_PANELS = [
    'CBC',
    'CMP',
    'BMP',
    'LIPID',
    'THYROID',
    'HBA1C',
    'IRON',
    'LIVER',
    'RENAL',
    'COAGULATION',
];
const CRITICAL_THRESHOLDS = {
    HGB: { low: 7, high: 20 },
    PLT: { low: 50, high: 1000 },
    WBC: { low: 2, high: 50 },
    GLU: { low: 40, high: 500 },
    K: { low: 2.5, high: 7 },
    NA: { low: 120, high: 160 },
    CA: { low: 6, high: 14 },
    INR: { high: 5 },
};
let LabsService = class LabsService {
    constructor(prisma, s3Service, aiGateway) {
        this.prisma = prisma;
        this.s3Service = s3Service;
        this.aiGateway = aiGateway;
    }
    async createOrder(patientId, dto, orderedBy) {
        return this.prisma.labOrder.create({
            data: {
                patientId,
                orderedBy,
                panelType: dto.panelType,
                tests: dto.tests,
                notes: dto.notes,
                status: 'ORDERED',
            },
        });
    }
    async getResults(patientId) {
        return this.prisma.labResult.findMany({
            where: { patientId },
            orderBy: { testDate: 'desc' },
            include: {
                aiAnalysis: true,
                verifiedBy: { select: { id: true, name: true } },
            },
        });
    }
    async getResult(patientId, resultId) {
        return this.prisma.labResult.findFirst({
            where: { id: resultId, patientId },
            include: {
                aiAnalysis: true,
                verifiedBy: { select: { id: true, name: true } },
            },
        });
    }
    async createResult(patientId, dto, file, uploadedBy) {
        if (!SUPPORTED_PANELS.includes(dto.panelType)) {
            throw new common_1.BadRequestException({
                code: 'UNSUPPORTED_PANEL',
                message: `Panel type "${dto.panelType}" is not supported for AI analysis`,
            });
        }
        this.validateValues(dto.values);
        let fileUrl = null;
        if (file) {
            fileUrl = await this.s3Service.uploadFile(file.buffer, `lab-results/${patientId}/${Date.now()}-${file.originalname}`, file.mimetype);
        }
        const flaggedValues = dto.values.map((v) => {
            const flag = this.computeFlag(v);
            const isCritical = this.isCritical(v.code, v.value);
            return { ...v, flag, isCritical };
        });
        const result = await this.prisma.labResult.create({
            data: {
                patientId,
                panelType: dto.panelType,
                testDate: new Date(dto.testDate),
                labName: dto.labName,
                values: flaggedValues,
                fileUrl,
                uploadedById: uploadedBy.id,
                status: 'PENDING_AI_ANALYSIS',
            },
        });
        await this.prisma.aiAnalysis.create({
            data: {
                labResultId: result.id,
                status: 'PENDING',
            },
        });
        return result;
    }
    async verifyResult(patientId, resultId, verifiedById) {
        return this.prisma.labResult.update({
            where: { id: resultId },
            data: {
                verifiedById,
                verifiedAt: new Date(),
                status: 'VERIFIED',
            },
        });
    }
    async triggerAIAnalysis(resultId) {
        const result = await this.prisma.labResult.findUnique({
            where: { id: resultId },
            include: {
                aiAnalysis: true,
                patient: {
                    select: {
                        id: true,
                        dateOfBirth: true,
                        sex: true,
                        language: true,
                        conditions: true,
                        medications: true,
                    },
                },
            },
        });
        if (!result)
            throw new common_1.NotFoundException('Lab result not found');
        const payload = this.buildAIPayload(result);
        const aiResult = await this.aiGateway.analyseLabResults(payload);
        await this.prisma.aiAnalysis.update({
            where: { labResultId: resultId },
            data: {
                status: aiResult.status === 'completed' ? 'COMPLETED' : 'COMPLETED_WITH_OVERRIDE',
                doctorView: aiResult.doctor_view,
                patientView: aiResult.patient_view,
                flags: aiResult.flags,
                urgencyLevel: aiResult.urgency_level,
                confidence: aiResult.confidence,
                safetyReport: aiResult.safety,
                metadata: aiResult.metadata,
            },
        });
        await this.prisma.labResult.update({
            where: { id: resultId },
            data: { status: 'AI_ANALYSIS_COMPLETE' },
        });
    }
    buildAIPayload(result) {
        const age = result.patient.dateOfBirth
            ? Math.floor((Date.now() - new Date(result.patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
            : null;
        return {
            analysis_id: result.aiAnalysis.id,
            patient: {
                age,
                sex: result.patient.sex,
                language: result.patient.language || 'en',
                conditions: result.patient.conditions || [],
                medications: result.patient.medications || [],
                previous_results: [],
            },
            panel: result.values,
            rule_flags: this.computeRuleFlags(result.values),
            options: {
                generate_doctor_view: true,
                generate_patient_view: true,
                patient_language: result.patient.language || 'en',
                doctor_language: 'en',
            },
        };
    }
    validateValues(values) {
        for (const v of values) {
            if (v.value < 0) {
                throw new common_1.BadRequestException({
                    code: 'IMPOSSIBLE_VALUES',
                    message: `Negative value for ${v.name} is impossible`,
                });
            }
            if (v.refLow && v.refHigh && v.refLow > v.refHigh) {
                throw new common_1.BadRequestException({
                    code: 'INVALID_REFERENCE_RANGE',
                    message: `Reference range for ${v.name} is invalid (low > high)`,
                });
            }
        }
    }
    computeFlag(v) {
        if (v.refLow && v.value < v.refLow)
            return 'LOW';
        if (v.refHigh && v.value > v.refHigh)
            return 'HIGH';
        return 'NORMAL';
    }
    isCritical(code, value) {
        const threshold = CRITICAL_THRESHOLDS[code];
        if (!threshold)
            return false;
        if (threshold.low !== undefined && value <= threshold.low)
            return true;
        if (threshold.high !== undefined && value >= threshold.high)
            return true;
        return false;
    }
    computeRuleFlags(values) {
        const critical = [];
        const nonCritical = [];
        for (const v of values) {
            const flag = this.computeFlag(v);
            const isCritical = this.isCritical(v.code, v.value);
            if (isCritical) {
                critical.push({
                    code: v.code,
                    flag,
                    message: `${v.name} value ${v.value} ${v.unit} is in critical range`,
                });
            }
            else if (flag !== 'NORMAL') {
                nonCritical.push({
                    code: v.code,
                    flag,
                    message: `${v.name} is ${flag.toLowerCase()} (${v.value} ${v.unit})`,
                });
            }
        }
        return { critical, non_critical: nonCritical, trend_summary: {} };
    }
};
exports.LabsService = LabsService;
exports.LabsService = LabsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        s3_service_1.S3Service,
        ai_gateway_service_1.AiGatewayService])
], LabsService);
