from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    id: str
    filename: str
    page_count: Optional[int] = 0
    word_count: Optional[int] = 0
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True


class QuestionRequest(BaseModel):
    question: str
    model: Optional[str] = "gemini-3.5-flash-lite"


class AnswerResponse(BaseModel):
    answer: str
    model: str


class SummaryResponse(BaseModel):
    summary: str


class ConversationResponse(BaseModel):
    id: str
    question: str
    answer: str
    created_at: Optional[datetime] = None
    class Config:
        from_attributes = True