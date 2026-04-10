import os
from data.generator import generate_grid, generate_training_data
from ml.model import TempModel

def main():
    print("Starting ML Model Training Pipeline...")
    
    # 1. Generate the base 100-zone grid
    print("Generating base city grid...")
    base_grid = generate_grid()
    
    # 2. Extract 5,000 training samples via gaussian jittering
    print("Simulating 5,000 IoT sensor readings (synthetic data)...")
    training_df = generate_training_data(base_grid, samples=5000)
    print(f"Data generated! Shape: {training_df.shape}")
    
    # 3. Train the RandomForest regressor
    print("Training RandomForestRegressor...")
    model = TempModel()
    model.train(training_df)
    
    # 4. Verify serialization
    if os.path.exists(model.model_path):
        print(f"Model successfully trained and saved to: {model.model_path}")
        print(f"File size: {os.path.getsize(model.model_path) / 1024:.2f} KB")
    else:
        print("Error: Model failed to save.")

if __name__ == "__main__":
    main()
