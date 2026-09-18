import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiGatewayService } from '../ai/ai-gateway.service';
import {
  CreatePatientProfileDto,
  UpdatePatientProfileDto,
  EmergencyContactDto,
  CreateMedicalHistoryDto,
  TriggerAiAnalysisDto,
  ReviewHistoryDto,
} from './dto/patient-history.dto';

// ── BMI Calculation ─────────────────────────────────────

export interface BmiResult {
  value: number;
  category: string;
}

export function calculateBmi(heightCm: number, weightKg: number): BmiResult {
  if (!heightCm || !weightKg || heightCm < 30 || weightKg < 1) {
    return { value: 0, category: 'unknown' };
  }
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  let category: string;
  if (bmi < 18.5) category = 'underweight';
  else if (bmi < 25) category = 'normal';
  else if (bmi < 30) category = 'overweight';
  else category = 'obese';
  return { value: Math.round(bmi * 10) / 10, category };
}

// ── Case Number Generator ──────────────────────────────

export function generateCaseNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `MED-${year}-${random}`;
}

// ── Service ─────────────────────────────────────────────

@Injectable()
export class PatientHistoryService {
  private readonly logger = new Logger(PatientHistoryService.name);

  constructor(
    private prisma: PrismaService,
    private aiGateway: AiGatewayService,
  ) {}

  // ═══════════════════════════════════════════════════════
  // PATIENT PROFILE CRUD
  // ═══════════════════════════════════════════════════════

  async createPatientProfile(dto: CreatePatientProfileDto) {
    const { heightCm, weightKg, ...rest } = dto;

    // Auto-calculate BMI
    let bmi: number | undefined;
    let bmiCategory: string | undefined;
    if (heightCm && weightKg) {
      const result = calculateBmi(heightCm, weightKg);
      bmi = result.value;
      bmiCategory = result.category;
    }

    // Auto-generate case number if not provided
    const caseNumber = dto.caseNumber || generateCaseNumber();

    return this.prisma.patientProfile.create({
      data: {
        ...rest,
        caseNumber,
        heightCm,
        weightKg,
        bmi,
        bmiCategory,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      },
      include: {
        emergencyContacts: true,
      },
    });
  }

