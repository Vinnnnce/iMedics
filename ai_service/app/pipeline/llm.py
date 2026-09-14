"""LLM Client — supports Kimi K3 (Moonshot AI), OpenAI, and self-hosted models."""

import httpx
from typing import Optional, Any
from app.config import settings


class LLMClient:
    """Unified LLM client for generating medical lab result explanations."""

    def __init__(
        self,
        provider: str = "kimi",
        model: str = "kimi-k3",
        api_key: str = "",
        base_url: Optional[str] = None,
    ):
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.base_url = base_url or self._default_base_url(provider)
        self.client = httpx.AsyncClient(timeout=60.0)

    def _default_base_url(self, provider: str) -> str:
        defaults = {
            "kimi": "https://api.moonshot.cn/v1",
            "openai": "https://api.openai.com/v1",
            "azure": "",
        }
        return defaults.get(provider, "http://localhost:8000/v1")

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 500,
        temperature: float = 0.3,
    ) -> str:
        """Generate text from the LLM."""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        response = await self.client.post(
            f"{self.base_url}/chat/completions",
            json=payload,
            headers=headers,
        )

        if response.status_code != 200:
            raise Exception(
                f"LLM API error {response.status_code}: {response.text}"
            )

        data = response.json()
        return data["choices"][0]["message"]["content"]

    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 500,
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        """Generate JSON output from the LLM. Parses the response as JSON."""
        # Add instruction to return JSON
        system_with_json = system_prompt + "\n\nIMPORTANT: Return your response as valid JSON only, no markdown or extra text."

        raw = await self.generate(
            system_with_json,
            user_prompt,
            max_tokens=max_tokens,
            temperature=temperature,
        )

        # Clean up potential markdown code blocks
        cleaned = raw.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        import json
        return json.loads(cleaned)

    async def close(self):
        await self.client.aclose()
