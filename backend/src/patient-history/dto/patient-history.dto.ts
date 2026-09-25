import { IsString, IsOptional, IsEnum, IsNumber, Min, Max, IsDateString, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Patient Profile DTOs ────────────────────────────────

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  NON_BINARY = 'non-binary',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say',
}

export class CreatePatientProfileDto {
  @ApiProperty({ description: 'User ID from auth system' })
  @IsString()
  userId: string;

  @ApiPropertyOptional({ description: 'Case number (auto-generated if omitted)' })
  @IsOptional()
  @IsString()
  caseNumber?: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  middleName?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Height in cm (30-300)' })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(300)
  heightCm?: number;

  @ApiPropertyOptional({ description: 'Weight in kg (1-500)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stateRegion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;
}

export class UpdatePatientProfileDto extends CreatePatientProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caseNumber?: string;
}

export class EmergencyContactDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relationship?: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stateRegion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;
}

// ── Medical History DTOs ────────────────────────────────

export class SymptomDto {
  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'sudden, gradual, unknown, custom' })
  @IsOptional()
  @IsString()
  onset?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  onsetCustomText?: string;

  @ApiPropertyOptional({ description: 'morning, afternoon, evening, night, constant' })
  @IsOptional()
  @IsString()
  worseningTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reliefTime?: string;

  @ApiPropertyOptional({ description: 'sharp, dull, throbbing, burning, pressure, intermittent, continuous, other' })
  @IsOptional()
  @IsString()
  character?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  characterCustomText?: string;

  @ApiPropertyOptional({ description: '0-10 pain scale' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  severity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  additionalNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class MedicationRecordDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional({ description: 'CURRENT or RECENT' })
  @IsOptional()
  @IsString()
  medicationType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class WoundInjuryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasInjury?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  injuryType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  injuryTypeCustom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timeSinceInjury?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cause?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  causeCustom?: string;
}

export class ChronicConditionDto {
  @ApiProperty({ description: 'DIABETES, STROKE, HEART_ATTACK, OTHER' })
  @IsString()
  conditionType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conditionLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasCondition?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional({ description: 'Type 1, Type 2, gestational for diabetes' })
  @IsOptional()
  @IsString()
  conditionSubtype?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  controlStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  residualSymptoms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  interventions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class FamilyHistoryEntryDto {
  @ApiProperty()
  @IsString()
  condition: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conditionCustom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relationship?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  ageAtOnset?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PastHistoryEntryDto {
  @ApiProperty({ description: 'DIAGNOSIS, SURGERY, HOSPITALIZATION' })
  @IsString()
  entryType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  surgeryType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AllergyDto {
  @ApiProperty({ description: 'DRUG, FOOD, ENVIRONMENTAL' })
  @IsString()
  allergenType: string;

  @ApiProperty()
  @IsString()
  allergen: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reactionType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reactionCustom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class LifestyleFactorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smokingStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smokingQuantity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  yearsSmoking?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alcoholUse?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alcoholQuantity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  physicalActivity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exerciseFrequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sleepPattern?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sleepHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  travelHistory?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  occupationalExposure?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReproductiveHistoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pregnancies?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  deliveries?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  miscarriages?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  livingChildren?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  complications?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  lastMenstrualPeriod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contraceptionMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class MentalHealthRecordDto {
  @ApiProperty()
  @IsString()
  condition: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conditionCustom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  treatmentStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentTreatment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ImmunizationRecordDto {
  @ApiProperty()
  @IsString()
  vaccineName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateAdministered?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  boosterDue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ExtensibleFieldDto {
  @ApiProperty()
  @IsString()
  fieldName: string;

  @ApiProperty()
  @IsOptional()
  fieldValue?: any;

  @ApiPropertyOptional({ description: 'TEXT, NUMBER, DATE, SELECT, JSON' })
  @IsOptional()
  @IsString()
  fieldType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  options?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

// ── Create Medical History DTO ─────────────────────────

export class CreateMedicalHistoryDto {
  @ApiProperty()
  @IsString()
  patientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  doctorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appointmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caseNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ type: [SymptomDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SymptomDto)
  symptoms?: SymptomDto[];

  @ApiPropertyOptional({ type: [MedicationRecordDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicationRecordDto)
  medications?: MedicationRecordDto[];

  @ApiPropertyOptional({ type: [WoundInjuryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WoundInjuryDto)
  woundInjuries?: WoundInjuryDto[];

  @ApiPropertyOptional({ type: [ChronicConditionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChronicConditionDto)
  chronicConditions?: ChronicConditionDto[];

  @ApiPropertyOptional({ type: [FamilyHistoryEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FamilyHistoryEntryDto)
  familyHistory?: FamilyHistoryEntryDto[];

  @ApiPropertyOptional({ type: [PastHistoryEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PastHistoryEntryDto)
  pastHistory?: PastHistoryEntryDto[];

  @ApiPropertyOptional({ type: [AllergyDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllergyDto)
  allergies?: AllergyDto[];

  @ApiPropertyOptional({ type: [LifestyleFactorDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LifestyleFactorDto)
  lifestyleFactors?: LifestyleFactorDto[];

  @ApiPropertyOptional({ type: [ReproductiveHistoryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReproductiveHistoryDto)
  reproductiveHistory?: ReproductiveHistoryDto[];

  @ApiPropertyOptional({ type: [MentalHealthRecordDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MentalHealthRecordDto)
  mentalHealthRecords?: MentalHealthRecordDto[];

  @ApiPropertyOptional({ type: [ImmunizationRecordDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImmunizationRecordDto)
  immunizationRecords?: ImmunizationRecordDto[];

  @ApiPropertyOptional({ type: [ExtensibleFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtensibleFieldDto)
  extensibleFields?: ExtensibleFieldDto[];
}

export class TriggerAiAnalysisDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;
}

export class ReviewHistoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clinicianNotes?: string;
}
