import json
from typing import Any

import pandas as pd
import requests


OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "mistral"


def build_system_prompt(budget_crore: float) -> str:
    return f"""You are a senior urban planner optimizing heat mitigation for Bengaluru.

Budget limit:
- Total budget must stay at or below Rs {budget_crore:.2f} crore.

Decision priorities:
1. Maximize total cooling within budget.
2. Prefer higher cooling-per-cost efficiency.
3. Avoid redundant expensive upgrades when a cheaper option in the same zone delivers nearly the same cooling.
4. Use only the candidate interventions provided.

Return valid JSON only with this exact schema:
{{
  "plan": [
    {{
      "zone_id": 12,
      "zone_name": "Example Zone",
      "intervention": "Action Name",
      "cost_crore": 1.5,
      "cooling_delta_t": 1.2,
      "reasoning": "Why this action made the final plan."
    }}
  ],
  "summary": "Short strategic summary."
}}

Rules:
- Do not exceed the budget.
- Keep the plan concise, ideally 3 to 6 items.
- Do not invent zones, interventions, or numbers.
- Every numeric field must remain numeric in JSON.
"""


def build_user_prompt(grid: list[dict], ranked_scenarios_df: pd.DataFrame, budget_crore: float, user_request: str = None) -> str:
    zone_lookup = {zone["id"]: zone["name"] for zone in grid}
    scenarios_df = ranked_scenarios_df.copy()
    scenarios_df["efficiency"] = scenarios_df["delta_T"] / scenarios_df["cost_crore"].clip(lower=0.1)
    scenarios_df["zone_name"] = scenarios_df["zone_id"].map(zone_lookup)
    scenarios_df = scenarios_df[scenarios_df["delta_T"] > 0].copy()

    best_per_zone = (
        scenarios_df.sort_values(["zone_id", "efficiency", "delta_T"], ascending=[True, False, False])
        .groupby("zone_id", as_index=False)
        .head(2)
    )
    top_efficient = scenarios_df.sort_values("efficiency", ascending=False).head(8)
    top_cooling = scenarios_df.sort_values("delta_T", ascending=False).head(8)
    under_budget = scenarios_df[scenarios_df["cost_crore"] <= budget_crore].sort_values("efficiency", ascending=False).head(8)

    shortlisted = (
        pd.concat([best_per_zone, top_efficient, top_cooling, under_budget], ignore_index=True)
        .drop_duplicates(subset=["zone_id", "interventions"])
        .sort_values(["efficiency", "delta_T"], ascending=[False, False])
        .head(14)
    )

    city_avg = sum(zone["temp"] for zone in grid) / max(len(grid), 1)
    city_peak = max(grid, key=lambda zone: zone["temp"])

    context = {
        "budget_crore": round(budget_crore, 2),
        "city_overview": {
            "zone_count": len(grid),
            "avg_temp": round(city_avg, 2),
            "peak_zone_id": city_peak["id"],
            "peak_zone_name": city_peak["name"],
            "peak_temp": round(city_peak["temp"], 2),
        },
        "candidates": [],
    }

    for _, row in shortlisted.iterrows():
        context["candidates"].append(
            {
                "zone_id": int(row["zone_id"]),
                "zone_name": row["zone_name"],
                "current_temp": float(round(row["current_temp"], 2)),
                "predicted_temp": float(round(row["predicted_temp"], 2)),
                "cooling_delta_t": float(round(row["delta_T"], 2)),
                "cost_crore": float(round(row["cost_crore"], 2)),
                "efficiency": float(round(row["efficiency"], 3)),
                "intervention": row["interventions"],
            }
        )

    prompt = (
        "Planner input JSON:\n"
        f"{json.dumps(context, indent=2)}\n\n"
        "Construct the final plan using only these candidates."
    )
    
    if user_request:
        prompt += f"\n\nCRITICAL USER CONSTRAINT: The user specifically requested: '{user_request}'. You MUST strictly adhere to this instruction when finalizing the plan, and mention how you adapted to it in the summary."

    return prompt


def _extract_json_payload(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(text[start : end + 1])


def generate_plan(prompt: str, system_prompt: str) -> dict[str, Any]:
    response = requests.post(
        OLLAMA_URL,
        json={
            "model": OLLAMA_MODEL,
            "system": system_prompt,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.2,
            },
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    raw_text = payload.get("response", "")
    return _extract_json_payload(raw_text)

def answer_plan_question(plan_context: str, question: str) -> str:
    system_prompt = "You are a senior urban planner. Answer the user's question concisely and accurately based STRICTLY on the plan context provided. Do not use JSON. Answer in plain human-readable text."
    user_prompt = f"Here is the finalized UHI budget plan:\n{plan_context}\n\nUser Question: {question}\n\nProvide a direct, conversational answer detailing the reasoning from the plan."
    
    response = requests.post(
        OLLAMA_URL,
        json={
            "model": OLLAMA_MODEL,
            "system": system_prompt,
            "prompt": user_prompt,
            "stream": False,
        },
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    return payload.get("response", "Could not generate an answer.")

