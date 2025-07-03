import { useState } from "react";
import MapView from "./components/MapView";
import RoutePlanner from "./components/RoutePlanner";

function App() {
  const [routeCoords, setRouteCoords] = useState([]);

  const handleRouteReady = (coords) => {
    setRouteCoords(coords);
  };

  return (
    <div style={{ height: "100vh", margin: 0 }}>
      {/* RoutePlanner lar brukeren søke etter destinasjon */}
      <RoutePlanner onRouteReady={handleRouteReady} />
      
      {/* MapView viser kart og ruten */}
      <MapView routeCoords={routeCoords} />
    </div>
  );
}

export default App;
