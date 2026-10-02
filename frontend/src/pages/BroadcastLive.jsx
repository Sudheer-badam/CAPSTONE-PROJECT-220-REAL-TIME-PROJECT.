import React, { useRef, useState } from 'react';
import { startBroadcasting } from '../services/webrtc';
import { auth } from '../services/firebase';

const BroadcastLive = () => {
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
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', color: '#fff' }}>
            <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>User Live Broadcast</h2>
            
            {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button 
                    onClick={() => handleStart('camera')}
                    disabled={isBroadcasting}
                    style={buttonStyle}
                >
                    Share Camera
                </button>
                <button 
                    onClick={() => handleStart('screen')}
                    disabled={isBroadcasting}
                    style={buttonStyle}
                >
                    Share Screen
                </button>
                <button 
                    onClick={() => handleStart('both')}
                    disabled={isBroadcasting}
                    style={{...buttonStyle, background: '#4CAF50'}}
                >
                    Share Both
                </button>
            </div>

            {isBroadcasting && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h3 style={{ color: '#4CAF50' }}>Broadcasting ({broadcastType})...</h3>
                    
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1', minWidth: '300px' }}>
                            <h4>Camera View</h4>
                            <video 
                                ref={camVideoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                style={videoStyle}
                            />
                        </div>
                        <div style={{ flex: '1', minWidth: '300px' }}>
                            <h4>Screen View</h4>
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
            )}
        </div>
    );
};

const buttonStyle = {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '5px',
    background: '#2196F3',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold'
};

const videoStyle = {
    width: '100%',
    backgroundColor: '#000',
    borderRadius: '8px',
    border: '1px solid #333'
};

export default BroadcastLive;
