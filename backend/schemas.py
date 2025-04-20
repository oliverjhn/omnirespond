from pydantic import BaseModel, Field
from typing import List, Dict, Optional


# class WorkspaceSchema(BaseModel):
#     id: str
#     name: str
#     user_id: str
#     created_at: Optional[datetime]


# class ChatSchema(BaseModel):
#     id: str
#     workspace_id: str
#     name: str
#     created_at: Optional[datetime]


# class MessageSchema(BaseModel):
#     id: str
#     chat_id: str
#     role: str  # 'user' | 'assistant'
#     content: str
#     created_at: Optional[datetime]


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
    conversation: List[Dict[str, str]] = Field(
        ...,
        description="The complete conversation with the chatbot, including the most recent user message",
    )
    workspace_id: str = Field(
        ..., description="Workspace ID to search in for multitenancy partition"
    )
    model: str = Field(
        default="gpt-4o-mini",
        description="Model to use for the query",
    )

    # @property
    # def trimmed_conversations(self) -> List[Dict[str, str]]:
    #     return [{"role": msg.role, "content": msg.content} for msg in self.conversation]


class TimingInfo(BaseModel):
    search_time: str
    llm_time: str
    total_time: str


class QueryResponse(BaseModel):
    response: str
    relevant_chunks: List[Dict]


class DeleteRequest(BaseModel):
    workspace_id: str
    filenames: List[str]


class DeleteResponse(BaseModel):
    message: str
    status: str
