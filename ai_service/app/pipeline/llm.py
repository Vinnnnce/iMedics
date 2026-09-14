"""
LLM Client — Pluggable LLM provider for medical text generation.
Supports OpenAI, Azure OpenAI, and self-hosted (vLLM) providers.
"""

import json
import httpx
from typing import Any


class LLMClient:
    """LLM client supporting multiple providers."""

    def __init__(self, provider: str, model: str, api_key: str, base_url: str = None):
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.base_url = base_url or self._get_default_base_url(provider)
        self.timeout = 30.0

    def _get_default_base_url(self, provider: str) -> str:
        urls = {
            "openai": "https://api.openai.com/v1",
            "azure": None,  # Azure requires custom endpoint
            "self_hosted": "http://localhost:8080/v1",
        }
        return urls.get(provider, "https://api.openai.com/v1")

    async def generate_json(self, prompt: str, max_tokens: int = 500) -> dict:
        """
        Generate a JSON response from the LLM.

        The prompt should include instructions to output JSON.
        Returns parsed JSON dictionary.
        """
        try:
            response = await self._call_llm(prompt, max_tokens)
            return self._parse_json_response(response)
        except Exception as e:
            raise Exception(f"LLM generation failed: {e}")

    async def _call_llm(self, prompt: str, max_tokens: int) -> str:
        """Call the LLM API and return raw text response."""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a medical AI assistant. Always respond with valid JSON only, no markdown."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": max_tokens,
            "temperature": 0.3,  # Low temperature for consistency
            "response_format": {"type": "json_object"},
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    def _parse_json_response(self, text: str) -> dict:
        """Parse JSON from LLM response, handling markdown code blocks."""
        # Strip markdown code fences if present
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            # Remove first and last lines (fences)
            lines = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
            text = "\n".join(lines)

        return json.loads(text)
