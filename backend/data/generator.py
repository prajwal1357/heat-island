import numpy as np
import pandas as pd
import os

def compute_temp(z):
    return float(
        45
        - (z["albedo"] * 15)
        - (z["green_cover_pct"] * 0.12)
        + (z["building_density"] * 8)
        - (1.5 / (z["distance_to_water_km"] + 0.5))
    )

def generate_grid(n=100):
    grid = []
    for i in range(n):
        zone = {
            "id": i,
            "albedo": float(np.random.uniform(0.1, 0.4)),
            "green_cover_pct": float(np.random.uniform(0, 60)),
            "building_density": float(np.random.uniform(0, 1)),
            "distance_to_water_km": float(np.random.uniform(0, 5)),
        }
        zone["temp"] = compute_temp(zone)
        grid.append(zone)
    return grid

def generate_training_data(grid, samples=5000):
    """Generate training samples anchored to the current cached baseline."""
    training_data = []
    
    # Calculate Global Baseline Offset
    # This preserves the physics gradients for the ML model to learn without getting confused, 
    # but still dynamically forces the dataset to represent the real-time Tomorrow.io extremes!
    avg_live_temp = sum(z["temp"] for z in grid) / len(grid) if grid else 35.0
    avg_formula_temp = sum(compute_temp(z) for z in grid) / len(grid) if grid else 35.0
    global_offset = avg_live_temp - avg_formula_temp
    
    # 10% of the value range for each feature as the standard deviation for jitter
    std_dev = {
        "albedo": 0.03,              # (0.4 - 0.1) * 0.1
        "green_cover_pct": 6.0,      # (60 - 0) * 0.1
        "building_density": 0.1,     # (1 - 0) * 0.1
        "distance_to_water_km": 0.5  # (5 - 0) * 0.1
    }
    
    for _ in range(samples):
        base_zone = np.random.choice(grid)
        base_temp = float(base_zone["temp"])
        base_formula_temp = compute_temp(base_zone)
        
        jittered = {
            "albedo": float(np.clip(base_zone["albedo"] + np.random.normal(0, std_dev["albedo"]), 0.1, 0.4)),
            "green_cover_pct": float(np.clip(base_zone["green_cover_pct"] + np.random.normal(0, std_dev["green_cover_pct"]), 0, 60)),
            "building_density": float(np.clip(base_zone["building_density"] + np.random.normal(0, std_dev["building_density"]), 0, 1)),
            "distance_to_water_km": float(np.clip(base_zone["distance_to_water_km"] + np.random.normal(0, std_dev["distance_to_water_km"]), 0, 5)),
        }
        
        # Apply the physical algorithm, and dynamically anchor it to the Tomorrow.io live weather offset
        jittered["temp"] = round(compute_temp(jittered) + global_offset, 3)
        training_data.append(jittered)
        
    df = pd.DataFrame(training_data)
    
    # Save the dataframe as CSV for backup
    csv_path = os.path.join(os.path.dirname(__file__), "training_data.csv")
    df.to_csv(csv_path, index=False)
    
    return df
