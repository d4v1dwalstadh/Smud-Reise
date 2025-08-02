import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import SearchBox from "./SearchBox";
import nvdbService from "../data/nvdbService";
import NVDBDebugger from "./nvdbDebugger"; // Legg til debug-komponenten

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
  const [obstructions, setObstructions] = useState([]);
  const [obstructionsLoading, setObstructionsLoading] = useState(false);
  const [routeWarning, setRouteWarning] = useState(null);
  
  const mapRef = useRef();
  const lastPositionRef = useRef(null);
  const movementTimeoutRef = useRef(null);
  const loadObstructionsTimeoutRef = useRef(null);

  console.log("MapView rendered, vehicle:", vehicle);

  const startFollow = () => {
    setFollow(true);
    if (userLocation && mapRef.current) {
      mapRef.current.flyTo(userLocation, 17);
    }
  };

  const stopFollow = () => {
    setFollow(false);
    const container = document.querySelector(".leaflet-container");
    if (container) {
      container.style.transform = "none";
      container.style.transition = "transform 0.5s ease";
    }
  };

  // Last obstruksjoner når kartet flyttes eller kjøretøy endres
  useEffect(() => {
    const loadObstructionsInView = async () => {
      if (!mapRef.current || !vehicle?.height) {
        setObstructions([]);
        return;
      }
      
      setObstructionsLoading(true);
      try {
        const bounds = mapRef.current.getBounds();
        const bbox = [
          bounds.getWest(),
          bounds.getSouth(), 
          bounds.getEast(),
          bounds.getNorth()
        ];

        console.log('Laster obstruksjoner for kjøretøy høyde:', vehicle.height, 'i bbox:', bbox);
        const obstructionData = await nvdbService.getObstructionsForVehicle(bbox, vehicle.height);
        
        setObstructions(obstructionData);
        console.log(`Lastet ${obstructionData.length} problematiske obstruksjoner`);
        
        // Sjekk om ruten går gjennom noen obstruksjoner
        if (route && obstructionData.length > 0) {
          checkRouteObstructions(route, obstructionData);
        }
        
      } catch (error) {
        console.error('Kunne ikke laste obstruksjonsdata:', error);
        setObstructions([]);
      } finally {
        setObstructionsLoading(false);
      }
    };

    // Debounce lasting av obstruksjoner
    clearTimeout(loadObstructionsTimeoutRef.current);
    loadObstructionsTimeoutRef.current = setTimeout(loadObstructionsInView, 1000);
    
    return () => clearTimeout(loadObstructionsTimeoutRef.current);
  }, [vehicle?.height, userLocation]); // Trigger når kjøretøy eller posisjon endres

  // Last obstruksjoner når kartet flyttes
  useEffect(() => {
    if (!mapRef.current) return;

    const handleMoveEnd = () => {
      const loadObstructions = async () => {
        if (!vehicle?.height) return;
        
        setObstructionsLoading(true);
        try {
          const bounds = mapRef.current.getBounds();
          const bbox = [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
          ];

          const obstructionData = await nvdbService.getObstructionsForVehicle(bbox, vehicle.height);
          setObstructions(obstructionData);
          
          if (route && obstructionData.length > 0) {
            checkRouteObstructions(route, obstructionData);
          }
          
        } catch (error) {
          console.error('Feil ved lasting av obstruksjoner:', error);
        } finally {
          setObstructionsLoading(false);
        }
      };

      clearTimeout(loadObstructionsTimeoutRef.current);
      loadObstructionsTimeoutRef.current = setTimeout(loadObstructions, 500);
    };

    mapRef.current.on('moveend', handleMoveEnd);
    
    return () => {
      if (mapRef.current) {
        mapRef.current.off('moveend', handleMoveEnd);
      }
    };
  }, [vehicle?.height, route]);

  // Sjekk om ruten går gjennom obstruksjoner
  const checkRouteObstructions = (routeCoords, obstructionList) => {
    if (!routeCoords || !obstructionList.length) {
      setRouteWarning(null);
      return;
    }

    const problematicObstructions = obstructionList.filter(obs => {
      if (!obs.coordinates || !obs.isProblematic) return false;
      
      // Sjekk om obstruksjonen er nær ruten (forenklet sjekk)
      return routeCoords.some(routePoint => {
        const distance = calculateDistance(routePoint, obs.coordinates);
        return distance < 50; // 50 meter toleranse
      });
    });

    if (problematicObstructions.length > 0) {
      setRouteWarning({
        count: problematicObstructions.length,
        obstructions: problematicObstructions
      });
    } else {
      setRouteWarning(null);
    }
  };

  useEffect(() => {
    console.log("Starting geolocation watch...");
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        console.log("Position received:", pos.coords);
        const coords = [pos.coords.latitude, pos.coords.longitude];
        
        if (lastPositionRef.current) {
          const distance = calculateDistance(lastPositionRef.current, coords);
          if (distance > 0.5) {
            setIsMoving(true);
            clearTimeout(movementTimeoutRef.current);
            movementTimeoutRef.current = setTimeout(() => {
              setIsMoving(false);
            }, 3000);
          }
        }
        
        setUserLocation(coords);
        setAccuracy(pos.coords.accuracy);
        lastPositionRef.current = coords;
        
        if (pos.coords.heading !== null && pos.coords.heading !== undefined) {
          setHeading(pos.coords.heading);
        }
        
        if (follow && mapRef.current) {
          const currentZoom = mapRef.current.getZoom();
          mapRef.current.flyTo(coords, Math.max(currentZoom, 16), {
            duration: 1.5,
            easeLinearity: 0.25
          });
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        // Sett en standard posisjon (Oslo) hvis geolocation feiler
        setUserLocation([59.91, 10.75]);
      },
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

  function calculateDistance([lat1, lon1], [lat2, lon2]) {
    const R = 6371e3;
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

  useEffect(() => {
    const getRoute = async () => {
      if (!userLocation || !destination) {
        setRoute(null);
        setRouteWarning(null);
        return;
      }

      console.log("Getting route from", userLocation, "to", destination);

      try {
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

        if (!res.ok) {
          throw new Error(`Route API error: ${res.status}`);
        }

        const data = await res.json();
        const coords = data.features[0].geometry.coordinates.map(
          ([lng, lat]) => [lat, lng]
        );

        setRoute(coords);
        console.log("Route loaded successfully");

        // Sjekk obstruksjoner på ny rute
        if (obstructions.length > 0) {
          checkRouteObstructions(coords, obstructions);
        }

      } catch (error) {
        console.error('Feil ved ruteberegning:', error);
        setRoute(null);
        setRouteWarning(null);
      }
    };

    getRoute();
  }, [userLocation, destination, obstructions]);

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

  const createObstructionIcon = (obstruction) => {
    const getIconColor = (type) => {
      switch (type) {
        case 'height_restriction': return '#ff4444';
        case 'tunnel': return '#ff8800';
        case 'underpass': return '#ff6600';
        default: return '#cc0000';
      }
    };

    const getIconSymbol = (type) => {
      switch (type) {
        case 'height_restriction': return '⚠️';
        case 'tunnel': return '🚇';
        case 'underpass': return '🌉';
        default: return '❌';
      }
    };

    const color = getIconColor(obstruction.type);
    const symbol = getIconSymbol(obstruction.type);
    
    return L.divIcon({
      className: "obstruction-marker",
      html: `
        <div style="
          width: 24px;
          height: 24px;
          background: ${color};
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
        ">
          ${symbol}
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  console.log("Rendering MapView...");

  return (
    <div>
      {/* Debug-komponent for testing (kun i development) */}
      {process.env.NODE_ENV === 'development' && <NVDBDebugger />}
      
      <SearchBox
        onSelectPlace={(place) => {
          console.log("Place selected:", place);
          const [lon, lat] = place.geometry.coordinates;
          setDestination([lat, lon]);
          setFollow(false);
        }}
      />

      {/* Status panel */}
      <div style={{
        position: "absolute",
        top: "10px",
        right: "10px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        maxWidth: "280px"
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

        {/* Vehicle info */}
        {vehicle?.height && (
          <div style={{
            backgroundColor: "white",
            padding: "8px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
          }}>
            <div><strong>Kjøretøy:</strong> {vehicle.height}m høy</div>
            {obstructionsLoading && (
              <div style={{ color: '#666', fontSize: '11px' }}>
                Laster høydebegrensninger...
              </div>
            )}
            {!obstructionsLoading && obstructions.length > 0 && (
              <div style={{ color: '#d63384', fontSize: '11px' }}>
                ⚠️ {obstructions.length} problematiske obstruksjoner
              </div>
            )}
            {!obstructionsLoading && obstructions.length === 0 && vehicle.height && (
              <div style={{ color: '#198754', fontSize: '11px' }}>
                ✓ Ingen hindringer i området
              </div>
            )}
          </div>
        )}

        {/* Route warning */}
        {routeWarning && (
          <div style={{
            backgroundColor: "#fff3cd",
            border: "1px solid #ffeaa7",
            color: "#856404",
            padding: "8px 10px",
            borderRadius: "6px",
            fontSize: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}>
            <div style={{ fontWeight: "bold" }}>⚠️ Ruteadvarsel</div>
            <div>
              {routeWarning.count} hindr{routeWarning.count === 1 ? 'ing' : 'inger'} på ruten
            </div>
            <div style={{ fontSize: '10px', marginTop: '4px' }}>
              Sjekk alternative ruter eller kjøretøyhøyde
            </div>
          </div>
        )}

        {/* Debug info */}
        <div style={{
          backgroundColor: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "6px 10px",
          borderRadius: "4px",
          fontSize: "11px"
        }}>
          <div>Posisjon: {userLocation ? 'OK' : 'Venter...'}</div>
          <div>Destinasjon: {destination ? 'Satt' : 'Ingen'}</div>
          <div>Rute: {route ? 'Beregnet' : 'Ingen'}</div>
          <div>Obstruksjoner: {obstructions.length}</div>
        </div>

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

        {/* Obstruction legend */}
        {obstructions.length > 0 && (
          <div style={{
            backgroundColor: "white",
            padding: "8px 10px",
            borderRadius: "6px",
            fontSize: "10px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
          }}>
            <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Symboler:</div>
            <div>⚠️ Høydebegrensning</div>
            <div>🚇 Tunnel</div>
            <div>🌉 Undergang</div>
          </div>
        )}
      </div>

      <MapContainer
        center={[59.91, 10.75]}
        zoom={13}
        style={{ height: "100vh" }}
        whenCreated={(mapInstance) => {
          console.log("Map created:", mapInstance);
          mapRef.current = mapInstance;
        }}
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
        
        {route && (
          <Polyline 
            positions={route} 
            color={routeWarning ? "#ff6b35" : "blue"} 
            weight={4} 
            opacity={0.7} 
          />
        )}

        {/* Vis obstruksjoner på kartet */}
        {obstructions.map((obstruction) => (
          obstruction.coordinates && (
            <Marker
              key={obstruction.id}
              position={obstruction.coordinates}
              icon={createObstructionIcon(obstruction)}
              title={`${obstruction.name}: ${obstruction.description}`}
            />
          )
        ))}

        <MapUpdater coords={destination || userLocation} />
      </MapContainer>
    </div>
  );
}

export default MapView;