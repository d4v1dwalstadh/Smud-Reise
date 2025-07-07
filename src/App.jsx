import { useState } from "react";
import MapView from "./components/MapView";
import VehicleInput from "./components/VehicleInput";

function App() {
  const [vehicle, setVehicle] = useState({ height: 0, width: 0, length: 0 });

  return (
    <div style={{ height: "100vh", margin: 0 }}>
      <VehicleInput onVehicleChange={setVehicle} />
      <MapView vehicle={vehicle} />
    </div>
  );
}

export default App;
