import { useState, useEffect, useRef } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, db } from './services/firebase'
import { doc, setDoc, collection, onSnapshot } from 'firebase/firestore'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MapPage from './pages/MapPage'
import IoTEvents from './pages/IoTEvents'
import ModelMetrics from './pages/ModelMetrics'
import AdminLiveMap from './pages/AdminLiveMap'
import RiskZoneAlert from './components/RiskZoneAlert'
import BroadcastLive from './pages/BroadcastLive'
import AdminBroadcastViewer from './pages/AdminBroadcastViewer'
import AdminManagerModal from './components/AdminManagerModal'
import VisitorCounter from './components/VisitorCounter'
import './index.css'

const THEMES = [
  { id: 'blue', primary: '#2F5D7D', light: '#4A84AD' },
  { id: 'purple', primary: '#6b21a8', light: '#9333ea' },
  { id: 'green', primary: '#166534', light: '#22c55e' },
  { id: 'orange', primary: '#9a3412', light: '#f97316' },
  { id: 'pink', primary: '#9d174d', light: '#ec4899' },
  { id: 'dark', primary: '#1a202c', light: '#2d3748' }
];

const ADMIN_EMAILS = [
  'badamsudheerreddy@gmail.com',
  '2300033278@kluniversity.in',
  '2300033278cseh2@gmail.com'
]; // Configurable list of admin emails

