"""
iMedics AI Microservice — FastAPI Entry Point
Medical lab result analysis with RAG, LLM, and safety filters.
"""

import os
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.security import APIKeyHeader
from prometheus_fastapi_instrumentator import Instrumentator

from app.routers import lab_analysis, health
from app.config import settings

app = FastAPI(
    title="iMedics AI Service",
    description="AI-powered medical lab result analysis with safety filters",
    version="1.0.0",
)

# Service-to-service authentication
api_key_header = APIKeyHeader(name="X-Service-Token")


async def verify_service_token(token: str = Depends(api_key_header)):
    if token != settings.service_token:
        raise HTTPException(status_code=403, detail="Invalid service token")
    return token


# Instrument with Prometheus metrics
Instrumentator().instrument(app).expose(app, endpoint="/metrics")


@app.on_event("startup")
async def startup_event():
    """Initialize RAG index and knowledge base on startup."""
    from app.pipeline.rag import RAGEngine
    from app.pipeline.safety import SafetyFilter

    # Initialize RAG engine (loads embeddings index)
    app.state.rag = RAGEngine()
    await app.state.rag.initialize()

    # Initialize safety filter
    app.state.safety = SafetyFilter()

    # Initialize LLM client
    from app.pipeline.llm import LLMClient
    app.state.llm = LLMClient(
        provider=settings.llm_provider,
        model=settings.llm_model,
        api_key=settings.llm_api_key,
    )

    print(f"AI Service started — LLM: {settings.llm_provider}/{settings.llm_model}")


# Routers
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(
    lab_analysis.router,
    prefix="/ai",
    tags=["ai"],
    dependencies=[Depends(verify_service_token)],
)
