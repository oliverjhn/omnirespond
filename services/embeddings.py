from typing import List
import numpy as np
from .base import BaseService, log_timing
from openai import OpenAI
from fastembed import TextEmbedding

class EmbeddingService(BaseService):
    def __init__(self, settings):
        super().__init__()
        self.settings = settings
        self.batch_size = 100
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.default_model = settings.DEFAULT_EMBEDDING_MODEL

    @log_timing
    async def embed_chunks(
        self, chunks: List[str], model: str = None
    ) -> List[np.ndarray]:
        try:
            model = model or self.default_model
            embeddings = []
            for i in range(0, len(chunks), self.batch_size):
                batch = chunks[i : i + self.batch_size]
                response = self.client.embeddings.create(input=batch, model=model)
                embeddings.extend([np.array(data.embedding) for data in response.data])
            return embeddings
        except Exception as e:
            self.logger.error(f"Failed to generate embeddings: {str(e)}")
            raise

    @property
    def dimension(self) -> int:
        # text-embedding-3-small dimension
        return 1536


class FastEmbeddingService(BaseService):
    def __init__(self, settings):
        super().__init__()
        self.embedding_model = TextEmbedding()

    @log_timing
    async def embed_chunks(
        self, chunks: List[str], model: str = None
    ) -> List[np.ndarray]:
        try:
            return list(self.embedding_model.embed(chunks))
        except Exception as e:
            self.logger.error(f"Failed to generate embeddings: {str(e)}")
            raise

    @property
    def dimension(self) -> int:
        return 384  # FastEmbed dimension
