import React, { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { answerBroadcast } from '../services/webrtc';

const AdminBroadcastViewer = ({ onClose }) => {
    const [users, setUsers] = useState([]);
    const [activeCalls, setActiveCalls] = useState(new Set());
    const [selectedUser, setSelectedUser] = useState("");
    const [isWatching, setIsWatching] = useState(false);
    
    const [camMuted, setCamMuted] = useState(false);
    const [screenMuted, setScreenMuted] = useState(false);
    const [camDb, setCamDb] = useState(-100);
    const [screenDb, setScreenDb] = useState(-100);
    
    const camVideoRef = useRef(null);
    const screenVideoRef = useRef(null);
    const camCanvasRef = useRef(null);
    const screenCanvasRef = useRef(null);

    // Fetch all users and active calls
    useEffect(() => {
        // Fetch all users from live_user_locations
        const usersCollection = collection(db, 'live_user_locations');
        const unsubUsers = onSnapshot(usersCollection, (snapshot) => {
            const usersList = [];
            snapshot.forEach((doc) => {
                usersList.push({ uid: doc.id, ...doc.data() });
            });
            setUsers(usersList);
        });

        // Fetch active WebRTC calls
        const callsCollection = collection(db, 'webrtc_calls');
        const unsubCalls = onSnapshot(callsCollection, (snapshot) => {
            const calls = new Set();
            snapshot.forEach((doc) => {
                if (doc.data().offer) {
                    calls.add(doc.id);
                }
            });
            setActiveCalls(calls);
        });

        return () => {
            unsubUsers();
            unsubCalls();
        };
    }, []);

    // Simulate dB meter
    useEffect(() => {
        let interval;
        if (isWatching) {
            interval = setInterval(() => {
                if (!camMuted) {
                    setCamDb(Math.floor(Math.random() * (10) - 25)); // Fluctuates around -15 to -25
                } else {
                    setCamDb(-100);
                }
                
                if (!screenMuted) {
                    setScreenDb(Math.floor(Math.random() * (10) - 25));
                } else {
                    setScreenDb(-100);
                }
            }, 300);
        }
        return () => clearInterval(interval);
    }, [isWatching, camMuted, screenMuted]);

    const handleWatchStream = async () => {
        if (!selectedUser) return;
        setIsWatching(true);
        try {
            await answerBroadcast(selectedUser, camVideoRef.current, screenVideoRef.current, camCanvasRef.current, screenCanvasRef.current);
        } catch (err) {
            console.error("Failed to answer broadcast", err);
            alert('Could not connect to this user broadcast.');
            setIsWatching(false);
        }
    };

    return (
        <div style={{ 
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', 
            backgroundColor: '#0A0A0A', padding: '40px 20px', zIndex: 10000, 
            display: 'flex', flexDirection: 'column', alignItems: 'center', 
            overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box'
        }}>
            <button 
                onClick={onClose} 
                style={{
                    position: 'absolute', top: '20px', right: '20px', background: '#fff', color: '#000',
                    border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '20px',
                    cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold'
                }}
            >
                ✕
            </button>
            
            <h1 style={{ color: '#D4AF37', fontFamily: 'serif', fontSize: '36px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '40px', textAlign: 'center', marginTop: '20px' }}>
                Admin Live Viewer
            </h1>
            
            <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '600px', marginBottom: '40px', flexWrap: 'wrap' }}>
                <select 
                    value={selectedUser} 
                    onChange={(e) => setSelectedUser(e.target.value)}
                    style={{ flex: '1 1 250px', padding: '12px', borderRadius: '4px', border: 'none', fontSize: '16px', outline: 'none', maxWidth: '100%' }}
                >
                    <option value="" disabled>Select a user to watch ({users.length} total)</option>
                    {users.map(u => {
                        const isLive = activeCalls.has(u.uid);
                        const statusDot = isLive ? '🟢' : '🔴';
                        const emailDisplay = u.email ? `(${u.email})` : '(No Email Provided)';
                        return (
                            <option key={u.uid} value={u.uid}>
                                {statusDot} {u.user_name} {emailDisplay} - {u.device_os || 'Unknown'}
                            </option>
                        );
                    })}
                </select>

                <button 
                    onClick={handleWatchStream}
                    style={{ flex: '1 1 auto', background: '#2C5282', color: '#fff', border: 'none', borderRadius: '4px', padding: '12px 20px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}
                >
                    Watch Stream
                </button>
            </div>

            {isWatching && (
                <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '40px', justifyContent: 'center' }}>
                    
                    {/* Camera Stream */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 400px', minWidth: '300px' }}>
                        <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '3px solid #D4AF37' }}>
                            <video 
                                ref={camVideoRef} 
                                autoPlay 
                                playsInline 
                                muted={camMuted}
                                style={{ width: '100%', backgroundColor: '#000', minHeight: '300px', objectFit: 'cover', display: 'block' }}
                            />
                            <canvas 
                                ref={camCanvasRef} 
                                width={600} 
                                height={60} 
                                style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '60px', opacity: 0.8, pointerEvents: 'none' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '15px', gap: '20px' }}>
                            <button 
                                onClick={() => setCamMuted(!camMuted)}
                                style={{ background: '#D32F2F', color: '#fff', border: 'none', borderRadius: '4px', padding: '10px 20px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                {camMuted ? 'Unmute' : 'Mute'} Camera Audio
                            </button>
                            <span style={{ color: '#D4AF37', fontSize: '24px', fontWeight: 'bold' }}>
                                {camDb} dB
                            </span>
                        </div>
                    </div>

                    {/* Screen Stream */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 400px', minWidth: '300px' }}>
                        <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '3px solid #3182CE' }}>
                            <video 
                                ref={screenVideoRef} 
                                autoPlay 
                                playsInline 
                                muted={screenMuted}
                                style={{ width: '100%', backgroundColor: '#000', minHeight: '300px', objectFit: 'contain', display: 'block' }}
                            />
                            <canvas 
                                ref={screenCanvasRef} 
                                width={600} 
                                height={60} 
                                style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '60px', opacity: 0.8, pointerEvents: 'none' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '15px', gap: '20px' }}>
                            <button 
                                onClick={() => setScreenMuted(!screenMuted)}
                                style={{ background: '#3182CE', color: '#fff', border: 'none', borderRadius: '4px', padding: '10px 20px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                {screenMuted ? 'Unmute' : 'Mute'} Screen Audio
                            </button>
                            <span style={{ color: '#3182CE', fontSize: '24px', fontWeight: 'bold' }}>
                                {screenDb} dB
                            </span>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default AdminBroadcastViewer;
