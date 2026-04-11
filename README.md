# ThermiQ: Urban Heat Island Command Center

> 🎯 **[View Project Presentation & Demo Video (Google Drive)](https://drive.google.com/drive/folders/1-V3PDQc-aLB9P9ffz8T17iTCs6NJrykT?usp=sharing)**

ThermiQ is a real-time, AI-driven dashboard that models and mitigates the Urban Heat Island (UHI) effect across Bengaluru's 28 constituencies. 

Built with a **FastAPI backend** and a **React/D3.js frontend**, this platform allows city planners to simulate the exact thermal benefits of deploying tree cover, cool roofs, and reflective pavements. It uses an active Machine Learning engine to ensure interventions are modeled according to physical thermodynamics, and features an integrated **LLM AI Planner** that dynamically optimizes municipal budgets based on strict cost vs. cooling efficiency limits (δT / ₹Cr).

## 🚀 Key Features

* **Real-time Live Weather Data:** Syncs real-world ambient temperatures simultaneously across the city grid using the Tomorrow.io API.
* **Physics-Bound Machine Learning:** Evaluates environmental baseline changes using a `Random Forest` delta-T engine. Real structural cooling, zero AI hallucinations.
* **Cost Efficiency Tracking:** Prevents budgetary waste by calculating Diminishing Returns and actively alerting planners when cheaper alternatives exist.
* **Generative City AI:** Powered by an Ollama-hosted LLM (Mistral). The backend curates 50 mathematically optimal permutations across the spatial layout and allows the LLM to output a finalized, perfectly budgeted, city-wide strategy!

## 💻 Tech Stack

* **Frontend:** React, Vite, Tailwind CSS, D3.js (Geospatial Renderings)
* **Backend:** Python, FastAPI, Pandas, Scikit-Learn (ML Core)
* **AI & external APIs:** Mistral (via Ollama REST pipeline), Tomorrow.io Hyperlocal Weather API

## ⚙️ Quick Start Setup

### 1. Start the Backend server (FastAPI)
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate | Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```
*Note: Make sure to duplicate `.env.example` into `.env` and input your `Tomorrow.io` API key inside the backend folder.*

### 2. Start the Frontend (React / Vite)
```bash
cd frontend
npm install
npm run dev
```

### 3. (Optional) Start the Local LLM Brain
To use the Generative Planner feature, simply install [Ollama](https://ollama.com) on your machine and start it locally in the background!
```bash
ollama run mistral
```
