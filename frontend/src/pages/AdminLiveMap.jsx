import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { collection, onSnapshot, query } from 'firebase/firestore';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to live_user_locations
    const q = query(collection(db, "live_user_locations"));
    const unsub = onSnapshot(q, (snapshot) => {
      const users = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        // Only show users who have updated their location in the last 10 minutes
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

    return () => unsub();
  }, []);

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
          <MapContainer center={defaultCenter} zoom={13} className="leaflet-container" style={{ height: '600px', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
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
          </MapContainer>
        )}
      </div>
    </div>
  );
}
