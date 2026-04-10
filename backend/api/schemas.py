from pydantic import BaseModel

class PredictRequest(BaseModel):
    zone_id: int
    green_cover_delta: float = 0.0
    cool_roof: bool = False
    reflective_pavement: bool = False

class PredictResponse(BaseModel):
    zone_id: int
    current_temp: float
    predicted_temp: float
    delta_T: float

class AskPlannerRequest(BaseModel):
    budget_crore: float = 50.0

class ZoneUpdate(BaseModel):
    zoneId: int
    changes: dict