  async getPatientProfile(id: string) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { id },
      include: {
        emergencyContacts: true,
        medicalHistories: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!profile) throw new NotFoundException('Patient profile not found');
    return profile;
  }

  async getPatientByCaseNumber(caseNumber: string) {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { caseNumber },
      include: {
        emergencyContacts: true,
      },
    });
    if (!profile) throw new NotFoundException('Patient not found');
    return profile;
  }

  async listPatients(options: { skip?: number; take?: number; search?: string } = {}) {
    const { skip = 0, take = 20, search } = options;

    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { caseNumber: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [patients, total] = await Promise.all([
      this.prisma.patientProfile.findMany({
        where,
        skip,
        take,
        orderBy: { lastName: 'asc' },
        include: { emergencyContacts: true },
      }),
      this.prisma.patientProfile.count({ where }),
    ]);

    return { patients, total, skip, take };
  }

  async updatePatientProfile(id: string, dto: UpdatePatientProfileDto) {
    const { heightCm, weightKg, ...rest } = dto;

    // Recalculate BMI if height or weight changed
    let bmi: number | undefined;
    let bmiCategory: string | undefined;
    if (heightCm && weightKg) {
      const result = calculateBmi(heightCm, weightKg);
      bmi = result.value;
      bmiCategory = result.category;
    }

    return this.prisma.patientProfile.update({
      where: { id },
      data: {
        ...rest,
        heightCm,
        weightKg,
        bmi,
        bmiCategory,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
      include: { emergencyContacts: true },
    });
  }

  async deletePatientProfile(id: string) {
    return this.prisma.patientProfile.delete({
      where: { id },
    });
  }

  // ═══════════════════════════════════════════════════════
  // EMERGENCY CONTACTS
  // ═══════════════════════════════════════════════════════

  async addEmergencyContact(patientId: string, dto: EmergencyContactDto) {
    return this.prisma.emergencyContact.create({
      data: {
        ...dto,
        patientId,
      },
    });
  }

  async updateEmergencyContact(id: string, dto: Partial<EmergencyContactDto>) {
    return this.prisma.emergencyContact.update({
      where: { id },
      data: dto,
    });
  }

  async deleteEmergencyContact(id: string) {
    return this.prisma.emergencyContact.delete({
      where: { id },
    });
  }

  // ═══════════════════════════════════════════════════════
  // MEDICAL HISTORY CRUD
  // ═══════════════════════════════════════════════════════

  async createMedicalHistory(dto: CreateMedicalHistoryDto) {
    const {
      patientId,
      doctorId,
      appointmentId,
      caseNumber,
      chiefComplaint,
      status,
      symptoms,
      medications,
      woundInjuries,
      chronicConditions,
      familyHistory,
      pastHistory,
      allergies,
      lifestyleFactors,
      reproductiveHistory,
      mentalHealthRecords,
      immunizationRecords,
      extensibleFields,
    } = dto;

    const generatedCaseNumber = caseNumber || generateCaseNumber();

    return this.prisma.medicalHistory.create({
      data: {
        patientId,
        doctorId,
        appointmentId,
        caseNumber: generatedCaseNumber,
        chiefComplaint,
        status: status || 'DRAFT',
        symptoms: symptoms?.length
          ? { create: symptoms.map((s, i) => ({ ...s, sortOrder: s.sortOrder ?? i })) }
          : undefined,
        medications: medications?.length
          ? { create: medications }
          : undefined,
        woundInjuries: woundInjuries?.length
          ? { create: woundInjuries }
          : undefined,
        chronicConditions: chronicConditions?.length
          ? { create: chronicConditions }
          : undefined,
        familyHistory: familyHistory?.length
          ? { create: familyHistory }
          : undefined,
        pastHistory: pastHistory?.length
          ? { create: pastHistory.map(p => ({
              ...p,
              eventDate: p.eventDate ? new Date(p.eventDate) : undefined,
            })) }
          : undefined,
        allergies: allergies?.length
          ? { create: allergies }
          : undefined,
        lifestyleFactors: lifestyleFactors?.length
          ? { create: lifestyleFactors }
          : undefined,
        reproductiveHistory: reproductiveHistory?.length
          ? { create: reproductiveHistory.map(r => ({
              ...r,
              lastMenstrualPeriod: r.lastMenstrualPeriod ? new Date(r.lastMenstrualPeriod) : undefined,
            })) }
          : undefined,
        mentalHealthRecords: mentalHealthRecords?.length
          ? { create: mentalHealthRecords }
          : undefined,
        immunizationRecords: immunizationRecords?.length
          ? { create: immunizationRecords.map(i => ({
              ...i,
              dateAdministered: i.dateAdministered ? new Date(i.dateAdministered) : undefined,
              boosterDue: i.boosterDue ? new Date(i.boosterDue) : undefined,
            })) }
          : undefined,
        extensibleFields: extensibleFields?.length
          ? { create: extensibleFields }
          : undefined,
      },
      include: {
        symptoms: { orderBy: { sortOrder: 'asc' } },
        medications: true,
        woundInjuries: true,
        chronicConditions: true,
        familyHistory: true,
        pastHistory: true,
        allergies: true,
        lifestyleFactors: true,
        reproductiveHistory: true,
        mentalHealthRecords: true,
        immunizationRecords: true,
        extensibleFields: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async getMedicalHistory(id: string) {
    const history = await this.prisma.medicalHistory.findUnique({
      where: { id },
      include: {
        patient: { include: { emergencyContacts: true } },
        doctor: { select: { id: true, name: true } },
        symptoms: { orderBy: { sortOrder: 'asc' } },
        medications: true,
        woundInjuries: true,
        chronicConditions: true,
        familyHistory: true,
        pastHistory: true,
        allergies: true,
        lifestyleFactors: true,
        reproductiveHistory: true,
        mentalHealthRecords: true,
        immunizationRecords: true,
        extensibleFields: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!history) throw new NotFoundException('Medical history not found');
    return history;
  }

  async listMedicalHistories(patientId: string) {
    return this.prisma.medicalHistory.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        doctor: { select: { id: true, name: true } },
        _count: {
          select: {
            symptoms: true,
            medications: true,
            chronicConditions: true,
          },
        },
      },
    });
  }

  async updateMedicalHistory(id: string, dto: Partial<CreateMedicalHistoryDto>) {
    // For updates, we only update the top-level fields
    // Sub-entities are managed via their own endpoints
    const { chiefComplaint, status, clinicianNotes } = dto as any;
    return this.prisma.medicalHistory.update({
      where: { id },
      data: {
        chiefComplaint,
        status,
        clinicianNotes,
      },
    });
  }

  async deleteMedicalHistory(id: string) {
    return this.prisma.medicalHistory.delete({
      where: { id },
    });
  }

  // ═══════════════════════════════════════════════════════
  // AI ANALYSIS
  // ═══════════════════════════════════════════════════════

  async triggerAiAnalysis(historyId: string, dto: TriggerAiAnalysisDto) {
    this.logger.log(`Triggering AI analysis for history ${historyId}`);

    // Fetch the complete medical history with all related data
    const history = await this.getMedicalHistory(historyId);

    // Build the AI analysis payload
    const patient = history.patient;
    const age = patient.dateOfBirth
      ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    const payload = {
      analysis_id: `hist-${historyId}-${Date.now()}`,
      patient: {
        age,
        gender: patient.gender,
        bmi: patient.bmi,
        bmi_category: patient.bmiCategory,
        occupation: patient.occupation,
        conditions: history.chronicConditions
          .filter(c => c.hasCondition)
          .map(c => c.conditionType),
      },
      chief_complaint: history.chiefComplaint,
      symptoms: history.symptoms.map(s => ({
        description: s.description,
        onset: s.onset,
        worsening_time: s.worseningTime,
        relief_time: s.reliefTime,
        character: s.character,
        severity: s.severity,
        duration: s.duration,
        additional_notes: s.additionalNotes,
      })),
      medications: history.medications.map(m => ({
        name: m.name,
        dose: m.dose,
        frequency: m.frequency,
        duration: m.duration,
        medication_type: m.medicationType,
      })),
      chronic_conditions: history.chronicConditions.map(c => ({
        condition_type: c.conditionType,
        has_condition: c.hasCondition,
        duration: c.duration,
        condition_subtype: c.conditionSubtype,
        control_status: c.controlStatus,
        event_date: c.eventDate?.toISOString(),
        residual_symptoms: c.residualSymptoms,
        interventions: c.interventions,
      })),
      family_history: history.familyHistory.map(f => ({
        condition: f.condition,
        relationship: f.relationship,
        age_at_onset: f.ageAtOnset,
      })),
      past_history: history.pastHistory.map(p => ({
        entry_type: p.entryType,
        diagnosis: p.diagnosis,
        surgery_type: p.surgeryType,
        event_date: p.eventDate?.toISOString(),
        outcome: p.outcome,
      })),
      allergies: history.allergies.map(a => ({
        allergen_type: a.allergenType,
        allergen: a.allergen,
        reaction_type: a.reactionType,
        severity: a.severity,
      })),
      lifestyle: history.lifestyleFactors[0]
        ? {
            smoking_status: history.lifestyleFactors[0].smokingStatus,
            smoking_quantity: history.lifestyleFactors[0].smokingQuantity,
            alcohol_use: history.lifestyleFactors[0].alcoholUse,
            physical_activity: history.lifestyleFactors[0].physicalActivity,
            sleep_pattern: history.lifestyleFactors[0].sleepPattern,
            travel_history: history.lifestyleFactors[0].travelHistory,
            occupational_exposure: history.lifestyleFactors[0].occupationalExposure,
          }
        : {},
      wound_injury: history.woundInjuries[0]
        ? {
            has_injury: history.woundInjuries[0].hasInjury,
            location: history.woundInjuries[0].location,
            injury_type: history.woundInjuries[0].injuryType,
            time_since_injury: history.woundInjuries[0].timeSinceInjury,
            cause: history.woundInjuries[0].cause,
          }
        : {},
      reproductive: history.reproductiveHistory[0]
        ? {
            pregnancies: history.reproductiveHistory[0].pregnancies,
            deliveries: history.reproductiveHistory[0].deliveries,
            complications: history.reproductiveHistory[0].complications,
          }
        : {},
      mental_health: history.mentalHealthRecords.map(m => ({
        condition: m.condition,
        duration: m.duration,
        treatment_status: m.treatmentStatus,
      })),
      immunizations: history.immunizationRecords.map(i => ({
        vaccine_name: i.vaccineName,
        date_administered: i.dateAdministered?.toISOString(),
        status: i.status,
      })),
      extensible: history.extensibleFields.map(f => ({
        field_name: f.fieldName,
        field_value: f.fieldValue,
        category: f.category,
      })),
      options: {
        language: dto.language || 'en',
      },
    };

    // Call AI service via gateway
    const analysisId = payload.analysis_id;
    let aiResult: any;
    try {
      aiResult = await this.aiGateway.analyseHistory(payload);
    } catch (error) {
      this.logger.error(`AI analysis failed: ${error.message}`, error.stack);
      aiResult = {
        analysis_id: analysisId,
        status: 'fallback',
        clinician_summary: {
          chief_complaint: history.chiefComplaint || 'Not provided',
          hpi: 'AI analysis unavailable. Please review manually.',
          past_medical_history: [],
          family_history: [],
          social_history: [],
          medications: [],
          allergies: [],
          additional_notes: [],
        },
        patient_recap: {
          title: 'Your Visit Summary',
          greeting: 'Hello,',
          what_you_reported: ['Your medical history has been recorded.'],
          your_history: [],
          medications_listed: [],
          next_steps: 'Please discuss your history with your doctor.',
          disclaimer: 'This summary is for your reference only. It is not a diagnosis.',
        },
        suggested_questions: { questions: [], priority_topics: [] },
        risk_factors: { risk_factors: [], summary: '' },
        symptom_clusters: { clusters: [], cross_system_patterns: [] },
        timeline: { timeline: [], patterns: [] },
        safety: { passed: true, filtered_count: 0, notes: 'Fallback - no AI generated content' },
        metadata: { error: error.message, timestamp: new Date().toISOString() },
      };
    }

    // Store AI results in the medical history record
    await this.prisma.medicalHistory.update({
      where: { id: historyId },
      data: {
        aiSummary: aiResult.clinician_summary || {},
        aiPatientRecap: aiResult.patient_recap || {},
        aiSuggestedQuestions: aiResult.suggested_questions || {},
        aiRiskFactors: aiResult.risk_factors || {},
        aiSymptomClusters: aiResult.symptom_clusters || {},
        aiTimeline: aiResult.timeline || {},
      },
    });

    return {
      analysisId,
      historyId,
      status: aiResult.status || 'completed',
      ...aiResult,
    };
  }

  // ═══════════════════════════════════════════════════════
  // CLINICIAN REVIEW
  // ═══════════════════════════════════════════════════════

  async reviewHistory(historyId: string, reviewerId: string, dto: ReviewHistoryDto) {
    return this.prisma.medicalHistory.update({
      where: { id: historyId },
      data: {
        clinicianReviewed: true,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
        clinicianNotes: dto.clinicianNotes,
        status: 'COMPLETED',
      },
    });
  }
}
