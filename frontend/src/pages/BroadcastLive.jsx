import React, { useRef, useState, useEffect } from 'react';
import { startBroadcasting } from '../services/webrtc';
import { auth } from '../services/firebase';

const BroadcastLive = ({ isOpen, onClose }) => {
    const camVideoRef = useRef(null);
    const screenVideoRef = useRef(null);
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [broadcastType, setBroadcastType] = useState(null);
    const [error, setError] = useState('');

    const handleStart = async (type) => {
        try {
            setError('');
            await startBroadcasting(type, camVideoRef.current, screenVideoRef.current);
            setIsBroadcasting(true);
            setBroadcastType(type);
        } catch (err) {
            console.error("Broadcast failed", err);
            setError('Failed to start broadcast. Please check permissions or login status.');
        }
    };

    return (
        <div style={{ ...overlayStyle, display: isOpen ? 'flex' : 'none' }}>
            <div style={{
                ...modalStyle,
                maxWidth: (isBroadcasting && broadcastType === 'both') ? '800px' : '400px',
                transition: 'max-width 0.3s ease'
            }}>
                <button onClick={onClose} style={closeBtnStyle}>✕</button>
                
                <h2 style={{ fontSize: '32px', marginBottom: '10px', color: '#D4AF37', textAlign: 'center', fontFamily: 'serif', textTransform: 'uppercase' }}>
                    Broadcast Live
                </h2>
                
                <p style={{ color: '#fff', textAlign: 'center', marginBottom: '30px', fontSize: '18px' }}>
                    Choose what to share with the Admin:
                </p>

                {error && <div style={{ color: 'red', marginBottom: '15px', textAlign: 'center' }}>{error}</div>}
                
                {!isBroadcasting ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                        <button 
                            onClick={() => handleStart('camera')}
                            style={{ ...buttonStyle, background: '#D4AF37', color: '#000' }}
                        >
                            <span style={{ marginRight: '10px' }}>📹</span> Camera Only
                        </button>
                        <button 
                            onClick={() => handleStart('screen')}
                            style={{ ...buttonStyle, background: '#D4AF37', color: '#000' }}
                        >
                            <span style={{ marginRight: '10px' }}>🖥️</span> Screen Only
                        </button>
                        <button 
                            onClick={() => handleStart('both')}
                            style={{ ...buttonStyle, background: '#E53935', color: '#000' }}
                        >
                            <span style={{ marginRight: '10px' }}>🎬</span> Share Both
                        </button>
                    </div>
                ) : (
                    <h3 style={{ color: '#4CAF50', textAlign: 'center' }}>Broadcasting ({broadcastType})...</h3>
                )}

                <div style={{ display: isBroadcasting ? 'flex' : 'none', flexDirection: 'row', flexWrap: 'wrap', gap: '20px', width: '100%', marginTop: '20px', justifyContent: 'center' }}>
                    <div style={{ display: (broadcastType === 'camera' || broadcastType === 'both') ? 'block' : 'none', flex: '1 1 300px', minWidth: '0' }}>
                        <video 
                            ref={camVideoRef} 
                            autoPlay 
                            playsInline 
                            muted 
                            style={videoStyle}
                        />
                    </div>
                    
                    <div style={{ display: (broadcastType === 'screen' || broadcastType === 'both') ? 'block' : 'none', flex: '1 1 300px', minWidth: '0' }}>
                        <video 
                            ref={screenVideoRef} 
                            autoPlay 
                            playsInline 
                            muted 
                            style={videoStyle}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const overlayStyle = {
    position: 'fixed',
    top: 0, left: 0, width: '100vw', height: '100vh',
    background: 'rgba(10, 10, 10, 0.95)',
    zIndex: 10000,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    boxSizing: 'border-box'
};

const modalStyle = {
    background: '#111',
    padding: '40px 20px',
    borderRadius: '15px',
    width: '100%',
    maxWidth: '400px',
    position: 'relative',
    boxShadow: '0 0 20px rgba(212, 175, 55, 0.1)'
};

const closeBtnStyle = {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: '#fff',
    color: '#000',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: 'bold'
};

const buttonStyle = {
    width: '100%',
    maxWidth: '300px',
    padding: '15px 20px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '18px',
    cursor: 'pointer',
    fontWeight: 'bold',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
};

const videoStyle = {
    width: '100%',
    backgroundColor: '#000',
    borderRadius: '8px',
    border: '2px solid #D4AF37'
};

export default BroadcastLive;
