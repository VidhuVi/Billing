import os
import httpx
from typing import Dict, Any
from dotenv import load_dotenv
from schemas import ZohoPushRequest, ZohoPushResponse

load_dotenv()

ZOHO_AUTH_TOKEN = os.getenv("ZOHO_AUTH_TOKEN", "mock_zoho_token")
ZOHO_ORGANIZATION_ID = os.getenv("ZOHO_ORGANIZATION_ID", "123456789")
ZOHO_API_BASE_URL = os.getenv("ZOHO_API_BASE_URL", "https://www.zohoapis.com/books/v3")

async def refresh_access_token() -> str:
    """Uses the refresh token to get a new access token and updates .env"""
    load_dotenv(override=True)
    client_id = os.getenv("ZOHO_CLIENT_ID", "").strip()
    client_secret = os.getenv("ZOHO_CLIENT_SECRET", "").strip()
    refresh_token = os.getenv("ZOHO_REFRESH_TOKEN", "").strip()
    
    if not all([client_id, client_secret, refresh_token]):
        raise Exception("Missing Client ID, Client Secret, or Refresh Token in .env")

    endpoints = [
        "https://accounts.zoho.in/oauth/v2/token",
        "https://accounts.zoho.com/oauth/v2/token"
    ]
    
    params = {
        "grant_type": "refresh_token",
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token
    }

    async with httpx.AsyncClient() as client:
        for url in endpoints:
            response = await client.post(url, params=params)
            res_data = response.json()
            if "access_token" in res_data:
                new_access_token = res_data["access_token"]
                
                # Update .env file
                env_path = os.path.join(os.path.dirname(__file__), ".env")
                if os.path.exists(env_path):
                    with open(env_path, "r") as f:
                        lines = f.read().splitlines()
                    
                    found = False
                    for i, line in enumerate(lines):
                        if line.startswith("ZOHO_AUTH_TOKEN="):
                            lines[i] = f"ZOHO_AUTH_TOKEN={new_access_token}"
                            found = True
                            break
                    if not found:
                        lines.append(f"ZOHO_AUTH_TOKEN={new_access_token}")
                        
                    with open(env_path, "w") as f:
                        f.write("\n".join(lines) + "\n")
                
                return new_access_token
                
        raise Exception("Failed to refresh token: " + str(res_data))


async def create_expense(push_request: ZohoPushRequest) -> ZohoPushResponse:
    """
    Sends an extracted expense item to Zoho Books API POST /expenses endpoint.
    Handles headers, query parameters, payload mapping, and graceful error response.
    """
    load_dotenv(override=True)
    zoho_auth_token = os.getenv("ZOHO_AUTH_TOKEN", "mock_zoho_token").strip()
    zoho_org_id = os.getenv("ZOHO_ORGANIZATION_ID", "60080949659").strip()
    zoho_base_url = os.getenv("ZOHO_API_BASE_URL", "https://www.zohoapis.in/books/v3").rstrip("/")

    extracted = push_request.expense_data
    
    # Map ExpenseExtraction schema to Zoho Books Expense JSON structure
    # Account IDs corresponding to Uncategorized Expense (4021943000000000576) and Petty Cash (4021943000000000459)
    zoho_payload = {
        "account_id": push_request.account_id or "4021943000000000576",
        "paid_through_account_id": push_request.paid_through_account_id or "4021943000000000459",
        "date": extracted.date,
        "amount": extracted.amount,
        "vendor_name": extracted.vendor_name,
        "reference_number": extracted.bill_number or "",
        "currency_code": extracted.currency or "INR",
        "description": f"Extracted via Taxor AI Eval. Tax info: {extracted.tax_details or 'None'}"
    }

    # If mock token or testing environment
    if zoho_auth_token == "mock_zoho_token" or not zoho_auth_token:
        return ZohoPushResponse(
            success=True,
            message="[Mock Mode] Expense successfully created in Zoho Books",
            expense_id="zh_exp_9841203",
            data=zoho_payload
        )

    if zoho_auth_token.startswith("Zoho-oauthtoken "):
        auth_header_val = zoho_auth_token
    else:
        auth_header_val = f"Zoho-oauthtoken {zoho_auth_token}"

    headers = {
        "Authorization": auth_header_val,
        "Content-Type": "application/json"
    }

    params = {
        "organization_id": zoho_org_id
    }

    # Prepare candidate base URLs (.in for India accounts, .com for US, .eu for Europe)
    candidate_urls = [zoho_base_url]
    if "zohoapis.com" in zoho_base_url:
        candidate_urls.append("https://www.zohoapis.in/books/v3")
    elif "zohoapis.in" in zoho_base_url:
        candidate_urls.append("https://www.zohoapis.com/books/v3")

    last_error_text = ""
    async with httpx.AsyncClient(timeout=10.0) as client:
        for current_url in candidate_urls:
            try:
                url = f"{current_url}/expenses"
                response = await client.post(url, json=zoho_payload, headers=headers, params=params)
                
                if response.status_code in (200, 201):
                    resp_json = response.json()
                    expense_obj = resp_json.get("expense", {})
                    return ZohoPushResponse(
                        success=True,
                        message="Expense exported to Zoho Books successfully!",
                        expense_id=str(expense_obj.get("expense_id", "zh_exp_created")),
                        data=resp_json
                    )
                elif response.status_code == 401:
                    # Token expired, try refreshing once
                    try:
                        print("Token expired, attempting auto-refresh...")
                        new_token = await refresh_access_token()
                        headers["Authorization"] = f"Zoho-oauthtoken {new_token}"
                        
                        # Retry the request
                        retry_response = await client.post(url, json=zoho_payload, headers=headers, params=params)
                        if retry_response.status_code in (200, 201):
                            resp_json = retry_response.json()
                            expense_obj = resp_json.get("expense", {})
                            return ZohoPushResponse(
                                success=True,
                                message="Expense exported successfully after token auto-refresh!",
                                expense_id=str(expense_obj.get("expense_id", "zh_exp_created")),
                                data=resp_json
                            )
                        else:
                            last_error_text = f"Retry Status {retry_response.status_code}: {retry_response.text}"
                    except Exception as refresh_err:
                        last_error_text = f"Token auto-refresh failed: {str(refresh_err)}"
                else:
                    last_error_text = f"Status {response.status_code}: {response.text}"
            except Exception as e:
                last_error_text = str(e)

        # Detailed instructions if code 57 (Unauthorized) returns
        err_msg = f"Zoho API Error: {last_error_text}"
        if "57" in last_error_text or "401" in last_error_text:
            err_msg += " (Token expired or generated from Client Secret tab instead of Generate Code. Click 'Generate Code' in Zoho Console)."

        return ZohoPushResponse(
            success=False,
            message=err_msg,
            data=zoho_payload
        )
