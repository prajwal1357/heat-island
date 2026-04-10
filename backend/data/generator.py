import numpy as np

def compute_temp(z):
    return float(
        45
        - (z["green_cover"] * 0.1)
        - (z["albedo"] * 5)
        + (z["density"] * 3)
        - (z["water"] * 2)
    )

def generate_grid(n=100):
    grid = []

    for i in range(n):
        zone = {
            "id": i,
            "albedo": float(np.random.uniform(0.2, 0.5)),
            "green_cover": float(np.random.uniform(0, 30)),
            "density": float(np.random.uniform(0.3, 1)),
            "water": float(np.random.uniform(0, 1)),
        }

        zone["temp"] = compute_temp(zone)
        grid.append(zone)

    return grid