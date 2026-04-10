import Grid from "./components/Grid";
import Planner from "./components/Planner";

function App() {
  return (
    <div style={{ display: "flex", gap: "40px" }}>
      <Grid />
      <Planner />
    </div>
  );
}

export default App;