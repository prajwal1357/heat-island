import { useState } from "react";
import { getPlan } from "../api";

export default function Planner() {
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchPlan = async () => {
    setLoading(true);
    const res = await getPlan();
    setPlan(res.data.plan);
    setLoading(false);
  };

  return (
    <div>
      <h2>AI Planner</h2>

      <button onClick={fetchPlan}>
        Ask AI Planner
      </button>

      {loading && <p>AI is thinking...</p>}

      <pre>{plan}</pre>
    </div>
  );
}