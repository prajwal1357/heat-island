import { useState, useEffect } from "react";

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://127.0.0.1:8000";

export default function PlannerChat() {
  const [budget, setBudget] = useState(50);
  const [response, setResponse] = useState("");
  const [parsedData, setParsedData] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const generatePlan = async () => {
    setIsStreaming(true);
    setResponse(""); // Clear UI
    setParsedData(null); // Reset JSON mapping

    try {
      const res = await fetch(`${BASE_URL}/ask-planner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_crore: parseFloat(budget) })
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        setResponse((prev) => prev + chunk); // Create typewriter sequence for live JSON loading
      }
    } catch (e) {
      console.error(e);
      setResponse("{\"error\": \"Failed to reach Backend\"}");
    } finally {
      setIsStreaming(false);
    }
  };

  // The moment streaming finishes, attempt to parse the raw JSON string into a structured React element
  useEffect(() => {
    if (!isStreaming && response) {
      try {
        setParsedData(JSON.parse(response));
      } catch (e) {
        console.error("Failed to parse LLM Response to JSON", e);
      }
    }
  }, [isStreaming, response]);

  return (
    <div className="bg-slate-900 overflow-hidden border border-slate-800 rounded-2xl flex flex-col h-full shadow-2xl relative">
      <div className="flex justify-between items-center p-6 bg-slate-900 border-b border-slate-800 z-10">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-0.5 flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI Urban Planner
          </h2>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-7">Mistral Insights</p>
        </div>

        <div className="flex items-center gap-4">
            <div className="relative group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold pb-0.5 z-10 transition-colors group-focus-within:text-teal-400">₹</span>
              <input 
                type="number" 
                value={budget} 
                onChange={(e) => setBudget(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-white rounded-xl pl-8 pr-8 py-2.5 w-32 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-bold transition-all shadow-inner relative z-0"
                min="10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 font-bold text-[10px] uppercase tracking-widest z-10 pt-0.5">Cr</span>
            </div>
            
            <button 
              onClick={generatePlan} 
              disabled={isStreaming}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-xl transition-all flex items-center gap-2
                ${isStreaming ? 'bg-slate-800 cursor-not-allowed opacity-80' : 'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 active:scale-95 border border-teal-400/20 shadow-teal-500/20'}`}
            >
              {isStreaming ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Draft Strategy
                  <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
        </div>
      </div>

      <div className="flex-1 bg-slate-950 p-6 overflow-y-auto relative text-sm leading-relaxed text-slate-300  whitespace-pre-wrap flex flex-col">
        
        {/* Placeholder state */}
        {!response && !isStreaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 text-center px-12">
            <svg className="w-16 h-16 mb-4 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            <p className="font-bold text-slate-500 text-lg mb-2">Ready to Advise</p>
            <p className="text-xs font-medium max-w-sm mx-auto">Click Draft Strategy to begin JSON streaming from the model and parse the results.</p>
          </div>
        )}

        {/* Dynamic Typing UI (Shows raw code hacker style) */}
        {isStreaming && (
           <div className="font-mono text-teal-500/80 text-xs">
             {response}
             <span className="inline-block w-2 ml-1 h-3 bg-teal-400 animate-pulse mt-0.5 align-middle" />
           </div>
        )}

        {/* Formatted JSON Dashboard (Only shows when stream completes) */}
        {parsedData && !isStreaming && (
          <div className="space-y-6 animate-fade-in flex-1">
            <div className="bg-gradient-to-r from-teal-900/20 to-slate-900 border border-teal-800/30 p-4 rounded-xl shadow-lg">
              <h3 className="text-teal-400 font-bold mb-2 uppercase tracking-wide text-xs">Executive Summary</h3>
              <p className="text-slate-300 font-medium">{parsedData.summary}</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-slate-400 font-bold uppercase tracking-wide text-xs">Recommended Approvals</h3>
              {parsedData.plan && parsedData.plan.map((item, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
                   <div className="absolute top-0 left-0 w-1 h-full bg-teal-500"></div>
                   <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-white text-base">
                        Zone {item.zone_id} <span className="text-slate-600 mx-2">|</span> <span className="text-teal-400 text-sm">{item.intervention}</span>
                      </div>
                      <div className="text-right flex items-center gap-3 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                         <div className="font-mono text-amber-400 font-bold text-xs"><span className="text-slate-500">cost:</span> ₹{item.cost_crore}Cr</div>
                         <div className="font-mono text-teal-400 text-xs font-bold"><span className="text-slate-500">drop:</span> -{item.cooling_delta_t}°C</div>
                      </div>
                   </div>
                   <p className="text-xs text-slate-400 leading-relaxed font-medium mt-3 border-t border-slate-800/80 pt-2">{item.reasoning}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* JSON Parser Failure Warning */}
        {!parsedData && !isStreaming && response && (
          <div className="font-mono whitespace-pre-wrap text-[10px] text-red-500/80 bg-red-950/20 p-4 rounded-xl border border-red-900/50">
             // ERROR: Failed to parse native JSON response
             <br/><br/>
             {response}
          </div>
        )}
      </div>
    </div>
  );
}
