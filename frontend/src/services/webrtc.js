import { db, auth } from './firebase';
import { 
    doc, 
    setDoc, 
    collection, 
    addDoc, 
    onSnapshot, 
    updateDoc, 
    getDoc 
} from 'firebase/firestore';

// STUN servers
const servers = {
    iceServers: [
        {
            urls: [
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302'
            ]
        }
    ],
    iceCandidatePoolSize: 10,
};

let pc = null;
let localStream = null;
let screenStream = null;
let activeCanvasAnim = null;

export const startBroadcasting = async (type, localVideoCamEl, localVideoScreenEl) => {
    if (!auth.currentUser) throw new Error("User must be authenticated");
    const uid = auth.currentUser.uid;
    
    // Cleanup previous if exists
    if (pc) pc.close();
    
    pc = new RTCPeerConnection(servers);
    
    // Get media streams based on type
    try {
        if (type === 'camera' || type === 'both') {
            try {
                localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            } catch (err) {
                console.warn("Audio failed, falling back to video only", err);
                localStream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
            if (localVideoCamEl) {
                localVideoCamEl.srcObject = localStream;
            }
            localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
        }
        
        if (type === 'screen' || type === 'both') {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            if (localVideoScreenEl) {
                localVideoScreenEl.srcObject = screenStream;
            }
            screenStream.getTracks().forEach((track) => pc.addTrack(track, screenStream));
        }
    } catch (error) {
        console.error("Error getting media streams:", error);
        throw error;
    }
    
    // Reference to Firestore document
    const callDoc = doc(db, 'webrtc_calls', uid);
    const offerCandidates = collection(callDoc, 'offerCandidates');
    const answerCandidates = collection(callDoc, 'answerCandidates');
    
    // Listen for local ICE candidates
    pc.onicecandidate = (event) => {
        event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
    };
    
    // Reconnection/state logic
    pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            console.warn('Network changed, attempting ICE restart...');
            pc.restartIce();
        }
    };

    let isInitialOffer = true;
    pc.onnegotiationneeded = async () => {
        try {
            const offerDescription = await pc.createOffer();
            await pc.setLocalDescription(offerDescription);
            
            const offer = {
                sdp: offerDescription.sdp,
                type: offerDescription.type,
            };
            
            if (isInitialOffer) {
                await setDoc(callDoc, { offer });
                isInitialOffer = false;
            } else {
                await updateDoc(callDoc, { offer });
            }
        } catch (err) {
            console.error("Renegotiation failed:", err);
        }
    };
    
    // Listen for Answer
    onSnapshot(callDoc, (snapshot) => {
        const data = snapshot.data();
        if (data?.answer && pc.remoteDescription?.sdp !== data.answer.sdp) {
            const answerDescription = new RTCSessionDescription(data.answer);
            pc.setRemoteDescription(answerDescription);
        }
    });
    
    // Listen for Admin's ICE candidates
    onSnapshot(answerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });
};

export const answerBroadcast = async (uid, remoteVideoCamEl, remoteVideoScreenEl, camCanvasEl, scrCanvasEl) => {
    // Cleanup previous if exists
    if (pc) pc.close();
    
    pc = new RTCPeerConnection(servers);
    
    // Set up audio visualizer context
    let audioContext = null;
    const activeCanvasAnims = [];

    // Track incoming streams by ID
    const streamMap = {};

    pc.ontrack = (event) => {
        console.log("Track received:", event.track.kind);
        const stream = event.streams[0];
        if (!stream) return;

        const streamId = stream.id;
        
        // Map the first unique stream ID to the Camera stream, and the second to Screen stream
        if (!streamMap[streamId]) {
            if (Object.keys(streamMap).length === 0) {
                streamMap[streamId] = 'cam';
                if (remoteVideoCamEl) remoteVideoCamEl.srcObject = stream;
            } else {
                streamMap[streamId] = 'scr';
                if (remoteVideoScreenEl) remoteVideoScreenEl.srcObject = stream;
            }
        }

        if (event.track.kind === 'audio') {
            const targetCanvas = (streamMap[streamId] === 'cam') ? camCanvasEl : scrCanvasEl;
            const color = (streamMap[streamId] === 'cam') ? 'rgba(212, 175, 55, 0.8)' : 'rgba(49, 130, 206, 0.8)';
            
            if (targetCanvas) {
                try {
                    if (!audioContext) {
                        const AudioContext = window.AudioContext || window.webkitAudioContext;
                        audioContext = new AudioContext();
                    }
                    const analyser = audioContext.createAnalyser();
                    analyser.fftSize = 64; 
                    
                    const source = audioContext.createMediaStreamSource(new MediaStream([event.track]));
                    source.connect(analyser);
                    
                    const bufferLength = analyser.frequencyBinCount;
                    const dataArray = new Uint8Array(bufferLength);
                    const ctx = targetCanvas.getContext('2d');
                    
                    const drawVisualizer = () => {
                        const animId = requestAnimationFrame(drawVisualizer);
                        activeCanvasAnims.push(animId);
                        
                        analyser.getByteFrequencyData(dataArray);
                        ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
                        
                        const barWidth = targetCanvas.width / bufferLength;
                        let x = 0;
                        
                        for (let i = 0; i < bufferLength; i++) {
                            const percent = dataArray[i] / 255;
                            const barHeight = percent * targetCanvas.height;
                            
                            ctx.fillStyle = color;
                            ctx.fillRect(x, targetCanvas.height - barHeight, barWidth - 1, barHeight);
                            x += barWidth;
                        }
                    };
                    drawVisualizer();
                } catch (e) {
                    console.error("Audio visualizer error", e);
                }
            }
        }
    };
    
    // Firestore references
    const callDoc = doc(db, 'webrtc_calls', uid);
    const offerCandidates = collection(callDoc, 'offerCandidates');
    const answerCandidates = collection(callDoc, 'answerCandidates');
    
    // Handle local ICE candidates
    pc.onicecandidate = (event) => {
        event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
    };
    
    // Reconnection/state logic
    pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            console.warn('Admin ICE connection state:', pc.iceConnectionState);
        }
    };
    
    // Listen for incoming Offers (Initial and ICE Restarts)
    onSnapshot(callDoc, async (snapshot) => {
        const data = snapshot.data();
        if (data?.offer && pc.remoteDescription?.sdp !== data.offer.sdp) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answerDescription = await pc.createAnswer();
                await pc.setLocalDescription(answerDescription);
                await updateDoc(callDoc, { 
                    answer: { type: answerDescription.type, sdp: answerDescription.sdp } 
                });
            } catch (err) {
                console.error("Error responding to offer:", err);
            }
        }
    });
    
    // Listen for incoming ICE candidates from the broadcaster
    onSnapshot(offerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                let data = change.doc.data();
                pc.addIceCandidate(new RTCIceCandidate(data));
            }
        });
    });
};
