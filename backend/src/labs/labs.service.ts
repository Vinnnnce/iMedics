import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../common/services/s3.service';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { CreateLabResultDto } from './dto/create-lab-result.dto';

// Supported panel types for AI analysis
const SUPPORTED_PANELS = [
  'CBC',          // Complete Blood Count
  'CMP',          // Comprehensive Metabolic Panel
  'BMP',          // Basic Metabolic Panel
  'LIPID',        // Lipid Panel
  'THYROID',      // Thyroid Function
  'HBA1C',        // Glycated Hemoglobin
  'IRON',         // Iron Studies
  'LIVER',        // Liver Function Tests
  'RENAL',        // Renal Function Panel
  'COAGULATION',  // Coagulation Panel
];

// Critical value thresholds (non-exhaustive)
const CRITICAL_THRESHOLDS: Record<string, { low?: number; high?: number }> = {
  HGB: { low: 7, high: 20 },
  PLT: { low: 50, high: 1000 },
  WBC: { low: 2, high: 50 },
  GLU: { low: 40, high: 500 },
  K: { low: 2.5, high: 7 },
  NA: { low: 120, high: 160 },
  CA: { low: 6, high: 14 },
  INR: { high: 5 },
};

@Injectable()
export class LabsService {
  constructor(
    private prisma: PrismaService,
    private s3Service: S3Service,
    private aiGateway: AiGatewayService,
  ) {}

  async createOrder(patientId: string, dto: CreateLabOrderDto, orderedBy: string) {
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

  async getResults(patientId: string) {
    return this.prisma.labResult.findMany({
      where: { patientId },
      orderBy: { testDate: 'desc' },
      include: {
        aiAnalysis: true,
        verifiedBy: { select: { id: true, name: true } },
      },
    });
  }

  async getResult(patientId: string, resultId: string) {
    return this.prisma.labResult.findFirst({
      where: { id: resultId, patientId },
      include: {
        aiAnalysis: true,
        verifiedBy: { select: { id: true, name: true } },
      },
    });
  }

  async createResult(
    patientId: string,
    dto: CreateLabResultDto,
    file: Express.Multer.File | undefined,
    uploadedBy: { id: string; role: string },
  ) {
    // Validate panel type
    if (!SUPPORTED_PANELS.includes(dto.panelType)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_PANEL',
        message: `Panel type "${dto.panelType}" is not supported for AI analysis`,
      });
    }

    // Validate values (pre-LLM safety filter)
    this.validateValues(dto.values);

    // Upload file to S3 if provided
    let fileUrl: string | null = null;
    if (file) {
      fileUrl = await this.s3Service.uploadFile(
        file.buffer,
        `lab-results/${patientId}/${Date.now()}-${file.originalname}`,
        file.mimetype,
      );
    }

    // Apply rule-based flags
    const flaggedValues = dto.values.map((v) => {
      const flag = this.computeFlag(v);
      const isCritical = this.isCritical(v.code, v.value);
      return { ...v, flag, isCritical };
    });

    // Store result
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

    // Create AI analysis record (pending)
    await this.prisma.aiAnalysis.create({
      data: {
        labResultId: result.id,
        status: 'PENDING',
      },
    });

    return result;
  }

  async verifyResult(patientId: string, resultId: string, verifiedById: string) {
    return this.prisma.labResult.update({
      where: { id: resultId },
      data: {
        verifiedById,
        verifiedAt: new Date(),
        status: 'VERIFIED',
      },
    });
  }

  async triggerAIAnalysis(resultId: string) {
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

    if (!result) throw new NotFoundException('Lab result not found');

    // Build AI payload
    const payload = this.buildAIPayload(result);

    // Call AI service
    const aiResult = await this.aiGateway.analyseLabResults(payload);

    // Store AI output
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

    // Update result status
    await this.prisma.labResult.update({
      where: { id: resultId },
      data: { status: 'AI_ANALYSIS_COMPLETE' },
    });

    // Emit WebSocket event (handled by gateway)
    // this.websocketGateway.emitToPatient(result.patientId, 'ai_analysis_complete', { resultId });
  }

  private buildAIPayload(result: any) {
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
        previous_results: [], // Fetch from history
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

  private validateValues(values: any[]) {
    for (const v of values) {
      if (v.value < 0) {
        throw new BadRequestException({
          code: 'IMPOSSIBLE_VALUES',
          message: `Negative value for ${v.name} is impossible`,
        });
      }
      if (v.refLow && v.refHigh && v.refLow > v.refHigh) {
        throw new BadRequestException({
          code: 'INVALID_REFERENCE_RANGE',
          message: `Reference range for ${v.name} is invalid (low > high)`,
        });
      }
    }
  }

  private computeFlag(v: { value: number; refLow?: number; refHigh?: number }): string {
    if (v.refLow && v.value < v.refLow) return 'LOW';
    if (v.refHigh && v.value > v.refHigh) return 'HIGH';
    return 'NORMAL';
  }

  private isCritical(code: string, value: number): boolean {
    const threshold = CRITICAL_THRESHOLDS[code];
    if (!threshold) return false;
    if (threshold.low !== undefined && value <= threshold.low) return true;
    if (threshold.high !== undefined && value >= threshold.high) return true;
    return false;
  }

  private computeRuleFlags(values: any[]) {
    const critical: any[] = [];
    const nonCritical: any[] = [];

    for (const v of values) {
      const flag = this.computeFlag(v);
      const isCritical = this.isCritical(v.code, v.value);

      if (isCritical) {
        critical.push({
          code: v.code,
          flag,
          message: `${v.name} value ${v.value} ${v.unit} is in critical range`,
        });
      } else if (flag !== 'NORMAL') {
        nonCritical.push({
          code: v.code,
          flag,
          message: `${v.name} is ${flag.toLowerCase()} (${v.value} ${v.unit})`,
        });
      }
    }

    return { critical, non_critical: nonCritical, trend_summary: {} };
  }
}
