from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    model_config = {"from_attributes": True}
    id: str
    email: str
    name: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class QuestionRequest(BaseModel):
    question: str


class ConversationOut(BaseModel):
    model_config = {"from_attributes": True}
    id: str
    role: str
    content: str
    created_at: datetime


class DocumentOut(BaseModel):
    model_config = {"from_attributes": True}
    id: str
    filename: str
    pages: Optional[int] = None
    word_count: Optional[int] = None
    read_time: Optional[int] = None
    created_at: datetime


# Force-build all models
UserOut.model_rebuild()
TokenResponse.model_rebuild()
DocumentOut.model_rebuild()
ConversationOut.model_rebuild()