"""
Pydantic schemas for medical history AI service.
Request/response models for history analysis pipeline.
"""

from pydantic import BaseModel, Field
from typing import Optional, Any


class PatientInfo(BaseModel):
    age: Optional[int] = None
    gender: Optional[str] = None
    bmi: Optional[float] = None
    bmi_category: Optional[str] = None
    occupation: Optional[str] = None
    conditions: list[str] = Field(default_factory=list)


class SymptomData(BaseModel):
    description: str
    onset: Optional[str] = None
    worsening_time: Optional[str] = None
    relief_time: Optional[str] = None
    character: Optional[str] = None
    severity: Optional[int] = None
    duration: Optional[str] = None
    additional_notes: Optional[str] = None


class MedicationData(BaseModel):
    name: str
    dose: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    medication_type: str = "CURRENT"


class ChronicConditionData(BaseModel):
    condition_type: str
    has_condition: bool = False
    duration: Optional[str] = None
    condition_subtype: Optional[str] = None
    control_status: Optional[str] = None
    event_date: Optional[str] = None
    residual_symptoms: Optional[str] = None
    interventions: Optional[str] = None


class FamilyHistoryData(BaseModel):
    condition: str
    relationship: Optional[str] = None
    age_at_onset: Optional[int] = None


class PastHistoryData(BaseModel):
    entry_type: str
    diagnosis: Optional[str] = None
    surgery_type: Optional[str] = None
    event_date: Optional[str] = None
    outcome: Optional[str] = None


class AllergyData(BaseModel):
    allergen_type: str
    allergen: str
    reaction_type: Optional[str] = None
    severity: Optional[str] = None


class LifestyleData(BaseModel):
    smoking_status: Optional[str] = None
    smoking_quantity: Optional[str] = None
    alcohol_use: Optional[str] = None
    physical_activity: Optional[str] = None
    sleep_pattern: Optional[str] = None
    travel_history: Optional[str] = None
    occupational_exposure: Optional[str] = None


class WoundInjuryData(BaseModel):
    has_injury: bool = False
    location: Optional[str] = None
    injury_type: Optional[str] = None
    time_since_injury: Optional[str] = None
    cause: Optional[str] = None


class ReproductiveData(BaseModel):
    pregnancies: Optional[int] = None
    deliveries: Optional[int] = None
    complications: Optional[str] = None


class MentalHealthData(BaseModel):
    condition: str
    duration: Optional[str] = None
    treatment_status: Optional[str] = None


class ImmunizationData(BaseModel):
    vaccine_name: str
    date_administered: Optional[str] = None
    status: Optional[str] = None


class HistoryAnalysisRequest(BaseModel):
    analysis_id: str
    patient: PatientInfo = PatientInfo()
    chief_complaint: Optional[str] = None
    symptoms: list[SymptomData] = Field(default_factory=list)
    medications: list[MedicationData] = Field(default_factory=list)
    chronic_conditions: list[ChronicConditionData] = Field(default_factory=list)
    family_history: list[FamilyHistoryData] = Field(default_factory=list)
    past_history: list[PastHistoryData] = Field(default_factory=list)
    allergies: list[AllergyData] = Field(default_factory=list)
    lifestyle: Optional[LifestyleData] = None
    wound_injury: Optional[WoundInjuryData] = None
    reproductive: Optional[ReproductiveData] = None
    mental_health: list[MentalHealthData] = Field(default_factory=list)
    immunizations: list[ImmunizationData] = Field(default_factory=list)
    extensible: list[dict[str, Any]] = Field(default_factory=list)
    options: dict[str, Any] = Field(default_factory=dict)


class ClinicianSummary(BaseModel):
    chief_complaint: str = ""
    hpi: str = ""
    past_medical_history: list[str] = Field(default_factory=list)
    family_history: list[str] = Field(default_factory=list)
    social_history: list[str] = Field(default_factory=list)
    medications: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    additional_notes: list[str] = Field(default_factory=list)


class PatientRecap(BaseModel):
    title: str = ""
    greeting: str = ""
    what_you_reported: list[str] = Field(default_factory=list)
    your_history: list[str] = Field(default_factory=list)
    medications_listed: list[str] = Field(default_factory=list)
    next_steps: str = ""
    disclaimer: str = ""


class SuggestedQuestion(BaseModel):
    category: str
    question: str
    rationale: str = ""


class QuestionGenerationResult(BaseModel):
    questions: list[SuggestedQuestion] = Field(default_factory=list)
    priority_topics: list[str] = Field(default_factory=list)


class SymptomCluster(BaseModel):
    system: str
    symptoms: list[str] = Field(default_factory=list)
    notes: str = ""


class SymptomClusteringResult(BaseModel):
    clusters: list[SymptomCluster] = Field(default_factory=list)
    cross_system_patterns: list[str] = Field(default_factory=list)


class RiskFactor(BaseModel):
    factor: str
    category: str
    relevance: str = ""


class RiskFactorResult(BaseModel):
    risk_factors: list[RiskFactor] = Field(default_factory=list)
    summary: str = ""


class TimelineEvent(BaseModel):
    event: str
    approximate_date: str = ""
    category: str = ""
    ongoing: bool = False
    progression: Optional[str] = None


class TimelineResult(BaseModel):
    timeline: list[TimelineEvent] = Field(default_factory=list)
    patterns: list[str] = Field(default_factory=list)


class HistoryAnalysisResponse(BaseModel):
    analysis_id: str
    status: str = "completed"
    clinician_summary: dict
    patient_recap: dict
    suggested_questions: dict
    risk_factors: dict
    symptom_clusters: dict
    timeline: dict
    safety: dict
    metadata: dict
