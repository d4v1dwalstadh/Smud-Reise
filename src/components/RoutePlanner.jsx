// src/components/RoutePlanner.jsx
import { useState } from 'react';
import axios from 'axios';

function RoutePlanner({ onRouteReady }) {
  const [destination, setDestination] = useState('');

  const handleSearch = async () => {
    try {
      const response = await axios.get('https://api.openrouteservice.org/geocode/search', {
        params: {
          api_key: '5b3ce3597851110001cf6248bd7caf0c7da04779b64619b78105940c',
          text: destination,
        },
      });

      const [lon, lat] = response.data.features[0].geometry.coordinates;
      onRouteReady([lat, lon]);
    } catch (error) {
      console.error('Feil ved søk:', error);
    }
  };

  return (
    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, backgroundColor: 'white', padding: 8 }}>
      <input
        type="text"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        placeholder="Skriv inn destinasjon"
      />
      <button onClick={handleSearch}>Søk</button>
    </div>
  );
}

export default RoutePlanner;
