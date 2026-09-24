import { useState, useEffect, useRef } from 'react';

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a05195', '#d45087'];
const SENTIMENT_COLORS = { 'Positive': '#00C49F', 'Negative': '#FF8042', 'Neutral': '#0088FE' };

export default function Dashboard() {
  const [summary, setSummary] = useState({ total_posts: 0, incident_count: 0, risk_zone_count: 0, recent_events_count: 0 });
  const [sentimentData, setSentimentData] = useState([]);
  const [incidentData, setIncidentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cachedLocation, setCachedLocation] = useState(null);
  const locationRef = useRef(null);

  // Emergency Alarm State
  const [activeAlarm, setActiveAlarm] = useState(null);
  const [alarmStopped, setAlarmStopped] = useState(false);
  const [dangerReason, setDangerReason] = useState("");
  const [dangerRadius, setDangerRadius] = useState(50);
  
  const audioRef = useRef(null);


  const playSiren = () => {
    window.dispatchEvent(new Event('sosAlarmActive'));
    
    if (!audioRef.current) {
      audioRef.current = new Audio('/purge_siren.mp3');
      audioRef.current.loop = true;
    }
    
    // Play the audio
    audioRef.current.play().catch(err => {
      console.warn("Audio playback was blocked by browser. User interaction is needed.", err);
    });
    
    // Try continuous vibration on supported devices
    if (navigator.vibrate) {
      navigator.vibrate([1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000, 500]);
    }
  };

  const stopAlarm = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (navigator.vibrate) {
      navigator.vibrate(0);
    }
    setAlarmStopped(true);
    window.dispatchEvent(new Event('sosAlarmDismissed'));
  };

  const closeBanner = () => {
    setActiveAlarm(null);
    setAlarmStopped(false);
    setDangerReason("");
    setDangerRadius(50);
  };

  useEffect(() => {
    // 1. Listen to analysis_results for sentiment and incidents
    const unsubAnalysis = onSnapshot(collection(db, "analysis_results"), (snapshot) => {
      let pos = 0, neg = 0, neu = 0;
      let incidents = {};
      let incidentCount = 0;
      
      snapshot.forEach(doc => {
        const a = doc.data();
        if (a.sentiment === 'Positive') pos++;
        if (a.sentiment === 'Negative') neg++;
        if (a.sentiment === 'Neutral') neu++;
        
        if (a.incident_type !== 'Other') incidentCount++;
        
        const itype = a.incident_type || 'Unknown';
        incidents[itype] = (incidents[itype] || 0) + 1;
      });
      
      setSentimentData([
        { label: 'Positive', count: pos },
        { label: 'Negative', count: neg },
        { label: 'Neutral', count: neu }
      ]);
      
      setIncidentData(Object.keys(incidents).map(k => ({ incident_type: k, count: incidents[k] })));
      
      setSummary(prev => ({ ...prev, incident_count: incidentCount }));
    });

    // 2. Listen to posts
    const unsubPosts = onSnapshot(collection(db, "posts"), (snapshot) => {
      setSummary(prev => ({ ...prev, total_posts: snapshot.size }));
      setLoading(false); // Posts loaded, we can show dashboard
    }, (error) => {
      console.error("Firebase Error:", error);
      alert("Firebase Connection Error: Please ensure you have created frontend/.env with your Firebase Web Config and restarted the dev server!");
      setLoading(false);
    });

    // 3. Listen to active risk zones
    const unsubZones = onSnapshot(collection(db, "risk_zones"), (snapshot) => {
      let activeZones = 0;
      snapshot.forEach(doc => {
        if (doc.data().status === 'Active') activeZones++;
      });
      setSummary(prev => ({ ...prev, risk_zone_count: activeZones }));
    });

    // 4. Listen to IoT Events
    let isInitialLoad = true;
    const eventsQuery = query(collection(db, "iot_events"), orderBy("created_at", "desc"), limit(50));
    const unsubEvents = onSnapshot(eventsQuery, (snapshot) => {
      setSummary(prev => ({ ...prev, recent_events_count: snapshot.size }));
      
      if (!isInitialLoad) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            if (data.event_type === 'SOS') {
              const loc = locationRef.current;
              console.log("Received SOS Event:", data);
              if (loc && data.latitude && data.longitude) {
                const distance = getDistance(loc.lat, loc.lon, data.latitude, data.longitude);
                console.log(`SOS Distance calculation: ${distance.toFixed(2)} meters from your location.`);
                if (distance <= 50) {
                  setActiveAlarm(data);
                  setAlarmStopped(false);
                  setDangerReason("");
                  setDangerRadius(50);
                  playSiren();
                } else {
                  console.log("SOS ignored: Distance is greater than 50m.");
                }
              } else {
                console.log("SOS ignored: Local location not available. Please allow location access.");
              }
            }
          }
        });
      }
      isInitialLoad = false;
    });

    // 5. Background GPS tracking for instant SOS triggering
    let watchId;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setCachedLocation(loc);
          locationRef.current = loc;
        },
        (err) => console.log("GPS track error:", err),
        { enableHighAccuracy: true }
      );
    }

    // Cleanup listeners on unmount
    return () => {
      unsubAnalysis();
      unsubPosts();
      unsubZones();
      unsubEvents();
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  if (loading) return <div>Loading real-time dashboard...</div>;

  return (
    <div>
      {/* Emergency Alarm Banner Overlay */}
      {activeAlarm && (
        <div className="emergency-banner">
          <style>
            {`
              @keyframes flash { from { background-color: red; } to { background-color: darkred; } }
              .emergency-banner {
                position: fixed; top: 0; left: 0; width: 100%; z-index: 9999;
                background: red; color: white; padding: 20px; text-align: center;
                box-shadow: 0 4px 10px rgba(0,0,0,0.5); animation: flash 1s infinite alternate;
                max-height: 100vh; overflow-y: auto;
                box-sizing: border-box;
              }
              .emergency-banner h1 { margin: 0 0 10px 0; font-size: 32px; }
              .emergency-banner p { font-size: 18px; margin: 5px 0; word-wrap: break-word; }
              .emergency-banner button {
                margin-top: 15px; padding: 15px 30px; font-size: 20px; font-weight: bold;
                background: white; color: red; border: none; border-radius: 8px; cursor: pointer;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
              }
              @media (max-width: 600px) {
                .emergency-banner { padding: 15px 10px; }
                .emergency-banner h1 { font-size: 22px; }
                .emergency-banner p { font-size: 14px; }
                .emergency-banner button { padding: 10px 20px; font-size: 16px; margin-top: 10px; }
              }
            `}
          </style>
          <h1>🚨 EMERGENCY ALARM TRIGGERED 🚨</h1>
          <p><strong>Device:</strong> {activeAlarm.device_code}</p>
          <p><strong>Reason:</strong> {activeAlarm.message || 'SOS Panic Button pressed'}</p>
          <p><strong>Location:</strong> {activeAlarm.latitude}, {activeAlarm.longitude}</p>
          
          {!alarmStopped ? (
            <button onClick={stopAlarm}>
              STOP ALARM
            </button>
          ) : (
            <div style={{ marginTop: '20px', background: 'rgba(0,0,0,0.1)', padding: '15px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 10px 0' }}>Activate Danger Zone</h3>
              <input 
                type="text" 
                placeholder="Reason (e.g. Suspicious Activity)" 
                value={dangerReason} 
                onChange={(e) => setDangerReason(e.target.value)}
                style={{ width: '80%', padding: '10px', fontSize: '16px', borderRadius: '5px', border: 'none', marginBottom: '10px' }}
              />
              <br />
              <input 
                type="number" 
                placeholder="Radius (in meters, e.g. 10)" 
                value={dangerRadius} 
                onChange={(e) => setDangerRadius(e.target.value)}
                style={{ width: '80%', padding: '10px', fontSize: '16px', borderRadius: '5px', border: 'none', marginBottom: '10px' }}
                min="1"
              />
              <br />
              <button 
                style={{ background: '#ffc107', color: '#000', marginRight: '10px' }}
                onClick={async () => {
                  if (!dangerReason) return alert("Please provide a reason to activate the Danger Zone.");
                  if (!dangerRadius || dangerRadius <= 0) return alert("Please provide a valid radius greater than 0.");
                  try {
                    const userName = auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email) : 'Unknown User';
                    const { activateDangerZone } = await import('../services/api');
                    await activateDangerZone({ 
                      device_id: activeAlarm.device_code, 
                      latitude: activeAlarm.latitude, 
                      longitude: activeAlarm.longitude, 
                      reason: dangerReason,
                      user_name: userName,
                      radius_meters: Number(dangerRadius)
                    });
                    closeBanner();
                  } catch (e) {
                    alert("Failed to activate Danger Zone.");
                  }
                }}
              >
                Activate Danger Zone
              </button>
              <button style={{ background: '#6c757d', color: '#fff' }} onClick={closeBanner}>
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}


      <div className="dashboard-grid">
        <div className="stat-card">
          <h3>Total Posts Analyzed</h3>
          <div className="value">{summary.total_posts}</div>
        </div>
        <div className="stat-card">
          <h3>Safety Incidents</h3>
          <div className="value">{summary.incident_count}</div>
        </div>
        <div className="stat-card">
          <h3>Potential Risk Zones</h3>
          <div className="value">{summary.risk_zone_count}</div>
        </div>
        <div className="stat-card">
          <h3>Recent IoT Events</h3>
          <div className="value">{summary.recent_events_count}</div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginTop: '20px', marginBottom: '20px' }}>
        <div className="chart-card" style={{ gridColumn: '1 / -1', background: '#fff3cd', border: '1px solid #ffeeba' }}>
          <h3 style={{ color: '#856404' }}>Hardware Simulator</h3>
          <p style={{ color: '#856404', fontSize: '14px', marginTop: 0 }}>
            Use these buttons to simulate a physical ESP32 device sending data to the backend.
            Because you are using Firebase Realtime Listeners, the dashboard above will update INSTANTLY!
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={async () => {
                if (!cachedLocation) return alert("Waiting for GPS lock... please ensure location access is allowed.");
                try {
                  const userName = auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email) : 'Unknown User';
                  
                  // INSTANT UI FEEDBACK: Trigger alarm locally before network request
                  const fakeEventData = {
                    device_code: 'SIMULATOR-001',
                    latitude: cachedLocation.lat,
                    longitude: cachedLocation.lon,
                    message: 'EMERGENCY! (Locating Street...)',
                    event_type: 'SOS'
                  };
                  setActiveAlarm(fakeEventData);
                  setAlarmStopped(false);
                  setDangerReason("");
                  setDangerRadius(50);
                  playSiren();

                  const { triggerSOS } = await import('../services/api');
                  await triggerSOS({ device_id: 'SIMULATOR-001', latitude: cachedLocation.lat, longitude: cachedLocation.lon, user_name: userName });
                } catch (e) { 
                  console.error(e);
                  alert("Failed to trigger SOS."); 
                }
              }}
              style={{ flex: '1 1 200px', padding: '10px 20px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🚨 Simulate SOS Panic Button
            </button>
            <button 
              onClick={async () => {
                if (!cachedLocation) return alert("Waiting for GPS lock... please ensure location access is allowed.");
                try {
                  const userName = auth.currentUser ? (auth.currentUser.displayName || auth.currentUser.email) : 'Unknown User';
                  const { triggerLocationUpdate } = await import('../services/api');
                  await triggerLocationUpdate({ device_id: 'SIMULATOR-001', latitude: cachedLocation.lat, longitude: cachedLocation.lon, user_name: userName });
                  // Removed blocking alert() so UI renders instantly!
                } catch (e) { alert("Failed to send location update."); }
              }}
              style={{ flex: '1 1 200px', padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              📍 Simulate Location Update
            </button>
          </div>
        </div>
      </div>

      <div className="charts-container">
        <div className="chart-card">
          <h3>Sentiment Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={sentimentData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
                nameKey="label"
                label
              >
                {sentimentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[entry.label] || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Incident Types</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={incidentData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="incident_type" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="var(--primary)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
