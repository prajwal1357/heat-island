import { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function HeatGrid({ gridData, selectedZone, onSelectZone }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!gridData || gridData.length === 0) return;

    const width = 380;
    const height = 380;
    // Perfect 5x5 grid for 25 constituencies
    const cols = 5;
    const cellSize = width / cols;

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Dynamically calculate the extremes of the actual live data to exaggerate fractional micro-climates!
    const tempExtent = d3.extent(gridData, d => d.temp);
    // Add fallback padding incase all data exactly matches
    const minD = tempExtent[0] === tempExtent[1] ? tempExtent[0] - 1 : tempExtent[0];
    const maxD = tempExtent[0] === tempExtent[1] ? tempExtent[1] + 1 : tempExtent[1];

    // Teal (Coolest local area) to Amber (Hottest local area) smooth interpolation.
    const colorScale = d3.scaleSequential(d3.interpolateRgb("#14b8a6", "#f59e0b"))
      .domain([minD, maxD]);

    const cells = svg.selectAll("rect")
      .data(gridData, d => d.id);

    cells.enter()
      .append("rect")
      .attr("x", d => (d.id % cols) * cellSize)
      .attr("y", d => Math.floor(d.id / cols) * cellSize)
      .attr("width", cellSize - 2) // Space grid lines out slightly
      .attr("height", cellSize - 2)
      .attr("rx", 6) // Beautiful rounded edges
      .style("cursor", "pointer")
      .on("click", (event, d) => onSelectZone(d));
      
    // Add Tooltips for constituency names
    cells.enter().selectAll("rect").append("title")
      .text(d => `${d.name || d.id}: ${d.temp}°C`);

    cells.enter().selectAll("rect").merge(cells)
      .transition().duration(400) // Super fluid transitions when models update
      .attr("fill", d => colorScale(d.temp));
      
    // Selection highlight logic
    svg.selectAll("rect")
      .attr("stroke", d => d.id === selectedZone?.id ? "#fff" : "none")
      .attr("stroke-width", d => d.id === selectedZone?.id ? 2 : 0);

  }, [gridData, selectedZone, onSelectZone]);

  return (
    <div className="bg-slate-900 p-6 rounded-2xl shadow-2xl flex flex-col border border-slate-800">
      <div className="flex justify-between items-center w-full mb-5">
        <h2 className="text-lg font-bold tracking-tight text-white mb-0 mt-0 pt-0 pb-0">City Heatmap</h2>
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider">
           <span className="w-3 h-3 rounded bg-amber-500 shadow-sm shadow-amber-500/20"></span>
           <span className="text-slate-400 mr-2">Hot</span>
           <span className="w-3 h-3 rounded bg-teal-500 shadow-sm shadow-teal-500/20"></span>
           <span className="text-slate-400">Cool</span>
        </div>
      </div>
      
      <div className="relative border border-slate-700/50 rounded-xl p-2 bg-slate-950 shadow-inner flex justify-center">
         <svg ref={svgRef}></svg>
      </div>
    </div>
  );
}
