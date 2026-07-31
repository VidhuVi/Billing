import os
import time
import json
import base64
import asyncio
from typing import Optional
from dotenv import load_dotenv

from google import genai
from google.genai import types
from openai import OpenAI

from schemas import ExpenseExtraction, GroundTruthTarget, ModelEvalResult, TokenUsage
from evaluator import evaluate_extraction

load_dotenv()

USE_MOCK_MODELS = os.getenv("USE_MOCK_MODELS", "true").lower() in ("true", "1", "t")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

# Initialize Gemini Client if key is provided
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# Initialize OpenAI if key is provided
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# Initialize OpenRouter Client
openrouter_client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key=OPENROUTER_API_KEY,
) if OPENROUTER_API_KEY else None

PROMPT_TEXT = (
    "You are a high-precision document extraction AI. Extract the handwritten or printed receipt data into the following schema:\n"
    "- vendor_name: string (name of the company/vendor)\n"
    "- bill_number: string or null (invoice/receipt ID)\n"
    "- date: string YYYY-MM-DD\n"
    "- amount: float (total monetary amount)\n"
    "- currency: string (e.g., USD, INR, EUR)\n"
    "- tax_details: object or null"
)

def calculate_costs(model_type: str, input_tokens: int, output_tokens: int) -> tuple[float, float]:
    """Calculates cost per bill and cost for 100 bills based on model pricing."""
    if model_type == "gemini":
        input_rate = 0.075 / 1_000_000
        output_rate = 0.30 / 1_000_000
    elif model_type == "openrouter":
        input_rate = 0.0  # Many free models on OpenRouter
        output_rate = 0.0
    else:  # openai gpt-4o-mini
        input_rate = 0.150 / 1_000_000
        output_rate = 0.60 / 1_000_000

    cost_per_bill = (input_tokens * input_rate) + (output_tokens * output_rate)
    cost_per_100 = cost_per_bill * 100
    return round(cost_per_bill, 5), round(cost_per_100, 2)

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")

async def extract_gemini(image_bytes: bytes, target: Optional[GroundTruthTarget] = None, prompt_text: Optional[str] = None) -> ModelEvalResult:
    """Extracts receipt data using Gemini (default: gemini-flash-lite-latest) structured outputs or fallback mock."""
    start_time = time.time()
    model_display_name = f"Gemini ({GEMINI_MODEL})"
    prompt = prompt_text or PROMPT_TEXT
    
    if USE_MOCK_MODELS or not GEMINI_API_KEY or not gemini_client:
        await asyncio.sleep(0.6)  # Simulate API latency
        extraction = ExpenseExtraction(
            vendor_name="City Cab Corp",
            bill_number="7842",
            date="2023-10-14",
            amount=42.50,
            currency="USD",
            tax_details={"tax_rate": "5%", "tax_amount": 2.12}
        )
        input_tokens, output_tokens = 320, 65
        cost_bill, cost_100 = calculate_costs("gemini", input_tokens, output_tokens)
        overall_accuracy, field_scores = evaluate_extraction(extraction, target)
        
        return ModelEvalResult(
            model_id=GEMINI_MODEL,
            model_name=model_display_name,
            extraction=extraction,
            overall_accuracy=overall_accuracy,
            latency_ms=int((time.time() - start_time) * 1000),
            token_usage=TokenUsage(input_tokens=input_tokens, output_tokens=output_tokens, total_tokens=input_tokens + output_tokens),
            cost_per_bill=cost_bill,
            cost_per_100_bills=cost_100,
            field_scores=field_scores
        )

    # Candidate models in order of preference
    candidate_models = [GEMINI_MODEL, "gemini-flash-lite-latest", "gemini-flash-latest"]
    seen = set()
    candidate_models = [m for m in candidate_models if not (m in seen or seen.add(m))]

    last_exception = None
    for model_name in candidate_models:
        try:
            response = await asyncio.to_thread(
                gemini_client.models.generate_content,
                model=model_name,
                contents=[
                    prompt,
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type="image/jpeg",
                    ),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ExpenseExtraction,
                ),
            )
            parsed_json = json.loads(response.text)
            extraction = ExpenseExtraction(**parsed_json)
            
            # Token usage estimation
            usage = getattr(response, "usage_metadata", None)
            input_tokens = getattr(usage, "prompt_token_count", 450) if usage else 450
            output_tokens = getattr(usage, "candidates_token_count", 80) if usage else 80
            cost_bill, cost_100 = calculate_costs("gemini", input_tokens, output_tokens)
            overall_accuracy, field_scores = evaluate_extraction(extraction, target)
            
            return ModelEvalResult(
                model_id=model_name,
                model_name=f"Gemini ({model_name})",
                extraction=extraction,
                overall_accuracy=overall_accuracy,
                latency_ms=int((time.time() - start_time) * 1000),
                token_usage=TokenUsage(input_tokens=input_tokens, output_tokens=output_tokens, total_tokens=input_tokens + output_tokens),
                cost_per_bill=cost_bill,
                cost_per_100_bills=cost_100,
                field_scores=field_scores
            )
        except Exception as e:
            last_exception = e
            continue

    # Fallback graceful error handling if all models failed
    extraction = ExpenseExtraction(vendor_name="Unknown Vendor", date="2023-10-14", amount=0.0, currency="USD")
    overall_accuracy, field_scores = evaluate_extraction(extraction, target)
    return ModelEvalResult(
        model_id=GEMINI_MODEL,
        model_name=model_display_name,
        extraction=extraction,
        overall_accuracy=0.0,
        latency_ms=int((time.time() - start_time) * 1000),
        token_usage=TokenUsage(input_tokens=0, output_tokens=0, total_tokens=0),
        cost_per_bill=0.0,
        cost_per_100_bills=0.0,
        field_scores=field_scores,
        error=str(last_exception)
    )


