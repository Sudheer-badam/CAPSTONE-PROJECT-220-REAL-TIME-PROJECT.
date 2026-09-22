import { useState, useEffect } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './services/firebase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MapPage from './pages/MapPage'
import IoTEvents from './pages/IoTEvents'
import ModelMetrics from './pages/ModelMetrics'
import './index.css'

const THEMES = [
  { id: 'blue', primary: '#2F5D7D', light: '#4A84AD' },
  { id: 'purple', primary: '#6b21a8', light: '#9333ea' },
  { id: 'green', primary: '#166534', light: '#22c55e' },
  { id: 'orange', primary: '#9a3412', light: '#f97316' },
  { id: 'pink', primary: '#9d174d', light: '#ec4899' },
  { id: 'dark', primary: '#1a202c', light: '#2d3748' }
];

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = () => {
    signOut(auth).catch(console.error);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '20px' }}>Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app-container">
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
      </main>
    </div>
  )
}

export default App
