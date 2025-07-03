import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import { useEffect, useState } from "react";
import L from "leaflet";
import SearchBox from "./SearchBox";

const ORS_API_KEY = "5b3ce3597851110001cf6248bd7caf0c7da04779b64619b78105940c";

function MapView() {
  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);

  // Hent brukerens posisjon én gang
  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const coords = [pos.coords.latitude, pos.coords.longitude];
      setUserLocation(coords);
    });
  }, []);

  // Hent rute når bruker og destinasjon er klare
  useEffect(() => {
    const getRoute = async () => {
      if (!userLocation || !destination) return;

      const body = {
        coordinates: [
          [userLocation[1], userLocation[0]],
          [destination[1], destination[0]],
        ],
      };

      const res = await fetch(
        `https://api.openrouteservice.org/v2/directions/driving-car/geojson`,
        {
          method: "POST",
          headers: {
            "Authorization": ORS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const data = await res.json();
      const coords = data.features[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      setRoute(coords);
    };

    getRoute();
  }, [userLocation, destination]);

  function MapUpdater({ coords }) {
    const map = useMap();
    useEffect(() => {
      if (coords) map.flyTo(coords, 13);
    }, [coords]);
    return null;
  }

  return (
    <div>
      <SearchBox
        onSelectPlace={(place) => {
          const [lon, lat] = place.geometry.coordinates;
          setDestination([lat, lon]);
        }}
      />
      <MapContainer center={[59.91, 10.75]} zoom={13} style={{ height: "100vh" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {userLocation && (
          <Marker
            position={userLocation}
            icon={L.icon({
              iconUrl: "https://cdn-icons-png.flaticon.com/512/447/447031.png",
              iconSize: [32, 32],
            })}
          />
        )}
        {destination && <Marker position={destination} />}
        {route && <Polyline positions={route} color="blue" />}
        <MapUpdater coords={destination || userLocation} />
      </MapContainer>
    </div>
  );
}

export default MapView;
