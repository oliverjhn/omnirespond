import datetime
import time
import logging
from fastapi import FastAPI, File, UploadFile, Form, Depends
from typing import List, Optional, Dict
from schemas import UploadRequest, UploadResponse, QueryRequest, QueryResponse
from config import get_settings
from services import (
    DocumentService,
    StorageService,
    VectorDBService,
    EmbeddingService,
    LLMService,
    ExtractorService,
)

# Add this near the top of app.py, before creating the FastAPI app
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'  # Simplified timestamp format
)

settings = get_settings()
app = FastAPI()


def get_services(settings=Depends(get_settings)):
    storage = StorageService(settings)
    vector_db = VectorDBService(settings)
    embedder = EmbeddingService(settings)
    llm = LLMService(settings)
    extractor = ExtractorService(settings)
    return DocumentService(storage, vector_db, embedder, llm, extractor, settings)


@app.post("/upload/", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    collection_name: str = Form("unsorted"),
    extractor_type: str = Form("pypdf"),
    service: DocumentService = Depends(get_services),
):
    start_time = time.perf_counter()
    content = await file.read()

    if extractor_type in ["standard", "unstructured", "pypdf"]:
        service.extractor.set_extractor(".pdf", extractor_type)

    result = await service.process_document(
        content=content,
        metadata={
            "filename": file.filename,
            "collection": collection_name,
            "upload_time": datetime.datetime.now().isoformat(),
        },
    )

    processing_time = time.perf_counter() - start_time
    return UploadResponse(
        message="File uploaded and processed successfully",
        processing_time_seconds=processing_time,
        total_chunks=result["chunk_count"],
    )


@app.post("/query/", response_model=QueryResponse)
async def query_documents(
    request: QueryRequest, service: DocumentService = Depends(get_services)
):
    result = await service.process_query(request.query, request.collection_name)

    return QueryResponse(
        response=result["response"],
        relevant_chunks=result["relevant_chunks"],
        timing=result["timing"],
    )
