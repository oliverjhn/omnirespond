from typing import List, Dict, Optional
import numpy as np
from qdrant_client import QdrantClient, models
from qdrant_client.models import (
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    MatchAny,
)
from .base import BaseService
from .types import DocumentChunk
from .base import log_timing


class VectorDBService(BaseService):
    def __init__(self, settings):
        super().__init__()
        self.settings = settings  # Store settings as instance variable
        self.client = QdrantClient(
            url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY
        )
        # Use a single Qdrant collection for all workspaces
        self.collection_name = settings.DEFAULT_COLLECTION

    @log_timing
    async def create_collection(self, collection_name: str, vector_size: int):
        """Create a new collection if it doesn't exist"""
        try:
            # Always ensure a single collection for all workspaces
            collections = self.client.get_collections()
            if self.collection_name not in [
                col.name for col in collections.collections
            ]:
                self.client.recreate_collection(
                    collection_name=self.collection_name,
                    vectors_config={
                        "dense": models.VectorParams(
                            size=vector_size, distance=models.Distance.COSINE
                        )
                    },
                    sparse_vectors_config={
                        "sparse": models.SparseVectorParams(
                            modifier=models.Modifier.IDF
                        )
                    },
                )
                self.logger.info(f"Created collection: {self.collection_name}")
        except Exception as e:
            self.logger.error(f"Failed to create collection: {str(e)}")
            raise

    @log_timing
    async def store_embeddings(
        self,
        embeddings: List[np.ndarray],
        sparse_embeddings: List[Dict[str, List[float]]],
        chunks: List[DocumentChunk],
        document_key: str,
        metadata: dict,
    ):
        """Store both dense and sparse embeddings with their metadata"""
        try:
            # Extract workspace id from metadata for partitioning
            workspace_id = metadata.get("workspace_id")
            # Filter out keys not needed in payload (collection, workspace_id)
            metadata_payload = {
                k: v
                for k, v in metadata.items()
                if k not in ["collection", "workspace_id"]
            }
            # Store all embeddings in the single collection
            collection = self.collection_name
            points = [
                PointStruct(
                    id=self._generate_chunk_id(
                        metadata["filename"], workspace_id, chunk
                    ),
                    vector={
                        "dense": embedding.tolist(),
                        "sparse": models.SparseVector(
                            indices=sparse_embedding["indices"],
                            values=sparse_embedding["values"],
                        ),
                    },
                    payload={  # Include group_id for multitenancy partition
                        **metadata_payload,
                        "group_id": workspace_id,
                        "chunk_index": idx,
                        "document_key": document_key,
                    },
                )
                for idx, (chunk, embedding, sparse_embedding) in enumerate(
                    zip(chunks, embeddings, sparse_embeddings)
                )
            ]
            self.client.upsert(collection_name=collection, points=points)
        except Exception as e:
            self.logger.error(f"Failed to store embeddings: {str(e)}")
            raise

    def _generate_chunk_id(
        self, filename: str, workspace_id: str, chunk: DocumentChunk
    ) -> int:
        """Generate a deterministic ID for a chunk based on filename, workspace_id and chunk content"""
        import hashlib

        content_to_hash = f"{filename}:{workspace_id}:{chunk.text}"
        hash_object = hashlib.sha256(content_to_hash.encode())
        return int.from_bytes(hash_object.digest()[:8], byteorder="big")

    @log_timing
    async def search(
        self, collection_name: str, query_vector: np.ndarray, limit: int = 5
    ) -> List[Dict]:
        try:
            # Filter results by workspace via group_id for multitenancy
            filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="group_id",
                        match=models.MatchValue(value=collection_name),
                    )
                ]
            )
            results = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_vector.tolist(),
                limit=limit,
                query_filter=filter,  # Multitenancy filter by group_id
            )
            return [
                {
                    "score": hit.score,
                    "document_key": hit.payload["document_key"],
                    "chunk_index": hit.payload["chunk_index"],
                    "metadata": {
                        k: v
                        for k, v in hit.payload.items()
                        if k not in ["document_key", "chunk_index"]
                    },
                }
                for hit in results
            ]
        except Exception as e:
            self.logger.error(f"Search failed: {str(e)}")
            raise

    @log_timing
    async def hybrid_search(
        self,
        collection_name: str,
        query: str,
        query_vector: np.ndarray,
        sparse_vector: Dict[str, List[float]],
        rerank_top_k: int = 100,
        dense_limit: int = 5,
        sparse_limit: int = 2,
    ) -> List[Dict]:
        try:
            # Apply workspace filter via group_id for multitenancy
            filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="group_id",
                        match=models.MatchValue(value=collection_name),
                    )
                ]
            )
            response = self.client.query_points(
                collection_name=self.collection_name,
                query_filter=filter,  # Multitenancy filter by group_id
                prefetch=[
                    models.Prefetch(
                        query=query_vector.tolist(),
                        using="dense",
                        limit=dense_limit,
                    ),
                    models.Prefetch(
                        query=models.SparseVector(
                            indices=sparse_vector["indices"],
                            values=sparse_vector["values"],
                        ),
                        using="sparse",
                        limit=sparse_limit,
                    ),
                ],
                query=models.FusionQuery(fusion=models.Fusion.RRF),
            )

            results = response.points
            documents = []
            for hit in results:
                documents.append(
                    {
                        "score": hit.score,
                        "document_key": hit.payload["document_key"],
                        "chunk_index": hit.payload["chunk_index"],
                        "metadata": {
                            k: v
                            for k, v in hit.payload.items()
                            if k not in ["document_key", "chunk_index"]
                        },
                    }
                )

            return documents

        except Exception as e:
            self.logger.error(f"Hybrid search failed: {str(e)}")
            raise

    @log_timing
    async def delete_points_by_filter(self, workspace_id: str, filenames: List[str]):
        """Delete points matching the workspace_id and filenames."""
        try:
            if not filenames:
                self.logger.warning("No filenames provided for deletion.")
                return None

            qdrant_filter = Filter(
                must=[
                    FieldCondition(
                        key="group_id",
                        match=MatchValue(value=workspace_id),
                    ),
                    FieldCondition(
                        key="filename",
                        match=MatchAny(any=filenames),
                    ),
                ]
            )

            result = self.client.delete(
                collection_name=self.collection_name,
                points_selector=qdrant_filter,
            )
            self.logger.info(
                f"Deletion request sent for workspace {workspace_id}, filenames: {filenames}. Result: {result}"
            )
            return result

        except Exception as e:
            self.logger.error(f"Failed to delete points by filter: {str(e)}")
            raise
