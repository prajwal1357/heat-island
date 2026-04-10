import requests

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from api.schemas import PredictRequest, PredictResponse, AskPlannerRequest
from data.generator import generate_training_data
from data.weather_cache import read_live_weather_cache, refresh_live_weather_cache
from ml.model import TempModel
from planner.prompt import build_system_prompt, build_user_prompt
from planner.llm import stream_llm

router = APIRouter()


def _sync_grid_state(request: Request) -> list[dict]:
    cache_payload = read_live_weather_cache()
    request.app.state.grid = cache_payload["zones"]
    return request.app.state.grid


def _retrain_model(request: Request) -> TempModel:
    grid = _sync_grid_state(request)
    training_df = generate_training_data(grid, samples=5000)
    model = TempModel()
    model.train(training_df)
    request.app.state.model = model
    return model


@router.get("/grid")
def get_grid(request: Request):
    """Returns the cached Bengaluru constituency weather payload."""
    cache_payload = read_live_weather_cache()
    request.app.state.grid = cache_payload["zones"]
    return cache_payload


@router.post("/refresh-weather")
def refresh_weather(request: Request):
    """Refreshes all constituency temperatures from Tomorrow.io and retrains the ML model."""
    try:
        cache_payload = refresh_live_weather_cache()
        request.app.state.grid = cache_payload["zones"]
        _retrain_model(request)
        return cache_payload
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else 502
        raise HTTPException(status_code=status_code, detail=f"Tomorrow.io request failed: {exc}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Weather refresh failed: {exc}") from exc

@router.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest, request: Request):
    """Takes UI sliders for a specific node and uses ML Random Forest to predict temperature drops."""
    model = request.app.state.model
    grid = _sync_grid_state(request)
    
    zone = next((z for z in grid if z["id"] == payload.zone_id), None)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
        
    intervention = {
        "green_cover_delta": payload.green_cover_delta,
        "cool_roof": payload.cool_roof,
        "reflective_pavement": payload.reflective_pavement
    }
    
    predicted_temp = model.predict_intervention(zone, intervention)
    delta_t = zone["temp"] - predicted_temp
    
    return PredictResponse(
        zone_id=zone["id"],
        current_temp=round(zone["temp"], 2),
        predicted_temp=round(predicted_temp, 2),
        delta_T=round(delta_t, 2)
    )

@router.post("/scenarios")
def scenarios(request: Request):
    """Sweeps intervention combinations across all cached constituencies."""
    model = request.app.state.model
    grid = _sync_grid_state(request)
    
    scenarios_df = model.rank_scenarios(grid)
    top_15 = scenarios_df.head(15)
    
    return top_15.to_dict(orient="records")

@router.post("/ask-planner")
async def ask_planner(payload: AskPlannerRequest, request: Request):
    """Streams token-by-token recommendations exactly to UI using standard Fetch API ReadableStream."""
    model = request.app.state.model
    grid = _sync_grid_state(request)
    
    # 1. Ask ML layer to rank thousands of options to find the Top 8 most optimal
    scenarios_df = model.rank_scenarios(grid)
    
    # 2. Re-contextualize the data down into markdown table format for the Model
    system_prompt = build_system_prompt(payload.budget_crore)
    user_prompt = build_user_prompt(scenarios_df)
    
    # 3. Open streaming generation directly to the Client.
    return StreamingResponse(
        stream_llm(user_prompt, system_prompt),
        media_type="text/plain"
    )
