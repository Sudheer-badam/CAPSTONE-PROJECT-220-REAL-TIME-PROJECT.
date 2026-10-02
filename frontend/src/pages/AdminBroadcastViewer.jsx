import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { answerBroadcast } from '../services/webrtc';

const AdminBroadcastViewer = () => {
    const [activeCalls, setActiveCalls] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [error, setError] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    
    const camVideoRef = useRef(null);
    const screenVideoRef = useRef(null);
    const canvasRef = useRef(null);

    // Fetch active calls from Firestore
    useEffect(() => {
        const callsCollection = collection(db, 'webrtc_calls');
        const unsubscribe = onSnapshot(callsCollection, (snapshot) => {
            const calls = [];
            snapshot.forEach((doc) => {
                // If it has an offer, we consider it an active call
                if (doc.data().offer) {
                    calls.push({ uid: doc.id, ...doc.data() });
                }
            });
            setActiveCalls(calls);
        }, (err) => {
            console.error("Error fetching calls:", err);
            setError('Failed to fetch active broadcasts.');
        });

        return () => unsubscribe();
    }, []);

    const handleSelectUser = async (uid) => {
        try {
            setError('');
            setSelectedUser(uid);
            await answerBroadcast(uid, camVideoRef.current, screenVideoRef.current, canvasRef.current);
        } catch (err) {
            console.error("Failed to answer broadcast", err);
            setError('Could not connect to this user broadcast.');
        }
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
        if (camVideoRef.current) camVideoRef.current.muted = !isMuted;
        if (screenVideoRef.current) screenVideoRef.current.muted = !isMuted;
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', color: '#fff' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>Admin Broadcast Viewer</h2>
            
            {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}

            <div style={{ marginBottom: '20px' }}>
                <h3>Active Broadcasters</h3>
                {activeCalls.length === 0 ? (
                    <p style={{ color: '#aaa' }}>No active broadcasts found.</p>
                ) : (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {activeCalls.map((call) => (
                            <button 
                                key={call.uid}
                                onClick={() => handleSelectUser(call.uid)}
                                style={{
                                    ...buttonStyle,
                                    background: selectedUser === call.uid ? '#4CAF50' : '#2196F3'
                                }}
                            >
                                User: {call.uid.substring(0, 8)}...
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {selectedUser && (
                <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ margin: 0, color: '#4CAF50' }}>Viewing Broadcast</h3>
                        <button onClick={toggleMute} style={{ ...buttonStyle, background: isMuted ? '#f44336' : '#ff9800' }}>
                            {isMuted ? 'Unmute' : 'Mute'} Audio
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
                        <div style={{ flex: '1', minWidth: '300px' }}>
                            <h4>Camera View</h4>
                            <video 
                                ref={camVideoRef} 
                                autoPlay 
                                playsInline 
                                style={videoStyle}
                            />
                        </div>
                        <div style={{ flex: '1', minWidth: '300px' }}>
                            <h4>Screen View</h4>
                            <video 
                                ref={screenVideoRef} 
                                autoPlay 
                                playsInline 
                                style={videoStyle}
                            />
                        </div>
                    </div>

                    <div>
                        <h4>Audio Decibel/Visualizer</h4>
                        <canvas 
                            ref={canvasRef} 
                            width={800} 
                            height={100} 
                            style={{ width: '100%', height: '100px', backgroundColor: '#141414', borderRadius: '4px' }}
                        ></canvas>
                    </div>
                </div>
            )}
        </div>
    );
};

const buttonStyle = {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '5px',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold'
};

const videoStyle = {
    width: '100%',
    backgroundColor: '#000',
    borderRadius: '8px',
    border: '1px solid #333',
    minHeight: '250px'
};

export default AdminBroadcastViewer;
