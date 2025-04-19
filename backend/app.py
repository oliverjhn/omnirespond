import datetime
import time
import logging
from fastapi import FastAPI, File, UploadFile, Form, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from schemas import UploadResponse, QueryRequest, QueryResponse
from config import get_settings
from services import (
    DocumentService,
    StorageService,
    VectorDBService,
    EmbeddingService,
    LLMService,
    ExtractorService,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

settings = get_settings()
app = FastAPI(
    title="OmniRespond API",
    description="API for document processing and RAG-based querying",
    version="1.0.0",
    docs_url=None if settings.ENVIRONMENT == "production" else "/docs",
    redoc_url=None if settings.ENVIRONMENT == "production" else "/redoc",
)


# Security headers middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        return response


# Configure security middleware
app.add_middleware(SecurityHeadersMiddleware)
if settings.ENVIRONMENT == "production":
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=[".yourdomain.com"],  # Replace with your actual domain
    )

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    # allow any localhost dev port
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# File size limit middleware
class FileSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "POST" and "upload" in request.url.path:
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > settings.MAX_UPLOAD_SIZE:
                return JSONResponse(
                    status_code=413,
                    content={
                        "detail": f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE // (1024 * 1024)}MB"
                    },
                )
        return await call_next(request)


app.add_middleware(FileSizeLimitMiddleware)


def get_services(settings=Depends(get_settings)):
    storage = StorageService(settings)
    vector_db = VectorDBService(settings)
    embedder = EmbeddingService(settings)
    llm = LLMService(settings)
    extractor = ExtractorService(settings)
    return DocumentService(storage, vector_db, embedder, llm, extractor, settings)


@app.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    workspace_id: str = Form(..., description="Workspace ID for upload"),
    extractor_type: str = Form("pypdf"),
    service: DocumentService = Depends(get_services),
):
    start_time = time.perf_counter()
    content = await file.read()

    if extractor_type in ["unstructured", "pypdf"]:
        service.extractor.set_extractor(".pdf", extractor_type)

    # Pass workspace_id in metadata for downstream partitioning
    result = await service.process_document(
        content=content,
        metadata={
            "filename": file.filename,
            "workspace_id": workspace_id,
            "upload_time": datetime.datetime.now().isoformat(),
        },
    )

    processing_time = time.perf_counter() - start_time
    return UploadResponse(
        message="File uploaded and processed successfully",
        processing_time_seconds=processing_time,
        total_chunks=result["chunk_count"],
    )


@app.post("/query", response_model=QueryResponse)
async def query_documents(
    request: QueryRequest, service: DocumentService = Depends(get_services)
):
    # Use workspace_id from request for partitioned search
    result = await service.process_query(
        request.query,
        request.workspace_id,
        request.conversation,
        request.model,
    )

    return QueryResponse(
        response=result["response"],
        relevant_chunks=result["relevant_chunks"],
    )
