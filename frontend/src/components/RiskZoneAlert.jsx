import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

// Haversine formula to calculate distance between two lat/lngs in meters
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Calculate bearing from point 1 to point 2
function getBearing(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;

  const p1 = lat1 * toRad;
  const p2 = lat2 * toRad;
  const dl = (lon2 - lon1) * toRad;

  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  
  let brng = Math.atan2(y, x) * toDeg;
  return (brng + 360) % 360;
}

// Convert bearing to compass direction string
function getCompassDirection(bearing) {
  const directions = ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"];
  const index = Math.round(((bearing %= 360) < 0 ? bearing + 360 : bearing) / 45) % 8;
  return directions[index];
}

// Calculate a destination point given distance and bearing
function getDestinationPoint(lat, lon, distance, bearing) {
  const R = 6371e3;
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;

  const p1 = lat * toRad;
  const l1 = lon * toRad;
  const brng = bearing * toRad;

  const p2 = Math.asin(Math.sin(p1) * Math.cos(distance / R) + Math.cos(p1) * Math.sin(distance / R) * Math.cos(brng));
  const l2 = l1 + Math.atan2(Math.sin(brng) * Math.sin(distance / R) * Math.cos(p1), Math.cos(distance / R) - Math.sin(p1) * Math.sin(p2));

  return { latitude: p2 * toDeg, longitude: l2 * toDeg };
}

