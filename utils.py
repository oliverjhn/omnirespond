from typing import List, Dict
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
import boto3
import pypdf
from io import BytesIO
import tempfile
import os
from openai import OpenAI
import numpy as np
import time
import pymupdf4llm
import uuid
import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Union, List, Optional, Dict, Any
import json
from botocore.client import Config

os.environ['OPENAI_API_KEY'] = "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"

# Create a single client instance at module level
openai_client = OpenAI()

@dataclass
class DocumentChunk:
    text: str

    def __str__(self) -> str:
        return self.text

class Embedder:
    def __init__(self, model_name: str):
        self.model_name = model_name

    @property
    def dimension(self) -> int:
        raise NotImplementedError("Subclasses must implement dimension property")

    def generate_embeddings(self, chunks: List[str]) -> List[np.ndarray]:
        raise NotImplementedError("Subclasses must implement generate_embeddings method.")

class FastEmbedEmbedder(Embedder):
    def __init__(self):
        super().__init__("fastembed")
        from fastembed import TextEmbedding
        self.embedding_model = TextEmbedding()

    @property
    def dimension(self) -> int:
        return 384  # FastEmbed dimension

    def generate_embeddings(self, chunks: List[str]) -> List[np.ndarray]:
        return list(self.embedding_model.embed(chunks))

class OpenAIEmbedder(Embedder):
    def __init__(self, model="text-embedding-3-small", batch_size=100):
        super().__init__("openai")
        self.model = model
        self.client = openai_client
        self.batch_size = batch_size

    @property
    def dimension(self) -> int:
        return 1536  # OpenAI dimension

    def generate_embeddings(self, chunks: List[str]) -> List[np.ndarray]:
        embeddings = []
        # Process chunks in batches
        for i in range(0, len(chunks), self.batch_size):
            batch = chunks[i:i + self.batch_size]
            response = self.client.embeddings.create(
                input=batch,
                model=self.model
            )
            embeddings.extend([np.array(data.embedding) for data in response.data])
        return embeddings

class TextExtractor(ABC):
    @abstractmethod
    def process(self, content: bytes, filename: str = None) -> List[Union[str, DocumentChunk]]:
        """Extract and chunk text from the document. Returns list of chunks."""
        pass

class PyPDFExtractor(TextExtractor):
    """Uses PyPDF for basic text extraction with simple chunking"""
    def __init__(self, chunk_size: int = 256, overlap: int = 32):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def process(self, content: bytes, filename: str = None) -> List[DocumentChunk]:
        start_time = time.time()
        try:
            # Extract text using PyPDF
            pdf_file = BytesIO(content)
            reader = pypdf.PdfReader(pdf_file)
            text = "\n".join(page.extract_text() for page in reader.pages)
            
            # Chunk the text
            words = text.split()
            chunks = []
            for i in range(0, len(words), self.chunk_size - self.overlap):
                chunk_text = " ".join(words[i:i + self.chunk_size])
                chunk = DocumentChunk(text=chunk_text)
                chunks.append(chunk)
            
            end_time = time.time()
            print(f"PyPDF extraction and chunking time: {end_time - start_time:.2f} seconds")
            print(f"Number of chunks generated: {len(chunks)}")
            
            return chunks
            
        except Exception as e:
            print(f"Error processing with PyPDF: {e}")
            raise
class UnstructuredPDFExtractor(TextExtractor):
    def __init__(self, max_characters: int = 1500, new_after_n_chars: int = 1500):
        self.max_characters = max_characters
        self.new_after_n_chars = new_after_n_chars

    def process(self, content: bytes, filename: str = None) -> List[DocumentChunk]:
        from unstructured.partition.pdf import partition_pdf
        from unstructured.chunking.basic import chunk_elements
        
        start_time = time.time()
        
        # Save the uploaded file to a temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        elements = partition_pdf(temp_file_path, strategy="hi_res")
        
        chunks = list(chunk_elements(elements, max_characters=self.max_characters, new_after_n_chars=self.new_after_n_chars))
        
        document_chunks = []
        for chunk in chunks:
            text = chunk.text
            document_chunk = DocumentChunk(text=text)
            document_chunks.append(document_chunk)
        
        # Delete the temporary file
        os.unlink(temp_file_path)
        
        end_time = time.time()
        print(f"Unstructured PDF extraction and chunking time: {end_time - start_time:.2f} seconds")
        print(f"Number of chunks generated: {len(document_chunks)}")
        
        return document_chunks

