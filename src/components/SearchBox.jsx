import { useState } from "react";

const SearchBox = ({ onSelectPlace }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const handleSearch = async (e) => {
    const value = e.target.value;
    setQuery(value);

    if (value.length < 3) {
      setResults([]);
      return;
    }

    const res = await fetch(
      `https://api.openrouteservice.org/geocode/search?api_key=5b3ce3597851110001cf6248bd7caf0c7da04779b64619b78105940c&text=${value}&size=5`
    );
    const data = await res.json();
    setResults(data.features);
  };

  return (
    <div className="search-box">
      <input
        type="text"
        value={query}
        onChange={handleSearch}
        placeholder="Søk etter et sted..."
      />
      {results.length > 0 && (
        <ul className="results">
          {results.map((place, i) => (
            <li key={i} onClick={() => onSelectPlace(place)}>
              {place.properties.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchBox;
