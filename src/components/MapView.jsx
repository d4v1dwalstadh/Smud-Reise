import { MapContainer, TileLayer, Marker, Polyline, useMap, } from "react-leaflet";
import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import SearchBox from "./SearchBox";
import bridges from "../data/bridges.json";

const ORS_API_KEY = "5b3ce3597851110001cf6248bd7caf0c7da04779b64619b78105940c";

function MapUpdater({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 16);
  }, [coords]);
  return null;
}

function SetMapRef({ mapRef }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map]);
  return null;
}

function MapView({ vehicle }) {
  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [follow, setFollow] = useState(false);
  const [heading, setHeading] = useState(0);
  const mapRef = useRef();

  const startFollow = () => {
    setFollow(true);
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo(userLocation, 16);
    }
  };

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(coords);
        if (pos.coords.heading !== null) {
          setHeading(pos.coords.heading);
        }
        if (follow && mapRef.current) {
          mapRef.current.flyTo(coords, mapRef.current.getZoom());
        }
      },
      (err) => console.error("Geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [follow]);

  function isRouteTooLow(routeCoords, vehicleHeight) {
    if (!vehicleHeight) return false;
    const threshold = 0.001; // ca. 100m radius

    for (let bridge of bridges) {
      if (bridge.clearance < vehicleHeight) {
        const [bridgeLat, bridgeLng] = bridge.coordinates;
        for (let [lat, lng] of routeCoords) {
          const dLat = Math.abs(lat - bridgeLat);
          const dLng = Math.abs(lng - bridgeLng);
          if (dLat < threshold && dLng < threshold) {
            console.warn("Rute krysser lav bro:", bridge.name);
            return true;
          }
        }
      }
    }
    return false;
  }

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
            Authorization: ORS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const data = await res.json();
      const coords = data.features[0].geometry.coordinates.map(
        ([lng, lat]) => [lat, lng]
      );

      const tooLow = isRouteTooLow(coords, vehicle?.height);
      if (tooLow) {
        alert("Ruten inneholder en bro som er for lav for kjøretøyet ditt.");
        setRoute(null);
      } else {
        setRoute(coords);
      }
    };

    getRoute();
  }, [userLocation, destination, vehicle]);

  useEffect(() => {
    if (!follow || heading === null) return;
    const container = document.querySelector(".leaflet-container");
    if (container) {
      container.style.transition = "transform 0.3s ease";
      container.style.transform = `rotate(${-heading}deg)`;
    }
    return () => {
      if (container) container.style.transform = "none";
    };
  }, [heading, follow]);

  return (
    <div>
      {/* Søkefelt */}
      <SearchBox
        onSelectPlace={(place) => {
          const [lon, lat] = place.geometry.coordinates;
          setDestination([lat, lon]);
          setFollow(false);
        }}
      />

      {/* Følg meg-knapp */}
      <button
        style={{
          position: "absolute",
          top: "10px",
          left: "280px",
          zIndex: 1000,
          padding: "8px 12px",
          backgroundColor: "#007bff",
          color: "#fff",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
        onClick={startFollow}
      >
        Følg meg
      </button>

      <MapContainer
        center={[59.91, 10.75]}
        zoom={13}
        style={{ height: "100vh" }}
        whenCreated={(mapInstance) => {
          mapRef.current = mapInstance;
        }}
      >
        <SetMapRef mapRef={mapRef} />
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userLocation && (
          <Marker
            position={userLocation}
            icon={L.divIcon({
              className: "user-icon",
              html: `<div style="transform: rotate(${heading}deg);"><img src="https://cdn-icons-png.flaticon.com/512/447/447031.png" width="32" height="32" /></div>`,
              iconSize: [32, 32],
              iconAnchor: [16, 16],
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
