from sklearn.ensemble import RandomForestRegressor
from ml.features import FEATURE_NAMES

class TempModel:
    def __init__(self):
        self.model = RandomForestRegressor()

    def train(self, grid):
        X = [[z[f] for f in FEATURE_NAMES] for z in grid]
        y = [z["temp"] for z in grid]

        self.model.fit(X, y)

    def predict(self, zone):
        X = [[zone[f] for f in FEATURE_NAMES]]
        return float(self.model.predict(X)[0])