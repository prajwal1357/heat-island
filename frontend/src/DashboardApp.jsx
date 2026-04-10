import { startTransition, useEffect, useState } from "react";
import ConstituencyMap from "./components/ConstituencyMap";
import InterventionOutcomePanel from "./components/InterventionOutcomePanel";
import PlannerChat from "./components/PlannerChat";
import { getGrid, refreshWeather } from "./api";

function formatSyncTime(timestamp) {
  if (!timestamp) {
    return "Seed cache";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export default function DashboardApp() {
  const [gridData, setGridData] = useState([]);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [cacheMeta, setCacheMeta] = useState(null);
  const [isLoadingGrid, setIsLoadingGrid] = useState(true);
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const loadGrid = async () => {
      setIsLoadingGrid(true);
      setLoadError("");

      try {
        const response = await getGrid();
        const payload = response.data;

        startTransition(() => {
          setGridData(payload.zones ?? []);
          setCacheMeta(payload);
          setSelectedZoneId((current) =>
            payload.zones?.some((zone) => zone.id === current) ? current : payload.zones?.[0]?.id ?? null,
          );
        });
      } catch (error) {
        console.error(error);
        setLoadError("Unable to load the cached Bengaluru weather grid.");
      } finally {
        setIsLoadingGrid(false);
      }
    };

    loadGrid();
  }, []);

  const handleRefreshWeather = async () => {
    setIsRefreshingWeather(true);
    setLoadError("");

    try {
      const response = await refreshWeather();
      const payload = response.data;

      startTransition(() => {
        setGridData(payload.zones ?? []);
        setCacheMeta(payload);
        setSelectedZoneId((current) =>
          payload.zones?.some((zone) => zone.id === current) ? current : payload.zones?.[0]?.id ?? null,
        );
      });
    } catch (error) {
      console.error(error);
      const detail = error.response?.data?.detail;
      setLoadError(typeof detail === "string" ? detail : "Weather refresh failed.");
    } finally {
      setIsRefreshingWeather(false);
    }
  };

  const selectedZone = gridData.find((zone) => zone.id === selectedZoneId) ?? null;
  const avgTemp = gridData.length ? gridData.reduce((sum, zone) => sum + zone.temp, 0) / gridData.length : 0;
  const hottest = gridData.reduce(
    (current, zone) => (current && current.temp > zone.temp ? current : zone),
    null,
  );
  const syncTime = formatSyncTime(cacheMeta?.last_refreshed_at);
  const weatherSource = cacheMeta?.weather_provider ?? "Cache";

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans p-4 lg:p-8 selection:bg-teal-500/30">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <header className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

          <div className="relative z-10 w-full md:w-auto text-center md:text-left">
            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
              Deep<span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-300">Heat</span> Command
            </h1>
            <p className="text-slate-400 font-medium tracking-wide text-xs uppercase">Strategic Environmental AI Interface</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto relative z-10">
            <div className="bg-slate-950/50 border border-slate-800/80 px-6 py-4 rounded-xl backdrop-blur-sm shadow-inner min-w-[210px]">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">City Avg Temp</div>
              <div className="text-2xl font-mono text-white font-bold tracking-tight">
                {gridData.length ? avgTemp.toFixed(1) : "--"} deg C
              </div>
              <div className="text-xs text-slate-500 mt-2">Source: {weatherSource}</div>
            </div>

            <div className="bg-slate-950/50 border border-slate-800/80 px-6 py-4 rounded-xl backdrop-blur-sm shadow-inner min-w-[240px]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Live Weather Cache</div>
                  <div className="text-sm text-white font-semibold">{syncTime}</div>
                  <div className="text-xs text-slate-500 mt-2">The client only reads the cached file until you sync again.</div>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshWeather}
                  disabled={isRefreshingWeather || isLoadingGrid}
                  className={`px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center gap-2 ${
                    isRefreshingWeather || isLoadingGrid
                      ? "bg-slate-800 cursor-not-allowed opacity-80"
                      : "bg-gradient-to-r from-teal-500 to-emerald-500 hover:scale-[1.02] active:scale-[0.98]"
                  }`}
                >
                  {isRefreshingWeather ? (
                    <>
                      <span className="w-4 h-4 border-2 border-slate-300 border-t-white rounded-full animate-spin"></span>
                      Syncing
                    </>
                  ) : (
                    "Sync Live Weather"
                  )}
                </button>
              </div>
            </div>

            <div className="bg-slate-950/50 border border-red-900/30 px-6 py-4 rounded-xl backdrop-blur-sm shadow-inner overflow-hidden relative min-w-[220px]">
              <div className="absolute inset-0 bg-red-500/5 pulse-animation"></div>
              <div className="text-[10px] text-red-400/80 font-bold uppercase tracking-widest mb-1 relative z-10">Critical Zone</div>
              <div className="relative z-10">
                <div className="text-lg font-bold text-white">{hottest?.name ?? "Loading"}</div>
                <div className="text-sm font-mono text-red-300 mt-1">
                  {hottest ? `${hottest.temp.toFixed(1)} deg C` : "--"}
                </div>
              </div>
            </div>
          </div>
        </header>

        {loadError && (
          <div className="bg-red-950/40 border border-red-900/40 text-red-200 rounded-2xl px-5 py-4 text-sm">
            {loadError}
          </div>
        )}

        <main className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-auto xl:h-[700px]">
          <div className="xl:col-span-5 flex flex-col gap-6">
            <ConstituencyMap
              zones={gridData}
              selectedZoneId={selectedZoneId}
              onSelectZone={setSelectedZoneId}
            />
            <div className="flex-1 min-h-[300px]">
              <InterventionOutcomePanel key={selectedZone?.id ?? "empty"} selectedZone={selectedZone} />
            </div>
          </div>

          <div className="xl:col-span-7 flex flex-col min-h-[500px]">
            <PlannerChat />
          </div>
        </main>
      </div>
    </div>
  );
}
