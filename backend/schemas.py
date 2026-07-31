from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

class TaxDetails(BaseModel):
    tax_rate: Optional[str] = Field(default=None, description="Tax percentage or rate")
    tax_amount: Optional[float] = Field(default=None, description="Tax monetary amount")

class ExpenseExtraction(BaseModel):
    vendor_name: str = Field(description="Name of the vendor or merchant")
    bill_number: Optional[str] = Field(default=None, description="Invoice or receipt number")
    date: str = Field(description="Transaction date in YYYY-MM-DD format")
    amount: float = Field(description="Total monetary amount")
    currency: str = Field(default="USD", description="Currency code e.g. USD, INR, EUR")
    tax_details: Optional[TaxDetails] = Field(default=None, description="Extracted tax breakdown if present")

class GroundTruthTarget(BaseModel):
    vendor_name: Optional[str] = None
    bill_number: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None

class FieldEvalScore(BaseModel):
    field_name: str
    extracted_value: Any
    target_value: Any
    confidence: float
    confidence_level: str  # HIGH, MED, LOW
    is_match: bool
    match_score: float     # 0 to 100
    match_type: str        # fuzzy, exact, date_parsed

class TokenUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0

class ModelEvalResult(BaseModel):
    model_id: str
    model_name: str
    extraction: ExpenseExtraction
    overall_accuracy: float # percentage 0 - 100
    latency_ms: int
    token_usage: TokenUsage
    cost_per_bill: float
    cost_per_100_bills: float
    field_scores: List[FieldEvalScore]
    error: Optional[str] = None

class EvaluateResponse(BaseModel):
    eval_id: str
    filename: str
    results: Dict[str, ModelEvalResult]
    is_mock: bool = False

class ZohoPushRequest(BaseModel):
    expense_data: ExpenseExtraction
    account_id: Optional[str] = "4021943000000000576"
    paid_through_account_id: Optional[str] = "4021943000000000459"

class ZohoPushResponse(BaseModel):
    success: bool
    message: str
    expense_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
