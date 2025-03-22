from pydantic import BaseModel, Field
from typing import List, Dict


class UploadRequest(BaseModel):
    collection_name: str = Field(
        default="unsorted", description="Collection name to store the document in"
    )
    extractor_type: str = Field(
        default="pypdf",
        description="Type of extractor to use: pypdf or unstructured",
    )


class UploadResponse(BaseModel):
    message: str
    processing_time_seconds: float
    total_chunks: int


class QueryRequest(BaseModel):
    query: str = Field(..., description="The query to search for")
    collection_name: str = Field(
        default="unsorted", description="Collection to search in"
    )


class TimingInfo(BaseModel):
    search_time: str
    llm_time: str
    total_time: str


class QueryResponse(BaseModel):
    response: str
    relevant_chunks: List[Dict]