async def extract_openai(image_bytes: bytes, target: Optional[GroundTruthTarget] = None, prompt_text: Optional[str] = None) -> ModelEvalResult:
    """Extracts receipt data using GPT-4o-mini structured outputs or fallback mock."""
    start_time = time.time()
    prompt = prompt_text or PROMPT_TEXT
    
    if USE_MOCK_MODELS or not OPENAI_API_KEY or not openai_client:
        await asyncio.sleep(0.9)  # Simulate API latency
        extraction = ExpenseExtraction(
            vendor_name="City Cab Corp",
            bill_number="7842",
            date="2023-10-14",
            amount=42.50,
            currency="USD",
            tax_details=None
        )
        input_tokens, output_tokens = 410, 72
        cost_bill, cost_100 = calculate_costs("openai", input_tokens, output_tokens)
        overall_accuracy, field_scores = evaluate_extraction(extraction, target)
        
        return ModelEvalResult(
            model_id="gpt-4o-mini",
            model_name="GPT-4o-mini",
            extraction=extraction,
            overall_accuracy=overall_accuracy,
            latency_ms=int((time.time() - start_time) * 1000),
            token_usage=TokenUsage(input_tokens=input_tokens, output_tokens=output_tokens, total_tokens=input_tokens + output_tokens),
            cost_per_bill=cost_bill,
            cost_per_100_bills=cost_100,
            field_scores=field_scores
        )

    try:
        base64_image = base64.b64encode(image_bytes).decode("utf-8")
        
        completion = await asyncio.to_thread(
            openai_client.beta.chat.completions.parse,
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                        }
                    ]
                }
            ],
            response_format=ExpenseExtraction
        )
        
        extraction = completion.choices[0].message.parsed
        input_tokens = completion.usage.prompt_tokens
        output_tokens = completion.usage.completion_tokens
        cost_bill, cost_100 = calculate_costs("openai", input_tokens, output_tokens)
        overall_accuracy, field_scores = evaluate_extraction(extraction, target)
        
        return ModelEvalResult(
            model_id="gpt-4o-mini",
            model_name="GPT-4o-mini",
            extraction=extraction,
            overall_accuracy=overall_accuracy,
            latency_ms=int((time.time() - start_time) * 1000),
            token_usage=TokenUsage(input_tokens=input_tokens, output_tokens=output_tokens, total_tokens=input_tokens + output_tokens),
            cost_per_bill=cost_bill,
            cost_per_100_bills=cost_100,
            field_scores=field_scores
        )
    except Exception as e:
        extraction = ExpenseExtraction(vendor_name="Unknown Vendor", date="2023-10-14", amount=0.0, currency="USD")
        overall_accuracy, field_scores = evaluate_extraction(extraction, target)
        err_msg = str(e)
        if "credit_balance_exhausted" in err_msg or "insufficient_quota" in err_msg:
            err_msg = "OpenAI 429: No credits remaining on OpenAI platform account."
        return ModelEvalResult(
            model_id="gpt-4o-mini",
            model_name="GPT-4o-mini",
            extraction=extraction,
            overall_accuracy=0.0,
            latency_ms=int((time.time() - start_time) * 1000),
            token_usage=TokenUsage(input_tokens=0, output_tokens=0, total_tokens=0),
            cost_per_bill=0.0,
            cost_per_100_bills=0.0,
            field_scores=field_scores,
            error=err_msg
        )

