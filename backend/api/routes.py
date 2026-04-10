from fastapi import APIRouter
from data.generator import generate_grid, compute_temp
from ml.model import TempModel
from api.schemas import ZoneUpdate

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