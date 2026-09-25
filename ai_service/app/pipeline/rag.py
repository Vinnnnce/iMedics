"""
RAG Engine — Retrieval-Augmented Generation for medical knowledge.
Uses pgvector to retrieve relevant medical evidence for lab analysis.
"""

from typing import Any
import os


class RAGEngine:
    """Retrieval-augmented generation engine using medical knowledge base."""

    def __init__(self):
        self.initialized = False
        self.embeddings = None
        self.vector_store = None

    async def initialize(self):
        """Initialize the RAG engine: load embeddings model and connect to vector store."""
        try:
            # Try to use sentence-transformers for local embeddings
            from sentence_transformers import SentenceTransformer
            self.embeddings = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        except ImportError:
            # Fallback: use OpenAI embeddings
            try:
                import openai
                self.embeddings = "openai"  # Flag to use OpenAI
            except ImportError:
                print("Warning: No embedding model available. RAG disabled.")
                self.embeddings = None
                self.initialized = True
                return

        # Connect to vector store (pgvector)
        try:
            import asyncpg
            conn_string = os.getenv("AI_VECTOR_DB_URL", "postgresql://localhost:5432/imedics")
            self.vector_store = await asyncpg.connect(conn_string)
            print("Connected to pgvector store")
        except Exception as e:
            print(f"Warning: Could not connect to vector store: {e}. RAG will use fallback.")
            self.vector_store = None

        self.initialized = True

    async def retrieve(
        self,
        panel_type: str = "",
        flags: dict = None,
        top_k: int = 3,
    ) -> list[dict]:
        """
        Retrieve top-k relevant medical knowledge passages.

        Args:
            panel_type: Type of lab panel (CBC, CMP, etc.)
            flags: Rule engine output with critical/non_critical flags
            top_k: Number of passages to retrieve

        Returns:
            List of retrieved evidence passages.
        """
        if not self.embeddings:
            return self._fallback_retrieval(panel_type, flags, top_k)

        # Build query from flags and panel type
        query = self._build_query(panel_type, flags)

        # Generate embedding for query
        if self.embeddings == "openai":
            import openai
            client = openai.AsyncOpenAI()
            embedding = (await client.embeddings.create(
                input=query, model="text-embedding-3-small"
            )).data[0].embedding
        else:
            embedding = self.embeddings.encode(query).tolist()

        # Search vector store
        if self.vector_store:
            results = await self._vector_search(embedding, top_k)
            if results:
                return results

        # Fallback to keyword-based retrieval
        return self._fallback_retrieval(panel_type, flags, top_k)

    def _build_query(self, panel_type: str, flags: dict) -> str:
        """Build a search query from panel type and flags."""
        parts = [panel_type] if panel_type else []

        if flags:
            for flag in flags.get("critical", []):
                parts.append(f"{flag.get('code', '')} {flag.get('flag', '')} critical")
            for flag in flags.get("non_critical", []):
                parts.append(f"{flag.get('code', '')} {flag.get('flag', '')}")

        return " ".join(parts) if parts else "lab results interpretation"

    async def _vector_search(self, embedding: list[float], top_k: int) -> list[dict]:
        """Search pgvector for similar passages."""
        try:
            embedding_str = str(embedding)
            rows = await self.vector_store.fetch(
                f"""
                SELECT title, content, source, 
                       embedding <=> $1::vector AS distance
                FROM medical_knowledge
                ORDER BY embedding <=> $1::vector
                LIMIT $2
                """,
                embedding_str,
                top_k,
            )
            return [
                {
                    "title": row["title"],
                    "content": row["content"],
                    "source": row["source"],
                    "relevance": 1 - row["distance"],
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Vector search failed: {e}")
            return []

    def _fallback_retrieval(self, panel_type: str, flags: dict, top_k: int) -> list[dict]:
        """Fallback keyword-based retrieval when vector store unavailable."""
        # Return curated snippets based on panel type
        knowledge = {
            "CBC": {
                "title": "Complete Blood Count Interpretation",
                "content": "A CBC measures red blood cells, white blood cells, and platelets. "
                          "Low hemoglobin may indicate anemia. Elevated WBC may suggest infection "
                          "or inflammation. Low platelet counts may indicate bleeding risk.",
                "source": "Clinical Laboratory Science Review",
            },
            "CMP": {
                "title": "Comprehensive Metabolic Panel",
                "content": "A CMP measures glucose, electrolytes, kidney function, and liver enzymes. "
                          "Abnormal glucose may indicate diabetes. Elevated liver enzymes may indicate "
                          "hepatocellular injury.",
                "source": "Clinical Laboratory Science Review",
            },
            "LIPID": {
                "title": "Lipid Panel Interpretation",
                "content": "A lipid panel measures cholesterol and triglycerides. "
                          "Elevated LDL is a risk factor for cardiovascular disease. "
                          "Low HDL is also a cardiovascular risk factor.",
                "source": "Cardiovascular Risk Assessment Guidelines",
            },
            "THYROID": {
                "title": "Thyroid Function Tests",
                "content": "TSH, FT4, and FT3 are used to assess thyroid function. "
                          "Elevated TSH with low FT4 suggests hypothyroidism. "
                          "Suppressed TSH with elevated FT4 suggests hyperthyroidism.",
                "source": "Endocrine Society Guidelines",
            },
            "HBA1C": {
                "title": "Hemoglobin A1c Interpretation",
                "content": "HbA1c reflects average blood glucose over 2-3 months. "
                          "Values ≥6.5% are diagnostic for diabetes. "
                          "Values 5.7-6.4% indicate prediabetes.",
                "source": "ADA Diabetes Management Guidelines",
            },
        }

        result = knowledge.get(panel_type, {
            "title": "General Lab Result Interpretation",
            "content": "Lab results should be interpreted in clinical context. "
                      "Out-of-range values may not always indicate disease.",
            "source": "General Clinical Guidelines",
        })

        return [result][:top_k]
