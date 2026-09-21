# AI-Based Social Media Sentiment and Trend Analysis Platform for Women’s Safety

## Overview
This project is an academic prototype for analyzing social media or reported text datasets to classify safety-related incidents, perform sentiment analysis, and highlight potential risk zones based on data patterns. It also includes an IoT integration prototype for sending GPS coordinates and SOS alerts.

## Architecture
- **Backend/AI**: Python (FastAPI, NLTK VADER, scikit-learn, SQLAlchemy, MySQL)
- **Frontend**: React.js (Vite), Axios, Recharts, Leaflet
- **Database**: MySQL 8+
- **IoT**: ESP32 (Arduino C++)

## Installation & Setup

### 1. Database Setup
- Install MySQL Server (8+).
- Create a database, e.g., `womens_safety`.
- Copy `backend/.env.example` to `backend/.env` and update the `DATABASE_URL` with your MySQL credentials.

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# Activate venv:
# On Windows: venv\Scripts\activate
# On macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
```

### 3. Frontend Setup
```bash
cd frontend
npm install
# Create .env and set VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

### 4. Running the Backend
- Start the FastAPI server:
```bash
cd backend
uvicorn app.main:app --reload
```

## Running the ML Pipeline
- Go to `http://localhost:8000/docs` (Swagger UI).
- Use the `/api/analysis/run` endpoint to ingest the `data/safety_posts.csv` and process it.

## Limitations
- This system uses a local sample dataset for academic demonstration. It does not actively scrape live social media.
- Potential risk zones are purely derived from the sample data frequency and do not predict actual crimes.
