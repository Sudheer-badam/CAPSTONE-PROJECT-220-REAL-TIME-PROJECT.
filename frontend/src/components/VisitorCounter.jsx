import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

const VisitorCounter = () => {
  const [usersMap, setUsersMap] = useState(new Map());
  const [activeCount, setActiveCount] = useState(0);
  const [showList, setShowList] = useState(false);

  // 1. Maintain a live map of all users and their data
  useEffect(() => {
    const usersCollection = collection(db, 'live_user_locations');
    const unsubscribe = onSnapshot(usersCollection, (snapshot) => {
      setUsersMap(prevMap => {
        const newMap = new Map(prevMap);
        snapshot.forEach((doc) => {
          newMap.set(doc.id, doc.data());
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
      usersMap.forEach((userData) => {
        const last_updated = userData.last_updated;
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

  // Determine active and inactive users for the list
  const currentTime = new Date().getTime();
  const activeUsers = [];
  const inactiveUsers = [];
  
  usersMap.forEach((userData) => {
      const isRecentlyActive = userData.last_updated && (currentTime - new Date(userData.last_updated).getTime() < 15000);
      if (isRecentlyActive) {
          activeUsers.push(userData);
      } else {
          inactiveUsers.push(userData);
      }
  });

  return (
    <>
      <div 
        onClick={() => setShowList(!showList)}
        style={{
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
          border: '1px solid #111',
          cursor: 'pointer',
          transition: 'transform 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
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

      {showList && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          right: '15px',
          width: '350px',
          maxHeight: '400px',
          backgroundColor: '#1E1E1E',
          borderRadius: '12px',
          boxShadow: '0 8px 16px rgba(0,0,0,0.8)',
          zIndex: 9000,
          border: '1px solid #333',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '15px',
            backgroundColor: '#2A2A2A',
            borderBottom: '1px solid #444',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, color: '#FFF', fontSize: '16px' }}>Visitor List</h3>
            <button 
              onClick={() => setShowList(false)}
              style={{ background: 'transparent', border: 'none', color: '#AAA', cursor: 'pointer', fontSize: '18px' }}
            >×</button>
          </div>
          
          <div style={{ padding: '15px', overflowY: 'auto', flex: 1 }}>
            <h4 style={{ color: '#00FF00', margin: '0 0 10px 0', fontSize: '14px', borderBottom: '1px solid #333', paddingBottom: '5px' }}>
              Active Now ({activeUsers.length})
            </h4>
            {activeUsers.length === 0 ? (
                <p style={{ color: '#888', fontSize: '13px', margin: '0 0 15px 0' }}>No active users.</p>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 15px 0' }}>
                {activeUsers.map((u, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontSize: '13px', color: '#CCC' }}>
                    <span style={{ color: '#00FF00', marginRight: '8px' }}>🟢</span>
                    <span style={{ fontWeight: 'bold', marginRight: '5px', color: '#FFF' }}>{u.user_name}</span> 
                    {u.email && <span style={{ color: '#888' }}>({u.email})</span>}
                    </li>
                ))}
                </ul>
            )}

            <h4 style={{ color: '#888', margin: '0 0 10px 0', fontSize: '14px', borderBottom: '1px solid #333', paddingBottom: '5px' }}>
              Past Visitors ({inactiveUsers.length})
            </h4>
            {inactiveUsers.length === 0 ? (
                <p style={{ color: '#555', fontSize: '13px', margin: 0 }}>No past visitors recorded.</p>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {inactiveUsers.map((u, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontSize: '13px', color: '#888' }}>
                    <span style={{ color: '#555', marginRight: '8px' }}>🔴</span>
                    <span style={{ marginRight: '5px' }}>{u.user_name}</span> 
                    {u.email && <span style={{ opacity: 0.7 }}>({u.email})</span>}
                    </li>
                ))}
                </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default VisitorCounter;
