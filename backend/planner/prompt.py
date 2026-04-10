def build_prompt(zones):
    return f"""
You are an expert urban planner.

Constraints:
- Budget: ₹50 Cr
- Goal: Reduce city temperature by 2°C
- Prioritize high-density residential zones

Costs:
- Increase green cover: ₹0.8Cr per 10%
- Cool roofs (increase albedo): ₹0.5Cr per 10%

Hot Zones:
{zones}

Task:
1. Select priority zones
2. Suggest interventions (trees, cool roofs)
3. Allocate budget smartly
4. Explain reasoning clearly

Answer in this format:

Priority Plan:
- Zone X → Action → Cost → Reason

Summary:
Explain overall strategy
"""