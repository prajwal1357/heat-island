import { useState } from "react";

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://127.0.0.1:8000";

export default function PlannerChat() {
  const [budget, setBudget] = useState(50);
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const generatePlan = async () => {
    setIsStreaming(true);
    setResponse(""); // Clear UI before fetching logic

    try {
      const res = await fetch(`${BASE_URL}/ask-planner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_crore: parseFloat(budget) })
      });

      if (!res.body) throw new Error("No response body");

      // Hook up to the Raw Response stream and unpack standard chunk streams manually 
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        setResponse((prev) => prev + chunk); // Create typewriter sequence UI
      }
    } catch (e) {
      console.error(e);
      setResponse("❌ Error communicating with LLM Planner. Ensure backend is running and Ollama model responds correctly.");
    } finally {
      setIsStreaming(false);
    }
  };

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

      <div className="flex-1 bg-slate-950 p-6 overflow-y-auto relative font-mono text-sm leading-relaxed text-slate-300  whitespace-pre-wrap">
        
        {/* Placeholder state */}
        {!response && !isStreaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 text-center px-12">
            <svg className="w-16 h-16 mb-4 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="font-bold text-slate-500 text-lg mb-2">Ready to Advise</p>
            <p className="text-xs font-medium max-w-sm mx-auto">Define your organizational budget constraints. The AI model will calculate thousands of prediction combinations across the simulated city grid and draft an optimal resource distribution response.</p>
          </div>
        )}

        {/* Dynamic Typing UI */}
        <div className="prose prose-invert prose-teal max-w-none">
          {response}
          {isStreaming && (
            <span className="inline-block w-2 ml-1 h-4 bg-teal-400 animate-pulse mt-1.5 align-middle" />
          )}
        </div>
      </div>
    </div>
  );
}
