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
  const [accuracy, setAccuracy] = useState(null);
  const [isMoving, setIsMoving] = useState(false);
  const mapRef = useRef();
  const lastPositionRef = useRef(null);
  const movementTimeoutRef = useRef(null);

  const startFollow = () => {
    setFollow(true);
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo(userLocation, 17); // Litt nærmere zoom når vi følger
    }
  };

  const stopFollow = () => {
    setFollow(false);
    // Fjern eventuell rotasjon når vi slutter å følge
    const container = document.querySelector(".leaflet-container");
    if (container) {
      container.style.transform = "none";
      container.style.transition = "transform 0.5s ease";
    }
  };

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        
        // Sjekk om vi beveger oss
        if (lastPositionRef.current) {
          const distance = calculateDistance(lastPositionRef.current, coords);
          if (distance > 0.5) { // 0.5 meter bevegelse
            setIsMoving(true);
            clearTimeout(movementTimeoutRef.current);
            movementTimeoutRef.current = setTimeout(() => {
              setIsMoving(false);
            }, 3000); // Stopp bevegelse-animasjon etter 3 sekunder
          }
        }
        
        setUserLocation(coords);
        setAccuracy(pos.coords.accuracy);
        lastPositionRef.current = coords;
        
        // Oppdater retning hvis tilgjengelig
        if (pos.coords.heading !== null && pos.coords.heading !== undefined) {
          setHeading(pos.coords.heading);
        }
        
        // Følg bruker med smooth animasjon
        if (follow && mapRef.current) {
          const currentZoom = mapRef.current.getZoom();
          mapRef.current.flyTo(coords, Math.max(currentZoom, 16), {
            duration: 1.5,
            easeLinearity: 0.25
          });
        }
      },
      (err) => console.error("Geolocation error:", err),
      { 
        enableHighAccuracy: true, 
        maximumAge: 1000, 
        timeout: 10000 
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(movementTimeoutRef.current);
    };
  }, [follow]);

  // Beregn avstand mellom to koordinater (i meter)
  function calculateDistance([lat1, lon1], [lat2, lon2]) {
    const R = 6371e3; // Jordens radius i meter
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

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

  // Roter kartet basert på retning når vi følger
  useEffect(() => {
    if (!follow || heading === null || heading === undefined) return;
    
    const container = document.querySelector(".leaflet-container");
    if (container) {
      container.style.transition = "transform 0.6s ease";
      container.style.transformOrigin = "center center";
      container.style.transform = `rotate(${-heading}deg)`;
    }
    
    return () => {
      if (!follow && container) {
        container.style.transform = "none";
      }
    };
  }, [heading, follow]);

  // Lag custom ikon for brukerposisjon
  const createUserIcon = () => {
    const size = isMoving ? 40 : 32;
    const pulseAnimation = isMoving ? 'animation: pulse 1.5s infinite;' : '';
    
    return L.divIcon({
      className: "user-location-marker",
      html: `
        <div style="
          transform: rotate(${heading}deg);
          transition: transform 0.3s ease;
          ${pulseAnimation}
        ">
          <div style="
            width: ${size}px;
            height: ${size}px;
            background: #4285f4;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-bottom: 12px solid white;
              transform: translateY(-2px);
            "></div>
          </div>
          ${accuracy && accuracy < 50 ? `
            <div style="
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: ${accuracy * 2}px;
              height: ${accuracy * 2}px;
              background: rgba(66, 133, 244, 0.1);
              border: 1px solid rgba(66, 133, 244, 0.3);
              border-radius: 50%;
              z-index: -1;
            "></div>
          ` : ''}
        </div>
        <style>
          @keyframes pulse {
            0% { transform: scale(1) rotate(${heading}deg); }
            50% { transform: scale(1.1) rotate(${heading}deg); }
            100% { transform: scale(1) rotate(${heading}deg); }
          }
        </style>
      `,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
    });
  };

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

      {/* Kontrollknapper */}
      <div style={{
        position: "absolute",
        top: "10px",
        right: "10px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}>
        <button
          style={{
            padding: "10px 12px",
            backgroundColor: follow ? "#28a745" : "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "bold",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "background-color 0.3s ease"
          }}
          onClick={follow ? stopFollow : startFollow}
        >
          {follow ? "🧭 Følger" : "📍 Følg meg"}
        </button>
        
        {follow && (
          <div style={{
            backgroundColor: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "6px 10px",
            borderRadius: "4px",
            fontSize: "12px",
            textAlign: "center"
          }}>
            {heading !== null ? `${Math.round(heading)}°` : "Ingen retning"}
            {accuracy && <div>±{Math.round(accuracy)}m</div>}
          </div>
        )}
      </div>

      <MapContainer
        center={[59.91, 10.75]}
        zoom={13}
        style={{ height: "100vh" }}
        whenCreated={(mapInstance) => {
          mapRef.current = mapInstance;
        }}
        // Deaktiver rotasjon med dobbelttrykk når vi følger
        doubleClickZoom={!follow}
      >
        <SetMapRef mapRef={mapRef} />
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userLocation && (
          <Marker
            position={userLocation}
            icon={createUserIcon()}
          />
        )}

        {destination && <Marker position={destination} />}
        {route && <Polyline positions={route} color="blue" weight={4} opacity={0.7} />}
        <MapUpdater coords={destination || userLocation} />
      </MapContainer>
    </div>
  );
}

export default MapView;