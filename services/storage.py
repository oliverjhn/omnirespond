from typing import List
import boto3
from botocore.client import Config
from .base import BaseService
from .types import DocumentChunk

class StorageService(BaseService):
    def __init__(self, settings):
        super().__init__()
        self.bucket_name = settings.BUCKET_NAME
        self.client = boto3.client(
            's3',
            endpoint_url=settings.R2_ENDPOINT_URL,
            aws_access_key_id=settings.R2_ACCESS_KEY,
            aws_secret_access_key=settings.R2_SECRET_KEY,
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )

    async def store_chunks(self, chunks: List[DocumentChunk], metadata: dict) -> str:
        """Store all chunk texts in a single file with separators"""
        try:
            CHUNK_SEPARATOR = "\n[CHUNK_SEPARATOR]\n"
            chunk_texts = [chunk.text for chunk in chunks]
            full_content = CHUNK_SEPARATOR.join(chunk_texts)
            
            collection = metadata.get('collection', 'uncategorized')
            filename = metadata.get('filename', 'unnamed')
            document_key = f"{collection}/{filename}/chunks.txt"
            
            self.client.put_object(
                Bucket=self.bucket_name,
                Key=document_key,
                Body=full_content.encode('utf-8')
            )
            return document_key
        except Exception as e:
            self.logger.error(f"Failed to store chunks: {str(e)}")
            raise

    async def get_chunks(self, document_key: str) -> List[str]:
        """Retrieve and split chunks from storage"""
        try:
            response = self.client.get_object(
                Bucket=self.bucket_name,
                Key=document_key
            )
            content = response['Body'].read().decode('utf-8')
            return content.split("\n[CHUNK_SEPARATOR]\n")
        except Exception as e:
            self.logger.error(f"Failed to retrieve chunks: {str(e)}")
            raise

    async def get_chunk(self, document_key: str, chunk_index: int) -> str:
        try:
            response = self.client.get_object(
                Bucket=self.bucket_name,
                Key=document_key
            )
            content = response['Body'].read().decode('utf-8')
            chunks = content.split("\n[CHUNK_SEPARATOR]\n")
            if 0 <= chunk_index < len(chunks):
                return chunks[chunk_index]
            raise ValueError(f"Chunk index {chunk_index} out of range")
        except Exception as e:
            self.logger.error(f"Failed to retrieve chunk: {str(e)}")
            raise
