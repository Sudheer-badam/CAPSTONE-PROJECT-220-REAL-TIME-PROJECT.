import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { collection, onSnapshot, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import L from 'leaflet';

// Custom User Location Icon
const LiveUserIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function AdminLiveMap() {
  const [liveUsers, setLiveUsers] = useState([]);
  const [riskZones, setRiskZones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to live_user_locations
    const q = query(collection(db, "live_user_locations"));
    const unsubUsers = onSnapshot(q, (snapshot) => {
      const users = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const now = new Date();
        const lastSeen = new Date(data.last_updated);
        const diffMinutes = (now - lastSeen) / 1000 / 60;
        
        if (data.is_sharing && diffMinutes < 10) {
          users.push({ id: doc.id, ...data });
        }
      });
      setLiveUsers(users);
      setLoading(false);
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
    });

    return () => {
      unsubUsers();
      unsubZones();
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

  const defaultCenter = [16.50, 80.64];

  return (
    <div>
      <div className="chart-card" style={{marginBottom: '20px'}}>
        <h3 style={{ color: 'var(--primary)', marginBottom: '5px' }}>Admin Dashboard: Live User Tracking</h3>
        <p style={{fontSize: '14px', color: '#666', marginTop: '0'}}>
          This map shows the real-time location of all active users who have opted into Live Location sharing.
        </p>
        
        {loading ? (
          <div>Loading live map data...</div>
        ) : (
          <MapContainer center={defaultCenter} zoom={13} className="leaflet-container" style={{ height: '700px', width: '100%', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
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
            
            {liveUsers.map(user => (
              <Marker key={user.id} position={[user.latitude, user.longitude]} icon={LiveUserIcon}>
                <Popup>
                  <div style={{ textAlign: 'center' }}>
                    <strong style={{ fontSize: '16px' }}>{user.user_name}</strong><br/>
                    <span style={{ fontSize: '12px', color: '#666' }}>{user.email}</span><br/>
                    <hr style={{ margin: '5px 0', border: 'none', borderTop: '1px solid #ccc' }} />
                    <strong>Lat:</strong> {user.latitude.toFixed(5)}<br/>
                    <strong>Lng:</strong> {user.longitude.toFixed(5)}<br/>
                    <span style={{ fontSize: '11px', color: 'green' }}>
                      Last Update: {new Date(user.last_updated).toLocaleTimeString()}
                    </span>
                  </div>
                </Popup>
              </Marker>
            ))}

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
          </MapContainer>
        )}
      </div>
    </div>
  );
}
