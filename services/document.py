from typing import List, Dict
from .base import BaseService
from .storage import StorageService
from .vector_db import VectorDBService
from .embeddings import EmbeddingService
from .llm import LLMService
from .extractors import ExtractorService
import time

class DocumentService(BaseService):
    def __init__(
        self,
        storage: StorageService,
        vector_db: VectorDBService,
        embedder: EmbeddingService,
        llm: LLMService,
        extractor: ExtractorService,
        settings: dict
    ):
        super().__init__()
        self.storage = storage
        self.vector_db = vector_db
        self.embedder = embedder
        self.llm = llm
        self.extractor = extractor
        self.settings = settings

    async def process_document(self, content: bytes, metadata: dict) -> Dict:
        try:
            chunks = await self.extractor.process_document(content, metadata["filename"])
            document_key = await self.storage.store_chunks(chunks, metadata)
            embeddings = await self.embedder.embed_chunks([c.text for c in chunks])
            await self.vector_db.create_collection(metadata["collection"], self.embedder.dimension)
            await self.vector_db.store_embeddings(embeddings, chunks, document_key, metadata)
            return {"status": "success", "chunk_count": len(chunks)}
        except Exception as e:
            self.logger.error(f"Document processing failed: {str(e)}")
            raise

    async def process_query(self, query: str, collection_name: str) -> Dict:
        try:
            timing = {}
            
            # Search timing
            search_start = time.perf_counter()
            query_embedding = (await self.embedder.embed_chunks([query]))[0]
            search_results = await self.vector_db.search(collection_name, query_embedding)
            timing["search_time"] = f"{time.perf_counter() - search_start:.2f}s"
            
            chunks = []
            for result in search_results:
                chunk_text = await self.storage.get_chunk(
                    result["document_key"],
                    result["chunk_index"]
                )
                chunks.append({
                    "score": result["score"],
                    "text": chunk_text,
                    "metadata": result["metadata"]
                })
            
            # LLM timing
            llm_start = time.perf_counter()
            context = "\n".join(chunk["text"] for chunk in chunks)
            response = await self.llm.generate_response(query, context)
            timing["llm_time"] = f"{time.perf_counter() - llm_start:.2f}s"
            
            timing["total_time"] = f"{time.perf_counter() - search_start:.2f}s"
            
            return {
                "response": response,
                "relevant_chunks": chunks,
                "timing": timing
            }
        except Exception as e:
            self.logger.error(f"Query processing failed: {str(e)}")
            raise
