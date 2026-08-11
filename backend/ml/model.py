import joblib
import os
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import cross_val_score
from ml.features import FEATURE_NAMES

class TempModel:
    def __init__(self):
        self.model = RandomForestRegressor()
        self.model_path = os.path.join(os.path.dirname(__file__), "model.joblib")

    def train(self, df: pd.DataFrame):
        X = df[FEATURE_NAMES]
        y = df["temp"]
        self.model.fit(X, y)
        
        # Cross-validation metrics for transparency
        r2_scores = cross_val_score(self.model, X, y, cv=5, scoring="r2")
        mae_scores = cross_val_score(self.model, X, y, cv=5, scoring="neg_mean_absolute_error")
        print(f"  ML Model CV R²:  {r2_scores.mean():.4f} (±{r2_scores.std():.4f})")
        print(f"  ML Model CV MAE: {-mae_scores.mean():.4f}°C (±{mae_scores.std():.4f})")
        
        self.save()

    def save(self):
        joblib.dump(self.model, self.model_path)

    def load(self):
        if os.path.exists(self.model_path):
            self.model = joblib.load(self.model_path)
            return True
        return False

    def predict_intervention(self, zone: dict, intervention: dict):
        """
        Accepts {"green_cover_delta": 25, "cool_roof": True, "reflective_pavement": True}
        """
        updated_zone = zone.copy()
        
        if "green_cover_delta" in intervention:
            updated_zone["green_cover_pct"] = min(60.0, updated_zone["green_cover_pct"] + intervention["green_cover_delta"])
            
        if intervention.get("cool_roof"):
            updated_zone["albedo"] = min(0.4, updated_zone["albedo"] + 0.15)
            
        if intervention.get("reflective_pavement"):
            updated_zone["albedo"] = min(0.4, updated_zone["albedo"] + 0.08)
            
        current_X = pd.DataFrame([{feature_name: zone[feature_name] for feature_name in FEATURE_NAMES}])
        updated_X = pd.DataFrame([{feature_name: updated_zone[feature_name] for feature_name in FEATURE_NAMES}])
        
        # Calculate pure physics delta_T from the ML model
        pure_current = float(self.model.predict(current_X)[0])
        pure_updated = float(self.model.predict(updated_X)[0])
        delta_T = pure_current - pure_updated
        
        # Apply the physical delta_T to the live weather baseline
        return float(zone["temp"] - delta_T)

    def rank_scenarios(self, grid: list):
        """
        Sweep all zones × all intervention combinations and returns a sorted DataFrame.
        Cost model scales by constituency area (normalized to 25 km² median).
        Cost formula: green cover = ₹0.8Cr per 10% × area_factor, cool roofs = ₹0.5Cr × area_factor, 
        reflective pavement = ₹0.3Cr × area_factor.
        """
        results = []
        
        # Intervention sweeps
        green_cover_deltas = [0, 10, 20]
        cool_roof_options = [False, True]
        reflective_pavement_options = [False, True]
        
        for zone in grid:
            current_temp = zone["temp"]
            area_sq_km = zone.get("area_sq_km", 25.0)
            area_factor = max(area_sq_km / 25.0, 0.5)  # Normalize to median, floor at 0.5
            
            for gc_delta in green_cover_deltas:
                for cool_roof in cool_roof_options:
                    for ref_pave in reflective_pavement_options:
                        # Skip if there are no interventions applied
                        if gc_delta == 0 and not cool_roof and not ref_pave:
                            continue
                            
                        intervention = {
                            "green_cover_delta": gc_delta,
                            "cool_roof": cool_roof,
                            "reflective_pavement": ref_pave
                        }
                        
                        pred_temp = self.predict_intervention(zone, intervention)
                        delta_t = current_temp - pred_temp
                        
                        # Apply area-scaled cost model
                        cost = (gc_delta / 10.0) * 0.8 * area_factor
                        if cool_roof: cost += 0.5 * area_factor
                        if ref_pave: cost += 0.3 * area_factor
                        
                        # Build description
                        ints_str = []
                        if gc_delta > 0: ints_str.append(f"+{gc_delta}% Green Cover")
                        if cool_roof: ints_str.append("Cool Roof")
                        if ref_pave: ints_str.append("Reflective Pavement")
                        
                        results.append({
                            "zone_id": zone["id"],
                            "current_temp": round(current_temp, 2),
                            "predicted_temp": round(pred_temp, 2),
                            "delta_T": round(delta_t, 2),
                            "cost_crore": round(cost, 2),
                            "interventions": ", ".join(ints_str)
                        })
                        
        df = pd.DataFrame(results)
        # Sort by largest delta_T first (maximum cooling)
        df = df.sort_values(by="delta_T", ascending=False)
        return df
