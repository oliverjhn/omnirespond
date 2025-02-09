from typing import List
import boto3
from botocore.client import Config
from .base import BaseService
from .types import DocumentChunk
import json
from .base import log_timing


class StorageService(BaseService):
    def __init__(self, settings):
        super().__init__()
        self.bucket_name = settings.BUCKET_NAME
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT_URL,
            aws_access_key_id=settings.R2_ACCESS_KEY,
            aws_secret_access_key=settings.R2_SECRET_KEY,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )

    @log_timing
    async def store_chunks_json(
        self,
        chunks: List[DocumentChunk],
        metadata: dict,
        original_content: bytes,
        content_type: str,
    ) -> str:
        """Store chunks in a JSON format with their metadata"""
        try:
            collection = metadata.get("collection", "unsorted")
            filename = metadata.get("filename", "unnamed")
            document_key = f"{collection}/{filename}/document.json"

            # Create document structure
            document = {
                "metadata": metadata,  # metadata is clean, doesn't need cleaning
                "chunks": [
                    {
                        "text": chunk.text,
                        "index": idx,
                    }
                    for idx, chunk in enumerate(chunks)
                ],
            }

            # Store the JSON document with chunks
            self.client.put_object(
                Bucket=self.bucket_name,
                Key=document_key,
                Body=json.dumps(document, ensure_ascii=False).encode("utf-8"),
                ContentType="application/json",
            )

            # Store the original document (disabled for development)
            # original_key = f"{collection}/{filename}/original"
            # self.client.put_object(
            #     Bucket=self.bucket_name,
            #     Key=original_key,
            #     Body=original_content,
            #     ContentType=content_type,
            # )

            return document_key
        except Exception as e:
            self.logger.error(f"Failed to store chunks as JSON: {str(e)}")
            raise

    @log_timing
    async def get_chunk_json(self, document_key: str, chunk_index: int) -> str:
        """Retrieve a specific chunk from JSON storage"""
        try:
            response = self.client.get_object(Bucket=self.bucket_name, Key=document_key)
            content = json.loads(response["Body"].read().decode("utf-8"))
            chunks = content["chunks"]

            if 0 <= chunk_index < len(chunks):
                return chunks[chunk_index]["text"]
            raise ValueError(f"Chunk index {chunk_index} out of range")
        except Exception as e:
            self.logger.error(f"Failed to retrieve chunk from JSON: {str(e)}")
            raise

    async def get_document_metadata(self, document_key: str) -> dict:
        """Retrieve document metadata from JSON storage"""
        try:
            response = self.client.get_object(Bucket=self.bucket_name, Key=document_key)
            content = json.loads(response["Body"].read().decode("utf-8"))
            return content["metadata"]
        except Exception as e:
            self.logger.error(f"Failed to retrieve document metadata: {str(e)}")
            raise
