import datetime
import time
import uuid
import os
from fastapi import FastAPI, File, UploadFile, Form, Body, HTTPException, Depends
from fastapi.responses import JSONResponse
from utils import DocumentProcessor, FastEmbedEmbedder, OpenAIEmbedder, UnstructuredPDFExtractor, StandardPDFExtractor, PlainTextExtractor, PyPDFExtractor
from qdrant_client.models import PointStruct, Filter, FieldCondition, MatchValue
from chunking_evaluation import ChunkingStrategyEvaluator, ChunkingAnalysisReport
from typing import List, Optional, Dict
from pydantic import BaseModel, Field

os.environ['CLOUDFLARE_R2_ENDPOINT_URL'] = "https://521e26c2bd1913e7106917f5bfb40dc7.r2.cloudflarestorage.com"
os.environ['CLOUDFLARE_R2_ACCESS_KEY'] = "0a8ff4325f1fd47c48f16ee608d47f41"
os.environ['CLOUDFLARE_R2_SECRET_KEY'] = "4e29936face1be01a320cb7cd9b7de05ce114ee17c6d2545e465a8ad8df7da1b"

# Request/Response Models
class UploadRequest(BaseModel):
    collection_name: str = Field(default="uncategorised", description="Collection name to store the document in")
    extractor_type: str = Field(default="pypdf", description="Type of extractor to use: pypdf, standard, or unstructured")

class UploadResponse(BaseModel):
    message: str
    processing_time_seconds: float
    total_chunks: int

class QueryRequest(BaseModel):
    query: str = Field(..., description="The query to search for")
    collection_name: str = Field(default="default", description="Collection to search in")

class TimingInfo(BaseModel):
    search_time: str
    llm_time: str
    total_time: str

class QueryResponse(BaseModel):
    response: str
    relevant_chunks: List[Dict]
    timing: TimingInfo

class SummarizeRequest(BaseModel):
    collection_name: str = Field(..., description="Collection containing the document")
    file_name: str = Field(..., description="Name of the file to summarize")
    query: str = Field(..., description="User's query or instruction to guide the summarization")
    summary_type: str = Field(default="concise", description="Type of summary: concise, detailed, or bullet_points")

class SummaryMetadata(BaseModel):
    file_name: str
    collection_name: str
    summary_type: str
    chunk_count: int
    processing_time: str  # Keep only total processing time

class SummarizeResponse(BaseModel):
    summary: str
    metadata: SummaryMetadata

app = FastAPI()
doc_processor = DocumentProcessor(
    embedder=OpenAIEmbedder(),
    r2_endpoint_url=os.getenv('CLOUDFLARE_R2_ENDPOINT_URL'),
    r2_access_key=os.getenv('CLOUDFLARE_R2_ACCESS_KEY'),
    r2_secret_key=os.getenv('CLOUDFLARE_R2_SECRET_KEY')
)

@app.post("/upload/", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    collection_name: str = Form("uncategorised"),
    extractor_type: str = Form("pypdf")
):
    request = UploadRequest(collection_name=collection_name, extractor_type=extractor_type)
    overall_start_time = time.perf_counter()
    print(f"\nStarting file upload process for {file.filename}...")
    
    # Read file content
    content = await file.read()
    
    # Get file extension
    file_extension = "." + file.filename.split(".")[-1].lower()
    
    # Optionally switch extractor based on parameter
    if file_extension == ".pdf" and request.extractor_type == "standard":
        doc_processor.set_extractor(".pdf", StandardPDFExtractor())
    elif file_extension == ".pdf" and request.extractor_type == "unstructured":
        doc_processor.set_extractor(".pdf", UnstructuredPDFExtractor())
    elif file_extension == ".pdf" and request.extractor_type == "pypdf":
        doc_processor.set_extractor(".pdf", PyPDFExtractor())
    
    # Check if we support this file type
    if file_extension not in doc_processor.extractors:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Supported types: {', '.join(doc_processor.extractors.keys())}"
        )
    
    # Process the file using the selected extractor
    chunks = doc_processor.extractors[file_extension].process(content, file.filename)
    
    # Prepare metadata
    metadata = {
        "file_name": file.filename,
        "upload_time": datetime.datetime.now().isoformat()
    }

    # Create collection if needed
    doc_processor.create_collection_if_not_exists(request.collection_name)

    base_key = f"{request.collection_name}/{file.filename}"
    
    print("\n")

    # Store all chunks in single file
    s3_start = time.perf_counter()
    document_key = doc_processor.store_document_with_chunks(chunks, base_key)
    s3_end = time.perf_counter()
    print(f"S3 storage time: {s3_end - s3_start:.2f} seconds")
    
    # Generate embeddings and store in Qdrant
    embed_start = time.perf_counter()
    embeddings = list(doc_processor.generate_embeddings(chunks))
    embed_end = time.perf_counter()
    print(f"Embedding generation time: {embed_end - embed_start:.2f} seconds")
    
    # Create and store points in Qdrant
    points = [
        PointStruct(
            id=doc_processor.generate_chunk_id(file.filename, chunk),
            vector=embedding.tolist(),
            payload={
                **metadata,
                "chunk_index": chunk_index,
                "document_key": document_key,
            }
        )
        for chunk_index, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]
    
    qdrant_start = time.perf_counter()
    doc_processor.client.upsert(collection_name=request.collection_name, points=points)
    qdrant_end = time.perf_counter()
    print(f"Qdrant storage time: {qdrant_end - qdrant_start:.2f} seconds")
    
    end_time = time.perf_counter()
    total_time = end_time - overall_start_time
    print(f"Total processing time for {file.filename}: {total_time:.2f} seconds")
    
    return UploadResponse(
        message="File uploaded and processed successfully",
        processing_time_seconds=total_time,
        total_chunks=len(chunks)
    )

