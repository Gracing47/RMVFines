import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Leg } from "@/lib/rmv-api";
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon issue in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapDisplayProps {
  startLeg: Leg;
  endLeg: Leg;
}

// Component to update map view when props change
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 11);
  }, [center, map]);
  return null;
}

export function MapDisplay({ startLeg, endLeg }: MapDisplayProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    // Get user's current GPS location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  // Default to Frankfurt if no coordinates available
  const startPos: [number, number] = [
    startLeg.Origin.lat || 50.1109, 
    startLeg.Origin.lon || 8.6821
  ];
  
  const endPos: [number, number] = [
    endLeg.Destination.lat || 50.0782, 
    endLeg.Destination.lon || 8.2397
  ];

  // Center map between start and end roughly
  const centerPos: [number, number] = [
    (startPos[0] + endPos[0]) / 2,
    (startPos[1] + endPos[1]) / 2
  ];

  return (
    <MapContainer 
      center={centerPos} 
      zoom={11} 
      scrollWheelZoom={false} 
      className="h-full w-full"
      style={{ background: 'transparent' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      
      <MapUpdater center={centerPos} />

      {/* Start Marker */}
      <Marker position={startPos}>
        <Popup>
          Start: {startLeg.Origin.name}
        </Popup>
      </Marker>

      {/* End Marker */}
      <Marker position={endPos}>
        <Popup>
          Ziel: {endLeg.Destination.name}
        </Popup>
      </Marker>

      {/* User GPS Location (if available) */}
      {userLocation && (
        <Marker position={userLocation} opacity={0.7}>
          <Popup>Dein Standort</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
