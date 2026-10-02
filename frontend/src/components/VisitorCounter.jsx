import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

const VisitorCounter = () => {
  const [usersMap, setUsersMap] = useState(new Map());
  const [activeCount, setActiveCount] = useState(0);

  // 1. Maintain a live map of all users and their last_updated times
  useEffect(() => {
    const usersCollection = collection(db, 'live_user_locations');
    const unsubscribe = onSnapshot(usersCollection, (snapshot) => {
      setUsersMap(prevMap => {
        const newMap = new Map(prevMap);
        snapshot.forEach((doc) => {
          newMap.set(doc.id, doc.data().last_updated);
        });
        return newMap;
      });
    });

    return () => unsubscribe();
  }, []);

  // 2. Evaluate the active count locally every 3 seconds
  useEffect(() => {
    const evaluateCount = () => {
      let count = 0;
      const currentTime = new Date().getTime();
      usersMap.forEach((last_updated) => {
        // A user is considered active if their heartbeat was within the last 15 seconds
        if (last_updated && (currentTime - new Date(last_updated).getTime() < 15000)) {
          count++;
        }
      });
      setActiveCount(count);
    };

    evaluateCount(); // Evaluate immediately
    const interval = setInterval(evaluateCount, 3000); // And evaluate constantly
    return () => clearInterval(interval);
  }, [usersMap]);

  // Format the number to always have 7 digits (e.g., 0000021)
  const formattedCount = activeCount.toString().padStart(7, '0');
  const digits = formattedCount.split('');

  return (
    <div style={{
      position: 'fixed',
      bottom: '15px',
      right: '15px',
      backgroundColor: '#2A2A2A',
      padding: '8px 12px',
      borderRadius: '8px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      zIndex: 9000,
      border: '1px solid #111'
    }}>
      <h3 style={{
        color: '#00FF00',
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        letterSpacing: '1px',
        margin: '0 0 6px 0',
        fontSize: '10px',
        textTransform: 'uppercase'
      }}>
        Visitor Counter
      </h3>
      
      <div style={{
        display: 'flex',
        gap: '2px',
        backgroundColor: '#111',
        padding: '4px',
        borderRadius: '4px',
        border: '1px solid #555'
      }}>
        {digits.map((digit, index) => (
          <div key={index} style={{
            backgroundColor: '#222',
            color: '#FFD700',
            fontFamily: 'monospace',
            fontSize: '16px',
            fontWeight: 'bold',
            padding: '2px 6px',
            borderRadius: '2px',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.2)',
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
