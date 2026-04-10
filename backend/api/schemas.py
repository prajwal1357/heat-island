from pydantic import BaseModel
from typing import List, Optional

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
    estimated_cost_crore: float
    active_interventions: List[str]
    intervention_count: int
    cooling_per_crore: float
    thermal_band: str
    marginal_gain_delta_t: Optional[float] = None
    marginal_gain_cost_crore: Optional[float] = None
    marginal_gain_per_crore: Optional[float] = None
    best_alternative_delta_t: Optional[float] = None
    best_alternative_cost_crore: Optional[float] = None
    best_alternative_interventions: Optional[List[str]] = None
    diminishing_returns: bool = False

class AskPlannerRequest(BaseModel):
    budget_crore: float = 50.0

class PlannerPlanItem(BaseModel):
    zone_id: int
    zone_name: str
    intervention: str
    cost_crore: float
    cooling_delta_t: float
    reasoning: str

class PlannerResponse(BaseModel):
    plan: List[PlannerPlanItem]
    summary: str

class ZoneUpdate(BaseModel):
    zoneId: int
    changes: dict
