import requests

from fastapi import APIRouter, Request, HTTPException
from api.schemas import PredictRequest, PredictResponse, AskPlannerRequest, PlannerResponse, PlanQuestionRequest, PlanQuestionResponse
from data.generator import generate_training_data
from data.weather_cache import read_live_weather_cache, refresh_live_weather_cache
from ml.model import TempModel
from planner.planner_engine import build_system_prompt, build_user_prompt, generate_plan, answer_plan_question

router = APIRouter()


def _clean_zero(value: float | None) -> float | None:
    if value is None:
        return None
    return 0.0 if abs(value) < 0.005 else round(value, 2)


def _calculate_cost(green_cover_delta: float, cool_roof: bool, reflective_pavement: bool) -> float:
    cost = (green_cover_delta / 10.0) * 0.8
    if cool_roof:
        cost += 0.5
    if reflective_pavement:
        cost += 0.3
    return round(cost, 2)


def _active_interventions(green_cover_delta: float, cool_roof: bool, reflective_pavement: bool) -> list[str]:
    active = []
    if green_cover_delta > 0:
        active.append(f"+{int(green_cover_delta)}% tree cover")
    if cool_roof:
        active.append("cool roof")
    if reflective_pavement:
        active.append("reflective pavement")
    return active


def _thermal_band(temp: float) -> str:
    if temp >= 35:
        return "critical"
    if temp >= 31:
        return "hot"
    if temp >= 27:
        return "warm"
    return "moderate"


def _strict_subset_variants(payload: PredictRequest) -> list[dict]:
    variants = []

    tree_values = list(range(0, int(payload.green_cover_delta) + 1, 10))
    cool_values = [False, payload.cool_roof] if payload.cool_roof else [False]
    pavement_values = [False, payload.reflective_pavement] if payload.reflective_pavement else [False]

    for tree_delta in tree_values:
        for cool_roof in cool_values:
            for reflective_pavement in pavement_values:
                if (
                    tree_delta == payload.green_cover_delta
                    and cool_roof == payload.cool_roof
                    and reflective_pavement == payload.reflective_pavement
                ):
                    continue

                if (
                    tree_delta <= payload.green_cover_delta
                    and (not cool_roof or payload.cool_roof)
                    and (not reflective_pavement or payload.reflective_pavement)
                ):
                    variants.append(
                        {
                            "green_cover_delta": float(tree_delta),
                            "cool_roof": cool_roof,
                            "reflective_pavement": reflective_pavement,
                        }
                    )

    unique_variants = []
    seen = set()
    for variant in variants:
        key = (
            variant["green_cover_delta"],
            variant["cool_roof"],
            variant["reflective_pavement"],
        )
        if key in seen:
            continue
        seen.add(key)
        unique_variants.append(variant)

    return unique_variants


def _analyze_prediction(model: TempModel, zone: dict, payload: PredictRequest, predicted_temp: float, delta_t: float) -> dict:
    active = _active_interventions(
        payload.green_cover_delta,
        payload.cool_roof,
        payload.reflective_pavement,
    )
    estimated_cost = _calculate_cost(
        payload.green_cover_delta,
        payload.cool_roof,
        payload.reflective_pavement,
    )
    cooling_per_crore = _clean_zero(delta_t / estimated_cost) if estimated_cost > 0 else 0.0

    best_alternative = None
    for variant in _strict_subset_variants(payload):
        alt_predicted_temp = model.predict_intervention(zone, variant)
        alt_delta_t = zone["temp"] - alt_predicted_temp
        alt_cost = _calculate_cost(
            variant["green_cover_delta"],
            variant["cool_roof"],
            variant["reflective_pavement"],
        )
        alt_active = _active_interventions(
            variant["green_cover_delta"],
            variant["cool_roof"],
            variant["reflective_pavement"],
        )
        alt_score = (_clean_zero(alt_delta_t), -alt_cost)

        if best_alternative is None or alt_score > best_alternative["score"]:
            best_alternative = {
                "score": alt_score,
                "delta_t": _clean_zero(alt_delta_t),
                "predicted_temp": _clean_zero(alt_predicted_temp),
                "cost": alt_cost,
                "interventions": alt_active,
            }

    marginal_gain_delta_t = None
    marginal_gain_cost = None
    marginal_gain_per_crore = None
    diminishing_returns = False

    if best_alternative and estimated_cost > best_alternative["cost"]:
        marginal_gain_delta_t = _clean_zero(delta_t - best_alternative["delta_t"])
        marginal_gain_cost = _clean_zero(estimated_cost - best_alternative["cost"])
        marginal_gain_per_crore = _clean_zero(marginal_gain_delta_t / marginal_gain_cost) if marginal_gain_cost > 0 else 0.0
        diminishing_returns = (
            len(active) > len(best_alternative["interventions"])
            and marginal_gain_delta_t <= 0.35
        ) or (
            marginal_gain_cost > 0 and marginal_gain_per_crore <= 0.5
        )

    return {
        "estimated_cost_crore": estimated_cost,
        "active_interventions": active,
        "intervention_count": len(active),
        "cooling_per_crore": cooling_per_crore,
        "thermal_band": _thermal_band(zone["temp"]),
        "marginal_gain_delta_t": marginal_gain_delta_t,
        "marginal_gain_cost_crore": marginal_gain_cost,
        "marginal_gain_per_crore": marginal_gain_per_crore,
        "best_alternative_delta_t": best_alternative["delta_t"] if best_alternative else None,
        "best_alternative_cost_crore": best_alternative["cost"] if best_alternative else None,
        "best_alternative_interventions": best_alternative["interventions"] if best_alternative else None,
        "diminishing_returns": diminishing_returns,
    }


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
    analysis = _analyze_prediction(model, zone, payload, predicted_temp, delta_t)
    
    return PredictResponse(
        zone_id=zone["id"],
        current_temp=round(zone["temp"], 2),
        predicted_temp=round(predicted_temp, 2),
        delta_T=round(delta_t, 2),
        **analysis,
    )

@router.post("/scenarios")
def scenarios(request: Request):
    """Sweeps intervention combinations across all cached constituencies."""
    model = request.app.state.model
    grid = _sync_grid_state(request)
    
    scenarios_df = model.rank_scenarios(grid)
    top_15 = scenarios_df.head(15)
    
    return top_15.to_dict(orient="records")

@router.post("/ask-planner", response_model=PlannerResponse)
async def ask_planner(payload: AskPlannerRequest, request: Request):
    """Builds a compact ML shortlist and asks the planner LLM for a final JSON plan."""
    model = request.app.state.model
    grid = _sync_grid_state(request)
    
    scenarios_df = model.rank_scenarios(grid)
    system_prompt = build_system_prompt(payload.budget_crore)
    user_prompt = build_user_prompt(grid, scenarios_df, payload.budget_crore, payload.user_request)

    try:
        return generate_plan(user_prompt, system_prompt)
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else 502
        raise HTTPException(status_code=status_code, detail=f"Planner model request failed: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f"Planner model returned invalid JSON: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Planner generation failed: {exc}") from exc

@router.post("/chat-plan-question", response_model=PlanQuestionResponse)
async def chat_plan_question(payload: PlanQuestionRequest):
    try:
        answer = answer_plan_question(payload.plan_context, payload.question)
        return PlanQuestionResponse(answer=answer)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"QA failed: {exc}") from exc
