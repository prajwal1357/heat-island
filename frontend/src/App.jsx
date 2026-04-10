import { useEffect, useState } from "react";
import HeatGrid from "./components/HeatGrid";
import InterventionPanel from "./components/InterventionPanel";
import PlannerChat from "./components/PlannerChat";
import { getGrid, refreshWeather } from "./api";

function App() {
  const [gridData, setGridData] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    getGrid().then(res => setGridData(res.data.zones || res.data)).catch(console.error);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await refreshWeather();
      setGridData(res.data.zones || res.data);
    } catch (e) {
      console.error("Refresh failed:", e);
      alert("Failed to sync with Tomorrow.io API.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePredictionUpdate = (predictedData) => {
    setGridData(prev => prev.map(z => 
      z.id === predictedData.zone_id 
        ? { ...z, temp: predictedData.predicted_temp } 
        : z
    ));
  };

  const avgTemp = gridData.length ? (gridData.reduce((acc, z) => acc + z.temp, 0) / gridData.length) : 0;
  const hottest = gridData.reduce((prev, curr) => (prev && prev.temp > curr.temp) ? prev : curr, null);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans p-4 lg:p-8 selection:bg-teal-500/30">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* Header / City Stats dashboard */}
        <header className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
          {/* Subtle gradient glow in background */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          
          <div className="relative z-10 w-full md:w-auto text-center md:text-left">
            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
              Deep<span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-300">Heat</span> Command
            </h1>
            <p className="text-slate-400 font-medium tracking-wide text-xs uppercase">Strategic Environmental AI Interface</p>
          </div>
          
          <div className="flex gap-4 w-full md:w-auto relative z-10 items-center">
               <button 
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className={`px-4 py-3 rounded-xl border border-teal-500/50 bg-teal-500/10 hover:bg-teal-500/20 transition-all font-bold text-xs uppercase tracking-wider text-teal-400 shadow-md ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
               >
                 {isRefreshing ? "Syncing API..." : "Live Sync"}
               </button>
               <div className="flex-1 md:flex-none bg-slate-950/50 border border-slate-800/80 px-6 py-4 rounded-xl backdrop-blur-sm shadow-inner">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">City Avg Temp</div>
                  <div className="text-2xl font-mono text-white font-bold tracking-tight">{avgTemp.toFixed(1)}°C</div>
               </div>
               <div className="flex-1 md:flex-none bg-slate-950/50 border border-red-900/30 px-6 py-4 rounded-xl backdrop-blur-sm shadow-inner overflow-hidden relative">
                  <div className="absolute inset-0 bg-red-500/5 pulse-animation"></div>
                  <div className="text-[10px] text-red-400/80 font-bold uppercase tracking-widest mb-1 relative z-10">Critical Zone</div>
                  <div className="text-2xl font-mono text-white flex items-center font-bold tracking-tight relative z-10">
                    {hottest?.name || `#${hottest?.id}`}
                    <span className="text-sm font-bold text-red-400/90 ml-3 py-0.5 px-2 bg-red-950/50 rounded-md">
                      {hottest?.temp.toFixed(1)}°C
                    </span>
                  </div>
               </div>
          </div>
        </header>

        {/* Main 2-Column Responsive Layout */}
        <main className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-auto xl:h-[700px]">
          
          {/* Left Column (Grid + Intervention Panel) */}
          <div className="xl:col-span-5 flex flex-col gap-6">
            <HeatGrid 
              gridData={gridData} 
              selectedZone={selectedZone}
              onSelectZone={setSelectedZone} 
            />
            <div className="flex-1 min-h-[300px]">
              <InterventionPanel 
                selectedZone={selectedZone} 
                onPredictionUpdate={handlePredictionUpdate}
              />
            </div>
          </div>

          {/* Right Column (Planner Chat) */}
          <div className="xl:col-span-7 flex flex-col min-h-[500px]">
             <PlannerChat />
          </div>

        </main>
      </div>
    </div>
  );
}

export default App;