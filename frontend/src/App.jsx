import { useState, useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, db } from './services/firebase'
import { doc, setDoc } from 'firebase/firestore'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MapPage from './pages/MapPage'
import IoTEvents from './pages/IoTEvents'
import ModelMetrics from './pages/ModelMetrics'
import AdminLiveMap from './pages/AdminLiveMap'
import RiskZoneAlert from './components/RiskZoneAlert'
import './index.css'

const THEMES = [
  { id: 'blue', primary: '#2F5D7D', light: '#4A84AD' },
  { id: 'purple', primary: '#6b21a8', light: '#9333ea' },
  { id: 'green', primary: '#166534', light: '#22c55e' },
  { id: 'orange', primary: '#9a3412', light: '#f97316' },
  { id: 'pink', primary: '#9d174d', light: '#ec4899' },
  { id: 'dark', primary: '#1a202c', light: '#2d3748' }
];

const ADMIN_EMAILS = ['admin@gmail.com']; // Configurable list of admin emails

function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);

  const changeTheme = (theme) => {
    document.documentElement.style.setProperty('--primary', theme.primary);
    document.documentElement.style.setProperty('--primary-light', theme.light);
  };

  return (
    <div className={`theme-switcher ${isOpen ? 'open' : ''}`}>
      <div className="theme-toggle" onClick={() => setIsOpen(!isOpen)}>
        <span className="gear-icon">⚙️</span>
      </div>
      <div className="theme-colors">
        {THEMES.map(t => (
          <button 
            key={t.id} 
            className="color-btn" 
            style={{ backgroundColor: t.primary }}
            onClick={() => { changeTheme(t); setIsOpen(false); }}
          />
        ))}
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSharingLocation, setIsSharingLocation] = useState(() => localStorage.getItem('isSharingLocation') === 'true');
  const [locationError, setLocationError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let watchId;
    if (isSharingLocation && user) {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          async (pos) => {
            setLocationError(null);
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            try {
              const userRef = doc(db, 'live_user_locations', user.uid);
              await setDoc(userRef, {
                user_id: user.uid,
                user_name: user.displayName || user.email || 'Unknown',
                email: user.email,
                latitude: lat,
                longitude: lon,
                is_sharing: true,
                last_updated: new Date().toISOString()
              }, { merge: true });
            } catch (err) {
              console.error("Failed to update live location:", err);
            }
          },
          (err) => {
            console.error("Live location error:", err);
            if (err.code === 1) { // PERMISSION_DENIED
              setLocationError("Location access was denied by your browser. You MUST allow location access in your browser's site settings to use this application.");
              localStorage.setItem('isSharingLocation', 'false');
              setIsSharingLocation(false);
            } else {
              setLocationError("Could not get your location. Please check your GPS signal or ensure location services are enabled on your device.");
            }
          },
          { enableHighAccuracy: true }
        );
      } else {
        setLocationError("Geolocation is not supported by your browser.");
        setIsSharingLocation(false);
      }
    } else if (!isSharingLocation && user) {
      // Mark as not sharing
      const userRef = doc(db, 'live_user_locations', user.uid);
      setDoc(userRef, { is_sharing: false, last_updated: new Date().toISOString() }, { merge: true }).catch(console.error);
      setLocationError("Location sharing is currently turned OFF.");
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isSharingLocation, user]);

  const handleSignOut = () => {
    signOut(auth).catch(console.error);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '20px' }}>Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  if (!isSharingLocation || locationError) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
        height: '100vh', width: '100vw', textAlign: 'center', background: 'var(--primary)',
        color: 'white', position: 'fixed', top: 0, left: 0, zIndex: 9999
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.2)', padding: '50px', borderRadius: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', maxWidth: '600px'
        }}>
          <h2 style={{ fontSize: '32px', marginBottom: '20px' }}>Location Access Required</h2>
          <p style={{ fontSize: '18px', marginBottom: '30px', lineHeight: '1.6' }}>
            {locationError || "To ensure the safety features of this application function correctly, you must share your live location. Please enable location access to enter the platform."}
          </p>
          
          {!isSharingLocation ? (
            <button 
              onClick={() => { 
                setIsSharingLocation(true); 
                localStorage.setItem('isSharingLocation', 'true');
                setLocationError(null); 
              }}
              style={{ padding: '15px 40px', background: '#28a745', color: 'white', fontSize: '20px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
            >
              Enable Location
            </button>
          ) : (
            <button 
              onClick={() => {
                localStorage.setItem('isSharingLocation', 'true');
                setIsSharingLocation(false);
                setTimeout(() => setIsSharingLocation(true), 100);
              }}
              style={{ padding: '15px 40px', background: '#ffc107', color: '#000', fontSize: '20px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
            >
              Retry / I Have Granted Permission
            </button>
          )}

          <div style={{ marginTop: '30px' }}>
            <button 
              onClick={handleSignOut} 
              style={{ 
                padding: '10px 25px', 
                background: 'rgba(255,255,255,0.15)', 
                color: 'white', 
                fontSize: '16px', 
                border: '1px solid rgba(255,255,255,0.3)', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                transition: 'background 0.3s' 
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.25)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <RiskZoneAlert />
      <ThemeSwitcher />
      <header>
        <div className="header-content">
          <img src="/logo.jpeg" alt="Capstone Logo" style={{ height: '60px', borderRadius: '50%' }} />
          <h1 style={{ margin: 0, textAlign: 'center' }}>AI-Based Social Media Sentiment and Trend Analysis Platform for Women’s Safety</h1>
        </div>
        <nav>
          <button 
            className={`nav-dashboard ${activeTab === 'dashboard' ? 'active' : ''}`} 
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`nav-map ${activeTab === 'map' ? 'active' : ''}`} 
            onClick={() => setActiveTab('map')}
          >
            Risk Zones
          </button>
          <button 
            className={`nav-iot ${activeTab === 'iot' ? 'active' : ''}`} 
            onClick={() => setActiveTab('iot')}
          >
            IoT SOS Events
          </button>
          <button 
            className={`nav-metrics ${activeTab === 'metrics' ? 'active' : ''}`} 
            onClick={() => setActiveTab('metrics')}
          >
            Model Performance
          </button>

          {user && ADMIN_EMAILS.includes(user.email) && (
            <button 
              className={`nav-admin-map ${activeTab === 'admin-map' ? 'active' : ''}`} 
              onClick={() => setActiveTab('admin-map')}
              style={{ background: '#dc3545', color: '#fff' }}
            >
              Admin Live Map
            </button>
          )}

          <div style={{ marginLeft: 'auto' }}>
            {/* Location sharing is now permanently active after initial grant */}
          </div>

          <button className="logout-btn" onClick={handleSignOut}>
            Sign Out
          </button>
        </nav>
      </header>

      <main>
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'map' && <MapPage />}
        {activeTab === 'iot' && <IoTEvents />}
        {activeTab === 'metrics' && <ModelMetrics />}
        {activeTab === 'admin-map' && <AdminLiveMap />}
      </main>
    </div>
  )
}

export default App
