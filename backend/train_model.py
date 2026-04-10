import os
from data.generator import generate_training_data
from data.weather_cache import load_backend_env, read_live_weather_cache
from ml.model import TempModel

def main():
    load_backend_env()
    print("Starting ML Model Training Pipeline...")
    
    print("Loading cached Bengaluru constituency grid...")
    cache_payload = read_live_weather_cache()
    base_grid = cache_payload["zones"]
    
    print("Simulating 5,000 cache-anchored training samples...")
    training_df = generate_training_data(base_grid, samples=5000)
    print(f"Data generated! Shape: {training_df.shape}")
    
    print("Training RandomForestRegressor...")
    model = TempModel()
    model.train(training_df)
    
    if os.path.exists(model.model_path):
        print(f"Model successfully trained and saved to: {model.model_path}")
        print(f"File size: {os.path.getsize(model.model_path) / 1024:.2f} KB")
    else:
        print("Error: Model failed to save.")

if __name__ == "__main__":
    main()
