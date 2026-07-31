import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "evaluations.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            results_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            image_base64 TEXT
        )
    ''')
    
    try:
        cursor.execute('ALTER TABLE evaluations ADD COLUMN image_base64 TEXT')
    except sqlite3.OperationalError:
        pass # Column already exists

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            prompt_text TEXT NOT NULL,
            is_active BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Insert default prompt if table is empty
    cursor.execute('SELECT COUNT(*) FROM prompts')
    if cursor.fetchone()[0] == 0:
        default_prompt = (
            "You are a high-precision document extraction AI. Extract the handwritten or printed receipt data into the following schema:\n"
            "- vendor_name: string (name of the company/vendor)\n"
            "- bill_number: string or null (invoice/receipt ID)\n"
            "- date: string YYYY-MM-DD\n"
            "- amount: float (total monetary amount)\n"
            "- currency: string (e.g., USD, INR, EUR)\n"
            "- tax_details: object or null"
        )
        cursor.execute('INSERT INTO prompts (name, prompt_text, is_active) VALUES (?, ?, 1)', ("Default Extraction Prompt", default_prompt))

    conn.commit()
    conn.close()

def save_evaluation(filename: str, results_dict: dict, image_base64: str = None) -> int:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO evaluations (filename, results_json, image_base64)
        VALUES (?, ?, ?)
    ''', (filename, json.dumps(results_dict), image_base64))
    eval_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return eval_id

def get_evaluations():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM evaluations ORDER BY created_at DESC')
    rows = cursor.fetchall()
    conn.close()
    
    # Parse the JSON back into dicts before returning
    results = []
    for row in rows:
        r = dict(row)
        r['results_json'] = json.loads(r['results_json'])
        results.append(r)
    return results

def get_prompts():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM prompts ORDER BY created_at DESC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_active_prompt() -> dict:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM prompts WHERE is_active = 1 LIMIT 1')
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def save_prompt(name: str, prompt_text: str, is_active: bool = False) -> int:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    if is_active:
        cursor.execute('UPDATE prompts SET is_active = 0')
        
    cursor.execute('''
        INSERT INTO prompts (name, prompt_text, is_active)
        VALUES (?, ?, ?)
    ''', (name, prompt_text, 1 if is_active else 0))
    prompt_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return prompt_id

def set_active_prompt(prompt_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('UPDATE prompts SET is_active = 0')
    cursor.execute('UPDATE prompts SET is_active = 1 WHERE id = ?', (prompt_id,))
    conn.commit()
    conn.close()
