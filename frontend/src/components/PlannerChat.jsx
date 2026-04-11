import { useState, useRef, useEffect } from "react";

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://127.0.0.1:8000";

export default function PlannerChat() {
  const [budget, setBudget] = useState(50);
  const [rawResponse, setRawResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [finalData, setFinalData] = useState(null);
  const [chatInput, setChatInput] = useState("");
  
  const bottomRef = useRef(null);

  // Auto-scroll when new cards stream in
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rawResponse]);

  const generatePlan = async (isChat = false) => {
    setIsStreaming(true);
    setRawResponse(""); 
    setFinalData(null); 

    let accumulatedText = "";

    try {
      const payload = { budget_crore: parseFloat(budget) };
      if (isChat && chatInput.trim()) {
         payload.user_request = chatInput.trim();
      }

      const res = await fetch(`${BASE_URL}/ask-planner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        setRawResponse(accumulatedText);
      }
      
      // On completion, save the finalized valid JSON object to clean up the UI
      setFinalData(JSON.parse(accumulatedText));
      
    } catch (e) {
      console.error(e);
      // Fallback
    } finally {
      setIsStreaming(false);
    }
  };

  // -------------------------------------------------------------
  // THE REAL-TIME JSON PARSER
  // Extracts completed array objects out of the broken JSON stream as they finish
  // -------------------------------------------------------------
  const extractedCards = [];
  const matches = rawResponse.match(/\{[^{]*"zone_id"[\s\S]*?\}/g) || [];
  matches.forEach(matchStr => {
    try {
      extractedCards.push(JSON.parse(matchStr));
    } catch(e) { } // Ignore incomplete JSON until the trailing '}' drops from streaming
  });

  // Extract the Summary dynamically
  const summaryMatch = rawResponse.match(/"summary"\s*:\s*"([\s\S]*?)("|$)/);
  const summaryText = summaryMatch ? summaryMatch[1] : "";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full shadow-xl relative">
      <div className="flex justify-between items-center p-6 bg-slate-900 border-b border-slate-800 z-10 rounded-t-2xl">
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
                className="bg-slate-950 border border-slate-800 text-white rounded-xl pl-8 pr-8 py-2 w-32 focus:outline-none focus:border-teal-500 font-bold transition-all shadow-inner"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 font-bold text-[10px] uppercase tracking-widest pt-0.5">Cr</span>
            </div>
            
            <button 
              onClick={generatePlan} 
              disabled={isStreaming}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center gap-2
                ${isStreaming ? 'bg-slate-800 cursor-not-allowed opacity-80' : 'bg-gradient-to-r from-teal-500 to-teal-600 hover:scale-105 active:scale-95 border border-teal-400/20 shadow-teal-500/20'}`}
            >
              {isStreaming ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
              ) : (
                "Draft Strategy"
              )}
            </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col space-y-4">
        
        {/* Placeholder Setup */}
        {!rawResponse && !isStreaming && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
             <p className="font-bold text-slate-500 mb-2">Awaiting Parameters</p>
             <p className="text-xs max-w-xs text-center">Set your exact budget constraint and ask the LLM to identify the most cost-effective interventions across the city.</p>
          </div>
        )}

        {/* Real-time Loading Indicator */}
        {isStreaming && extractedCards.length === 0 && (
          <div className="text-teal-500/50 text-xs font-mono animate-pulse w-full text-center py-10 mt-10 border border-dashed border-slate-800 rounded-lg">
             Receiving ML scenarios constraint logic & rendering JSON stream... 
          </div>
        )}

        {/* Headers */}
        {(extractedCards.length > 0 || finalData) && (
           <h3 className="text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-slate-800 pb-2">Recommended Interventions</h3>
        )}

        {/* Real-time Cards Render Engine */}
        {(finalData ? finalData.plan : extractedCards).map((item, idx) => (
          <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-md animate-fade-in relative overflow-hidden group hover:border-slate-700 transition-colors">
            <div className="absolute top-0 left-0 w-1 h-full bg-teal-500 shadow-[0_0_10px_#14b8a6]"></div>
            <div className="flex justify-between items-start mb-2">
               <div className="font-bold text-white">
                 Zone {item.zone_id} <span className="text-slate-600 mx-2">|</span> <span className="text-teal-400 text-sm">{item.intervention}</span>
               </div>
               <div className="text-right flex items-center gap-3 bg-slate-900 border border-slate-800 px-2 py-1 rounded">
                  <div className="font-mono text-amber-400 font-bold text-xs">
                     <span className="text-slate-500 uppercase tracking-widest text-[8px] mr-1 inline-block align-middle">cost:</span>₹{item.cost_crore}Cr
                  </div>
                  <div className="font-mono text-teal-400 text-xs font-bold">
                     <span className="text-slate-500 uppercase tracking-widest text-[8px] mr-1 inline-block align-middle">drop:</span>-{item.cooling_delta_t}°C
                  </div>
               </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-medium mt-3 border-t border-slate-800/80 pt-2">{item.reasoning}</p>
          </div>
        ))}

        {/* Real-Time Summary Block attached to bottom of UI generation */}
        {(summaryText || finalData?.summary) && (
           <div className="mt-6 pt-4 border-t border-slate-800 animate-fade-in relative pb-4">
              <h3 className="text-teal-500 font-bold uppercase tracking-wider text-xs mb-2">Strategic Summary</h3>
              <p className="text-slate-300 font-medium text-sm leading-relaxed whitespace-pre-wrap">
                 {finalData ? finalData.summary : summaryText}
                 {isStreaming && <span className="inline-block w-2 ml-1 h-3 bg-teal-400 animate-pulse align-middle" />}
              </p>
           </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* NEW: Chat Input Box for follow-up refinement! */}
      {(extractedCards.length > 0 || finalData) && !isStreaming && (
        <div className="p-4 border-t border-slate-800 bg-slate-950 rounded-b-2xl flex gap-3 items-center">
            <input 
              type="text" 
              placeholder="Refine plan... E.g. Also prioritize tree coverage in zone 5"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && chatInput.trim() && generatePlan(true)}
              className="flex-1 bg-slate-900 border border-slate-800 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-teal-500/50 transition-colors placeholder:text-slate-600 shadow-inner"
            />
            <button 
              disabled={!chatInput.trim()}
              onClick={() => generatePlan(true)}
              className="px-4 py-2.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 font-bold text-sm rounded-xl hover:bg-teal-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              Update AI
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
        </div>
      )}
    </div>
  );
}
