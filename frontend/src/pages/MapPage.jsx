import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, LayersControl, useMapEvents, ScaleControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

// Fix Leaflet marker icon issue in React
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom blue icon for user clicks
const UserIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom red icon for IoT SOS Alerts
const AlertIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapInteractionHandler() {
  useMapEvents({
    click: async (e) => {
      const clickLat = e.latlng.lat;
      const clickLng = e.latlng.lng;
      
      console.log(`Map clicked at: ${clickLat}, ${clickLng}`);

      // Ask for real GPS location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const realLat = position.coords.latitude;
          const realLng = position.coords.longitude;
          
          try {
            // Get IP Address
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipRes.json();
            
            // Save to Firebase
            await addDoc(collection(db, 'map_interactions'), {
              click_latitude: clickLat,
              click_longitude: clickLng,
              real_latitude: realLat,
              real_longitude: realLng,
              ip_address: ipData.ip,
              user_agent: navigator.userAgent,
              timestamp: new Date().toISOString()
            });
            
            console.log("Interaction saved to Firebase!");
          } catch (error) {
            console.error("Error saving interaction:", error);
          }
        }, (error) => {
          console.error("Geolocation error:", error.message);
          alert("Please allow location access to use this feature.");
        });
      } else {
        alert("Geolocation is not supported by this browser.");
      }
    }
  });
  return null;
}

export default function MapPage() {
  const [riskZones, setRiskZones] = useState([]);
  const [locations, setLocations] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [iotEvents, setIotEvents] = useState([]);

  useEffect(() => {
    // 1. Listen to Risk Zones
    const unsubZones = onSnapshot(collection(db, "risk_zones"), (snapshot) => {
      const zones = [];
      snapshot.forEach(doc => {
        if (doc.data().status === 'Active') {
          zones.push({ id: doc.id, ...doc.data() });
        }
      });
      setRiskZones(zones);
    });

    // 2. Listen to Posts for Incidents/Locations
    const unsubPosts = onSnapshot(collection(db, "posts"), (snapshot) => {
      const locs = [];
      snapshot.forEach(doc => {
        const p = doc.data();
        if (p.latitude && p.longitude) {
          locs.push({
            id: doc.id,
            location: p.location,
            latitude: p.latitude,
            longitude: p.longitude,
            incident_type: p.incident_type || "Unknown",
            sentiment: p.sentiment || "Unknown"
          });
        }
      });
      setLocations(locs);
    });

    // 3. Listen to User Map Interactions (Clicks + Geolocation)
    const unsubInteractions = onSnapshot(collection(db, "map_interactions"), (snapshot) => {
      const inter = [];
      snapshot.forEach(doc => {
        inter.push({ id: doc.id, ...doc.data() });
      });
      setInteractions(inter);
    });

    // 4. Listen to Real-Time IoT Events from Hardware/Simulator
    const unsubIot = onSnapshot(collection(db, "iot_events"), (snapshot) => {
      const events = [];
      snapshot.forEach(doc => {
        const p = doc.data();
        if (p.latitude && p.longitude) {
          events.push({
            id: doc.id,
            device_code: p.device_code,
            event_type: p.event_type,
            message: p.message,
            latitude: p.latitude,
            longitude: p.longitude,
            created_at: p.created_at
          });
        }
      });
      setIotEvents(events);
    });

    return () => {
      unsubZones();
      unsubPosts();
      unsubInteractions();
      unsubIot();
    };
  }, []);

  const defaultCenter = [16.50, 80.64];

  return (
    <div>
      <div className="chart-card" style={{marginBottom: '20px'}}>
        <h3>Advanced Interactive Risk Map</h3>
        <p style={{fontSize: '14px', color: '#666', marginTop: '0'}}>
          Click anywhere on the map to log an interaction. It will request your actual device location and log your IP securely to Firebase.
        </p>
        
        <MapContainer center={defaultCenter} zoom={13} className="leaflet-container">
          <ScaleControl position="bottomright" />
          <LayersControl position="topright">
            
            <LayersControl.BaseLayer checked name="OpenStreetMap (Street)">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Google Satellite (with Labels)">
              <TileLayer
                attribution="&copy; Google Maps"
                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="OpenTopoMap (Terrain)">
              <TileLayer
                attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>

          </LayersControl>

          {/* Handler for clicking on the map */}
          <MapInteractionHandler />
          
          {/* Individual Report Markers */}
          {locations.map(loc => (
            <Marker key={`loc-${loc.id}`} position={[loc.latitude, loc.longitude]}>
              <Popup>
                <strong>{loc.location}</strong><br/>
                Incident: {loc.incident_type}<br/>
                Sentiment: {loc.sentiment}
              </Popup>
            </Marker>
          ))}

          {/* User Interaction Markers (Blue) */}
          {interactions.map(inter => (
            <Marker key={`inter-${inter.id}`} position={[inter.click_latitude, inter.click_longitude]} icon={UserIcon}>
              <Popup>
                <strong>User Interaction</strong><br/>
                <strong>IP:</strong> {inter.ip_address}<br/>
                <strong>Clicked Map Coords:</strong> {inter.click_latitude.toFixed(4)}, {inter.click_longitude.toFixed(4)}<br/>
                <strong>Real Device GPS:</strong> {inter.real_latitude.toFixed(4)}, {inter.real_longitude.toFixed(4)}<br/>
                <span style={{fontSize: '10px', color: 'gray'}}>{inter.timestamp}</span>
              </Popup>
            </Marker>
          ))}

          {/* IoT Event Markers (Red) */}
          {iotEvents.map(ev => (
            <Marker key={`iot-${ev.id}`} position={[ev.latitude, ev.longitude]} icon={AlertIcon}>
              <Popup>
                <strong>🚨 {ev.event_type} ALERT</strong><br/>
                <strong>Device:</strong> {ev.device_code}<br/>
                <strong>Message:</strong> {ev.message}<br/>
                <strong>Location:</strong> {ev.latitude.toFixed(4)}, {ev.longitude.toFixed(4)}<br/>
                <span style={{fontSize: '10px', color: 'gray'}}>{new Date(ev.created_at).toLocaleString()}</span>
              </Popup>
            </Marker>
          ))}

          {/* Risk Zone Circles */}
          {riskZones.map(zone => (
            <Circle 
              key={`zone-${zone.id}`}
              center={[zone.latitude, zone.longitude]} 
              radius={zone.radius_meters}
              pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.2 }}
            >
              <Popup>
                <strong>{zone.name}</strong><br/>
                Reports in area: {zone.report_count}
              </Popup>
            </Circle>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
