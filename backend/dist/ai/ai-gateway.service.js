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
var AiGatewayService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiGatewayService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
let AiGatewayService = AiGatewayService_1 = class AiGatewayService {
    constructor(httpService) {
        this.httpService = httpService;
        this.logger = new common_1.Logger(AiGatewayService_1.name);
        this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        this.serviceToken = process.env.AI_SERVICE_TOKEN || 'dev-service-token';
    }
    async analyseLabResults(payload) {
        try {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiServiceUrl}/ai/lab/analyse`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-Token': this.serviceToken,
                },
                timeout: 60000,
            }));
            return data;
        }
        catch (error) {
            this.logger.error(`AI analysis failed: ${error.message}`, error.stack);
            return {
                analysis_id: payload.analysis_id,
                status: 'fallback',
                doctor_view: {
                    summary: ['AI analysis unavailable. Please review lab values manually.'],
                    suggested_followup: [],
                    urgency_level: 'routine',
                    limitations: 'AI service error. Manual review required.',
                },
                patient_view: {
                    language: payload.options?.patient_language || 'en',
                    title: 'Results Available',
                    body: ['Your lab results are available. Please discuss them with your doctor.'],
                    questions_for_doctor: ['What do these results mean?'],
                },
                flags: payload.rule_flags,
                urgency_level: 'routine',
                confidence: { level: 'low', reasons: ['AI service error'] },
                safety: { passed: true, filtered_count: 0, notes: 'Fallback - no AI generated content' },
                metadata: { error: error.message, timestamp: new Date().toISOString() },
            };
        }
    }
    async healthCheck() {
        try {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.aiServiceUrl}/health`, {
                headers: { 'X-Service-Token': this.serviceToken },
                timeout: 5000,
            }));
            return data.status === 'healthy';
        }
        catch {
            return false;
        }
    }
    async analyseHistory(payload) {
        try {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.aiServiceUrl}/ai/history/analyse`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Service-Token': this.serviceToken,
                },
                timeout: 90000,
            }));
            return data;
        }
        catch (error) {
            this.logger.error(`History AI analysis failed: ${error.message}`, error.stack);
            throw error;
        }
    }
};
exports.AiGatewayService = AiGatewayService;
exports.AiGatewayService = AiGatewayService = AiGatewayService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService])
], AiGatewayService);
