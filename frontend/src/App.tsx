import { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Video, 
  ArrowLeft, 
  Copy, 
  Check, 
  RefreshCw, 
  Home,
  User,
  Tv,
  MessageSquare,
  Activity,
  AlertCircle
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// Connections definitions for drawing hand skeletal lines (MediaPipe hand tracking standard topology)
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index
  [5, 9], [9, 10], [10, 11], [11, 12], // Middle
  [9, 13], [13, 14], [14, 15], [15, 16], // Ring
  [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [0, 17] // Palm base
];

// Read endpoints from environment or fall back to standard local ports
const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

export default function App() {
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  
  // Self-healing backend port auto-detector
  useEffect(() => {
    if (import.meta.env.VITE_BACKEND_URL) return;
    
    const detectBackend = async () => {
      // 1. Try 8080
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        const res = await fetch('http://localhost:8080/health', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          console.log('[BACKEND DETECTED] Using http://localhost:8080');
          setBackendUrl('http://localhost:8080');
          return;
        }
      } catch (e) {}
      
      // 2. Try 8083
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        const res = await fetch('http://localhost:8083/health', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          console.log('[BACKEND DETECTED] Using http://localhost:8083');
          setBackendUrl('http://localhost:8083');
          return;
        }
      } catch (e) {}
    };
    detectBackend();
  }, []);

  // App views: 'landing' | 'self' | 'room'
  const [view, setView] = useState<'landing' | 'self' | 'room'>('landing');
  
  // Room states
  const [roomId, setRoomId] = useState<string | null>(null);
  const [role, setRole] = useState<'signer' | 'listener' | null>(null);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [peerConnected, setPeerConnected] = useState(false);

  // Translation output states (Holds the list of subtitle words)
  const [translatedWords, setTranslatedWords] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);

  // DOM element references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const subtitlesTextRef = useRef<HTMLParagraphElement | null>(null);

  // Media & Landmarker loading states
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Background prediction refs
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const hasLoggedPayloadRef = useRef(false);
  const isSendingRef = useRef(false); // Throttles frame-by-frame API requests to avoid browser network congestion
  const frameBufferRef = useRef<number[][]>([]);
  const lastCaptureTimeRef = useRef<number>(0);
  
  // Network connections refs
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Auto-detect room ID in query parameter upon mounting
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomId(roomParam);
      setView('room');
    }
  }, []);

  // Display ephemeral toasts
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Helper to copy room joining link
  const copyRoomLink = () => {
    if (!roomId) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    triggerToast('Room link copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  // Load MediaPipe Hand Landmarker model
  const loadMediaPipe = async (): Promise<HandLandmarker> => {
    if (landmarkerRef.current) return landmarkerRef.current;
    
    setIsLoadingModel(true);
    setModelError(null);
    
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
      );
      
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2 // Support both hands tracking on the canvas
      });
      
      landmarkerRef.current = landmarker;
      setIsLoadingModel(false);
      return landmarker;
    } catch (err: any) {
      console.error('Failed to load MediaPipe:', err);
      setIsLoadingModel(false);
      setModelError('Could not load hand landmark model. Please reload or check network.');
      throw err;
    }
  };

  // Handle local camera permissions and stream initiation
  const startCamera = async (): Promise<MediaStream> => {
    setMediaError(null);
    try {
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          aspectRatio: { ideal: 1.333333 },
          facingMode: "user"
        },
        audio: true // Bidirectional audio like Google Meet
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Make sure it starts playing
        await videoRef.current.play().catch(e => console.warn('Video play deferred:', e));
      }
      return stream;
    } catch (err: any) {
      console.error('Camera access error:', err);
      setMediaError('Unable to access webcam. Please verify camera and microphone permissions.');
      throw err;
    }
  };

  // Stop camera tracks and clean up resources
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Post coordinate frames to the backend prediction endpoint
  const sendFramesToBackend = async (framesToSend: number[] | number[][]) => {
    if (!hasLoggedPayloadRef.current) {
      console.log('[DEBUG] First coordinate frames payload being sent to backend:', { frames: framesToSend });
      hasLoggedPayloadRef.current = true;
    }
    setIsTranslating(true);
    try {
      const response = await fetch(`${backendUrl}/app/translate/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ frames: framesToSend })
      });
      
      const resData = await response.json();
      
      if (resData.success && resData.data) {
        const words: string[] = resData.data;
        
        if (words.length > 0) {
          setTranslatedWords(prev => {
            const updated = [...prev];
            let lastWord = updated[updated.length - 1];
            
            words.forEach(word => {
              // Ignore word if it is repeated back-to-back (consecutive duplicate check)
              if (word !== lastWord) {
                updated.push(word);
                lastWord = word;
              }
            });
            
            const finalWords = updated.slice(-45); // Limit safety cache to 45 words
            
            // Emit the updated full subtitle transcript list to the peer via Socket.IO
            if (view === 'room' && socketRef.current && roomId) {
              socketRef.current.emit('translation-data', { text: finalWords, room: roomId });
            }
            
            return finalWords;
          });
        }
      }
    } catch (err) {
      console.error('Prediction API call failed:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  // Local draw loop to render hand skeleton feedback
  const drawHandSkeleton = (ctx: CanvasRenderingContext2D, landmarksList: any[][]) => {
    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;
    
    // Sage green lines for bones, charcoal for joints
    ctx.strokeStyle = '#7EA68E';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.fillStyle = '#607266';

    landmarksList.forEach(landmarks => {
      // Draw skeletal bones
      HAND_CONNECTIONS.forEach(([a, b]) => {
        const pt1 = landmarks[a];
        const pt2 = landmarks[b];
        if (pt1 && pt2) {
          ctx.beginPath();
          ctx.moveTo(pt1.x * width, pt1.y * height);
          ctx.lineTo(pt2.x * width, pt2.y * height);
          ctx.stroke();
        }
      });

      // Draw joint dots
      landmarks.forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x * width, pt.y * height, 5, 0, 2 * Math.PI);
        ctx.fill();
      });
    });
  };

  // Main hand landmarker frame analysis loop
  const startDetectionLoop = (landmarker: HandLandmarker) => {
    const analyzeFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video && video.readyState >= 2 && canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Adjust canvas size to match video resolution dynamically
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
          
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const timestamp = performance.now();
          const results = landmarker.detectForVideo(video, timestamp);
          
          if (results.landmarks && results.landmarks.length > 0) {
            // Butter-smooth skeletal drawing on every single frame (~30-60 fps)
            drawHandSkeleton(ctx, results.landmarks);
            
            // Extract coordinates of both hands on every frame and predict immediately
            let leftHandCoords = new Array(63).fill(0);
            let rightHandCoords = new Array(63).fill(0);
            
            results.landmarks.forEach((handLandmarks, idx) => {
              const handednessList = results.handedness?.[idx];
              const category = handednessList?.[0];
              const label = category?.displayName || category?.categoryName;
              
              const coords = handLandmarks.flatMap(lm => [lm.x, lm.y, lm.z]);
              
              if (coords.length === 63) {
                if (label === 'Left') {
                  leftHandCoords = coords;
                } else if (label === 'Right') {
                  rightHandCoords = coords;
                } else {
                  // Fallback order: first hand is left, second hand is right
                  if (idx === 0) leftHandCoords = coords;
                  else if (idx === 1) rightHandCoords = coords;
                }
              }
            });
            
            const coords126 = [...leftHandCoords, ...rightHandCoords];
            if (coords126.length === 126) {
              const now = performance.now();
              // Capture 1 frame every 100ms (10 frames per second)
              if (now - lastCaptureTimeRef.current >= 100) {
                lastCaptureTimeRef.current = now;
                frameBufferRef.current.push(coords126);
                
                // Once we have collected 5 frames (500ms elapsed), send batch to model
                if (frameBufferRef.current.length === 5) {
                  const batchToSend = [...frameBufferRef.current];
                  frameBufferRef.current = [];
                  sendFramesToBackend(batchToSend);
                }
              }
            }
          }
        }
      }
      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
    };
    
    animationFrameRef.current = requestAnimationFrame(analyzeFrame);
  };

  // Handle room generation API call
  const triggerCreateRoom = async () => {
    try {
      const hostId = crypto.randomUUID();
      const response = await fetch(`${backendUrl}/app/socket/roomid?hostId=${hostId}`);
      const data = await response.json();
      
      if (data.success && data.roomId) {
        setRoomId(data.roomId);
        // Sync URL query parameter in the host's address bar
        window.history.pushState({}, '', `?room=${data.roomId}`);
        setView('room');
      } else {
        triggerToast('Failed to generate room. Please try again.');
      }
    } catch (err) {
      console.error('Room creation API error:', err);
      triggerToast('Server offline or connection error.');
    }
  };

  // Initialize WebSockets and room-joining routine
  const initializeRoomSocket = (roomIdStr: string, chosenRole: 'signer' | 'listener') => {
    const socket = io(backendUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket client linked:', socket.id);
      
      // Pass chosenRole to the backend during connection
      socket.emit('join-room', roomIdStr, chosenRole, (response: any) => {
        if (response.success) {
          console.log(`Joined room ${roomIdStr} successfully as ${response.role}`);
          // Sync with the actual backend role to be safe
          setRole(response.role);
          triggerToast(`Connected to room as ${response.role.toUpperCase()}`);
        } else {
          console.error('Join room failed:', response.message);
          triggerToast(`Room join failed: ${response.message}`);
          handleLeaveRoom();
        }
      });
    });

    // Listen to incoming translation data subtitle transcript array (for Listener role)
    socket.on('translation-data', (data: { text: string[]; signerId: string }) => {
      if (chosenRole === 'listener') {
        setTranslatedWords(data.text);
      }
    });

    // Listen for WebRTC Signaling Events
    socket.on('webrtc-offer', async (offer: RTCSessionDescriptionInit) => {
      console.log('WebRTC Offer received. Setting up peer connection...');
      const pc = getOrCreatePeerConnection(roomIdStr);
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        socket.emit('webrtc-answer', { answer, room: roomIdStr });
        setPeerConnected(true);
      } catch (err) {
        console.error('Error handling WebRTC offer:', err);
      }
    });

    socket.on('webrtc-answer', async (answer: RTCSessionDescriptionInit) => {
      console.log('WebRTC Answer received.');
      const pc = peerConnectionRef.current;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          setPeerConnected(true);
        } catch (err) {
          console.error('Error setting remote description:', err);
        }
      }
    });

    socket.on('ice-candidate', async (candidate: RTCIceCandidateInit) => {
      console.log('ICE Candidate received.');
      const pc = peerConnectionRef.current;
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });

    socket.on('user-joined', ({ role: peerRole }) => {
      console.log(`Peer joined room: ${peerRole}`);
      triggerToast(`Another user joined as ${peerRole}`);
      
      // If we are Signer and Listener joins, kick off the WebRTC offer exchange
      if (chosenRole === 'signer' && peerRole === 'listener') {
        setupSignerWebRTCOffer(roomIdStr);
      }
    });

    socket.on('peer-left', (msg) => {
      triggerToast(msg);
      setPeerConnected(false);
      // Reset WebRTC remote streams
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    });
  };

  // WebRTC Peer Connection Factory (Enforces Bidirectional Streaming like Google Meet)
  const getOrCreatePeerConnection = (roomIdStr: string): RTCPeerConnection => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Exchange ICE Candidates via WebSockets
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          room: roomIdStr
        });
      }
    };

    // Render remote media stream for BOTH users (Signer streams to Listener, Listener streams to Signer)
    pc.ontrack = (event) => {
      console.log('Remote WebRTC track received from peer.');
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Attach local stream tracks (Both sides stream their camera and audio feed!)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    peerConnectionRef.current = pc;
    return pc;
  };

  // WebRTC offer initiation (Signer -> Listener)
  const setupSignerWebRTCOffer = async (roomIdStr: string) => {
    console.log('Initiating WebRTC offer as SIGNER...');
    try {
      const pc = getOrCreatePeerConnection(roomIdStr);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      if (socketRef.current) {
        socketRef.current.emit('webrtc-offer', { offer, room: roomIdStr });
      }
    } catch (err) {
      console.error('Failed to initiate WebRTC offer:', err);
    }
  };

  // Clean up and disconnect room
  const handleLeaveRoom = () => {
    stopCamera();
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Reset parameters & state
    setRoomId(null);
    setRole(null);
    setPeerConnected(false);
    setTranslatedWords([]);
    setView('landing');
    
    // Clear room query parameter in URL
    window.history.pushState({}, '', window.location.pathname);
  };

  // Entry point for local self translation practice mode
  const enterSelfPractice = () => {
    setView('self');
    setRole('signer'); // Signer role for practice
  };

  // Trigger state change for role choice
  const handleRoleSelection = (selectedRole: 'signer' | 'listener') => {
    setRole(selectedRole);
  };

  // Camera, socket, and model initiation
  useEffect(() => {
    if (view === 'landing') return;

    let isActive = true;
    const initAppServices = async () => {
      try {
        // 1. Start camera streams (Both modes require local cameras)
        await startCamera();
        if (!isActive) return;

        // 2. Load model and start detection loop if the user is a Signer
        if (role === 'signer') {
          const landmarker = await loadMediaPipe();
          if (!isActive) return;
          
          startDetectionLoop(landmarker);
        }

        // 3. Connect websocket if in a shared Room
        if (view === 'room' && roomId) {
          initializeRoomSocket(roomId, role!);
        }

      } catch (err) {
        console.error('Application services initialization failed:', err);
      }
    };

    if (role || view === 'self') {
      initAppServices();
    }

    return () => {
      isActive = false;
      stopCamera();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setPeerConnected(false);
      isSendingRef.current = false;
    };
  }, [view, role]);

  // Dynamic 3-line subtitles truncation engine.
  // Measures the subtitle text element scrollHeight and compares it against three lineheights.
  // Dynamically slices the oldest words and triggers socket sync updates until the text fits nicely.
  useEffect(() => {
    const el = subtitlesTextRef.current;
    if (el && translatedWords.length > 0) {
      const computedStyle = window.getComputedStyle(el);
      const lineHeight = parseFloat(computedStyle.lineHeight) || 48;
      const maxHeight = lineHeight * 3.1; // Max height for exactly 3 lines (with safe rounding bounds)
      
      if (el.scrollHeight > maxHeight) {
        setTranslatedWords(prev => {
          const nextWords = prev.slice(1);
          // Sync with the peer in the room if we are the signer
          if (view === 'room' && socketRef.current && roomId && role === 'signer') {
            socketRef.current.emit('translation-data', { text: nextWords, room: roomId });
          }
          return nextWords;
        });
      }
    }
  }, [translatedWords, view, role, roomId]);

  return (
    <div className="zen-app animate-fade-in">
      
      {/* Toast Alert overlay */}
      {toastMessage && (
        <div className="status-toast">
          <Activity size={18} className="video-placeholder-icon" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Landing Screen */}
      {view === 'landing' && (
        <div className="landing-layout">
          <h1 className="zen-title">Silent Voice</h1>
          <p className="zen-subtitle">
            A minimalist, distraction-free space translating hand signs in real-time.
          </p>
          
          <div className="options-container">
            <div className="zen-card">
              <div className="zen-card-icon">
                <Sparkles size={28} />
              </div>
              <h2 className="zen-card-title">Self Translation</h2>
              <p className="zen-card-desc">
                Practice and test hand signs locally using your webcam and the MediaPipe vision engine.
              </p>
              <button onClick={enterSelfPractice} className="zen-btn zen-btn-secondary">
                Start Practice
              </button>
            </div>
            
            <div className="zen-card">
              <div className="zen-card-icon">
                <Video size={28} />
              </div>
              <h2 className="zen-card-title">Create a Room</h2>
              <p className="zen-card-desc">
                Generate a secure peer-to-peer room for live translation between a Signer and a Listener.
              </p>
              <button onClick={triggerCreateRoom} className="zen-btn zen-btn-primary">
                Establish Space
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Self Translation Mode */}
      {view === 'self' && (
        <div className="room-container">
          <div className="room-header">
            <div className="room-title-area">
              <h2 className="room-title">Self Translation Space</h2>
              <p className="zen-card-desc" style={{ margin: 0 }}>Practice landmarks locally</p>
            </div>
            <button onClick={() => setView('landing')} className="zen-btn zen-btn-secondary">
              <ArrowLeft size={16} /> Exit Practice
            </button>
          </div>

          <div className="room-content">
            <div className="video-grid">
              <div className="video-wrapper">
                {isLoadingModel && (
                  <div className="video-placeholder">
                    <RefreshCw size={36} className="video-placeholder-icon" style={{ animation: 'spin 2s linear infinite' }} />
                    <span>Loading MediaPipe AI Model...</span>
                  </div>
                )}
                {modelError && (
                  <div className="video-placeholder" style={{ color: 'var(--danger)' }}>
                    <AlertCircle size={36} />
                    <span>{modelError}</span>
                  </div>
                )}
                {mediaError && !modelError && (
                  <div className="video-placeholder" style={{ color: 'var(--danger)' }}>
                    <AlertCircle size={36} />
                    <span>{mediaError}</span>
                  </div>
                )}
                
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="video-feed mirrored"
                  style={{ display: (isLoadingModel || modelError || mediaError) ? 'none' : 'block' }}
                />
                <canvas 
                  ref={canvasRef} 
                  className="video-canvas"
                  style={{ display: (isLoadingModel || modelError || mediaError) ? 'none' : 'block' }}
                />
                
                {!isLoadingModel && !modelError && !mediaError && (
                  <div className="video-label">
                    <span className="translation-status-dot active"></span> Local Camera (Signing)
                  </div>
                )}
              </div>
            </div>

            {/* wide Live Subtitles bottom panel */}
            <div className="translation-panel wide-layout animate-fade-in">
              <h3 className="translation-title">
                <MessageSquare size={18} /> Live Subtitles (Local)
                <span className="translation-status" style={{ marginLeft: 'auto' }}>
                  <span className="translation-status-dot active"></span>
                  <span>{isTranslating ? 'Transcribing...' : 'Model Online'}</span>
                </span>
              </h3>
              
              <div className="subtitles-container">
                {translatedWords.length > 0 ? (
                  <p ref={subtitlesTextRef} className="subtitles-text">
                    {translatedWords.map((word, idx) => (
                      <span key={idx} className="subtitles-word">
                        {word}
                        {idx < translatedWords.length - 1 && <span className="subtitle-bullet">•</span>}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="subtitles-placeholder">Awaiting gestured signs...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shared Room Connection Mode */}
      {view === 'room' && (
        <div className="room-container">
          
          {/* Role Choice Overlay/Modal */}
          {!role && (
            <div className="zen-overlay">
              <div className="modal-card">
                <h2 className="zen-card-title">Choose Your Role</h2>
                <p className="zen-card-desc">Select how you want to participate in this space</p>
                
                <div className="role-buttons">
                  <button onClick={() => handleRoleSelection('signer')} className="role-option-btn">
                    <div className="role-icon">
                      <User size={24} />
                    </div>
                    <div className="role-label">
                      <span className="role-name">Signer</span>
                      <span className="role-desc">Tracks landmarks locally, sends sign video via WebRTC.</span>
                    </div>
                  </button>
                  
                  <button onClick={() => handleRoleSelection('listener')} className="role-option-btn">
                    <div className="role-icon">
                      <Tv size={24} />
                    </div>
                    <div className="role-label">
                      <span className="role-name">Listener</span>
                      <span className="role-desc">Receives translated text and remote video feed.</span>
                    </div>
                  </button>
                </div>
                
                <button 
                  onClick={handleLeaveRoom} 
                  className="zen-btn zen-btn-secondary" 
                  style={{ marginTop: '2rem', width: '100%', justifyContent: 'center' }}
                >
                  <Home size={16} /> Return Home
                </button>
              </div>
            </div>
          )}

          <div className="room-header">
            <div className="room-title-area">
              <h2 className="room-title">Translation Room</h2>
              <div className="room-id-pill" onClick={copyRoomLink}>
                <span>Room: {roomId?.substring(0, 8)}...</span>
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              {role && (
                <div className="zen-btn zen-btn-secondary" style={{ pointerEvents: 'none' }}>
                  <User size={16} /> Role: {role.toUpperCase()}
                </div>
              )}
              <button onClick={handleLeaveRoom} className="zen-btn zen-btn-danger">
                Leave Room
              </button>
            </div>
          </div>

          <div className="room-content">
            
            {/* Google Meet Bidirectional Video Grid Layout */}
            <div className="video-grid two-feeds">
              
              {/* 1. Local User Webcam View */}
              <div className="video-wrapper">
                {isLoadingModel && role === 'signer' && (
                  <div className="video-placeholder">
                    <RefreshCw size={36} className="video-placeholder-icon" style={{ animation: 'spin 2s linear infinite' }} />
                    <span>Loading MediaPipe AI Model...</span>
                  </div>
                )}
                {mediaError && (
                  <div className="video-placeholder" style={{ color: 'var(--danger)' }}>
                    <AlertCircle size={36} />
                    <span>{mediaError}</span>
                  </div>
                )}
                
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="video-feed mirrored"
                  style={{ display: (isLoadingModel && role === 'signer') || mediaError ? 'none' : 'block' }}
                />
                <canvas 
                  ref={canvasRef} 
                  className="video-canvas"
                  style={{ display: (isLoadingModel && role === 'signer') || mediaError || role !== 'signer' ? 'none' : 'block' }}
                />
                
                {!isLoadingModel && !mediaError && (
                  <div className="video-label">
                    <span className="translation-status-dot active"></span> You ({role?.toUpperCase()})
                  </div>
                )}
              </div>

              {/* 2. Remote Peer Webcam View */}
              <div className="video-wrapper">
                <video 
                  ref={remoteVideoRef} 
                  autoPlay 
                  playsInline 
                  className="video-feed"
                  style={{ display: peerConnected ? 'block' : 'none' }}
                />
                
                {!peerConnected && (
                  <div className="video-placeholder">
                    <Video size={36} className="video-placeholder-icon" />
                    <span>Awaiting peer connection...</span>
                  </div>
                )}
                
                {peerConnected && (
                  <div className="video-label">
                    <span className="translation-status-dot active"></span> Peer Webcam
                  </div>
                )}
              </div>
            </div>

            {/* wide Live Subtitles bottom panel */}
            <div className="translation-panel wide-layout animate-fade-in">
              <h3 className="translation-title">
                <MessageSquare size={18} /> Live Subtitles
                <span className="translation-status" style={{ marginLeft: 'auto' }}>
                  <span className="translation-status-dot active"></span>
                  <span>{role === 'signer' ? 'Live Transcribing' : 'Caption Stream'}</span>
                </span>
              </h3>
              
              <div className="subtitles-container">
                {translatedWords.length > 0 ? (
                  <p ref={subtitlesTextRef} className="subtitles-text">
                    {translatedWords.map((word, idx) => (
                      <span key={idx} className="subtitles-word">
                        {word}
                        {idx < translatedWords.length - 1 && <span className="subtitle-bullet">•</span>}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="subtitles-placeholder">Awaiting gestured signs...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
