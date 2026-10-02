import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

const VisitorCounter = () => {
  const [activeCount, setActiveCount] = useState(0);
  const [now, setNow] = useState(new Date());

  // Tick every 5 seconds to re-evaluate stale heartbeats
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const usersCollection = collection(db, 'live_user_locations');
    const unsubscribe = onSnapshot(usersCollection, (snapshot) => {
      let count = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        // A user is considered active if their heartbeat was within the last 15 seconds
        if (data.last_updated && (now.getTime() - new Date(data.last_updated).getTime() < 15000)) {
          count++;
        }
      });
      setActiveCount(count);
    });

    return () => unsubscribe();
  }, [now]); // Re-run snapshot evaluation when 'now' updates to filter out dropped users

  // Format the number to always have 7 digits (e.g., 0000021)
  const formattedCount = activeCount.toString().padStart(7, '0');
  const digits = formattedCount.split('');

  return (
    <div style={{
      position: 'fixed',
      bottom: '30px',
      right: '30px',
      backgroundColor: '#2A2A2A',
      padding: '15px 20px',
      borderRadius: '12px',
      boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      zIndex: 9000,
      border: '2px solid #111'
    }}>
      <h3 style={{
        color: '#00FF00',
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        letterSpacing: '2px',
        margin: '0 0 10px 0',
        fontSize: '18px',
        textTransform: 'uppercase'
      }}>
        Visitor Counter
      </h3>
      
      <div style={{
        display: 'flex',
        gap: '4px',
        backgroundColor: '#111',
        padding: '8px',
        borderRadius: '8px',
        border: '2px solid #555'
      }}>
        {digits.map((digit, index) => (
          <div key={index} style={{
            backgroundColor: '#222',
            color: '#FFD700',
            fontFamily: 'monospace',
            fontSize: '28px',
            fontWeight: 'bold',
            padding: '5px 12px',
            borderRadius: '4px',
            boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.2)',
            borderTop: '1px solid #000',
            borderBottom: '1px solid #444'
          }}>
            {digit}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VisitorCounter;
