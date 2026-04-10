from fastapi import APIRouter
from data.generator import generate_grid, compute_temp
from ml.model import TempModel
from api.schemas import ZoneUpdate
from planner.prompt import build_prompt
from planner.llm import call_llm

router = APIRouter()

# Initialize once
grid = generate_grid()
model = TempModel()
model.train(grid)

@router.get("/grid")
def get_grid():
    return grid


VALID_KEYS = ["albedo", "green_cover", "density", "water"]

@router.post("/simulate")
def simulate(update: ZoneUpdate):
    zone = next(z for z in grid if z["id"] == update.zoneId)

    updated = zone.copy()

    for k, v in update.changes.items():
        if k in VALID_KEYS:
            updated[k] += v

    updated["temp"] = compute_temp(updated)

    return updated

@router.post("/planner")
def planner():
    # Pick hot zones only
    hot_zones = [z for z in grid if z["temp"] > 38]

    # Keep it small for LLM
    hot_zones = hot_zones[:5]

    prompt = build_prompt(hot_zones)

    result = call_llm(prompt)

    return {
        "zones_considered": hot_zones,
        "plan": result
    }
    