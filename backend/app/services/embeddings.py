import httpx
from ..config import settings


async def embed(text: str) -> list[float] | None:
    url = f"{settings.embedding_base_url}/models/{settings.embedding_model}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {settings.embedding_api_key}"},
                json={"inputs": text},
            )
            resp.raise_for_status()
            result = resp.json()
            # HF returns [[...]] for batch or [...] for single input
            if result and isinstance(result[0], list):
                return result[0]
            return result
    except Exception as e:
        raise RuntimeError(f"Embedding request failed: {e}") from e