class StandardPDFExtractor(TextExtractor):
    def __init__(self, chunk_size: int = 256, overlap: int = 32):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def process(self, content: bytes, filename: str = None) -> List[DocumentChunk]:
        start_time = time.time()
        try:
            # Extract text using PyMuPDF
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=True) as temp_pdf:
                temp_pdf.write(content)
                temp_pdf.flush()
                text = pymupdf4llm.to_markdown(temp_pdf.name)
            
            # Chunk the text
            words = text.split()
            chunks = []
            for i in range(0, len(words), self.chunk_size - self.overlap):
                chunk_text = " ".join(words[i:i + self.chunk_size])
                chunk = DocumentChunk(text=chunk_text)
                chunks.append(chunk)
            
            end_time = time.time()
            print(f"Standard PDF extraction and chunking time: {end_time - start_time:.2f} seconds")
            print(f"Number of chunks generated: {len(chunks)}")
            
            return chunks
            
        except Exception as e:
            print(f"Error processing with PyMuPDF: {e}")
            raise
class PlainTextExtractor(TextExtractor):
    def __init__(self, chunk_size: int = 256, overlap: int = 32):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def process(self, content: bytes, filename: str = None) -> List[DocumentChunk]:
        try:
            text = content.decode("utf-8")
            words = text.split()
            chunks = []
            for i in range(0, len(words), self.chunk_size - self.overlap):
                chunk_text = " ".join(words[i:i + self.chunk_size])
                chunk = DocumentChunk(text=chunk_text)
                chunks.append(chunk)
            return chunks
        except Exception as e:
            print(f"Error processing plain text: {e}")
            raise