@app.post("/query/")
async def query_documents(
    query: str,
    collection_name: str = "default"
):
    request = QueryRequest(query=query, collection_name=collection_name)
    start_time = time.perf_counter()
    print(f"\nProcessing query: {request.query}")
    
    # Search timing
    search_start = time.perf_counter()
    relevant_chunks = doc_processor.search_documents(request.collection_name, request.query, limit=5)
    search_end = time.perf_counter()
    search_time = search_end - search_start
    print(f"Search time: {search_time:.2f}s")
    
    # LLM timing
    relevant_chunks_text = "\n".join([chunk['text'] for chunk in relevant_chunks])
    llm_start = time.perf_counter()
    llm_response = doc_processor.generate_openai_response(request.query, relevant_chunks_text, model="gpt-4o-mini")
    llm_end = time.perf_counter()
    llm_time = llm_end - llm_start
    print(f"LLM response time: {llm_time:.2f}s")
    
    total_time = time.perf_counter() - start_time
    print(f"Total query processing time: {total_time:.2f}s\n")
    
    return QueryResponse(
        response=llm_response,
        relevant_chunks=relevant_chunks,
        timing=TimingInfo(
            search_time=f"{search_time:.2f}s",
            llm_time=f"{llm_time:.2f}s",
            total_time=f"{total_time:.2f}s"
        )
    )

@app.post("/summarize/")
async def summarize_document(
    collection_name: str,
    file_name: str,
    query: str,
    summary_type: str = "concise"
):
    request = SummarizeRequest(
        collection_name=collection_name,
        file_name=file_name,
        query=query,
        summary_type=summary_type
    )
    
    start_time = time.perf_counter()
    
    try:
        # Time document retrieval
        retrieval_start = time.perf_counter()
        search_results = doc_processor.client.scroll(
            collection_name=request.collection_name,
            scroll_filter=Filter(
                must=[
                    FieldCondition(
                        key="file_name",
                        match=MatchValue(value=request.file_name)
                    )
                ]
            ),
            limit=1000  # Increased limit to get all chunks
        )
        
        print(f"\nFound {len(search_results[0])} chunks in document")  # Debug print
        
        chunks = []
        for point in search_results[0]:
            document_key = point.payload.get("document_key")
            if document_key:
                response = doc_processor.s3_client.get_object(
                    Bucket=doc_processor.bucket_name,
                    Key=document_key
                )
                content = response['Body'].read().decode('utf-8')
                chunk_texts = content.split("\n[CHUNK_SEPARATOR]\n")
                chunk_index = point.payload.get("chunk_index", 0)
                if 0 <= chunk_index < len(chunk_texts):
                    chunks.append({
                        "text": chunk_texts[chunk_index],
                        "chunk_index": chunk_index
                    })
        retrieval_time = time.perf_counter() - retrieval_start

        chunks.sort(key=lambda x: x["chunk_index"])
        
        if not chunks:
            raise HTTPException(
                status_code=404,
                detail="Document not found in collection"
            )

        # Time chunking and intermediate summaries
        chunking_start = time.perf_counter()
        chunk_groups = [chunks[i:i+5] for i in range(0, len(chunks), 5)]
        intermediate_summaries = []
        
        for group in chunk_groups:
            group_text = "\n\n".join([chunk["text"] for chunk in group])
            group_summary = doc_processor.generate_openai_response(
                query=f"Summarize this section of the document concisely:\n\n{group_text}",
                relevant_chunks="",
                model="gpt-4o-mini"
            )
            intermediate_summaries.append(group_summary)
        
        all_summaries = "\n\n".join(intermediate_summaries)
        chunking_time = time.perf_counter() - chunking_start

        # Time final summary generation
        summary_start = time.perf_counter()
        summary_prompts = {
            "concise": "Create a focused summary addressing this request:",
            "detailed": "Create a comprehensive summary addressing this request:",
            "bullet_points": "Create a bullet-point summary addressing this request:",
        }
        
        summary_prompt = f"""{summary_prompts.get(request.summary_type, summary_prompts['concise'])}

        User Request: {request.query}

        Document Content:
        {all_summaries}
        
        Summary:"""
        
        final_summary = doc_processor.generate_summary_response(
            query=request.query,
            content=summary_prompt,
            summary_type=request.summary_type,
            model="gpt-4o-mini"
        )
        summary_time = time.perf_counter() - summary_start
        
        total_time = time.perf_counter() - start_time
        
        # Print timing information
        print(f"\nTiming Information:")
        print(f"  Document Retrieval: {retrieval_time:.2f}s")
        print(f"  Chunking & Intermediate Summaries: {chunking_time:.2f}s")
        print(f"  Final Summary Generation: {summary_time:.2f}s")
        print(f"  Total Processing Time: {total_time:.2f}s")
        
        return SummarizeResponse(
            summary=final_summary,
            metadata=SummaryMetadata(
                file_name=request.file_name,
                collection_name=request.collection_name,
                summary_type=request.summary_type,
                chunk_count=len(chunks),
                processing_time=f"{total_time:.2f}s"  # Keep only total time in response
            )
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")