const getDeviceOS = () => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "Android";
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return "iOS";
  if (/Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown Device";
};

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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [isAdminViewModalOpen, setIsAdminViewModalOpen] = useState(false);
  const [isAdminManagerOpen, setIsAdminManagerOpen] = useState(false);
  const [temporaryAdmins, setTemporaryAdmins] = useState([]);
  const [loadedInitialAdmins, setLoadedInitialAdmins] = useState(false);
  const [adminNotification, setAdminNotification] = useState(null);
  const previousIsTempAdmin = useRef(null);
  const profileDropdownRef = useRef(null);

  // Security Measures: Prevent screenshots, copying, and right-clicks for NON-ADMINS
  useEffect(() => {
    if (user && !isAdmin) {
      const handleKeyDown = (e) => {
        // Prevent PrintScreen, Ctrl+P/S/C, and Mac Cmd+Shift+3/4/5
        if (
          e.key === 'PrintScreen' || 
          (e.ctrlKey && ['p', 's', 'c'].includes(e.key.toLowerCase())) ||
          (e.metaKey && ['p', 's', 'c'].includes(e.key.toLowerCase())) ||
          (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key))
        ) {
          e.preventDefault();
          alert("Security Policy: Screenshots and copying are disabled for non-admins.");
        }
      };

      const handleContextMenu = (e) => {
        e.preventDefault();
      };

      const handleCopy = (e) => {
        e.preventDefault();
      };

      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('copy', handleCopy);

      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      // Prevent touch callouts on iOS (long press to save image)
      document.body.style.webkitTouchCallout = 'none';

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('copy', handleCopy);
        document.body.style.userSelect = 'auto';
        document.body.style.webkitUserSelect = 'auto';
        document.body.style.webkitTouchCallout = 'default';
      };
    } else {
      document.body.style.userSelect = 'auto';
      document.body.style.webkitUserSelect = 'auto';
      document.body.style.webkitTouchCallout = 'default';
    }
  }, [user, isAdmin]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'temporary_admins'), (snapshot) => {
      const admins = [];
      snapshot.forEach(doc => admins.push(doc.id));
      setTemporaryAdmins(admins);
      setLoadedInitialAdmins(true);
    });
    return () => unsub();
  }, []);

  const isOriginalAdmin = user && ADMIN_EMAILS.includes(user.email);
  const isTempAdmin = user && temporaryAdmins.includes(user.email?.toLowerCase());
  const isAdmin = isOriginalAdmin || isTempAdmin;

  useEffect(() => {
    if (!loadedInitialAdmins || !user) return;

    if (previousIsTempAdmin.current === null) {
      previousIsTempAdmin.current = isTempAdmin;
      return;
    }

    if (previousIsTempAdmin.current === false && isTempAdmin === true) {
      setAdminNotification('You have been ADDED as a temporary admin. You now have access to Admin features.');
    } else if (previousIsTempAdmin.current === true && isTempAdmin === false) {
      setAdminNotification('Your Temporary admin rights have been REMOVED by the original admin.');
    }

    previousIsTempAdmin.current = isTempAdmin;
  }, [isTempAdmin, loadedInitialAdmins, user]);

  useEffect(() => {
    let timeout;
    if (adminNotification) {
      timeout = setTimeout(() => {
        setAdminNotification(null);
      }, 10 * 60 * 1000); // 10 minutes
    }
    return () => clearTimeout(timeout);
  }, [adminNotification]);

  useEffect(() => {
    if (activeTab === 'admin-map' && !isAdmin) {
      setActiveTab('dashboard');
    }
    if (isAdminViewModalOpen && !isAdmin) {
      setIsAdminViewModalOpen(false);
    }
  }, [isAdmin, activeTab, isAdminViewModalOpen]);

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
                photo_url: user.photoURL || null,
                latitude: lat,
                longitude: lon,
                is_sharing: true,
                device_os: getDeviceOS(),
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

  // Global Presence Tracker (Admin needs to see them even if not sharing GPS)
  useEffect(() => {
    let presenceInterval;
    if (user) {
      const updatePresence = () => {
        const userRef = doc(db, 'live_user_locations', user.uid);
        setDoc(userRef, { 
          user_id: user.uid,
          user_name: user.displayName || user.email || 'Unknown',
          email: user.email,
          photo_url: user.photoURL || null,
          last_updated: new Date().toISOString(),
          device_os: getDeviceOS(),
          is_online: true
        }, { merge: true }).catch(console.error);
      };
      
      updatePresence(); // Initial write as soon as they enter
      // RAPID SPEED LIVE: Heartbeat every 3 seconds to prove the user is on the website
      presenceInterval = setInterval(updatePresence, 3000);
    }
    return () => {
      if (presenceInterval) clearInterval(presenceInterval);
    };
  }, [user]);

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
      {adminNotification && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 100000,
          background: adminNotification.includes('ADDED') ? '#28a745' : '#dc3545',
          color: 'white', padding: '20px', borderRadius: '8px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', maxWidth: '350px',
          display: 'flex', flexDirection: 'column', gap: '10px', animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <strong style={{ fontSize: '18px' }}>Notification</strong>
            <button 
              onClick={() => setAdminNotification(null)}
              style={{
                background: 'transparent', border: 'none', color: 'white', 
                fontSize: '24px', cursor: 'pointer', lineHeight: '1', padding: '0 5px'
              }}
            >
              &times;
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.4' }}>
            {adminNotification}
          </p>
        </div>
      )}

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

          {isAdmin && (
            <button 
              className={`nav-admin-map ${activeTab === 'admin-map' ? 'active' : ''}`} 
              onClick={() => setActiveTab('admin-map')}
              style={{ background: '#dc3545', color: '#fff' }}
            >
              Admin Live Map
            </button>
          )}

          <div ref={profileDropdownRef} style={{ marginLeft: 'auto', position: 'relative', flex: '0 0 auto' }}>
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)} 
              style={{
                background: 'transparent', border: 'none', color: '#D4AF37', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0', margin: '0'
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#D4AF37', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                {user.displayName ? user.displayName[0].toUpperCase() : (user.email ? user.email[0].toUpperCase() : 'U')}
              </div>
            </button>

            {isProfileOpen && (
              <div className="profile-dropdown-menu">
                <h3 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '18px' }}>
                  {user.displayName || 'Unknown User'}
                </h3>
                <p style={{ margin: '0 0 20px 0', color: '#888', fontSize: '14px', wordBreak: 'break-all' }}>
                  {user.email}
                </p>

                {isAdmin ? (
                  <>
                    <button 
                      onClick={() => { setIsAdminViewModalOpen(true); setIsProfileOpen(false); }}
                      style={{
                        width: '100%', padding: '12px', background: '#D4AF37', color: '#000',
                        border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        marginBottom: '10px', fontSize: '16px'
                      }}
                    >
                      Admin Live View
                    </button>
                    {isOriginalAdmin && (
                      <button 
                        onClick={() => { setIsAdminManagerOpen(true); setIsProfileOpen(false); }}
                        style={{
                          width: '100%', padding: '12px', background: '#28a745', color: '#fff',
                          border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                          marginBottom: '10px', fontSize: '16px'
                        }}
                      >
                        Manage Temp Admins
                      </button>
                    )}
                  </>
                ) : (
                  <button 
                    onClick={() => { setIsBroadcastModalOpen(true); setIsProfileOpen(false); }}
                    style={{
                      width: '100%', padding: '12px', background: '#D4AF37', color: '#000',
                      border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      marginBottom: '10px', fontSize: '16px'
                    }}
                  >
                    Broadcast Live
                  </button>
                )}

                <button 
                  onClick={handleSignOut}
                  style={{
                    width: '100%', padding: '12px', background: '#D32F2F', color: '#fff',
                    border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    fontSize: '16px'
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      <BroadcastLive 
        isOpen={isBroadcastModalOpen} 
        onClose={() => setIsBroadcastModalOpen(false)} 
      />

      {isAdminViewModalOpen && (
        <AdminBroadcastViewer onClose={() => setIsAdminViewModalOpen(false)} />
      )}
      
      <AdminManagerModal 
        isOpen={isAdminManagerOpen} 
        onClose={() => setIsAdminManagerOpen(false)} 
      />

      <main>
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'map' && <MapPage />}
        {activeTab === 'iot' && <IoTEvents />}
        {activeTab === 'metrics' && <ModelMetrics />}
        {activeTab === 'admin-map' && <AdminLiveMap />}
      </main>

      <footer style={{ textAlign: 'center', padding: '30px 0 10px 0', color: '#64748b', fontSize: '13px', marginTop: 'auto' }}>
        &copy; {new Date().getFullYear()} Capstone Project Group Batch No. 220. All rights reserved.
      </footer>
      
      {user && <VisitorCounter isAdmin={isAdmin} />}
    </div>
  )
}

export default App
