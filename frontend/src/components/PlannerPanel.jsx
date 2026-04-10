import { useMemo, useState } from "react";

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://127.0.0.1:8000";

function formatCurrency(value) {
  return `Rs ${Number(value).toFixed(2)} Cr`;
}

export default function PlannerPanel() {
  const [budget, setBudget] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [planData, setPlanData] = useState(null);

  const totalCost = useMemo(() => {
    if (!planData?.plan?.length) {
      return 0;
    }
    return planData.plan.reduce((sum, item) => sum + Number(item.cost_crore || 0), 0);
  }, [planData]);

  const totalCooling = useMemo(() => {
    if (!planData?.plan?.length) {
      return 0;
    }
    return planData.plan.reduce((sum, item) => sum + Number(item.cooling_delta_t || 0), 0);
  }, [planData]);

  const generatePlan = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${BASE_URL}/ask-planner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget_crore: Number.parseFloat(budget) || 0 }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || "Planner request failed.");
      }

      setPlanData(payload);
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.message || "Planner request failed.");
      setPlanData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full shadow-xl relative">
      <div className="flex justify-between items-center p-6 bg-slate-900 border-b border-slate-800 z-10 rounded-t-2xl gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-0.5 flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI Urban Planner
          </h2>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-7">Structured LLM Strategy</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold z-10 transition-colors group-focus-within:text-teal-400">
              Rs
            </span>
            <input
              type="number"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              className="bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-8 py-2 w-36 focus:outline-none focus:border-teal-500 font-bold transition-all shadow-inner"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 font-bold text-[10px] uppercase tracking-widest">
              Cr
            </span>
          </div>

          <button
            onClick={generatePlan}
            disabled={isLoading}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center gap-2 ${
              isLoading
                ? "bg-slate-800 cursor-not-allowed opacity-80"
                : "bg-gradient-to-r from-teal-500 to-teal-600 hover:scale-105 active:scale-95 border border-teal-400/20 shadow-teal-500/20"
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                Drafting
              </>
            ) : (
              "Draft Strategy"
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4">
        {!planData && !isLoading && !error && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
            <p className="font-bold text-slate-500 mb-2">Ready To Plan</p>
            <p className="text-xs max-w-xs text-center">
              The planner now receives a compact shortlist of ML-ranked scenarios instead of a broken streamed table dump.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="text-teal-400/70 text-xs font-mono w-full text-center py-10 mt-10 border border-dashed border-slate-800 rounded-lg animate-pulse">
            Ranking candidate interventions and asking the planner model for a final budget-safe strategy...
          </div>
        )}

        {planData?.plan?.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Budget Input</div>
                <div className="text-lg font-semibold text-white mt-1">{formatCurrency(Number(budget) || 0)}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Plan Cost</div>
                <div className="text-lg font-semibold text-amber-300 mt-1">{formatCurrency(totalCost)}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Total Cooling</div>
                <div className="text-lg font-semibold text-teal-300 mt-1">-{totalCooling.toFixed(1)} deg C</div>
              </div>
            </div>

            <h3 className="text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-slate-800 pb-2">
              Recommended Interventions
            </h3>

            {planData.plan.map((item, index) => (
              <div
                key={`${item.zone_id}-${index}`}
                className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-md relative overflow-hidden hover:border-slate-700 transition-colors"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-teal-500 shadow-[0_0_10px_#14b8a6]"></div>
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div>
                    <div className="font-bold text-white">
                      {item.zone_name}
                      <span className="text-slate-600 mx-2">|</span>
                      <span className="text-teal-400 text-sm">{item.intervention}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Zone ID {item.zone_id}</div>
                  </div>
                  <div className="text-right flex items-center gap-3 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
                    <div className="font-mono text-amber-400 font-bold text-xs">
                      <span className="text-slate-500 uppercase tracking-widest text-[8px] mr-1 inline-block align-middle">cost:</span>
                      {formatCurrency(item.cost_crore)}
                    </div>
                    <div className="font-mono text-teal-400 text-xs font-bold">
                      <span className="text-slate-500 uppercase tracking-widest text-[8px] mr-1 inline-block align-middle">drop:</span>
                      -{Number(item.cooling_delta_t).toFixed(1)} deg C
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed font-medium mt-3 border-t border-slate-800/80 pt-3">
                  {item.reasoning}
                </p>
              </div>
            ))}

            {planData.summary && (
              <div className="mt-2 pt-4 border-t border-slate-800">
                <h3 className="text-teal-500 font-bold uppercase tracking-wider text-xs mb-2">Strategic Summary</h3>
                <p className="text-slate-300 font-medium text-sm leading-relaxed whitespace-pre-wrap">
                  {planData.summary}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
