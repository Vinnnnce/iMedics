"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientHistoryModule = void 0;
const common_1 = require("@nestjs/common");
const patient_history_controller_1 = require("./patient-history.controller");
const patient_history_service_1 = require("./patient-history.service");
const prisma_module_1 = require("../prisma/prisma.module");
const ai_module_1 = require("../ai/ai.module");
let PatientHistoryModule = class PatientHistoryModule {
};
exports.PatientHistoryModule = PatientHistoryModule;
exports.PatientHistoryModule = PatientHistoryModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, ai_module_1.AiModule],
        controllers: [patient_history_controller_1.PatientHistoryController],
        providers: [patient_history_service_1.PatientHistoryService],
        exports: [patient_history_service_1.PatientHistoryService],
    })
], PatientHistoryModule);