class DocumentProcessor:
    def __init__(self, 
                 qdrant_url: str = "http://localhost:6333", 
                 bucket_name: str = "omnirespond-user-documents", 
                 embedder: Embedder = None,
                 r2_endpoint_url: str = None,
                 r2_access_key: str = None,
                 r2_secret_key: str = None):
        self.client = QdrantClient(url=qdrant_url)
        
        # Configure Cloudflare R2 client
        self.s3_client = boto3.client(
            's3',
            endpoint_url=r2_endpoint_url,  # Directly use the provided endpoint URL
            aws_access_key_id=r2_access_key,
            aws_secret_access_key=r2_secret_key,
            config=Config(signature_version='s3v4'),
            region_name='auto'  # Cloudflare R2 uses 'auto'
        )
        
        self.bucket_name = bucket_name
        self.embedder = embedder or FastEmbedEmbedder()
        self.extractors = {
            ".pdf": UnstructuredPDFExtractor(),  # Default PDF extractor
            ".txt": PlainTextExtractor()
        }

    def create_collection_if_not_exists(self, collection_name: str):
        collections = self.client.get_collections()
        collection_names = [col.name for col in collections.collections]

        if collection_name not in collection_names:
            self.client.recreate_collection(
                collection_name=collection_name,
                vectors_config={
                    "size": self.embedder.dimension,
                    "distance": "Cosine"
                }
            )
            print(f"Collection '{collection_name}' created.")
        else:
            print(f"Collection '{collection_name}' already exists.")

    def generate_embeddings(self, chunks: List[Union[str, DocumentChunk]]) -> List[np.ndarray]:
        """Generate embeddings for chunks"""
        texts = [chunk.text if isinstance(chunk, DocumentChunk) else chunk for chunk in chunks]
        return self.embedder.generate_embeddings(texts)

    def store_document_with_chunks(self, chunks: List[DocumentChunk], base_key: str) -> str:
        """Store all chunk texts in a single file with separators"""
        CHUNK_SEPARATOR = "\n[CHUNK_SEPARATOR]\n"
        
        chunk_texts = [chunk.text for chunk in chunks]
        full_content = CHUNK_SEPARATOR.join(chunk_texts)
        document_key = f"{base_key}/chunks.txt"
        
        self.s3_client.put_object(
            Bucket=self.bucket_name,
            Key=document_key,
            Body=full_content.encode('utf-8')
        )
        return document_key

    def search_documents(self, collection_name: str, query: str, limit: int = 5) -> List[Dict]:
        """Search documents with optimized document batching for multiple chunks"""
        timing = {
            'embed_start': time.time(),
            'total_s3': 0,
            'total_processing': 0
        }
        
        # Generate embedding
        query_embedding = self.embedder.generate_embeddings([query])[0]
        print(f"Query embedding time: {time.time() - timing['embed_start']:.2f} seconds")
        
        # Vector search
        search_start = time.time()
        search_results = self.client.search(
            collection_name=collection_name,
            query_vector=query_embedding,
            limit=limit
        )
        print(f"Vector search time: {time.time() - search_start:.2f} seconds")
        
        # Group by document to minimize S3 calls
        doc_groups = {}
        for result in search_results:
            doc_key = result.payload["document_key"]
            if doc_key not in doc_groups:
                doc_groups[doc_key] = {
                    'results': [],
                    'indices': set()  # Using set for efficient lookup
                }
            doc_groups[doc_key]['results'].append(result)
            doc_groups[doc_key]['indices'].add(result.payload["chunk_index"])
        
        results = []
        
        # Process each document once
        for doc_key, group in doc_groups.items():
            try:
                # Time S3 retrieval
                s3_start = time.time()
                response = self.s3_client.get_object(Bucket=self.bucket_name, Key=doc_key)
                content = response['Body'].read().decode('utf-8')
                s3_time = time.time() - s3_start
                timing['total_s3'] += s3_time
                
                # Process chunks
                process_start = time.time()
                chunks = content.split("\n[CHUNK_SEPARATOR]\n")
                
                # Sort results by score before processing
                group['results'].sort(key=lambda x: x.score, reverse=True)
                
                for result in group['results']:
                    chunk_index = result.payload["chunk_index"]
                    if 0 <= chunk_index < len(chunks):
                        chunk_text = chunks[chunk_index]
                        
                        results.append({
                            "score": result.score,
                            "chunk_index": chunk_index,
                            "file_name": result.payload["file_name"],
                            "text": chunk_text,
                            "metadata": result.payload.get("metadata", {})
                        })
                
                process_time = time.time() - process_start
                timing['total_processing'] += process_time
                
                # Detailed timing info per document
                print(f"\nDocument: {doc_key}")
                print(f"  Chunks retrieved: {len(group['results'])} of {len(chunks)} total")
                print(f"  S3 retrieval: {s3_time:.3f}s")
                print(f"  Processing: {process_time:.3f}s")
                print(f"  Average time per chunk: {(s3_time + process_time)/len(group['results']):.3f}s")
                
            except Exception as e:
                print(f"Error processing document {doc_key}: {e}")
                continue
        
        # Final timing summary
        total_time = time.time() - timing['embed_start']
        print(f"\nPerformance Summary:")
        print(f"  Documents processed: {len(doc_groups)}")
        print(f"  Total chunks retrieved: {len(results)}")
        print(f"  Total S3 time: {timing['total_s3']:.2f}s")
        print(f"  Total processing time: {timing['total_processing']:.2f}s")
        print(f"  Total execution time: {total_time:.2f}s")
        
        return results

    def generate_openai_response(self, query: str, relevant_chunks: str, model: str) -> str:
        prompt = f"Query: {query}\n\nRelevant Chunks:\n{relevant_chunks}\n\nResponse:"
        response = openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are trained on the users documents and are able to answer questions about them. You will ONLY use the information provided in the relevant chunks to answer the question, and if you need to use information from your internal knowledge, you will explicitly state that you are using your internal knowledge."},
                {"role": "user", "content": prompt}
            ],
        )
        return response.choices[0].message.content

    def generate_chunk_id(self, filename: str, chunk: str) -> int:
        """Generate a deterministic ID for a chunk based on filename and content."""
        content_to_hash = f"{filename}:{chunk}"
        hash_object = hashlib.sha256(content_to_hash.encode())
        return int.from_bytes(hash_object.digest()[:8], byteorder='big')

    def set_extractor(self, extension: str, extractor: TextExtractor):
        """Allow changing the extractor for a given file type"""
        self.extractors[extension] = extractor

    def generate_summary_response(self, query: str, content: str, summary_type: str, model: str) -> str:
        """
        Generate a summary response using a dedicated system prompt for summarization.
        Different from QA responses to better handle summarization tasks.
        """
        response = openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": """You are a document summarization assistant. 
                Your task is to create summaries that:
                1. Focus on the user's specific request/query
                2. Maintain accuracy and context
                3. Adapt style based on the summary type requested
                4. Exclude information not relevant to the user's request"""},
                {"role": "user", "content": content}
            ],
        )
        return response.choices[0].message.content
