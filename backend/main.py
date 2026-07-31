import os
import uuid
import asyncio
import base64
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from schemas import (
    ExpenseExtraction,
    GroundTruthTarget,
    EvaluateResponse,
    ZohoPushRequest,
    ZohoPushResponse,
    ModelEvalResult
)
from models import extract_gemini, extract_openai, extract_openrouter, USE_MOCK_MODELS
from zoho import create_expense
from db import init_db, save_evaluation, get_evaluations, get_prompts, get_active_prompt, save_prompt, set_active_prompt

load_dotenv()

app = FastAPI(
    title="Taxor AI Eval Engine",
    description="Handwritten Bill Evaluator & Benchmark Service for Gemini 1.5 Flash, GPT-4o-mini & Zoho Books",
    version="1.0.0"
)

@app.on_event("startup")
def on_startup():
    init_db()

# Enable CORS for Next.js frontend running on localhost:3000
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {
        "status": "online",
        "mock_mode": USE_MOCK_MODELS,
        "service": "Taxor AI Eval Engine"
    }

@app.post("/api/evaluate", response_model=EvaluateResponse)
async def evaluate_bill(
    file: UploadFile = File(...),
    target_vendor: Optional[str] = Form(None),
    target_bill_number: Optional[str] = Form(None),
    target_date: Optional[str] = Form(None),
    target_amount: Optional[float] = Form(None),
    target_currency: Optional[str] = Form(None)
):
    """
    Evaluates a bill image across Gemini 1.5 Flash and GPT-4o-mini concurrently.
    Compares extractions against ground truth if provided and computes 100-bill projected costs.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image (JPEG, PNG, WebP)")

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    target = None
    if any([target_vendor, target_bill_number, target_date, target_amount, target_currency]):
        target = GroundTruthTarget(
            vendor_name=target_vendor,
            bill_number=target_bill_number,
            date=target_date,
            amount=target_amount,
            currency=target_currency
        )

    # Get active prompt
    active_prompt_obj = get_active_prompt()
    active_prompt_text = active_prompt_obj["prompt_text"] if active_prompt_obj else None

    # Concurrently execute Gemini, OpenAI, and OpenRouter extractions using asyncio.gather
    results = await asyncio.gather(
        extract_gemini(image_bytes, target=target, prompt_text=active_prompt_text),
        extract_openai(image_bytes, target=target, prompt_text=active_prompt_text),
        extract_openrouter(image_bytes, target=target, prompt_text=active_prompt_text, model_name="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"),
        extract_openrouter(image_bytes, target=target, prompt_text=active_prompt_text, model_name="google/gemma-4-31b-it:free"),
        return_exceptions=True
    )

    gemini_result, openai_result, nemotron_result, gemma_result = results

    # Standardize result object dictionary
    model_results = {}
    
    if isinstance(gemini_result, ModelEvalResult):
        model_results["gemini-1.5-flash"] = gemini_result
    else:
        model_results["gemini-1.5-flash"] = ModelEvalResult(
            model_id="gemini-1.5-flash",
            model_name="Gemini 1.5 Flash",
            extraction=ExpenseExtraction(vendor_name="Error", date="2023-10-14", amount=0.0, currency="USD"),
            overall_accuracy=0.0,
            latency_ms=0,
            token_usage={"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
            cost_per_bill=0.0,
            cost_per_100_bills=0.0,
            field_scores=[],
            error=str(gemini_result)
        )

    if isinstance(openai_result, ModelEvalResult):
        model_results["gpt-4o-mini"] = openai_result
    else:
        model_results["gpt-4o-mini"] = ModelEvalResult(
            model_id="gpt-4o-mini",
            model_name="GPT-4o-mini",
            extraction=ExpenseExtraction(vendor_name="Error", date="2023-10-14", amount=0.0, currency="USD"),
            overall_accuracy=0.0,
            latency_ms=0,
            token_usage={"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
            cost_per_bill=0.0,
            cost_per_100_bills=0.0,
            field_scores=[],
            error=str(openai_result)
        )

    if isinstance(nemotron_result, ModelEvalResult):
        model_results["nemotron-3-nano"] = nemotron_result
    else:
        model_results["nemotron-3-nano"] = ModelEvalResult(
            model_id="nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
            model_name="Nemotron 3 Nano",
            extraction=ExpenseExtraction(vendor_name="Error", date="2023-10-14", amount=0.0, currency="USD"),
            overall_accuracy=0.0,
            latency_ms=0,
            token_usage={"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
            cost_per_bill=0.0,
            cost_per_100_bills=0.0,
            field_scores=[],
            error=str(nemotron_result)
        )

    if isinstance(gemma_result, ModelEvalResult):
        model_results["gemma-4-31b"] = gemma_result
    else:
        model_results["gemma-4-31b"] = ModelEvalResult(
            model_id="google/gemma-4-31b-it:free",
            model_name="Gemma 4 31B",
            extraction=ExpenseExtraction(vendor_name="Error", date="2023-10-14", amount=0.0, currency="USD"),
            overall_accuracy=0.0,
            latency_ms=0,
            token_usage={"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
            cost_per_bill=0.0,
            cost_per_100_bills=0.0,
            field_scores=[],
            error=str(gemma_result)
        )

    eval_id = f"ev_{uuid.uuid4().hex[:6]}"

    response = EvaluateResponse(
        eval_id=eval_id,
        filename=file.filename or "receipt.jpg",
        results=model_results,
        is_mock=USE_MOCK_MODELS
    )

    # Save to SQLite DB
    try:
        # Convert image bytes to base64 string to store in DB
        mime_type = file.content_type or "image/jpeg"
        img_b64 = f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode('utf-8')}"
        
        db_id = save_evaluation(response.filename, response.model_dump(), img_b64)
        response.eval_id = f"db_{db_id}" # Update with actual DB id
    except Exception as e:
        print(f"Error saving to DB: {e}")

    return response

@app.post("/api/zoho")
async def push_to_zoho(request: ZohoPushRequest):
    """Pushes extracted expense payload to Zoho Books API."""
    return await create_expense(request)

@app.get("/api/prompts")
def fetch_prompts():
    return get_prompts()

@app.post("/api/prompts")
def create_prompt(name: str = Form(...), prompt_text: str = Form(...), is_active: bool = Form(False)):
    pid = save_prompt(name, prompt_text, is_active)
    return {"id": pid}

@app.post("/api/prompts/{prompt_id}/activate")
def activate_prompt(prompt_id: int):
    set_active_prompt(prompt_id)
    return {"status": "ok"}

@app.get("/api/evaluations")
async def fetch_evaluations():
    """Fetches all past evaluations from the SQLite database."""
    try:
        return get_evaluations()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
