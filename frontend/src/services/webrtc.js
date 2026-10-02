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
            console.warn('ICE connection state:', pc.iceConnectionState);
            // Optionally implement a restart ice procedure here
        }
    };

    // Create Offer
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);
    
    const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
    };
    
    await setDoc(callDoc, { offer });
    
    // Listen for Answer
    onSnapshot(callDoc, (snapshot) => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
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

export const answerBroadcast = async (uid, remoteVideoCamEl, remoteVideoScreenEl, canvasEl) => {
    // Cleanup previous if exists
    if (pc) pc.close();
    if (activeCanvasAnim) cancelAnimationFrame(activeCanvasAnim);
    
    pc = new RTCPeerConnection(servers);
    
    // Set up audio visualizer context
    let audioContext = null;
    let analyser = null;
    let dataArray = null;

    // Track incoming streams
    const camStream = new MediaStream();
    const scrStream = new MediaStream();
    
    if (remoteVideoCamEl) remoteVideoCamEl.srcObject = camStream;
    if (remoteVideoScreenEl) remoteVideoScreenEl.srcObject = scrStream;

    pc.ontrack = (event) => {
        console.log("Track received:", event.track.kind);
        const stream = event.streams[0];
        
        // We'll roughly map the first video track to camera and second to screen if both exist,
        // or just add them sequentially based on element availability.
        // A better approach in WebRTC would be using stream IDs, but this is a simplified version.
        if (event.track.kind === 'video') {
            if (!camStream.getVideoTracks().length && remoteVideoCamEl) {
                camStream.addTrack(event.track);
            } else if (remoteVideoScreenEl) {
                scrStream.addTrack(event.track);
            }
        }
        if (event.track.kind === 'audio') {
            camStream.addTrack(event.track);
            
            // Audio visualizer logic if canvas provided
            if (canvasEl) {
                try {
                    if (!audioContext) {
                        const AudioContext = window.AudioContext || window.webkitAudioContext;
                        audioContext = new AudioContext();
                        analyser = audioContext.createAnalyser();
                        analyser.fftSize = 256;
                        
                        // We create a media stream source from the incoming event.streams[0]
                        const source = audioContext.createMediaStreamSource(stream);
                        source.connect(analyser);
                        
                        const bufferLength = analyser.frequencyBinCount;
                        dataArray = new Uint8Array(bufferLength);
                        const ctx = canvasEl.getContext('2d');
                        
                        const drawVisualizer = () => {
                            activeCanvasAnim = requestAnimationFrame(drawVisualizer);
                            analyser.getByteFrequencyData(dataArray);
                            
                            // Draw background
                            ctx.fillStyle = 'rgb(20, 20, 20)';
                            ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
                            
                            // Draw bars
                            const barWidth = (canvasEl.width / bufferLength) * 2.5;
                            let barHeight;
                            let x = 0;
                            
                            for (let i = 0; i < bufferLength; i++) {
                                barHeight = dataArray[i] / 2;
                                ctx.fillStyle = 'rgb(' + (barHeight + 100) + ', 50, 250)';
                                ctx.fillRect(x, canvasEl.height - barHeight, barWidth, barHeight);
                                x += barWidth + 1;
                            }
                        };
                        drawVisualizer();
                    }
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
    
    // Read the offer and create the answer
    const callData = (await getDoc(callDoc)).data();
    if (!callData?.offer) {
        throw new Error("No broadcast offer found for this user.");
    }
    
    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
    
    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);
    
    const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
    };
    
    await updateDoc(callDoc, { answer });
    
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
