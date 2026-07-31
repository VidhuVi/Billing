export interface ExpenseExtraction {
  vendor_name: string;
  bill_number?: string | null;
  date: string;
  amount: number;
  currency: string;
  tax_details?: Record<string, any> | null;
}

export interface GroundTruthTarget {
  vendor_name?: string;
  bill_number?: string;
  date?: string;
  amount?: number;
  currency?: string;
}

export interface FieldEvalScore {
  field_name: string;
  extracted_value: any;
  target_value: any;
  confidence: number;
  confidence_level: 'HIGH' | 'MED' | 'LOW';
  is_match: boolean;
  match_score: number;
  match_type: string;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface ModelEvalResult {
  model_id: string;
  model_name: string;
  extraction: ExpenseExtraction;
  overall_accuracy: number;
  latency_ms: number;
  token_usage: TokenUsage;
  cost_per_bill: number;
  cost_per_100_bills: number;
  field_scores: FieldEvalScore[];
  error?: string | null;
}

export interface EvaluateResponse {
  eval_id: string;
  filename: string;
  results: Record<string, ModelEvalResult>;
  is_mock: boolean;
}

export interface ZohoPushResponse {
  success: boolean;
  message: string;
  expense_id?: string;
  data?: any;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function evaluateBill(
  file: File,
  target?: GroundTruthTarget
): Promise<EvaluateResponse> {
  const formData = new FormData();
  formData.append("file", file);

  if (target) {
    if (target.vendor_name) formData.append("target_vendor", target.vendor_name);
    if (target.bill_number) formData.append("target_bill_number", target.bill_number);
    if (target.date) formData.append("target_date", target.date);
    if (target.amount !== undefined && target.amount !== null) formData.append("target_amount", target.amount.toString());
    if (target.currency) formData.append("target_currency", target.currency);
  }

  const response = await fetch(`${API_BASE_URL}/api/evaluate`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Evaluation failed (${response.status}): ${errText}`);
  }

  return await response.json();
}

export async function pushToZoho(expenseData: ExpenseExtraction): Promise<ZohoPushResponse> {
  const response = await fetch(`${API_BASE_URL}/api/zoho`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expense_data: expenseData }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Zoho export failed (${response.status}): ${errText}`);
  }

  return await response.json();
}
