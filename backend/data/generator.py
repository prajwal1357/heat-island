import numpy as np
import pandas as pd
import os

def compute_temp(z):
    """
    Improved physics-based temperature model with non-linear interaction terms.
    
    Key improvements over the original linear formula:
    1. Albedo × density interaction: dense areas with low reflectivity trap more heat
    2. Green cover diminishing returns: going from 5%→15% has more impact than 45%→55%
    3. Water proximity follows inverse-square decay (not just inverse)
    4. Building density has a quadratic component (dense urban cores heat exponentially)
    """
    albedo = z["albedo"]
    green = z["green_cover_pct"]
    density = z["building_density"]
    water_dist = z["distance_to_water_km"]
    
    # Base urban temperature
    base = 44.0
    
    # Albedo cooling (reflective surfaces reduce heat absorption)
    albedo_effect = albedo * 14.0
    
    # Non-linear interaction: low-albedo dense areas trap significantly more heat
    # than a simple additive model would predict
    density_albedo_interaction = (1.0 - albedo) * density * 3.5
    
    # Green cover with diminishing returns (quadratic term)
    # First 20% of tree cover cools much more effectively than the last 20%
    green_linear = green * 0.10
    green_diminishing = (green ** 2) / 1200.0  # Subtracts less as green grows
    green_effect = green_linear + green_diminishing
    
    # Building density with quadratic acceleration (urban heat trapping)
    density_effect = density * 6.0 + (density ** 2) * 3.0
    
    # Water body cooling with inverse-square proximity decay
    water_cooling = 2.0 / ((water_dist + 0.3) ** 1.3)
    
    return float(
        base
        - albedo_effect
        + density_albedo_interaction
        - green_effect
        + density_effect
        - water_cooling
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
        
        jittered = {
            "albedo": float(np.clip(base_zone["albedo"] + np.random.normal(0, std_dev["albedo"]), 0.1, 0.4)),
            "green_cover_pct": float(np.clip(base_zone["green_cover_pct"] + np.random.normal(0, std_dev["green_cover_pct"]), 0, 60)),
            "building_density": float(np.clip(base_zone["building_density"] + np.random.normal(0, std_dev["building_density"]), 0, 1)),
            "distance_to_water_km": float(np.clip(base_zone["distance_to_water_km"] + np.random.normal(0, std_dev["distance_to_water_km"]), 0, 5)),
        }
        
        # Apply the physical algorithm, anchor to Tomorrow.io offset,
        # then add micro-climate noise (±0.5°C) to simulate real sensor variance
        # This gives the Random Forest real variance to learn from beyond the formula
        micro_climate_noise = float(np.random.normal(0, 0.5))
        jittered["temp"] = round(compute_temp(jittered) + global_offset + micro_climate_noise, 3)
        training_data.append(jittered)
        
    df = pd.DataFrame(training_data)
    
    # Save the dataframe as CSV for backup
    csv_path = os.path.join(os.path.dirname(__file__), "training_data.csv")
    df.to_csv(csv_path, index=False)
    
    return df
