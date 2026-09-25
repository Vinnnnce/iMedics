"""
Pydantic schemas for AI service request/response models.
"""

from pydantic import BaseModel, Field
from typing import Optional, Any


class PreviousResult(BaseModel):
    test_date: str
    panel_type: Optional[str] = None
    values: list[dict]


class PatientContext(BaseModel):
    age: Optional[int] = None
    sex: Optional[str] = None
    language: str = "en"
    conditions: list[str] = Field(default_factory=list)
    medications: list[str] = Field(default_factory=list)
    previous_results: list[PreviousResult] = Field(default_factory=list)


class LabValue(BaseModel):
    code: str
    loinc: Optional[str] = None
    name: str
    value: float
    unit: str
    ref_low: Optional[float] = None
    ref_high: Optional[float] = None
    flag: Optional[str] = None


class TrendInfo(BaseModel):
    previous: float
    current: float
    direction: str
    raw_direction: Optional[str] = None
    change: Optional[float] = None
    previous_date: Optional[str] = None


class FlagItem(BaseModel):
    code: str
    name: Optional[str] = None
    flag: str
    value: Optional[float] = None
    unit: Optional[str] = None
    message: str


class RuleFlags(BaseModel):
    critical: list[FlagItem] = Field(default_factory=list)
    non_critical: list[FlagItem] = Field(default_factory=list)
    trend_summary: dict[str, Any] = Field(default_factory=dict)


class AnalysisOptions(BaseModel):
    generate_doctor_view: bool = True
    generate_patient_view: bool = True
    patient_language: str = "en"
    doctor_language: str = "en"


class LabAnalysisRequest(BaseModel):
    analysis_id: str
    patient: PatientContext
    panel: list[LabValue]
    rule_flags: RuleFlags
    options: AnalysisOptions = AnalysisOptions()


class DoctorView(BaseModel):
    summary: list[str]
    suggested_followup: list[str]
    urgency_level: str = "routine"
    limitations: str = ""


class PatientView(BaseModel):
    language: str = "en"
    title: str
    body: list[str]
    questions_for_doctor: list[str]


class ConfidenceInfo(BaseModel):
    level: str = "medium"
    reasons: list[str] = Field(default_factory=list)


class SafetyReport(BaseModel):
    passed: bool = True
    filtered_count: int = 0
    notes: str = ""
    actions_taken: Optional[list[dict]] = None


class AnalysisMetadata(BaseModel):
    model: str = ""
    rag_documents_retrieved: int = 0
    processing_time_ms: int = 0
    timestamp: str = ""


class LabAnalysisResponse(BaseModel):
    analysis_id: str
    status: str = "completed"
    doctor_view: dict
    patient_view: dict
    flags: dict
    urgency_level: str = "routine"
    confidence: dict
    safety: dict
    metadata: dict
