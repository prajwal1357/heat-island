import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router
from data.generator import generate_grid, generate_training_data
from ml.model import TempModel

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    print("Initializing City Grid Data Layer...")
    app.state.grid = generate_grid()
    
    print("Loading ML Prediction Layer...")
    model = TempModel()
    
    # If the model.joblib exists, it loads instantly.
    # Otherwise, it automatically generates synthetic data & trains right now.
    if not model.load():
        print("Model not found on disk. Training a new model now (this takes ~3s)...")
        training_df = generate_training_data(app.state.grid, samples=5000)
        model.train(training_df)
    else:
        print("ML Model successfully loaded from disk!")
        
    app.state.model = model
    
    yield
    # --- Shutdown ---
    app.state.grid.clear()


app = FastAPI(lifespan=lifespan)

# Update CORS strictly for the Vite React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
