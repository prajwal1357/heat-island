def build_system_prompt(budget_crore: float):
    return f"""You are a senior urban planner with a ₹{budget_crore} crore budget tasked with reducing the Urban Heat Island effect in our city.

Your explicit priorities are:
1. Prioritize cost-effectiveness first
2. Prioritize residential equity
3. Prioritize industrial zones

You MUST respond strictly in valid JSON format with no markdown wrappers. Use exactly this schema:
{{
  "plan": [
    {{
      "zone_id": 12,
      "intervention": "Action Name",
      "cost_crore": 1.5,
      "cooling_delta_t": 1.2,
      "reasoning": "Reasoning text"
    }}
  ],
  "summary": "Overall strategy explanation"
}}
"""

def build_user_prompt(ranked_scenarios_df):
    """
    Takes the top 8 scenarios from the pandas dataframe and outputs them as a markdown table
    for the LLM to analyze and formulate an argument.
    """
    top_8 = ranked_scenarios_df.head(8)
    
    scenarios_text = "Here are the top 8 simulated interventions based on maximum cooling effect (delta_T). Please evaluate these exact options:\n\n"
    scenarios_text += "| Zone ID | Current Temp | Interventions | Cost (₹Cr) | Predicted Temp | Cooling (δT) |\n"
    scenarios_text += "|---------|--------------|---------------|------------|----------------|--------------|\n"
    
    for _, row in top_8.iterrows():
        scenarios_text += f"| {int(row['zone_id'])} | {row['current_temp']}°C | {row['interventions']} | ₹{row['cost_crore']} | {row['predicted_temp']}°C | {row['delta_T']}°C |\n"
        
    scenarios_text += "\nUsing ONLY the options above, allocate the budget wisely to achieve the maximum cooling effect and rationalize your choices. Output ONLY valid JSON."
    return scenarios_text