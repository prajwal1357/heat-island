import { useEffect, useState } from "react";
import { getGrid, simulate } from "../api";

export default function Grid() {
  const [grid, setGrid] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    getGrid().then(res => setGrid(res.data));
  }, []);

  const getColor = (temp) => {
    if (temp > 40) return "red";
    if (temp > 35) return "orange";
    return "skyblue";
  };

  const handleClick = (zone) => {
    setSelected(zone);
  };

  const applyChange = async () => {
    const res = await simulate({
      zoneId: selected.id,
      changes: { green_cover: 10 }
    });

    setGrid(prev =>
      prev.map(z => z.id === selected.id ? res.data : z)
    );
  };

  return (
    <div>
      <h2>City Heatmap</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 50px)" }}>
        {grid.map(z => (
          <div
            key={z.id}
            onClick={() => handleClick(z)}
            style={{
              width: 50,
              height: 50,
              background: getColor(z.temp),
              border: "1px solid #000",
              cursor: "pointer"
            }}
          />
        ))}
      </div>

      {selected && (
        <div>
          <h3>Zone {selected.id}</h3>
          <button onClick={applyChange}>Add Trees 🌳</button>
        </div>
      )}
    </div>
  );
}