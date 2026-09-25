"""Health check router."""

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("")
@router.get("/")
async def health_check(request: Request):
    """Check service health and component status."""
    components = {}

    # Check LLM
    try:
        llm = request.app.state.llm
        components["llm"] = "healthy" if llm else "unavailable"
    except AttributeError:
        components["llm"] = "not_initialized"

    # Check RAG
    try:
        rag = request.app.state.rag
        components["rag"] = "healthy" if rag and rag.initialized else "unavailable"
    except AttributeError:
        components["rag"] = "not_initialized"

    all_healthy = all(v == "healthy" for v in components.values())

    return {
        "status": "healthy" if all_healthy else "degraded",
        "components": components,
    }
