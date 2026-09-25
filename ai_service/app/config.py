"""Configuration for the AI microservice."""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Service
    service_token: str = "dev-service-token"
    host: str = "0.0.0.0"
    port: int = 8000

    # LLM — Kimi K3 (Moonshot AI)
    llm_provider: str = "kimi"  # kimi, openai, azure, self_hosted
    llm_model: str = "kimi-k3"
    llm_api_key: str = ""
    llm_base_url: Optional[str] = "https://api.moonshot.cn/v1"

    # Embeddings
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_api_key: Optional[str] = None

    # Vector DB
    vector_db_url: str = "postgresql://localhost:5432/imedics"
    vector_collection: str = "medical_knowledge"

    # Knowledge base
    knowledge_base_path: str = "knowledge_base"

    # Safety
    safety_filter_enabled: bool = True
    max_tokens_doctor: int = 500
    max_tokens_patient: int = 400

    # Supported panels
    supported_panels: list[str] = [
        "CBC", "CMP", "BMP", "LIPID", "THYROID",
        "HBA1C", "IRON", "LIVER", "RENAL", "COAGULATION",
    ]

    # Supported languages
    supported_languages: list[str] = ["en", "fr", "ru", "es"]

    class Config:
        env_file = ".env"
        env_prefix = "AI_"


settings = Settings()
