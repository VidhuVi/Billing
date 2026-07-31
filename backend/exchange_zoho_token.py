import os
import sys
import json
import httpx
from dotenv import load_dotenv, set_key

env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)

def exchange_code(client_id, client_secret, code, redirect_uri=None):
    clean_client_id = client_id.strip()
    clean_client_secret = client_secret.strip()
    clean_code = code.strip()

    endpoints = [
        "https://accounts.zoho.in/oauth/v2/token",
        "https://accounts.zoho.com/oauth/v2/token"
    ]

    params = {
        "grant_type": "authorization_code",
        "client_id": clean_client_id,
        "client_secret": clean_client_secret,
        "code": clean_code
    }
    if redirect_uri:
        params["redirect_uri"] = redirect_uri.strip()

    last_res = None
    for url in endpoints:
        print(f"Sending POST to {url}...")
        response = httpx.post(url, params=params)
        res_data = response.json()
        last_res = res_data
        
        if "access_token" in res_data:
            access_token = res_data["access_token"]
            refresh_token = res_data.get("refresh_token", "")
            print("\nSUCCESS! Access Token retrieved successfully!")
            print(f"Access Token: {access_token}")
            
            # Save to .env
            env_vars = {
                "ZOHO_AUTH_TOKEN": access_token,
                "ZOHO_CLIENT_ID": clean_client_id,
                "ZOHO_CLIENT_SECRET": clean_client_secret
            }
            if refresh_token:
                env_vars["ZOHO_REFRESH_TOKEN"] = refresh_token
                print(f"Refresh Token: {refresh_token}")
            
            with open(env_path, "r") as f:
                content = f.read()
            
            lines = content.splitlines()
            for key, val in env_vars.items():
                found = False
                for i, line in enumerate(lines):
                    if line.startswith(f"{key}="):
                        lines[i] = f"{key}={val}"
                        found = True
                        break
                if not found:
                    lines.append(f"{key}={val}")
                    
            with open(env_path, "w") as f:
                f.write("\n".join(lines) + "\n")
                
            print("\nbackend/.env updated automatically with valid tokens and client credentials!")
            return True

    print("\nExchange Failed!")
    print("Zoho Response:", last_res)
    return False

if __name__ == "__main__":
    print("=== Zoho OAuth Token Exchanger ===")
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if os.path.exists(arg):
            with open(arg, "r") as f:
                data = json.load(f)
                client_id = data.get("client_id")
                client_secret = data.get("client_secret")
                code = data.get("code")
                exchange_code(client_id, client_secret, code)
                sys.exit(0)

    print("\nPlease enter details from your downloaded JSON file or Zoho Console:")
    client_id = input("Client ID: ").strip()
    client_secret = input("Client Secret: ").strip()
    code = input("Grant Code (1000.xxx...): ").strip()
    
    exchange_code(client_id, client_secret, code)
