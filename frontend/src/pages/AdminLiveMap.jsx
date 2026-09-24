import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, Circle, ScaleControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import L from 'leaflet';

const UserIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const LiveUserIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const AlertIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function AdminLiveMap() {
  const [liveUsers, setLiveUsers] = useState([]);
  const [riskZones, setRiskZones] = useState([]);
  const [sosEvents, setSosEvents] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    // Force re-render every 5 seconds to instantly catch users who leave the site
    const timer = setInterval(() => setCurrentTime(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Listen to live_user_locations
    const q = query(collection(db, "live_user_locations"));
    const unsubUsers = onSnapshot(q, (snapshot) => {
      const users = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.latitude && data.longitude) {
          users.push({ id: doc.id, ...data });
        }
      });
      setLiveUsers(users);
    }, (error) => {
      console.error("Error fetching live_user_locations:", error);
    });

    // Listen to Risk Zones
    const unsubZones = onSnapshot(collection(db, "risk_zones"), (snapshot) => {
      const zones = [];
      snapshot.forEach(docObj => {
        if (docObj.data().status === 'Active') {
          zones.push({ id: docObj.id, ...docObj.data() });
        }
      });
      setRiskZones(zones);
    }, (error) => {
      console.error("Error fetching risk_zones:", error);
    });

    // Listen to active SOS Events
    const unsubSos = onSnapshot(collection(db, "iot_events"), (snapshot) => {
      const events = [];
      snapshot.forEach(docObj => {
        const data = docObj.data();
        if (data.status !== 'Resolved' && data.latitude && data.longitude) {
          events.push({ 
            id: docObj.id, 
            ...data,
            latitude: parseFloat(data.latitude),
            longitude: parseFloat(data.longitude)
          });
        }
      });
      setSosEvents(events);
    }, (error) => {
      console.error("Error fetching iot_events:", error);
    });

    // Listen to Map Interactions (Blue Buttons)
    const unsubInteractions = onSnapshot(collection(db, "map_interactions"), (snapshot) => {
      const inters = [];
      snapshot.forEach(docObj => {
        const data = docObj.data();
        inters.push({ 
          id: docObj.id, 
          ...data
        });
      });
      setInteractions(inters);
    }, (error) => {
      console.error("Error fetching map_interactions:", error);
    });

    return () => {
      unsubUsers();
      unsubZones();
      unsubSos();
      unsubInteractions();
    };
  }, []);

  const handleRemoveZone = async (zoneId) => {
    if (window.confirm("Are you sure you want to resolve and remove this Risk Zone?")) {
      try {
        await updateDoc(doc(db, "risk_zones", zoneId), { status: 'Resolved' });
        alert("Risk Zone successfully removed!");
      } catch (err) {
        console.error("Error removing risk zone:", err);
        alert("Failed to remove Risk Zone.");
      }
    }
  };

  const handleRemoveSos = async (eventId) => {
    if (window.confirm("Are you sure you want to resolve and remove this SOS Alert?")) {
      try {
        await updateDoc(doc(db, "iot_events", eventId), { status: 'Resolved' });
      } catch (err) {
        console.error("Error removing SOS alert:", err);
        alert("Failed to remove SOS Alert.");
      }
    }
  };

  const handleRemoveInteraction = async (interactionId) => {
    if (window.confirm("Are you sure you want to permanently delete this map interaction?")) {
      try {
        await deleteDoc(doc(db, "map_interactions", interactionId));
      } catch (err) {
        console.error("Error removing interaction:", err);
        alert("Failed to remove interaction.");
      }
    }
  };

  const defaultCenter = [16.50, 80.64];

  return (
    <div>
      <div className="chart-card" style={{marginBottom: '20px'}}>
        <h3 style={{ color: 'var(--primary)', marginBottom: '5px' }}>Admin Dashboard: Live User Tracking</h3>
        <p style={{fontSize: '14px', color: '#666', marginTop: '0'}}>
          This map shows the real-time location of all active users who have opted into Live Location sharing.
        </p>
        
        <MapContainer center={defaultCenter} zoom={13} className="leaflet-container" style={{ height: '700px', width: '100%', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
            <ScaleControl position="bottomright" />
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Google Street">
                <TileLayer
                  url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                  attribution="&copy; Google Maps"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Google Satellite">
                <TileLayer
                  url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                  attribution="&copy; Google Maps"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Google Terrain">
                <TileLayer
                  url="https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
                  attribution="&copy; Google Maps"
                />
              </LayersControl.BaseLayer>
            </LayersControl>
            
            {liveUsers.map(user => {
              const lastSeen = new Date(user.last_updated);
              const diffMinutes = (currentTime - lastSeen) / 1000 / 60;
              // RAPID SPEED LIVE: If they updated in the last 15 seconds (0.25 mins), they are LIVE
              const isLiveNow = diffMinutes < 0.25 && user.is_sharing;

              return (
              <Marker key={user.id} position={[user.latitude, user.longitude]} icon={isLiveNow ? LiveUserIcon : UserIcon}>
                <Popup>
                  <div style={{ textAlign: 'center' }}>
                    <strong style={{ fontSize: '16px' }}>{user.user_name}</strong><br/>
                    <span style={{ fontSize: '12px', color: '#666' }}>{user.email}</span><br/>
                    <div style={{ 
                      marginTop: '5px', 
                      padding: '4px 8px', 
                      borderRadius: '12px', 
                      display: 'inline-block',
                      background: isLiveNow ? '#d4edda' : '#f8d7da',
                      color: isLiveNow ? '#155724' : '#721c24',
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}>
                      {isLiveNow ? '🟢 LIVE NOW' : '🔴 NOT IN LIVE'}
                    </div>
                    <hr style={{ margin: '5px 0', border: 'none', borderTop: '1px solid #ccc' }} />
                    <strong>Lat:</strong> {user.latitude.toFixed(5)}<br/>
                    <strong>Lng:</strong> {user.longitude.toFixed(5)}<br/>
                    <span style={{ fontSize: '11px', color: 'green' }}>
                      Last Update: {new Date(user.last_updated).toLocaleTimeString()}
                    </span>
                  </div>
                </Popup>
              </Marker>
            );
          })}

            {/* Render Risk Zones for Admin to Manage */}
            {riskZones.map(zone => (
              <Circle 
                key={`zone-${zone.id}`}
                center={[zone.latitude, zone.longitude]} 
                radius={zone.radius_meters}
                pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.2 }}
              >
                <Popup>
                  <div style={{ textAlign: 'center' }}>
                    <strong style={{ fontSize: '16px', color: 'red' }}>{zone.name}</strong><br/>
                    <span style={{ fontSize: '13px' }}>Reports in area: {zone.report_count}</span><br/>
                    <button 
                      onClick={() => handleRemoveZone(zone.id)}
                      style={{
                        marginTop: '10px', padding: '8px 15px', background: '#dc3545', color: 'white', 
                        border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'
                      }}
                    >
                      Remove Risk Zone
                    </button>
                  </div>
                </Popup>
              </Circle>
            ))}

            {/* Render Active SOS Events for Admin to Manage */}
            {sosEvents.map(ev => (
              <Marker key={`sos-${ev.id}`} position={[ev.latitude, ev.longitude]} icon={AlertIcon}>
                <Popup>
                  <div style={{ textAlign: 'center' }}>
                    <strong style={{ fontSize: '16px', color: 'red' }}>🚨 {ev.event_type} ALERT</strong><br/>
                    <strong>Device:</strong> {ev.device_code}<br/>
                    <span style={{ fontSize: '12px', color: 'gray' }}>{new Date(ev.created_at).toLocaleString()}</span><br/>
                    <button 
                      onClick={() => handleRemoveSos(ev.id)}
                      style={{
                        marginTop: '10px', padding: '8px 15px', background: '#ffc107', color: 'black', 
                        border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'
                      }}
                    >
                      Remove SOS Alert
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Render User Map Interactions (Blue Dots) for Admin to Manage */}
            {interactions.map(inter => (
              <Marker key={`inter-${inter.id}`} position={[inter.click_latitude, inter.click_longitude]} icon={UserIcon}>
                <Popup>
                  <div style={{ textAlign: 'center' }}>
                    <strong style={{ fontSize: '16px', color: '#0d6efd' }}>User Interaction</strong><br/>
                    <strong>IP:</strong> {inter.ip_address}<br/>
                    <span style={{ fontSize: '12px', color: 'gray' }}>{inter.timestamp}</span><br/>
                    <button 
                      onClick={() => handleRemoveInteraction(inter.id)}
                      style={{
                        marginTop: '10px', padding: '8px 15px', background: '#0d6efd', color: 'white', 
                        border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'
                      }}
                    >
                      Delete Interaction
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
      </div>
    </div>
  );
}
