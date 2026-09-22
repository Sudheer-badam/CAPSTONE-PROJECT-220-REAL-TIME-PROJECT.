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

export default function RiskZoneAlert() {
  const [userLocation, setUserLocation] = useState(null);
  const [riskZones, setRiskZones] = useState([]);
  const [activeAlertZone, setActiveAlertZone] = useState(null);
  const [dismissedZoneId, setDismissedZoneId] = useState(null);

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
    if (!userLocation || riskZones.length === 0) return;

    let foundZone = null;
    for (const zone of riskZones) {
      // Don't alert again for a dismissed zone until they leave and re-enter, or just ignore if dismissed
      if (zone.id === dismissedZoneId) continue;
      
      const dist = getDistanceInMeters(
        userLocation.latitude, 
        userLocation.longitude, 
        zone.latitude, 
        zone.longitude
      );
      
      if (dist <= (zone.radius_meters || 300)) {
        foundZone = zone;
        break;
      }
    }

    setActiveAlertZone(foundZone);
  }, [userLocation, riskZones, dismissedZoneId]);

  if (!activeAlertZone) return null;

  return (
    <div className="risk-zone-alert-banner">
      <style>
        {`
          @keyframes slideDown { from { top: -100px; opacity: 0; } to { top: 0; opacity: 1; } }
          @keyframes pulseRed { 0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7); } 70% { box-shadow: 0 0 0 20px rgba(220, 53, 69, 0); } 100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); } }
          .risk-zone-alert-banner {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            z-index: 10000;
            background: linear-gradient(135deg, #ff416c, #ff4b2b);
            color: white;
            text-align: center;
            padding: 20px;
            box-sizing: border-box;
            animation: slideDown 0.5s ease-out, pulseRed 2s infinite;
            border-bottom: 4px solid #8b0000;
          }
          .risk-zone-alert-banner h2 {
            margin: 0 0 10px 0;
            font-size: 28px;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          .risk-zone-alert-banner p {
            margin: 5px 0;
            font-size: 18px;
          }
          .reporters-list {
            background: rgba(0,0,0,0.2);
            padding: 10px;
            border-radius: 8px;
            margin-top: 10px;
            display: inline-block;
          }
          .dismiss-btn {
            position: absolute;
            top: 15px;
            right: 20px;
            background: transparent;
            border: 2px solid white;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s;
          }
          .dismiss-btn:hover {
            background: white;
            color: #ff4b2b;
          }
        `}
      </style>
      <button className="dismiss-btn" onClick={() => {
        setDismissedZoneId(activeAlertZone.id);
        setActiveAlertZone(null);
      }}>Dismiss</button>
      <h2>⚠️ Warning: You have entered a Risk Zone! ⚠️</h2>
      <p><strong>Location:</strong> {activeAlertZone.name.replace("Potential Risk Zone: ", "")}</p>
      
      {activeAlertZone.reporters && activeAlertZone.reporters.length > 0 && (
        <div className="reporters-list">
          <strong>This zone was reported by:</strong>
          <br />
          {activeAlertZone.reporters.join(', ')}
        </div>
      )}
    </div>
  );
}
