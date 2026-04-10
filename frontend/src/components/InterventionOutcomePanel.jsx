import { useEffect, useRef, useState } from "react";
import { predict } from "../api";

function formatCurrency(value) {
  return `Rs ${value.toFixed(2)} Cr`;
}

function getActiveInterventions({ greenCoverDelta, coolRoof, reflectivePavement }) {
  const interventions = [];

  if (greenCoverDelta > 0) {
    interventions.push(`+${greenCoverDelta}% tree cover`);
  }

  if (coolRoof) {
    interventions.push("cool roof");
  }

  if (reflectivePavement) {
    interventions.push("reflective pavement");
  }

  return interventions;
}

export default function InterventionOutcomePanel({ selectedZone }) {
  const [greenCoverDelta, setGreenCoverDelta] = useState(0);
  const [coolRoof, setCoolRoof] = useState(false);
  const [reflectivePavement, setReflectivePavement] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);

  const debounceRef = useRef(null);

  useEffect(() => {
    if (!selectedZone) {
      return undefined;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        setIsPredicting(true);
        const res = await predict({
          zone_id: selectedZone.id,
          green_cover_delta: greenCoverDelta,
          cool_roof: coolRoof,
          reflective_pavement: reflectivePavement,
        });
        setPrediction(res.data);
      } catch (error) {
        console.error("Prediction failed", error);
      } finally {
        setIsPredicting(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [greenCoverDelta, coolRoof, reflectivePavement, selectedZone]);

  if (!selectedZone) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center justify-center h-full text-slate-500 shadow-xl font-medium text-sm">
        <div className="flex flex-col items-center gap-2">
          <svg className="w-8 h-8 text-teal-900/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <p>Select a constituency to configure interventions</p>
        </div>
      </div>
    );
  }

  const cost = ((greenCoverDelta / 10) * 0.8) + (coolRoof ? 0.5 : 0) + (reflectivePavement ? 0.3 : 0);
  const activeInterventions = getActiveInterventions({ greenCoverDelta, coolRoof, reflectivePavement });
  const hasIntervention = activeInterventions.length > 0;

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-white shadow-xl h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800 gap-4">
        <div>
          <h3 className="text-lg font-bold text-teal-400">{selectedZone.name}</h3>
          <p className="text-xs text-slate-500 mt-1">Constituency code {selectedZone.id}</p>
        </div>
        <span className="text-xs px-3 py-1 font-bold bg-slate-950 rounded-full text-slate-300 shadow-inner">
          Current: {selectedZone.temp.toFixed(1)} deg C
        </span>
      </div>

      <div className="space-y-5 flex-1">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
          <label className="flex justify-between text-sm font-medium mb-3">
            <span className="text-slate-300 font-bold">Plant Trees</span>
            <span className="text-teal-400">+{greenCoverDelta}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="60"
            step="10"
            value={greenCoverDelta}
            onChange={(e) => setGreenCoverDelta(Number(e.target.value))}
            className="w-full accent-teal-500 bg-slate-800 h-2 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <button
          type="button"
          className="w-full flex items-center justify-between p-4 bg-slate-950 border border-slate-800/80 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer group text-left"
          onClick={() => setCoolRoof(!coolRoof)}
        >
          <div>
            <div className="font-bold text-sm text-slate-300">Cool Roof System</div>
            <div className="text-xs text-slate-500 mt-1 font-medium">Reflects solar radiation (Rs 0.5 Cr)</div>
          </div>
          <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${coolRoof ? "bg-teal-500 shadow-lg shadow-teal-500/20" : "bg-slate-700"}`}>
            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${coolRoof ? "translate-x-5" : "translate-x-0"}`}></div>
          </div>
        </button>

        <button
          type="button"
          className="w-full flex items-center justify-between p-4 bg-slate-950 border border-slate-800/80 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer group text-left"
          onClick={() => setReflectivePavement(!reflectivePavement)}
        >
          <div>
            <div className="font-bold text-sm text-slate-300">Reflective Pavement</div>
            <div className="text-xs text-slate-500 mt-1 font-medium">Lighten street surface (Rs 0.3 Cr)</div>
          </div>
          <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${reflectivePavement ? "bg-teal-500 shadow-lg shadow-teal-500/20" : "bg-slate-700"}`}>
            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${reflectivePavement ? "translate-x-5" : "translate-x-0"}`}></div>
          </div>
        </button>
      </div>

      <div className="mt-6 pt-5 border-t border-slate-800">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Predicted Outcome</p>
            <p className="text-sm text-slate-400">
              {hasIntervention
                ? "Live estimate based on the active intervention mix."
                : "Turn on one or more interventions to compare the new projected baseline."}
            </p>
          </div>
          {isPredicting && (
            <div className="flex items-center gap-2 text-xs text-teal-300 font-semibold">
              <span className="w-4 h-4 border-2 border-slate-500 border-t-teal-300 rounded-full animate-spin"></span>
              Updating
            </div>
          )}
        </div>

        {prediction ? (
          <div className="rounded-2xl border border-teal-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))] p-5 shadow-[0_18px_60px_rgba(8,145,178,0.12)]">
            <div className="grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-4">
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-bold mb-2">Projected Temperature</div>
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="text-4xl font-black tracking-tight text-white font-mono">
                    {prediction.predicted_temp.toFixed(1)}
                    <span className="text-lg text-slate-400 ml-1">deg C</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-300 text-sm font-bold border border-emerald-500/20">
                    {prediction.delta_T > 0 ? `-${prediction.delta_T.toFixed(1)} deg C` : "No cooling gain"}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">Current</div>
                    <div className="text-lg font-semibold text-slate-100 mt-1">{prediction.current_temp.toFixed(1)} deg C</div>
                  </div>
                  <div className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">Estimated Cost</div>
                    <div className="text-lg font-semibold text-amber-300 mt-1">{formatCurrency(cost)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-4 flex flex-col">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-bold mb-3">Intervention Stack</div>
                <div className="flex flex-wrap gap-2">
                  {activeInterventions.length ? (
                    activeInterventions.map((item) => (
                      <span
                        key={item}
                        className="px-3 py-1.5 rounded-full bg-teal-500/12 text-teal-200 text-xs font-bold border border-teal-500/15"
                      >
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">No intervention selected yet.</span>
                  )}
                </div>

                <div className="mt-auto pt-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">Model Readout</div>
                    <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                      {prediction.delta_T > 0
                        ? "This mix is expected to reduce the local heat baseline and improve outdoor comfort in the selected constituency."
                        : "This combination does not currently produce a meaningful modeled drop, so try increasing tree cover or stacking surface upgrades."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 px-4 py-5 text-sm text-slate-500">
            Prediction results will appear here as soon as the model responds.
          </div>
        )}
      </div>
    </div>
  );
}