export default function RiskZoneAlert() {
  const [userLocation, setUserLocation] = useState(null);
  const [riskZones, setRiskZones] = useState([]);
  const [activeAlertZone, setActiveAlertZone] = useState(null);
  const [resolvedAddress, setResolvedAddress] = useState("");

  // Fetch active risk zones
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "risk_zones"), (snapshot) => {
      const zones = [];
      snapshot.forEach(doc => {
        if (doc.data().status === 'Active') {
          zones.push({ id: doc.id, ...doc.data() });
        }
      });
      setRiskZones(zones);
    });
    return () => unsub();
  }, []);

  // Track user location
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        console.error("Error watching position:", error.message);
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Check if user is in any risk zone
  useEffect(() => {
    if (!userLocation || riskZones.length === 0) {
      setActiveAlertZone(null);
      return;
    }

    let foundZone = null;
    for (const zone of riskZones) {
      const dist = getDistanceInMeters(
        userLocation.latitude, 
        userLocation.longitude, 
        zone.latitude, 
        zone.longitude
      );
      
      if (dist <= (zone.radius_meters || 50)) {
        foundZone = { ...zone, currentDistance: dist };
        break;
      }
    }

    setActiveAlertZone(foundZone);
  }, [userLocation, riskZones]);

  // Resolve address dynamically for the active zone
  useEffect(() => {
    if (activeAlertZone) {
      let locName = activeAlertZone.name.replace("Potential Risk Zone: ", "");
      if (locName === "Emergency Location" || locName === "Unknown Location") {
        setResolvedAddress("Resolving street address...");
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${activeAlertZone.latitude}&lon=${activeAlertZone.longitude}`)
          .then(res => res.json())
          .then(data => {
            if (data && data.display_name) {
              setResolvedAddress(data.display_name);
            } else {
              setResolvedAddress("Address not found");
            }
          })
          .catch(() => setResolvedAddress("Address resolution failed"));
      } else {
        setResolvedAddress(locName);
      }
    } else {
      setResolvedAddress("");
    }
  }, [activeAlertZone]);

  if (!activeAlertZone) return null;

  // Calculate Escape Route
  const radius = activeAlertZone.radius_meters || 50;
  const distanceToEdge = Math.max(0, Math.round(radius - activeAlertZone.currentDistance) + 50);
  
  // Bearing from zone center to user
  const bearingOut = getBearing(activeAlertZone.latitude, activeAlertZone.longitude, userLocation.latitude, userLocation.longitude);
  const compassDirection = getCompassDirection(bearingOut);
  
  const safePoint = getDestinationPoint(userLocation.latitude, userLocation.longitude, distanceToEdge, bearingOut);
  
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${safePoint.latitude},${safePoint.longitude}&travelmode=walking`;

  return (
    <div className="risk-zone-modal-overlay">
      <style>
        {`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes scaleUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          @keyframes pulseRed { 0% { box-shadow: 0 8px 32px 0 rgba(220, 53, 69, 0.37); } 50% { box-shadow: 0 8px 32px 0 rgba(220, 53, 69, 0.7); } 100% { box-shadow: 0 8px 32px 0 rgba(220, 53, 69, 0.37); } }
          
          .risk-zone-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease-out;
          }
          
          .risk-zone-glass-modal {
            background: rgba(40, 10, 10, 0.65);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 100, 100, 0.3);
            border-radius: 20px;
            padding: 30px;
            width: 90%;
            max-width: 500px;
            color: #fff;
            text-align: center;
            animation: scaleUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, pulseRed 2s infinite;
            position: relative;
            box-shadow: 0 8px 32px 0 rgba(220, 53, 69, 0.37);
          }
          
          .risk-zone-glass-modal h2 {
            margin: 0 0 15px 0;
            color: #ff4d4d;
            font-size: 26px;
            text-transform: uppercase;
            letter-spacing: 2px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.5);
          }
          
          .risk-info-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
            text-align: left;
            background: rgba(0, 0, 0, 0.3);
            padding: 15px;
            border-radius: 12px;
            margin-bottom: 20px;
            border: 1px solid rgba(255,255,255,0.1);
          }
          
          .risk-info-item {
            display: flex;
            flex-direction: column;
          }
          
          .risk-info-label {
            font-size: 12px;
            color: #ffb3b3;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 2px;
          }
          
          .risk-info-value {
            font-size: 14px;
            font-weight: bold;
            word-wrap: break-word;
            line-height: 1.4;
          }

          .reporters-section {
            text-align: left;
            margin-bottom: 20px;
          }

          .reporters-list {
            background: rgba(255,255,255,0.05);
            padding: 10px 15px;
            border-radius: 8px;
            margin-top: 5px;
            max-height: 120px;
            overflow-y: auto;
            border: 1px solid rgba(255,255,255,0.05);
          }
          
          .reporters-list ul {
            margin: 0;
            padding-left: 20px;
          }
          
          .reporters-list li {
            margin-bottom: 4px;
            font-size: 14px;
          }
          
          .dismiss-btn {
            position: absolute;
            top: 15px;
            right: 15px;
            background: rgba(255,255,255,0.1);
            border: none;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            cursor: pointer;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
          }
          .dismiss-btn:hover {
            background: rgba(255, 50, 50, 0.8);
          }
          
          .escape-btn {
            display: block;
            width: 100%;
            background: linear-gradient(135deg, #28a745, #218838);
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: bold;
            font-size: 16px;
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);
            transition: transform 0.2s, box-shadow 0.2s;
            box-sizing: border-box;
          }
          .escape-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(40, 167, 69, 0.6);
          }

          .compass-widget {
            position: absolute;
            bottom: 80px;
            right: 20px;
            width: 70px;
            height: 70px;
            background: rgba(0, 0, 0, 0.5);
            border: 2px solid rgba(255, 193, 7, 0.4);
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            z-index: 10;
          }
          
          .compass-arrow {
            transition: transform 0.5s ease-out;
            margin-bottom: 2px;
          }
          
          .compass-dist-text {
            font-size: 11px;
            color: #ffc107;
            font-weight: bold;
            text-shadow: 0 1px 2px rgba(0,0,0,0.8);
          }

          /* Mobile Layout Improvements */
          @media (max-width: 480px) {
            .risk-zone-glass-modal {
              width: 95%;
              padding: 20px 15px;
              border-radius: 15px;
            }
            .risk-zone-glass-modal h2 {
              font-size: 20px;
              margin-bottom: 10px;
            }
            .risk-info-grid {
              gap: 8px;
              padding: 10px;
              margin-bottom: 15px;
            }
            .risk-info-label {
              font-size: 10px;
            }
            .risk-info-value {
              font-size: 14px;
            }
            .reporters-section {
              margin-bottom: 15px;
            }
            .reporters-list {
              max-height: 90px;
              padding: 8px 10px;
            }
            .reporters-list li {
              font-size: 12px;
            }
            .escape-btn {
              padding: 12px;
              font-size: 14px;
            }
            .compass-widget {
              bottom: 70px;
              right: 15px;
              width: 60px;
              height: 60px;
            }
            .compass-dist-text {
              font-size: 10px;
            }
          }
        `}
      </style>
      
      <div className="risk-zone-glass-modal">
        <h2>⚠️ DANGER ZONE ⚠️</h2>
        
        <div className="risk-info-grid">
          <div className="risk-info-item">
            <span className="risk-info-label">Risk Area (Street)</span>
            <span className="risk-info-value" style={{ fontSize: '13px' }}>{resolvedAddress}</span>
          </div>
          <div className="risk-info-item">
            <span className="risk-info-label">Coordinates</span>
            <span className="risk-info-value" style={{ fontFamily: 'monospace', color: '#ffcccc' }}>
              Lat: {activeAlertZone.latitude.toFixed(6)} <br/>
              Lng: {activeAlertZone.longitude.toFixed(6)}
            </span>
          </div>
          <div className="risk-info-item">
            <span className="risk-info-label">Escape Direction</span>
            <span className="risk-info-value" style={{color: '#ffc107'}}>
              Walk {distanceToEdge} meters heading {compassDirection}
            </span>
          </div>
        </div>
        
        {activeAlertZone.reporters && activeAlertZone.reporters.length > 0 && (
          <div className="reporters-section">
            <span className="risk-info-label">Reported By</span>
            <div className="reporters-list">
              <ul>
                {activeAlertZone.reporters.map((rep, idx) => (
                  <li key={idx}>
                    {rep.name || rep} 
                    {rep.time && <span style={{fontSize: '12px', color: '#aaa', marginLeft: '5px'}}>
                      ({rep.time !== 'Unknown Time' ? new Date(rep.time).toLocaleString() : 'Unknown Time'})
                    </span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        
        <div className="compass-widget" title={`Head ${compassDirection}`}>
          <svg className="compass-arrow" style={{ transform: `rotate(${bearingOut}deg)` }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffc107" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
          </svg>
          <span className="compass-dist-text">{distanceToEdge}m</span>
        </div>
        
        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="escape-btn">
          🗺️ Open Safe Escape Route
        </a>
      </div>
    </div>
  );
}
