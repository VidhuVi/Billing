import math
from datetime import datetime
from dateutil import parser as date_parser
import re
from thefuzz import fuzz
from typing import Optional, List, Tuple
from schemas import ExpenseExtraction, GroundTruthTarget, FieldEvalScore

def normalize_date(date_str: Optional[str]) -> Optional[str]:
    """Parses date string into ISO YYYY-MM-DD format."""
    if not date_str or date_str == "null":
        return None
    try:
        dt = date_parser.parse(str(date_str), fuzzy=True)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return str(date_str).strip()

def evaluate_extraction(extracted: ExpenseExtraction, target: Optional[GroundTruthTarget] = None) -> Tuple[float, List[FieldEvalScore]]:
    """
    Evaluates an extracted model response against ground truth target.
    Returns overall accuracy percentage (0.0 to 100.0) and individual field scores.
    """
    if not target:
        # Default self-consistency confidence evaluation when ground truth isn't provided
        field_scores = [
            FieldEvalScore(
                field_name="Vendor",
                extracted_value=extracted.vendor_name,
                target_value="N/A",
                confidence=0.99 if extracted.vendor_name else 0.40,
                confidence_level="HIGH" if extracted.vendor_name else "LOW",
                is_match=True,
                match_score=100.0,
                match_type="extracted"
            ),
            FieldEvalScore(
                field_name="Date",
                extracted_value=extracted.date,
                target_value="N/A",
                confidence=0.96 if extracted.date else 0.30,
                confidence_level="HIGH" if extracted.date else "LOW",
                is_match=True,
                match_score=100.0,
                match_type="extracted"
            ),
            FieldEvalScore(
                field_name="Total Amount",
                extracted_value=extracted.amount,
                target_value="N/A",
                confidence=0.88 if extracted.amount > 0 else 0.50,
                confidence_level="HIGH" if extracted.amount > 0 else "MED",
                is_match=True,
                match_score=100.0,
                match_type="extracted"
            ),
            FieldEvalScore(
                field_name="Tax Details",
                extracted_value=str(extracted.tax_details) if extracted.tax_details else "null",
                target_value="N/A",
                confidence=0.75 if extracted.tax_details else 0.32,
                confidence_level="MED" if extracted.tax_details else "LOW",
                is_match=extracted.tax_details is not None,
                match_score=100.0 if extracted.tax_details else 0.0,
                match_type="extracted"
            )
        ]
        total_score = sum(fs.match_score for fs in field_scores) / len(field_scores)
        return round(total_score, 1), field_scores

    field_scores: List[FieldEvalScore] = []

    # 1. Vendor Name evaluation using continuous fuzz ratio
    vendor_target = target.vendor_name or ""
    vendor_extracted = extracted.vendor_name or ""
    vendor_ratio = fuzz.ratio(vendor_extracted.lower().strip(), vendor_target.lower().strip())
    is_vendor_match = vendor_ratio >= 85
    field_scores.append(FieldEvalScore(
        field_name="Vendor",
        extracted_value=vendor_extracted,
        target_value=vendor_target,
        confidence=round(vendor_ratio / 100.0, 2),
        confidence_level="HIGH" if vendor_ratio >= 85 else ("MED" if vendor_ratio >= 60 else "LOW"),
        is_match=is_vendor_match,
        match_score=float(vendor_ratio),
        match_type="fuzzy_ratio_continuous"
    ))

    # 1.5. Bill Number evaluation using continuous fuzz ratio
    bill_target = target.bill_number or ""
    bill_extracted = extracted.bill_number or ""
    if bill_target:
        bill_ratio = fuzz.ratio(bill_extracted.lower().strip(), bill_target.lower().strip())
        is_bill_match = bill_ratio >= 85
        field_scores.append(FieldEvalScore(
            field_name="Bill Number",
            extracted_value=bill_extracted,
            target_value=bill_target,
            confidence=round(bill_ratio / 100.0, 2),
            confidence_level="HIGH" if bill_ratio >= 85 else ("MED" if bill_ratio >= 60 else "LOW"),
            is_match=is_bill_match,
            match_score=float(bill_ratio),
            match_type="fuzzy_ratio_continuous"
        ))

    # 2. Date evaluation via parser normalization
    date_extracted_norm = normalize_date(extracted.date)
    date_target_norm = normalize_date(target.date)
    is_date_match = (date_extracted_norm is not None and date_extracted_norm == date_target_norm)
    field_scores.append(FieldEvalScore(
        field_name="Date",
        extracted_value=extracted.date,
        target_value=target.date or "N/A",
        confidence=0.96 if is_date_match else 0.40,
        confidence_level="HIGH" if is_date_match else "LOW",
        is_match=is_date_match,
        match_score=100.0 if is_date_match else 0.0,
        match_type="date_parsed"
    ))

    # 3. Total Amount evaluation (exact match / float tolerance)
    target_amt = target.amount or 0.0
    is_amount_match = math.isclose(extracted.amount, target_amt, abs_tol=0.01)
    field_scores.append(FieldEvalScore(
        field_name="Total Amount",
        extracted_value=extracted.amount,
        target_value=target_amt,
        confidence=0.98 if is_amount_match else 0.50,
        confidence_level="HIGH" if is_amount_match else "MED",
        is_match=is_amount_match,
        match_score=100.0 if is_amount_match else 0.0,
        match_type="exact_numeric"
    ))

    # 4. Currency evaluation
    target_curr = (target.currency or "USD").upper()
    extracted_curr = (extracted.currency or "USD").upper()
    is_curr_match = (extracted_curr == target_curr)
    field_scores.append(FieldEvalScore(
        field_name="Currency",
        extracted_value=extracted_curr,
        target_value=target_curr,
        confidence=1.0 if is_curr_match else 0.0,
        confidence_level="HIGH" if is_curr_match else "LOW",
        is_match=is_curr_match,
        match_score=100.0 if is_curr_match else 0.0,
        match_type="exact_string"
    ))

    # 5. Date Format Compliance
    date_is_iso = bool(re.match(r"^\d{4}-\d{2}-\d{2}$", str(extracted.date))) if extracted.date else False
    if target.date:
        field_scores.append(FieldEvalScore(
            field_name="Date ISO Format",
            extracted_value=extracted.date,
            target_value="YYYY-MM-DD",
            confidence=1.0,
            confidence_level="HIGH",
            is_match=date_is_iso,
            match_score=100.0 if date_is_iso else 0.0,
            match_type="format_check"
        ))

    # 6. Hallucination Check (Strict penalty for inventing data when target is empty)
    hallucinated_bill = (not target.bill_number) and (extracted.bill_number is not None and str(extracted.bill_number).strip() != "")
    field_scores.append(FieldEvalScore(
        field_name="Hallucination Check",
        extracted_value="Fabricated Data" if hallucinated_bill else "Clean",
        target_value="Clean",
        confidence=1.0,
        confidence_level="HIGH",
        is_match=not hallucinated_bill,
        match_score=0.0 if hallucinated_bill else 100.0,
        match_type="hallucination_penalty"
    ))

    # Calculate weighted overall accuracy
    overall_accuracy = sum(f.match_score for f in field_scores) / len(field_scores)
    return round(overall_accuracy, 1), field_scores
