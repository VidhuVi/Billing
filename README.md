# Handwritten Bill Evaluator (AI Screening Task)

This repository contains an end-to-end evaluation framework designed to benchmark Multimodal Large Language Models (LLMs) on their ability to extract structured data from handwritten Indian bills and receipts.

## The Problem
Digital invoices are relatively easy for LLMs to read. Handwritten bills—common in Indian small businesses—are highly unstructured, suffer from poor handwriting, varied lighting, and inconsistent formats. This project systematically tests different vision models to determine the most cost-effective and accurate pipeline for processing handwritten expense claims.

---

## 🛠 Setup & Run Instructions

### Prerequisites
- Node.js (v18+)
- Python 3.10+
- API Keys for OpenAI, Google Gemini, and OpenRouter.
- Zoho Books account (Free/Trial)

### 1. Backend Setup (FastAPI)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create your environment variables
cp .env.example .env
```
*Fill in your API keys in the newly created `.env` file.*

### 2. Zoho Books OAuth Setup
To enable automatic exports to Zoho Books, you need to generate an initial token:
1. Go to the [Zoho API Console](https://api-console.zoho.in/).
2. Generate a Grant Code for your Server-based Application.
3. Run the token exchange script:
```bash
python exchange_zoho_token.py
```
*The backend has an automated auto-refresh mechanism. You only need to run this script once to populate your `.env` with a persistent Refresh Token.*

### 3. Start the Backend Server
```bash
# Ensure you are still in the backend directory
./venv/bin/uvicorn main:app --reload --port 8000
```

### 4. Start the Frontend (Next.js)
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Visit `http://localhost:3000` to access the Evaluation Dashboard.

---

## 🔬 Evaluation Methodology

### Models Evaluated
1. **Google Gemini 1.5 Flash**: A lightweight, highly efficient multimodal model directly from Google.
2. **GPT-4o-mini**: OpenAI's fastest, most cost-effective vision model.
3. **OpenRouter (Free Tier Routing)**: Acts as a dynamic router to free vision models (e.g., Gemma 31B Vision) to test zero-cost open-source alternatives.

### Scoring Logic
The evaluation framework uses a strict **Field-Level Exact/Fuzzy Match** approach:
- **Numerical Fields (Amount)**: Exact numerical match required.
- **Date**: Standardized to `YYYY-MM-DD` and exact matched.
- **Text Fields (Vendor Name, Currency)**: Fuzzy matched using Levenshtein distance (threshold > 85% similarity) to account for slight spelling variations caused by messy handwriting.

**Overall Accuracy** is calculated as the percentage of correctly extracted fields per bill. 

### Why this methodology?
In automated accounting, a 90% accurate amount extraction is still 100% wrong if it pushes incorrect financial data. By tracking field-level accuracy, we can identify *where* models fail (e.g., confusing vendor names vs. hallucinating amounts).

---

## 📊 Results & Cost Analysis

*(Note: These are sample results based on a 15-bill handwritten dataset. Please adjust these numbers based on your actual testing!)*

| Model | Avg. Accuracy | Vendor Acc. | Amount Acc. | Date Acc. | API Cost (Per 100 Bills) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GPT-4o-mini** | 88% | 85% | 95% | 80% | ~$0.15 |
| **Gemini 1.5 Flash** | 92% | 90% | 98% | 88% | ~$0.08 |
| **OpenRouter (Free)** | 70% | 65% | 75% | 60% | $0.00 |

---

## 💡 Final Recommendation

Based on the evaluation framework, **[INSERT YOUR WINNER HERE, e.g., Gemini 1.5 Flash]** is the recommended model for processing handwritten Indian bills. 

### Justification:
1. **Accuracy**: Handwritten bills are highly unstructured. [Winner Model] consistently demonstrated superior spatial reasoning, correctly linking handwritten totals to their corresponding labels even when written at odd angles.
2. **Cost-to-Performance Ratio**: While GPT-4o-mini performed admirably, [Winner Model] achieved a higher accuracy at roughly half the cost. 
3. **Pipeline Recommendation**: 
   - **For Digital/Typed Invoices**: Both GPT-4o-mini and Gemini Flash are overkill. A cheaper OCR pipeline combined with a smaller LLM could suffice.
   - **For Handwritten Bills**: I recommend using the winning model. Furthermore, to reach production-grade reliability (99%+), I recommend a "human-in-the-loop" UI (like the one built in this repository) where the LLM highlights its extractions on the image for quick human verification before pushing to Zoho Books.

---

## 🚀 Deployment Guide (Vercel & Render)

To prove this application is production-ready, you can host the Frontend and Backend separately for free.

### 1. Deploy Frontend (Next.js) to Vercel
1. Create a new GitHub repository and push your code.
2. Go to [Vercel](https://vercel.com) and create a new Project.
3. Import your GitHub repository.
4. Set the **Root Directory** to `frontend`.
5. Deploy! Vercel will automatically detect Next.js.

### 2. Deploy Backend (FastAPI) to Render
1. Go to [Render](https://render.com) and create a new "Web Service".
2. Connect your GitHub repository.
3. Set the **Root Directory** to `backend`.
4. Set the Start Command to: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Under Environment Variables, copy everything from your `.env` file (including your Zoho tokens, OpenAI, Gemini, and OpenRouter API keys).
6. Deploy!

*(Note: Once your backend is deployed, you will need to update the API fetch URLs in your frontend code from `http://localhost:8000` to your new Render URL).*

---
*Developed for the Software Engineering Internship Screening Task.*
