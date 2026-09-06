from typing import Dict, List
from .base import BaseService, log_timing
from .storage import StorageService
from .vector_db import VectorDBService
from .embeddings import EmbeddingService, SparseEmbeddingService
from .llm import LLMService
from .extractors import ExtractorService
import asyncio


class DocumentService(BaseService):
    def __init__(
        self,
        storage: StorageService,
        vector_db: VectorDBService,
        embedder: EmbeddingService,
        llm: LLMService,
        extractor: ExtractorService,
        settings: dict,
    ):
        super().__init__()
        self.storage = storage
        self.vector_db = vector_db
        self.embedder = embedder
        self.llm = llm
        self.extractor = extractor
        self.settings = settings
        self.sparse_embedder = SparseEmbeddingService(settings)

    @log_timing
    async def process_document(self, content: bytes, metadata: dict) -> Dict:
        try:
            # Extract chunks first as it's required for both operations
            chunks = await self.extractor.process_document(
                content, metadata["filename"]
            )

            content_type = self._get_content_type(metadata["filename"])

            # Run storage and embedding operations concurrently
            storage_task = self.storage.store_chunks_json(
                chunks=chunks,
                metadata=metadata,
                original_content=content,
                content_type=content_type,
            )

            # Generate both dense and sparse embeddings
            chunk_texts = [c.text for c in chunks]
            dense_task = self.embedder.embed_chunks(chunk_texts)
            sparse_task = self.sparse_embedder.sparse_embed_chunks(chunk_texts)

            # Wait for all operations to complete
            document_key, dense_embeddings, sparse_embeddings = await asyncio.gather(
                storage_task, dense_task, sparse_task
            )

            # Create collection and store embeddings
            await self.vector_db.create_collection(
                self.vector_db.collection_name, self.embedder.dimension
            )
            await self.vector_db.store_embeddings(
                dense_embeddings, sparse_embeddings, chunks, document_key, metadata
            )

            return {"status": "success", "chunk_count": len(chunks)}
        except Exception as e:
            self.logger.error(f"Document processing failed: {str(e)}")
            raise

    def _get_content_type(self, filename: str) -> str:
        """Helper to determine content type from filename"""
        extension = filename.lower().split(".")[-1]
        content_types = {
            "pdf": "application/pdf",
            "txt": "text/plain",
            "doc": "application/msword",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }
        return content_types.get(extension, "application/octet-stream")

    @log_timing
    async def process_query(
        self,
        query: str,
        collection_name: str,
        conversation: List[Dict[str, str]],
        model: str = None,
    ) -> Dict:
        try:
            # Generate dense and sparse embeddings for query
            dense_task = self.embedder.embed_chunks([query])
            sparse_task = self.sparse_embedder.sparse_embed_chunks([query])
            dense_embedding, sparse_embedding = await asyncio.gather(
                dense_task, sparse_task
            )

            search_results = await self.vector_db.hybrid_search(
                collection_name, query, dense_embedding[0], sparse_embedding[0]
            )

            # Retrieve chunks and prepare for reranking
            documents = []
            for result in search_results:
                chunk_text = await self.storage.get_chunk_json(
                    result["document_key"], result["chunk_index"]
                )
                documents.append(
                    {
                        "text": chunk_text,
                        "metadata": result["metadata"],
                    }
                )

            # Rerank with actual chunk text
            reranked_results = await self.llm.rerank_documents(query, documents, 5)

            context = "\n".join(chunk["text"] for chunk in reranked_results)
            response = await self.llm.generate_openai_response(
                query, context, conversation, model
            )
            return {
                "response": response,
                "relevant_chunks": reranked_results,
            }
        except Exception as e:
            self.logger.error(f"Query processing failed: {str(e)}")
            raise
