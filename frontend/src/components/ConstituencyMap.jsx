import * as d3 from "d3";

const VIEWBOX_WIDTH = 760;
const VIEWBOX_HEIGHT = 660;

function getFeatureCollection(zones) {
  return {
    type: "FeatureCollection",
    features: zones.map((zone) => ({
      type: "Feature",
      geometry: zone.geometry,
      properties: zone,
    })),
  };
}

function getPathData(zones) {
  if (!zones.length) {
    return [];
  }

  const featureCollection = getFeatureCollection(zones);
  const projection = d3.geoMercator().fitSize([VIEWBOX_WIDTH, VIEWBOX_HEIGHT], featureCollection);
  const path = d3.geoPath(projection);

  return featureCollection.features.map((feature) => ({
    id: feature.properties.id,
    name: feature.properties.name,
    temp: feature.properties.temp,
    weather: feature.properties.weather,
    center: feature.properties.center,
    path: path(feature),
    labelPoint: path.centroid(feature),
  }));
}

export default function ConstituencyMap({ zones, selectedZoneId, onSelectZone }) {
  const mapZones = getPathData(zones);
  const temperatures = zones.map((zone) => zone.temp);
  const minTemp = temperatures.length ? Math.min(...temperatures) : 0;
  const maxTemp = temperatures.length ? Math.max(...temperatures) : 1;
  const colorScale = d3
    .scaleLinear()
    .domain(minTemp === maxTemp ? [minTemp - 1, maxTemp + 1] : [minTemp, maxTemp])
    .range(["#0f766e", "#f97316"]);

  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? null;

  return (
    <div className="bg-slate-900 p-6 rounded-2xl shadow-2xl border border-slate-800">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white">Bengaluru Constituency Heatmap</h2>
          <p className="text-sm text-slate-400 mt-1">
            25 core assembly constituencies rendered from the cached GeoJSON source.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider">
          <span className="w-3 h-3 rounded bg-orange-500 shadow-sm shadow-orange-500/20"></span>
          <span className="text-slate-400 mr-2">Warmer</span>
          <span className="w-3 h-3 rounded bg-teal-600 shadow-sm shadow-teal-500/20"></span>
          <span className="text-slate-400">Cooler</span>
        </div>
      </div>

      <div className="border border-slate-700/60 rounded-2xl bg-slate-950 overflow-hidden shadow-inner">
        <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="w-full h-auto block">
          <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="#020617" />
          {mapZones.map((zone) => {
            const isSelected = zone.id === selectedZoneId;
            const [labelX, labelY] = zone.labelPoint;

            return (
              <g key={zone.id}>
                <path
                  d={zone.path}
                  fill={colorScale(zone.temp)}
                  stroke={isSelected ? "#f8fafc" : "#0f172a"}
                  strokeWidth={isSelected ? 2.8 : 1.1}
                  className="cursor-pointer transition-all duration-500 ease-out"
                  opacity={isSelected ? 1 : 0.92}
                  onClick={() => onSelectZone(zone.id)}
                >
                  <title>{`${zone.name}: ${zone.temp.toFixed(1)} deg C`}</title>
                </path>
                <circle
                  cx={labelX}
                  cy={labelY}
                  r={isSelected ? 4.5 : 2.8}
                  fill={isSelected ? "#f8fafc" : "#cbd5e1"}
                  className="pointer-events-none transition-all duration-300"
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.9fr] gap-4 mt-5">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          {selectedZone ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-bold">Selected Constituency</div>
                  <div className="text-xl font-bold text-white mt-1">{selectedZone.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-bold">Cached Temperature</div>
                  <div className="text-2xl font-mono font-bold text-orange-400 mt-1">
                    {selectedZone.temp.toFixed(1)} deg C
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3">
                  <div className="text-slate-500 text-[11px] uppercase tracking-widest">Zone Code</div>
                  <div className="text-white font-semibold mt-1">{selectedZone.id}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3">
                  <div className="text-slate-500 text-[11px] uppercase tracking-widest">Weather Source</div>
                  <div className="text-white font-semibold mt-1">{selectedZone.temp_source}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3">
                  <div className="text-slate-500 text-[11px] uppercase tracking-widest">Center Latitude</div>
                  <div className="text-white font-semibold mt-1">{selectedZone.center.lat}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3">
                  <div className="text-slate-500 text-[11px] uppercase tracking-widest">Center Longitude</div>
                  <div className="text-white font-semibold mt-1">{selectedZone.center.lng}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="min-h-36 flex items-center justify-center text-sm text-slate-500">
              Pick a constituency on the map to inspect its cached weather baseline.
            </div>
          )}
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500 font-bold mb-3">Hottest Constituencies</div>
          <div className="space-y-2">
            {[...zones]
              .sort((left, right) => right.temp - left.temp)
              .slice(0, 5)
              .map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => onSelectZone(zone.id)}
                  className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                    zone.id === selectedZoneId
                      ? "border-orange-400/40 bg-orange-500/10"
                      : "border-slate-800 bg-slate-900/50 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-white">{zone.name}</span>
                    <span className="text-sm font-mono text-orange-400">{zone.temp.toFixed(1)} deg C</span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
