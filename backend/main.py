from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router
from data.generator import generate_training_data
from data.weather_cache import load_backend_env, read_live_weather_cache
from ml.model import TempModel

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_backend_env()

    print("Initializing Bengaluru constituency cache...")
    cache_payload = read_live_weather_cache()
    app.state.grid = cache_payload["zones"]

    print("Training ML prediction layer from cached weather baseline...")
    model = TempModel()
    training_df = generate_training_data(app.state.grid, samples=5000)
    model.train(training_df)
    app.state.model = model

    yield
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
