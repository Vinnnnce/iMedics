export declare enum Gender {
    MALE = "male",
    FEMALE = "female",
    NON_BINARY = "non-binary",
    PREFER_NOT_TO_SAY = "prefer_not_to_say"
}
export declare class CreatePatientProfileDto {
    userId: string;
    caseNumber?: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    gender?: Gender;
    dateOfBirth?: string;
    heightCm?: number;
    weightKg?: number;
    occupation?: string;
    street?: string;
    city?: string;
    stateRegion?: string;
    country?: string;
    postalCode?: string;
}
export declare class UpdatePatientProfileDto extends CreatePatientProfileDto {
    caseNumber?: string;
}
export declare class EmergencyContactDto {
    name: string;
    relationship?: string;
    phone: string;
    street?: string;
    city?: string;
    stateRegion?: string;
    country?: string;
    postalCode?: string;
}
export declare class SymptomDto {
    description: string;
    onset?: string;
    onsetCustomText?: string;
    worseningTime?: string;
    reliefTime?: string;
    character?: string;
    characterCustomText?: string;
    severity?: number;
    duration?: string;
    additionalNotes?: string;
    sortOrder?: number;
}
export declare class MedicationRecordDto {
    name: string;
    dose?: string;
    frequency?: string;
    duration?: string;
    medicationType?: string;
    notes?: string;
}
export declare class WoundInjuryDto {
    hasInjury?: boolean;
    location?: string;
    injuryType?: string;
    injuryTypeCustom?: string;
    timeSinceInjury?: string;
    cause?: string;
    causeCustom?: string;
}
export declare class ChronicConditionDto {
    conditionType: string;
    conditionLabel?: string;
    hasCondition?: boolean;
    duration?: string;
    conditionSubtype?: string;
    controlStatus?: string;
    eventDate?: string;
    residualSymptoms?: string;
    interventions?: string;
    notes?: string;
}
export declare class FamilyHistoryEntryDto {
    condition: string;
    conditionCustom?: string;
    relationship?: string;
    ageAtOnset?: number;
    notes?: string;
}
export declare class PastHistoryEntryDto {
    entryType: string;
    diagnosis?: string;
    surgeryType?: string;
    eventDate?: string;
    outcome?: string;
    notes?: string;
}
export declare class AllergyDto {
    allergenType: string;
    allergen: string;
    reactionType?: string;
    reactionCustom?: string;
    severity?: string;
    notes?: string;
}
export declare class LifestyleFactorDto {
    smokingStatus?: string;
    smokingQuantity?: string;
    yearsSmoking?: number;
    alcoholUse?: string;
    alcoholQuantity?: string;
    physicalActivity?: string;
    exerciseFrequency?: string;
    sleepPattern?: string;
    sleepHours?: number;
    travelHistory?: string;
    occupationalExposure?: string;
    notes?: string;
}
export declare class ReproductiveHistoryDto {
    pregnancies?: number;
    deliveries?: number;
    miscarriages?: number;
    livingChildren?: number;
    complications?: string;
    lastMenstrualPeriod?: string;
    contraceptionMethod?: string;
    notes?: string;
}
export declare class MentalHealthRecordDto {
    condition: string;
    conditionCustom?: string;
    duration?: string;
    treatmentStatus?: string;
    currentTreatment?: string;
    notes?: string;
}
export declare class ImmunizationRecordDto {
    vaccineName: string;
    dateAdministered?: string;
    status?: string;
    boosterDue?: string;
    notes?: string;
}
export declare class ExtensibleFieldDto {
    fieldName: string;
    fieldValue?: any;
    fieldType?: string;
    category?: string;
    options?: any;
    required?: boolean;
    sortOrder?: number;
}
export declare class CreateMedicalHistoryDto {
    patientId: string;
    doctorId?: string;
    appointmentId?: string;
    caseNumber?: string;
    chiefComplaint?: string;
    status?: string;
    symptoms?: SymptomDto[];
    medications?: MedicationRecordDto[];
    woundInjuries?: WoundInjuryDto[];
    chronicConditions?: ChronicConditionDto[];
    familyHistory?: FamilyHistoryEntryDto[];
    pastHistory?: PastHistoryEntryDto[];
    allergies?: AllergyDto[];
    lifestyleFactors?: LifestyleFactorDto[];
    reproductiveHistory?: ReproductiveHistoryDto[];
    mentalHealthRecords?: MentalHealthRecordDto[];
    immunizationRecords?: ImmunizationRecordDto[];
    extensibleFields?: ExtensibleFieldDto[];
}
export declare class TriggerAiAnalysisDto {
    language?: string;
}
export declare class ReviewHistoryDto {
    clinicianNotes?: string;
}
