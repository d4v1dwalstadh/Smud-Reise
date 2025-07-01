import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './style.css' // eller ./index.css hvis du bruker det
import 'leaflet/dist/leaflet.css' // Import Leaflet CSS for map styling

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
