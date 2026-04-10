import { useState, useEffect, useRef } from "react";
import { predict } from "../api";

export default function InterventionPanel({ selectedZone }) {
  const [greenCoverDelta, setGreenCoverDelta] = useState(0);
  const [coolRoof, setCoolRoof] = useState(false);
  const [reflectivePavement, setReflectivePavement] = useState(false);
  const [prediction, setPrediction] = useState(null);
  
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!selectedZone) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await predict({
          zone_id: selectedZone.id,
          green_cover_delta: greenCoverDelta,
          cool_roof: coolRoof,
          reflective_pavement: reflectivePavement
        });
        setPrediction(res.data);
      } catch (e) {
        console.error("Prediction failed", e);
      }
    }, 300); // UI performance debounce so ML layer doesn't crash on slider drag!

    return () => clearTimeout(debounceRef.current);
  }, [greenCoverDelta, coolRoof, reflectivePavement, selectedZone]);

  if (!selectedZone) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center justify-center h-full text-slate-500 shadow-xl font-medium text-sm">
        <div className="flex flex-col items-center gap-2">
           <svg className="w-8 h-8 text-teal-900/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
           </svg>
      } catch (e) {
        console.error("Prediction failed", e);
      }
    }, 300); // UI performance debounce so ML layer doesn't crash on slider drag!

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

  // Frontend quick-calc to immediately render costs avoiding extra API load
  const cost = ((greenCoverDelta / 10) * 0.8) + (coolRoof ? 0.5 : 0) + (reflectivePavement ? 0.3 : 0);
  const efficiency = prediction?.delta_T > 0 && cost > 0 ? (prediction.delta_T / cost) : 0;

  const getEfficiencyState = () => {
     if (cost === 0) return { text: "Adjust sliders to initiate simulations", color: "text-slate-500", bg: "bg-slate-900" };
     if (efficiency < 0.6) return { text: "⚠️ Diminishing Returns: Overspending for minimal cooling", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" };
     if (efficiency < 1.0) return { text: "Moderate Efficiency", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" };
     return { text: "✨ Highly Efficient cooling ratio", color: "text-teal-400", bg: "bg-teal-500/10 border-teal-500/20" };
  }
  const effState = getEfficiencyState();

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-white shadow-xl h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800 gap-4">
        <div>
          <h3 className="text-lg font-bold text-teal-400">{selectedZone.name}</h3>
          <p className="text-xs text-slate-500 mt-1">Constituency code {selectedZone.id}</p>
        </div>
        <span className="text-xs px-3 py-1 font-bold bg-slate-950 rounded-full text-slate-300 shadow-inner">
          Current: {selectedZone.temp.toFixed(1)}°C
        </span>
      </div>

      <div className="space-y-5 flex-1">
        
        {/* Slider 1 */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
          <label className="flex justify-between text-sm font-medium mb-3">
            <span className="text-slate-300 font-bold">Plant Trees</span>
            <span className="text-teal-400">+{greenCoverDelta}%</span>
          </label>
          <input 
            type="range" min="0" max="60" step="10" 
            value={greenCoverDelta} 
            onChange={(e) => setGreenCoverDelta(Number(e.target.value))}
            className="w-full accent-teal-500 bg-slate-800 h-2 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Toggle 2 */}
        <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800/80 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer group" onClick={() => setCoolRoof(!coolRoof)}>
          <div>
            <div className="font-bold text-sm text-slate-300">Cool Roof System</div>
            <div className="text-xs text-slate-500 mt-1 font-medium">Reflects solar radiation (₹0.5Cr)</div>
          </div>
           <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${coolRoof ? 'bg-teal-500 shadow-lg shadow-teal-500/20' : 'bg-slate-700'}`}>
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${coolRoof ? 'translate-x-5' : 'translate-x-0'}`}></div>
          </div>
        </div>

        {/* Toggle 3 */}
        <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800/80 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer group" onClick={() => setReflectivePavement(!reflectivePavement)}>
           <div>
            <div className="font-bold text-sm text-slate-300">Reflective Pavement</div>
            <div className="text-xs text-slate-500 mt-1 font-medium">Lighten street surface (₹0.3Cr)</div>
          </div>
           <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${reflectivePavement ? 'bg-teal-500 shadow-lg shadow-teal-500/20' : 'bg-slate-700'}`}>
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${reflectivePavement ? 'translate-x-5' : 'translate-x-0'}`}></div>
          </div>
        </div>

      </div>

      {prediction && (
        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Predicted Outcome</p>
              <div className="text-3xl font-bold font-mono tracking-tight text-white flex items-center">
                {prediction.predicted_temp.toFixed(1)}°C
                <span className="text-xs ml-3 font-bold px-2 py-1 bg-teal-500/20 text-teal-400 rounded-md">
                  -{prediction.delta_T.toFixed(1)}°C
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Estimated Cost</p>
              <div className="text-xl font-bold font-mono flex items-center text-amber-400">
                ₹{cost.toFixed(2)}
                <span className="text-xs ml-1 font-bold text-amber-500/60">Cr</span>
              </div>
            </div>
          </div>
          
          {/* Diminishing Returns ML Output Box */}
          <div className={`p-3 border rounded-xl flex items-center justify-between transition-colors duration-300 ${effState.bg}`}>
             <span className={`text-xs font-bold ${effState.color}`}>{effState.text}</span>
             {cost > 0 && (
                <span className="font-mono text-xs font-bold text-slate-400">
                   {efficiency.toFixed(2)} δT/₹Cr
                </span>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
