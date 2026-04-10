import pandas as pd

def build_system_prompt(budget_crore: float):
    return f"""You are a senior urban planner with a ₹{budget_crore} crore budget tasked with reducing the Urban Heat Island effect in our city.

Your explicit priorities are:
1. Maximize overall city cooling using the budget.
2. Ensure strict cost-effectiveness (Cooling δT per ₹Cr).
3. Identify diminishing returns: If applying multiple expensive interventions somewhere only yields marginally more cooling than a cheaper option for the same zone, explicitly point this out and choose the more cost-efficient option!

You MUST respond strictly in valid JSON format with no markdown wrappers. Use exactly this schema:
{{
  "plan": [
    {{
      "zone_id": 12,
      "intervention": "Action Name",
      "cost_crore": 1.5,
      "cooling_delta_t": 1.2,
      "reasoning": "Explain why this was chosen, noting any unchosen alternative expensive options to highlight the diminishing returns you avoided."
    }}
  ],
  "summary": "Overall strategy explanation..."
}}
"""

def build_user_prompt(grid, ranked_scenarios_df: pd.DataFrame, budget_crore: float):
    """
    Takes both the absolute highest cooling permutations and the highest efficiency permutations,
    giving the LLM the comparative data it needs to identify diminishing ML returns.
    """
    # Create an efficiency metric (Cooling vs Cost)
    ranked_scenarios_df["efficiency"] = ranked_scenarios_df["delta_T"] / ranked_scenarios_df["cost_crore"].clip(lower=0.1)
    
    # Provide the LLM with highly detailed, comparative context:
    # 1. Provide the ABSOLUTE MAX cooling intervention for EVERY single constituency.
    max_cooling_per_zone = ranked_scenarios_df.sort_values(by="delta_T", ascending=False).groupby("zone_id").head(1)
    
    # 2. Provide the MOST EFFICIENT (Bang-for-buck) intervention for EVERY single constituency.
    efficient_per_zone = ranked_scenarios_df.sort_values(by="efficiency", ascending=False).groupby("zone_id").head(1)
    
    # Combine everything so the LLM has roughly 50 highly curated rows spanning the entire city map.
    best_options = pd.concat([max_cooling_per_zone, efficient_per_zone]).drop_duplicates(subset=["zone_id", "interventions"])
    
    # Map the real names of the Bangalore constituencies into the ML context window!
    id_to_name = {z["id"]: z["name"] for z in grid}
    
    scenarios_text = "Here are the top simulated interventions for the city. I have provided both the 'Most Efficient' and the 'Maximum Cooling' options across various zones to provide comparative ML data:\n\n"
    scenarios_text += "| ID | Constituency | Current Temp | Interventions | Cost | Predicted | Cooling | Efficiency |\n"
    scenarios_text += "|----|--------------|--------------|---------------|------|-----------|---------|------------|\n"
    
    for _, row in best_options.iterrows():
        zid = int(row['zone_id'])
        zname = id_to_name.get(zid, "Unknown Zone")
        scenarios_text += f"| {zid} | {zname} | {row['current_temp']}°C | {row['interventions']} | ₹{row['cost_crore']} | {row['predicted_temp']}°C | -{row['delta_T']}°C | {round(row['efficiency'], 2)} |\n"
        
    scenarios_text += f"\nUsing ONLY the ML permutations provided above, allocate your ₹{budget_crore}Cr budget wisely to achieve the maximum cooling effect. Compare the efficiency ratios to identify points of diminishing returns (where spending drastically more barely increases the delta_T drop). Formulate your argument purely in the required JSON."
    return scenarios_text