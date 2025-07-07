import { useState } from "react";
import "../Style.css";

function VehicleInput({ onVehicleChange }) {
  const [height, setHeight] = useState("");
  const [width, setWidth] = useState("");
  const [length, setLength] = useState("");

  const handleChange = () => {
    onVehicleChange({
      height: parseFloat(height),
      width: parseFloat(width),
      length: parseFloat(length),
    });
  };

  return (
    <div className="vehicle-input">
      <label>
        Høyde (m):
        <input
          type="number"
          step="0.1"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          onBlur={handleChange}
        />
      </label>
      <label>
        Bredde (m):
        <input
          type="number"
          step="0.1"
          value={width}
          onChange={(e) => setWidth(e.target.value)}
          onBlur={handleChange}
        />
      </label>
      <label>
        Lengde (m):
        <input
          type="number"
          step="0.1"
          value={length}
          onChange={(e) => setLength(e.target.value)}
          onBlur={handleChange}
        />
      </label>
    </div>
  );
}

export default VehicleInput;
