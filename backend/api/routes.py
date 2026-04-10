from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from api.schemas import PredictRequest, PredictResponse, AskPlannerRequest
from planner.prompt import build_system_prompt, build_user_prompt
from planner.llm import stream_llm

router = APIRouter()

@router.get("/grid")
def get_grid(request: Request):
    """Returns the full 10x10 city grid setup with historical node data."""
    return request.app.state.grid

@router.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest, request: Request):
    """Takes UI sliders for a specific node and uses ML Random Forest to predict temperature drops."""
    model = request.app.state.model
    grid = request.app.state.grid
    
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
    """Sweeps combination analysis across all 100 zones returning the top 15 most efficient delta-Ts."""
    model = request.app.state.model
    grid = request.app.state.grid
    
    scenarios_df = model.rank_scenarios(grid)
    top_15 = scenarios_df.head(15)
    
    return top_15.to_dict(orient="records")

@router.post("/ask-planner")
async def ask_planner(payload: AskPlannerRequest, request: Request):
    """Streams token-by-token recommendations exactly to UI using standard Fetch API ReadableStream."""
    model = request.app.state.model
    grid = request.app.state.grid
    
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