async def extract_openrouter(image_bytes: bytes, model_name: str = "openrouter/free", target: Optional[GroundTruthTarget] = None, prompt_text: Optional[str] = None) -> ModelEvalResult:
    """Extracts receipt data using an OpenRouter model."""
    start_time = time.time()
    prompt = prompt_text or PROMPT_TEXT
    
    if USE_MOCK_MODELS or not OPENROUTER_API_KEY or not openrouter_client:
        await asyncio.sleep(1.0)
        extraction = ExpenseExtraction(
            vendor_name="OpenRouter Mock Vendor",
            bill_number="9999",
            date="2024-01-01",
            amount=100.0,
            currency="USD",
            tax_details=None
        )
        overall_accuracy, field_scores = evaluate_extraction(extraction, target)
        return ModelEvalResult(
            model_id=model_name,
            model_name=f"OpenRouter ({model_name})",
            extraction=extraction,
            overall_accuracy=overall_accuracy,
            latency_ms=int((time.time() - start_time) * 1000),
            token_usage=TokenUsage(input_tokens=0, output_tokens=0, total_tokens=0),
            cost_per_bill=0.0,
            cost_per_100_bills=0.0,
            field_scores=field_scores
        )

    try:
        base64_image = base64.b64encode(image_bytes).decode("utf-8")
        
        # We use a standard chat completion, asking for JSON output
        completion = await asyncio.to_thread(
            openrouter_client.chat.completions.create,
            model=model_name,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt + "\n\nReturn ONLY raw valid JSON matching the schema, with no markdown formatting or backticks."},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                        }
                    ]
                }
            ]
        )
        
        raw_content = completion.choices[0].message.content
        
        # Robustly extract JSON block
        start_idx = raw_content.find('{')
        end_idx = raw_content.rfind('}')
        if start_idx != -1 and end_idx != -1:
            json_str = raw_content[start_idx:end_idx+1]
        else:
            json_str = raw_content
            
        parsed_json = json.loads(json_str)
        extraction = ExpenseExtraction(**parsed_json)
        
        input_tokens = completion.usage.prompt_tokens if completion.usage else 0
        output_tokens = completion.usage.completion_tokens if completion.usage else 0
        cost_bill, cost_100 = calculate_costs("openrouter", input_tokens, output_tokens)
        overall_accuracy, field_scores = evaluate_extraction(extraction, target)
        
        actual_model = getattr(completion, "model", model_name)
        
        return ModelEvalResult(
            model_id=model_name,
            model_name=f"OpenRouter ({actual_model})",
            extraction=extraction,
            overall_accuracy=overall_accuracy,
            latency_ms=int((time.time() - start_time) * 1000),
            token_usage=TokenUsage(input_tokens=input_tokens, output_tokens=output_tokens, total_tokens=input_tokens + output_tokens),
            cost_per_bill=cost_bill,
            cost_per_100_bills=cost_100,
            field_scores=field_scores
        )
    except Exception as e:
        extraction = ExpenseExtraction(vendor_name="Error", date="2023-10-14", amount=0.0, currency="USD")
        overall_accuracy, field_scores = evaluate_extraction(extraction, target)
        return ModelEvalResult(
            model_id=model_name,
            model_name=f"OpenRouter ({model_name})",
            extraction=extraction,
            overall_accuracy=0.0,
            latency_ms=int((time.time() - start_time) * 1000),
            token_usage=TokenUsage(input_tokens=0, output_tokens=0, total_tokens=0),
            cost_per_bill=0.0,
            cost_per_100_bills=0.0,
            field_scores=field_scores,
            error=str(e)
        )
