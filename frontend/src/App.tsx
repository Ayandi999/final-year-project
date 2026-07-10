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
  AlertCircle,
  ChevronRight,
  Camera,
  Heart,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const PRACTICE_SIGNS = [
  {
    id: "howmuch",
    name: "How Much",
    label: "How much",
    image: "/assets/isl_sign_howmuch.png",
    description: "Hold both hands in front of your chest with index fingers pointing directly towards each other horizontally and thumbs extended upwards."
  },
  {
    id: "takecare",
    name: "Take Care",
    label: "take_care",
    image: "/assets/isl_sign_please.png",
    description: "Extend your hand flat and circle it gently over your chest."
  },
  {
    id: "iloveyou",
    name: "I Love You",
    label: "i love u",
    image: "/assets/isl_sign_iloveyou.png",
    description: "Raise one hand, extending the index finger, pinky finger, and thumb, while holding the middle and ring fingers down."
  },
  {
    id: "you",
    name: "You",
    label: "you",
    image: "/assets/isl_sign_you.png",
    description: "Point your dominant hand's index finger directly forward towards the screen/viewer."
  },
  {
    id: "godsplan",
    name: "God's Plan",
    label: "God's Plan",
    image: "/assets/isl_sign_godsplan.png",
    description: "Raise both hands high, pointing index fingers upwards towards the sky."
  }
];

// Connections definitions for drawing hand skeletal lines (MediaPipe hand tracking standard topology)
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index
  [5, 9], [9, 10], [10, 11], [11, 12], // Middle
  [9, 13], [13, 14], [14, 15], [15, 16], // Ring
  [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [0, 17] // Palm base
];

interface PredictedWord {
  word: string;
  confidence: number;
}

// Read endpoints from environment or fall back to standard local ports
const DEFAULT_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';



interface LoginPageProps {
  backendUrl: string;
  onBack: () => void;
  onLoginSuccess: () => void;
  triggerToast: (msg: string) => void;
  isLoggingInWithGoogle: boolean;
  setIsLoggingInWithGoogle: (val: boolean) => void;
  handleGoogleLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({
  onBack,
  isLoggingInWithGoogle,
  handleGoogleLogin
}) => {
  return (
    <div className="login-page-container" style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      width: '100%',
      backgroundColor: 'var(--bg-app)',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Back to Home Button */}
      <button 
        onClick={onBack} 
        style={{
          position: 'absolute',
          top: '24px',
          left: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'transparent',
          border: '1px solid var(--border-light)',
          color: 'var(--text-color)',
          padding: '8px 16px',
          borderRadius: '24px',
          cursor: 'pointer',
          fontWeight: '700',
          fontSize: '0.9rem',
          zIndex: 10,
          transition: 'all 0.2s ease'
        }}
      >
        <ArrowLeft size={16} />
        Back to Home
      </button>

      {/* Decorative blurred background shapes */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '-10%',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(143,163,150,0.1) 0%, transparent 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none'
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-10%',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(143,163,150,0.1) 0%, transparent 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none'
      }}></div>

      {/* Glassmorphic Login Card */}
      <div className="login-card" style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-light)',
        borderRadius: '24px',
        padding: '48px 32px',
        width: '100%',
        maxWidth: '440px',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        zIndex: 1
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'rgba(143,163,150,0.05)',
            color: 'var(--primary)',
            marginBottom: '12px'
          }}>
            <Tv size={36} />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--text-dark)', margin: 0 }}>Silent Voice</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
            Sign in to access real-time continuous gesture translation, multi-party rooms, and personalized practice workspaces.
          </p>
        </div>

        {isLoggingInWithGoogle ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px 0' }}>
            <RefreshCw size={36} style={{ color: 'var(--primary)', animation: 'spin 2s linear infinite' }} />
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>Connecting with Google...</p>
          </div>
        ) : (
          <button 
            onClick={handleGoogleLogin} 
            className="btn-google-login"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              width: '100%',
              padding: '16px 24px',
              borderRadius: '14px',
              border: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-cream)',
              color: 'var(--text-dark)',
              fontSize: '1rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" style={{ display: 'block' }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{import.meta.env.VITE_GOOGLE_CLIENT_ID ? 'Sign in with Google' : 'Sign in with Mock Google'}</span>
          </button>
        )}

        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '20px' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            By signing in, you agree to our Terms of Service & Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

interface DashboardPageProps {
  onBack: () => void;
  onStartLearning: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  onLogout: () => void;
  userData: {
    displayName: string;
    email: string;
    avatarUrl: string;
  } | null;
}

const DashboardPage: React.FC<DashboardPageProps> = ({
  onBack,
  onStartLearning,
  onCreateRoom,
  onJoinRoom,
  onLogout,
  userData
}) => {
  const [roomInput, setRoomInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const displayName = userData?.displayName || 'User';
  const avatarUrl = userData?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${displayName}`;

  return (
    <div className="dashboard-page-container" style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#111111',
      padding: '0 0 60px 0',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <style>{`
        .db-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform: translateY(0);
          background: #1a1a1a !important;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 28px;
          padding: 40px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          position: relative;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .db-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.3) !important;
        }
        .db-card-practice {
          border-top: 4px solid #10B981 !important;
        }
        .db-card-practice:hover {
          border-color: rgba(16, 185, 129, 0.4) !important;
        }
        .db-card-room {
          border-top: 4px solid #8B5CF6 !important;
        }
        .db-card-room:hover {
          border-color: rgba(139, 92, 246, 0.4) !important;
        }
        .db-nav-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          font-weight: 600;
          font-size: 0.9rem;
          transition: color 0.2s ease;
          padding: 8px 12px;
        }
        .db-nav-btn:hover {
          color: var(--text-dark);
        }
        .db-nav-btn-signout {
          color: rgba(139, 92, 246, 0.8);
        }
        .db-nav-btn-signout:hover {
          color: #8B5CF6;
        }
        .db-badge {
          font-size: 0.75rem;
          font-weight: 800;
          padding: 6px 12px;
          border-radius: 12px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          width: fit-content;
        }
        .db-badge-practice {
          background: rgba(16, 185, 129, 0.12);
          color: #34D399;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .db-badge-room {
          background: rgba(139, 92, 246, 0.12);
          color: #A78BFA;
          border: 1px solid rgba(139, 92, 246, 0.2);
        }
      `}</style>

      {/* Thin, Compact Top Navbar */}
      <nav style={{
        width: '100%',
        background: '#181818',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        height: '56px',
        display: 'flex',
        alignItems: 'center'
      }}>
        <div className="container" style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%'
        }}>
          {/* Left: Back to Home Link */}
          <button onClick={onBack} className="db-nav-btn">
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </button>

          {/* Right: Avatar Button with Sign Out Dropdown */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowDropdown(prev => !prev)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                outline: 'none',
                borderRadius: '50%'
              }}
            >
              <img 
                src={avatarUrl} 
                alt={displayName} 
                style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  objectFit: 'cover', 
                  border: showDropdown ? '2px solid #8B5CF6' : '1.5px solid var(--primary)',
                  transition: 'border 0.2s ease'
                }} 
              />
            </button>

            {showDropdown && (
              <>
                {/* Invisible backdrop overlay to close dropdown when clicking outside */}
                <div 
                  onClick={() => setShowDropdown(false)}
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 99,
                    background: 'transparent'
                  }}
                />
                
                {/* Dropdown Menu */}
                <div style={{
                  position: 'absolute',
                  top: '42px',
                  right: 0,
                  background: '#1e1e1e',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '8px',
                  minWidth: '165px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    marginBottom: '4px'
                  }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={displayName}>
                      {displayName}
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => { setShowDropdown(false); onLogout(); }}
                    className="db-nav-btn db-nav-btn-signout"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      justifyContent: 'flex-start'
                    }}
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Content Container */}
      <div className="container" style={{ 
        maxWidth: '1100px', 
        margin: '0 auto', 
        zIndex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '40px', 
        width: '100%',
        padding: '40px 24px 0 24px'
      }}>
        
        {/* Header Title area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--primary)' }}>Workspace Hub</span>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--text-dark)', margin: 0 }}>AI Translation Dashboard</h2>
        </div>

        {/* Main Centerpiece Actions Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '32px' }}>
          
          {/* Card 1: Practice Workspace */}
          <div className="db-card db-card-practice">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'rgba(16, 185, 129, 0.08)',
                color: '#34D399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Sparkles size={28} />
              </div>
              <span className="db-badge db-badge-practice">Active Module</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '1.6rem', fontWeight: '900', margin: 0, color: 'var(--text-dark)' }}>Practice Workspace</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.96rem', lineHeight: '1.6', margin: 0 }}>
                Learn and test 5 core Indian Sign Language phrases. Uses on-device MediaPipe models to detect hand landmarks locally through your camera stream.
              </p>
            </div>

            <button 
              onClick={onStartLearning} 
              style={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: '14px',
                border: 'none',
                backgroundColor: '#10B981',
                color: 'var(--text-light)',
                fontWeight: '800',
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginTop: 'auto',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#059669';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#10B981';
              }}
            >
              Open Practice Session
            </button>
          </div>

          {/* Card 2: Create / Join Meeting Room */}
          <div className="db-card db-card-room">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'rgba(139, 92, 246, 0.08)',
                color: '#A78BFA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Video size={28} />
              </div>
              <span className="db-badge db-badge-room">Collaborative</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '1.6rem', fontWeight: '900', margin: 0, color: 'var(--text-dark)' }}>Translation Meeting</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.96rem', lineHeight: '1.6', margin: 0 }}>
                Establish low-latency socket pipelines to translate sign language gestures and stream continuous chat text and audio between multiple connected peers.
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: 'auto' }}>
              <button 
                onClick={onCreateRoom} 
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  borderRadius: '14px',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  backgroundColor: 'transparent',
                  color: '#A78BFA',
                  fontWeight: '800',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.06)';
                  e.currentTarget.style.borderColor = '#8B5CF6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                }}
              >
                Create New Room
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  placeholder="Enter Room Code" 
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px 18px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    color: 'var(--text-dark)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#8B5CF6'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
                />
                <button 
                  onClick={() => { if (roomInput.trim()) onJoinRoom(roomInput.trim()); }} 
                  disabled={!roomInput.trim()}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '14px',
                    border: 'none',
                    backgroundColor: roomInput.trim() ? '#8B5CF6' : 'rgba(255,255,255,0.05)',
                    color: roomInput.trim() ? 'var(--text-light)' : 'var(--text-secondary)',
                    fontWeight: '800',
                    fontSize: '0.95rem',
                    cursor: roomInput.trim() ? 'pointer' : 'default',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (roomInput.trim()) {
                      e.currentTarget.style.backgroundColor = '#7C3AED';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (roomInput.trim()) {
                      e.currentTarget.style.backgroundColor = '#8B5CF6';
                    }
                  }}
                >
                  Join
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Small Bottom Stats Grid */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          textAlign: 'center'
        }}>
          <div>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px 0' }}>Learning Tier</h4>
            <p style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--text-dark)', margin: 0 }}>Beginner (5 Signs)</p>
          </div>
          <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.08)', borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px 0' }}>Practice Attempts</h4>
            <p style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--text-dark)', margin: 0 }}>37 gestures</p>
          </div>
          <div>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px 0' }}>Practice Accuracy</h4>
            <p style={{ fontSize: '1.3rem', fontWeight: '900', color: 'var(--primary)', margin: 0 }}>92.4%</p>
          </div>
        </div>

      </div>
    </div>
  );
};

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

  const [view, setView] = useState<'landing' | 'login' | 'dashboard' | 'self' | 'room'>('landing');

  // Modern Landing Page Interactive Practice States
  const [gameStep, setGameStep] = useState<'START' | 'LOADING' | 'PLAYING' | 'FINISHED'>('START');
  const [currentSignIndex, setCurrentSignIndex] = useState(0);
  const [isSignSuccess, setIsSignSuccess] = useState(false);
  const [gameLoadingMessage, setGameLoadingMessage] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ displayName: string; email: string; avatarUrl: string } | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoggingInWithGoogle, setIsLoggingInWithGoogle] = useState(false);

  const currentSignIndexRef = useRef(0);
  const isSignSuccessRef = useRef(false);

  useEffect(() => {
    currentSignIndexRef.current = currentSignIndex;
  }, [currentSignIndex]);

  useEffect(() => {
    isSignSuccessRef.current = isSignSuccess;
  }, [isSignSuccess]);
  
  // Room states
  const [roomId, setRoomId] = useState<string | null>(null);
  const [role, setRole] = useState<'signer' | 'listener' | null>(null);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [peerConnected, setPeerConnected] = useState(false);


  // Translation output states (Holds the list of subtitle words)
  const [translatedWords, setTranslatedWords] = useState<PredictedWord[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);

  // DOM element references
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const subtitlesTextRef = useRef<HTMLParagraphElement | null>(null);
  const dictionaryScrollRef = useRef<HTMLDivElement | null>(null);

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
  const lastFrameTimeRef = useRef(0); // Tracks timestamps to cap coordinate capture at 30 FPS
  
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

  // Redirect vertical mouse wheel scrolls to horizontal scrolling on the dictionary container
  useEffect(() => {
    const container = dictionaryScrollRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY * 0.8;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [view]);

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

  const handleNextGameSignAuto = () => {
    setIsSignSuccess(false);
    setCurrentSignIndex(prev => {
      const nextIndex = prev + 1;
      if (nextIndex < PRACTICE_SIGNS.length) {
        return nextIndex;
      } else {
        setGameStep('FINISHED');
        stopGameCamera();
        return prev;
      }
    });
  };

  const startGameDetectionLoop = (landmarker: HandLandmarker) => {
    const analyzeGameFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video && video.readyState >= 2 && canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }
          
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const timestamp = performance.now();
          const results = landmarker.detectForVideo(video, timestamp);
          
          if (results.landmarks && results.landmarks.length > 0) {
            drawHandSkeleton(ctx, results.landmarks);
            
            const now = performance.now();
            if (now - lastFrameTimeRef.current >= 33.33) { // 30 FPS Cap
              // Package coordinates sequentially (Option A: zero padding for up to 2 hands)
              const coords126: number[] = [];
              results.landmarks.slice(0, 2).forEach((handLandmarks) => {
                const coords = handLandmarks.flatMap(lm => [lm.x, lm.y, lm.z]);
                if (coords.length === 63) {
                  coords126.push(...coords);
                }
              });
              
              while (coords126.length < 126) {
                coords126.push(0.0);
              }
              
              const finalCoords = coords126.slice(0, 126);
              
              if (finalCoords.length === 126 && !isSendingRef.current && !isSignSuccessRef.current) {
                isSendingRef.current = true;
                lastFrameTimeRef.current = now;
                
                try {
                  const response = await fetch(`${backendUrl}/app/translate/translate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ frames: [finalCoords] })
                  });
                  const resData = await response.json();
                  if (resData.success && resData.data && resData.data.length > 0) {
                    const topPrediction = resData.data[0];
                    const currentSign = PRACTICE_SIGNS[currentSignIndexRef.current];
                    
                    if (currentSign && topPrediction.word === currentSign.label && topPrediction.confidence > 0.4) {
                      setIsSignSuccess(true);
                      
                      // Auto move to next sign after 1.5 seconds
                      setTimeout(() => {
                        handleNextGameSignAuto();
                      }, 1500);
                    }
                  }
                } catch (err) {
                  console.error('Game prediction failed:', err);
                } finally {
                  isSendingRef.current = false;
                }
              }
            }
          }
        }
      }
      animationFrameRef.current = requestAnimationFrame(analyzeGameFrame);
    };
    animationFrameRef.current = requestAnimationFrame(analyzeGameFrame);
  };

  const startGameCamera = async () => {
    setGameStep('LOADING');
    setGameLoadingMessage('Downloading MediaPipe model...');
    try {
      const landmarker = await loadMediaPipe();
      setGameLoadingMessage('Accessing webcam stream...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          aspectRatio: 1.333333
        }
      });
      
      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          startGameDetectionLoop(landmarker);
        };
      }
      setGameStep('PLAYING');
    } catch (err) {
      console.error(err);
      triggerToast('Camera access denied or model load failed.');
      setGameStep('START');
    }
  };

  const stopGameCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleNextGameSign = () => {
    setIsSignSuccess(false);
    if (currentSignIndex < PRACTICE_SIGNS.length - 1) {
      setCurrentSignIndex(prev => prev + 1);
    } else {
      setGameStep('FINISHED');
      stopGameCamera();
    }
  };

  const resetGamePractice = () => {
    setCurrentSignIndex(0);
    setIsSignSuccess(false);
    setGameStep('START');
  };

  // Synchronized particle wave canvas background animation with cursor interaction
  useEffect(() => {
    const canvas1 = document.getElementById('particle-wave-canvas') as HTMLCanvasElement | null;
    const canvas2 = document.getElementById('particle-wave-canvas-dashboard') as HTMLCanvasElement | null;
    const canvas = canvas1 || canvas2;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates tracker
    let mouseX = -1000;
    let mouseY = -1000;

    // Renders a static, high-performance uniform dot grid for mobile (0% CPU overhead!)
    const renderStaticMobileGrid = () => {
      ctx.clearRect(0, 0, width, height);
      const spacing = 28; // Uniform square spacing to prevent vertical stripes
      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const drawX = c * spacing;
          const drawY = r * spacing;

          // Alpha calculations to fade away at screen borders
          const alphaX = Math.sin((c / cols) * Math.PI);
          const alphaY = Math.sin((r / rows) * Math.PI);
          const alpha = alphaX * alphaY * 0.45; // Max opacity 45%

          // Tiranga color gradient from left to right (Saffron -> White -> Green)
          const ratio = drawX / width;
          let flagR = 143, flagG = 163, flagB = 150;
          
          if (ratio < 0.31) {
            // Saffron/Orange
            flagR = 255;
            flagG = 90;
            flagB = 0;
          } else if (ratio < 0.35) {
            // Transition
            const t = (ratio - 0.31) / 0.04;
            flagR = Math.round(255 - 15 * t);
            flagG = Math.round(90 + 150 * t);
            flagB = Math.round(0 + 240 * t);
          } else if (ratio < 0.63) {
            // White
            flagR = 240;
            flagG = 240;
            flagB = 240;
          } else if (ratio < 0.67) {
            // Transition
            const t = (ratio - 0.63) / 0.04;
            flagR = Math.round(240 - 230 * t);
            flagG = Math.round(240 - 55 * t);
            flagB = Math.round(240 - 150 * t);
          } else {
            // Green
            flagR = 10;
            flagG = 185;
            flagB = 90;
          }

          ctx.beginPath();
          ctx.arc(drawX, drawY, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${flagR}, ${flagG}, ${flagB}, ${alpha})`;
          ctx.fill();
        }
      }
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      if (window.innerWidth < 768) {
        renderStaticMobileGrid();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (window.innerWidth >= 768) {
        mouseX = e.clientX;
        mouseY = e.clientY;
      }
    };

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const cols = 45;
    const rows = 25;
    let spacingX = width / (cols - 1);
    let spacingY = height / (rows - 1);

    let count = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      count += 0.003; // extremely slow background drift to make cursor following the primary focus

      spacingX = width / (cols - 1);
      spacingY = height / (rows - 1);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * spacingX;
          const y = r * spacingY;

          // Wave calculations for diagnostic ripple waves
          const waveX = Math.sin(c * 0.15 + count) * 12;
          const waveY = Math.cos(r * 0.15 + count) * 12;
          const waveDiagonal = Math.sin((c + r) * 0.1 + count) * 18;

          let drawX = x + waveX;
          let drawY = y + waveY + waveDiagonal;

          // Scale particle dot radius dynamically based on diagonal wave phase (creates 3D wave depth feel!)
          let size = Math.max(1.2, 2.2 + Math.sin((c + r) * 0.1 + count) * 1.0);

          // Alpha calculations to fade away at screen borders (fades on left/right and top/bottom edges)
          const alphaX = Math.sin((c / cols) * Math.PI);
          const alphaY = Math.sin((r / rows) * Math.PI);
          let alpha = alphaX * alphaY * 0.45; // Max opacity 45% for a visible sage green color

          // Cursor interaction calculations (gravity/repulsion and focus glow)
          const dx = drawX - mouseX;
          const dy = drawY - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 220) {
            const force = (220 - dist) / 220; // 0 (far) to 1 (intersecting)
            const angle = Math.atan2(dy, dx);
            
            // Push particles away from cursor
            drawX += Math.cos(angle) * force * 35;
            drawY += Math.sin(angle) * force * 35;
            
            // Increase size and make it glow brighter when cursor is near
            size += force * 2.5;
            alpha = Math.min(0.95, alpha + force * 0.5);
          }

          // Calculate Tiranga color gradient from left to right (Saffron -> White -> Green)
          const ratio = drawX / width;
          let flagR = 143, flagG = 163, flagB = 150;
          
          if (ratio < 0.31) {
            // Solid Saffron
            flagR = 255;
            flagG = 90;
            flagB = 0;
          } else if (ratio < 0.35) {
            // Saffron to White narrow transition
            const t = (ratio - 0.31) / 0.04;
            flagR = Math.round(255 - 15 * t);
            flagG = Math.round(90 + 150 * t);
            flagB = Math.round(0 + 240 * t);
          } else if (ratio < 0.63) {
            // Solid White
            flagR = 240;
            flagG = 240;
            flagB = 240;
          } else if (ratio < 0.67) {
            // White to Green narrow transition
            const t = (ratio - 0.63) / 0.04;
            flagR = Math.round(240 - 230 * t);
            flagG = Math.round(240 - 55 * t);
            flagB = Math.round(240 - 150 * t);
          } else {
            // Solid Green
            flagR = 10;
            flagG = 185;
            flagB = 90;
          }

          ctx.beginPath();
          ctx.arc(drawX, drawY, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${flagR}, ${flagG}, ${flagB}, ${Math.min(0.9, alpha * 2.2)})`;
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    if (window.innerWidth < 768) {
      renderStaticMobileGrid();
    } else {
      render();
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [view]);

  // Load Google accounts client script and check existing session on mount
  useEffect(() => {
    // 1. Check for active HTTP-only cookie session
    const checkSession = async () => {
      try {
        const res = await fetch(`${backendUrl}/app/auth/me`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.loggedIn) {
            setIsLoggedIn(true);
            setUser(data.user);
            console.log('[AUTH] Restored session from secure cookies for:', data.user.email);
          }
        }
      } catch (err) {
        console.warn('[AUTH] Session check on mount failed:', err);
      }
    };

    // 2. Check for OAuth redirect callback code in the query params
    const checkOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      if (code) {
        // Clear code from URL bar immediately so refreshing doesn't replay it
        window.history.replaceState({}, document.title, window.location.pathname);
        setIsLoggingInWithGoogle(true);
        try {
          const res = await fetch(`${backendUrl}/app/auth/google-callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
            credentials: 'include'
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              setIsLoggedIn(true);
              setUser(data.user);
              setView('dashboard');
              triggerToast('Signed in with Google successfully.');
            } else {
              triggerToast(data.message || 'OAuth exchange failed.');
            }
          } else {
            triggerToast('Server failed to verify Google OAuth code.');
          }
        } catch (err) {
          console.error(err);
          triggerToast('OAuth connection failed.');
        } finally {
          setIsLoggingInWithGoogle(false);
        }
      }
    };

    checkSession();
    checkOAuthCallback();
  }, [backendUrl]);

  const handleGoogleLogin = async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    // A. Use official Google Redirect Flow if Client ID is configured
    if (clientId) {
      console.log('[AUTH] Initiating Google OAuth redirect flow...');
      setIsLoggingInWithGoogle(true);
      
      const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
      const options = {
        redirect_uri: window.location.origin, // Dynamically maps to localhost or your production domain
        client_id: clientId,
        access_type: 'offline',
        response_type: 'code',
        prompt: 'consent',
        scope: [
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
        ].join(' '),
      };

      const qs = new URLSearchParams(options);
      window.location.href = `${rootUrl}?${qs.toString()}`;
      return;
    }

    // B. Fallback to simulated developer Google popup if no client ID is set
    console.log('[AUTH] Falling back to simulated Google authentication login...');
    setIsLoggingInWithGoogle(true);
    
    // Simulate a secure OAuth popup dialog
    setTimeout(async () => {
      const mockEmail = prompt("VITE_GOOGLE_CLIENT_ID is not set in frontend/.env.\n\nEnter a mock Google account email to register/sign-in locally:", "ayandip@gmail.com");
      if (!mockEmail) {
        setIsLoggingInWithGoogle(false);
        return;
      }
      
      const mockName = mockEmail.split('@')[0].toUpperCase();
      const mockProfile = {
        googleId: `g_mock_${Date.now()}`,
        email: mockEmail,
        displayName: mockName,
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${mockName}`
      };

      try {
        const res = await fetch(`${backendUrl}/app/auth/google-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile: mockProfile }),
          credentials: 'include'
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setIsLoggedIn(true);
            setUser(data.user);
            setView('dashboard');
            triggerToast(`Successfully logged in as ${mockEmail}`);
          } else {
            triggerToast(data.message || 'Mock login failed.');
          }
        } else {
          triggerToast('Backend failed to process mock authentication.');
        }
      } catch (err) {
        console.error(err);
        triggerToast('Failed to connect to backend auth service.');
      } finally {
        setIsLoggingInWithGoogle(false);
      }
    }, 800);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${backendUrl}/app/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.warn('[AUTH] Logout request failed:', err);
    }
    setIsLoggedIn(false);
    setUser(null);
    setView('landing');
    triggerToast('Logged out successfully.');
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
        numHands: 2, // Support both hands tracking on the canvas
        minHandDetectionConfidence: 0.3,
        minHandPresenceConfidence: 0.3
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
        const words: PredictedWord[] = resData.data;
        
        if (words.length > 0) {
          setTranslatedWords(prev => {
            const updated = [...prev];
            let lastWord = updated[updated.length - 1]?.word;
            
            words.forEach(pred => {
              // Ignore word if it is repeated back-to-back (consecutive duplicate check)
              if (pred.word !== lastWord) {
                updated.push(pred);
                lastWord = pred.word;
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
      isSendingRef.current = false;
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
          
            // Draw hand skeleton skeleton feedback on every animation frame for maximum smoothness
            if (results.landmarks && results.landmarks.length > 0) {
              drawHandSkeleton(ctx, results.landmarks);
            }
            
            const now = performance.now();
            if (now - lastFrameTimeRef.current >= 33.33) { // 30 FPS Cap
              if (results.landmarks && results.landmarks.length > 0) {
                // Sequential hand coordinate extraction (Option A: ignores handedness to match model training)
                const coords126: number[] = [];
                
                // Extract up to 2 hands in detection order
                results.landmarks.slice(0, 2).forEach((handLandmarks) => {
                  const coords = handLandmarks.flatMap(lm => [lm.x, lm.y, lm.z]);
                  if (coords.length === 63) {
                    coords126.push(...coords);
                  }
                });
                
                // Pad remaining space with zeros if only 1 hand is detected
                while (coords126.length < 126) {
                  coords126.push(0.0);
                }
                
                // Safe slice to keep exactly 126 features
                const finalCoords = coords126.slice(0, 126);
                
                if (finalCoords.length === 126) {
                  if (!isSendingRef.current) {
                    isSendingRef.current = true;
                    lastFrameTimeRef.current = now;
                    sendFramesToBackend([finalCoords]);
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
          
          // If this user joins as Signer, immediately kick off the WebRTC offer 
          // in case the Listener is already in the room waiting.
          if (response.role === 'signer') {
            setupSignerWebRTCOffer(roomIdStr);
          }
        } else {
          console.error('Join room failed:', response.message);
          triggerToast(`Room join failed: ${response.message}`);
          handleLeaveRoom();
        }
      });
    });

    // Listen to incoming translation data subtitle transcript array (for Listener role)
    socket.on('translation-data', (data: { text: PredictedWord[]; signerId: string }) => {
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
      // In practice mode ('self' view), we want subtitles to scroll and grow naturally, not truncate.
      if (view === 'self') return;

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

  // Practice mode auto-scroller for overflowing subtitles
  useEffect(() => {
    if (view === 'self') {
      const el = subtitlesTextRef.current;
      if (el) {
        const container = el.parentElement;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }
    }
  }, [translatedWords, view]);

  return (
    <div className={view === 'landing' ? "landing-page-app-wrapper" : "zen-app animate-fade-in"}>
      
      {/* Toast Alert overlay */}
      {toastMessage && (
        <div className="status-toast">
          <Activity size={18} className="video-placeholder-icon" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Wave Particle Background Canvas (Fixed to viewport, outside animated container to bypass containing block limitations) */}
      {view === 'landing' && (
        <canvas id="particle-wave-canvas" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 0 }}></canvas>
      )}

      {/* Main Landing Screen */}
      {view === 'landing' && (
        <div className="landing-page-wrapper" style={{ width: '100%' }}>
          {/* Section 1: Navigation Bar */}
          <nav className="navbar" aria-label="Main Navigation">
            <div className="container nav-container">
              <a href="#" className="nav-logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <span>SilenTalk</span>
              </a>

              <ul className="nav-links">
                <li><a href="#try" onClick={(e) => { e.preventDefault(); document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' }); }}>Practice</a></li>
                <li><a href="#mission" onClick={(e) => { e.preventDefault(); document.getElementById('mission')?.scrollIntoView({ behavior: 'smooth' }); }}>Mission</a></li>
                <li><a href="#learn" onClick={(e) => { e.preventDefault(); document.getElementById('learn')?.scrollIntoView({ behavior: 'smooth' }); }}>Learn</a></li>
                <li><a href="#about" onClick={(e) => { e.preventDefault(); document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }); }}>About</a></li>
              </ul>

              <div className="nav-actions">
                {isLoggedIn ? (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button className="btn-login" onClick={() => setView('dashboard')} style={{ padding: '6px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Go to Dashboard</button>
                    <div className="user-avatar" onClick={handleLogout} title="Click to Sign Out" style={{ cursor: 'pointer' }}>
                      {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'AD'}
                    </div>
                  </div>
                ) : (
                  <button className="btn-login" onClick={() => setView('login')}>Login</button>
                )}
              </div>

              <button 
                className="hamburger" 
                onClick={() => setIsDrawerOpen(prev => !prev)} 
                aria-label="Toggle Navigation Menu"
              >
                {isDrawerOpen ? <X size={24} style={{ color: 'var(--text-dark)' }} /> : <Menu size={24} style={{ color: 'var(--text-dark)' }} />}
              </button>
            </div>
          </nav>

          {/* Mobile Navigation Drawer (Moved outside transformed container to fix containing-block bugs on scroll!) */}
          {isDrawerOpen && (
            <div className={`mobile-drawer ${isDrawerOpen ? 'open' : ''}`}>
              <ul className="nav-links" style={{ display: 'flex' }}>
                <li><a href="#try" onClick={(e) => { e.preventDefault(); document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' }); setIsDrawerOpen(false); }}>Practice</a></li>
                <li><a href="#mission" onClick={(e) => { e.preventDefault(); document.getElementById('mission')?.scrollIntoView({ behavior: 'smooth' }); setIsDrawerOpen(false); }}>Mission</a></li>
                <li><a href="#learn" onClick={(e) => { e.preventDefault(); document.getElementById('learn')?.scrollIntoView({ behavior: 'smooth' }); setIsDrawerOpen(false); }}>Learn</a></li>
                <li><a href="#about" onClick={(e) => { e.preventDefault(); document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }); setIsDrawerOpen(false); }}>About</a></li>
              </ul>
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {isLoggedIn ? (
                  <>
                    <button className="btn-login" onClick={() => { setView('dashboard'); setIsDrawerOpen(false); }}>Go to Dashboard</button>
                    <button className="btn-login" onClick={() => { handleLogout(); setIsDrawerOpen(false); }} style={{ borderColor: 'var(--danger-soft)', color: 'var(--danger)' }}>Sign Out</button>
                  </>
                ) : (
                  <button className="btn-login" onClick={() => { setIsDrawerOpen(false); setView('login'); }}>Login</button>
                )}
              </div>
            </div>
          )}

          <div className="animate-fade-in" style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Ambient Glowing Background Hues */}
            <div className="ambient-glow-1"></div>
            <div className="ambient-glow-2"></div>
            <div className="ambient-glow-3"></div>

          {/* Section 2: Hero Section */}
          <header className="landing-hero">
            <div className="container hero-content">
              <h1 className="hero-title-main">
                <span className="flag-saffron">Indian</span><br />
                <span className="flag-white">Sign</span><br />
                <span className="flag-green">Language</span>
              </h1>
              <p className="hero-subtitle">Breaking barriers, one sign at a time.</p>
              
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '20px' }}>
                <button onClick={() => document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' })} className="btn-landing-cta">
                  <span>Start Practicing</span>
                  <ChevronRight size={18} />
                </button>
                {isLoggedIn && (
                  <>
                    <button onClick={enterSelfPractice} className="btn-landing-cta" style={{ background: 'transparent', border: '2px solid var(--primary)', color: 'var(--primary)', boxShadow: 'none' }}>
                      <span>Practice Workspace</span>
                      <Sparkles size={18} style={{ marginLeft: '8px' }} />
                    </button>
                    <button onClick={triggerCreateRoom} className="btn-landing-cta" style={{ background: 'var(--primary)', color: 'var(--text-light)', border: 'none' }}>
                      <span>Create Room</span>
                      <Video size={18} style={{ marginLeft: '8px' }} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Section 3: Mission Section */}
          <section id="mission" className="mission-section">
            <div className="container mission-grid">
              <div className="mission-image-card" style={{ width: '100%', borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--border-light)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                <img src="/assets/isl_mission_communication.png" alt="Two Indian people communicating using Indian Sign Language" style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>
              <div className="mission-content" style={{ textAlign: 'left' }}>
                <span className="section-label">Our Purpose</span>
                <h2 className="section-title">Our Mission</h2>
                <p className="mission-text">
                  Silent Voice exists to bridge the communication gap for India's 18 million+ deaf and hard-of-hearing community. We leverage AI and computer vision to translate Indian Sign Language in real-time, making everyday interactions — at schools, hospitals, banks, and public spaces — accessible, dignified, and effortless. Every sign matters. Every voice deserves to be heard.
                </p>
                <div className="stat-card-group">
                  <div className="stat-card-item">
                    <h4>18M+</h4>
                    <p>People</p>
                  </div>
                  <div className="stat-card-item">
                    <h4>400+</h4>
                    <p>ISL Signs</p>
                  </div>
                  <div className="stat-card-item">
                    <h4>Real-time</h4>
                    <p>Translation</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Try It Yourself Interactive Practice Game */}
          <section id="try" className="practice-game-section">
            <div className="container">
              <div className="try-header">
                <span className="section-label">Interactive Practice</span>
                <h2 className="section-title">Try It Yourself</h2>
                <p style={{ color: 'var(--text-muted)', fontWeight: 600, marginTop: '8px' }}>Practice 5 essential ISL signs with your camera</p>
              </div>

              <div className="practice-game-container">
                {gameStep === 'START' && (
                  <div className="try-start-screen" style={{ margin: '0 auto', maxWidth: '500px' }}>
                    <div className="zen-card-icon" style={{ width: '80px', height: '80px', margin: '0 auto 1.5rem auto' }}>
                      <Camera size={36} />
                    </div>
                    <h3 style={{ fontSize: '1.6rem', marginBottom: '12px' }}>Interactive Sign Practice</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>To start practicing, grant camera permission. All video frames are processed locally inside your browser and never sent to any server.</p>
                    <button className="zen-btn zen-btn-primary" onClick={startGameCamera}>Start Camera</button>
                  </div>
                )}

                {(gameStep === 'PLAYING' || gameStep === 'LOADING') && (
                  <div className="practice-game-split">
                    <div className="practice-game-left">
                      {gameStep === 'LOADING' ? (
                        <div className="try-loader" style={{ margin: '0 auto', minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <RefreshCw size={48} className="video-placeholder-icon" style={{ color: 'var(--primary)', marginBottom: '1.5rem', animation: 'spin 2s linear infinite' }} />
                          <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Configuring Model</h3>
                          <p style={{ color: 'var(--text-muted)' }}>{gameLoadingMessage}</p>
                        </div>
                      ) : (
                        <>
                          <div className="sign-reference-card">
                            <img src={PRACTICE_SIGNS[currentSignIndex].image} alt={`Visual instructions for ${PRACTICE_SIGNS[currentSignIndex].name} sign`} />
                            <div className="sign-target-label" style={{ left: '16px', bottom: '16px', background: 'rgba(15,23,42,0.85)' }}>
                              Instruction: {PRACTICE_SIGNS[currentSignIndex].name}
                            </div>
                            <div className={`success-match-overlay ${isSignSuccess ? 'active' : ''}`}>
                              <Check size={48} />
                              <h3 style={{ color: '#fff', marginTop: '12px', fontSize: '1.5rem' }}>Perfect Match!</h3>
                            </div>
                          </div>
                          <div className="sign-desc-box" style={{ textAlign: 'left' }}>
                            <strong>How to perform:</strong> {PRACTICE_SIGNS[currentSignIndex].description}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="practice-game-right">
                      <div className="video-wrapper" style={{ width: '100%', margin: 0, aspectRatio: '1.333333', position: 'relative' }}>
                        <video ref={videoRef} className="video-feed" playsInline muted style={{ transform: 'scaleX(-1)', width: '100%', height: '100%', objectFit: 'cover' }}></video>
                        <canvas ref={canvasRef} className="video-canvas" style={{ transform: 'scaleX(-1)' }}></canvas>
                        {gameStep === 'LOADING' && (
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            background: 'rgba(15, 23, 42, 0.85)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontWeight: 'bold',
                            borderRadius: '24px',
                            zIndex: 20
                          }}>
                            Connecting camera feed...
                          </div>
                        )}
                      </div>
                      <div className="practice-controls">
                        <p style={{ fontWeight: 800, color: 'var(--text-muted)' }}>
                          {gameStep === 'LOADING' ? "Preparing signs..." : `Sign ${currentSignIndex + 1} of 5`}
                        </p>
                        {isSignSuccess && gameStep === 'PLAYING' && (
                          <button className="btn-next-sign" onClick={handleNextGameSign}>
                            {currentSignIndex === PRACTICE_SIGNS.length - 1 ? "Finish Session" : "Next Sign"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {gameStep === 'FINISHED' && (
                  <div className="try-finish-screen" style={{ margin: '0 auto', maxWidth: '480px' }}>
                    <div className="zen-card-icon" style={{ width: '80px', height: '80px', margin: '0 auto 1.5rem auto', backgroundColor: 'var(--accent-primary)', color: '#fff' }}>
                      <Check size={36} />
                    </div>
                    <h3 style={{ fontSize: '1.8rem', marginBottom: '12px' }}>Congratulations!</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>You've successfully completed the practice course! Want to continue? Please login to save progress, unlock 400+ vocabulary signs, and join live P2P rooms.</p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                      <button className="zen-btn zen-btn-primary" onClick={() => setView('login')}>Login / Sign Up</button>
                      <button className="zen-btn zen-btn-secondary" onClick={resetGamePractice}>Practice Again</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="full-app-cta-card">
                <div style={{ textAlign: 'left' }}>
                  <h3>Ready to translate full conversations?</h3>
                  <p>Connect with other signers and translate streaming conversations instantly.</p>
                </div>
                <button className="btn-open-app" onClick={() => setView('login')}>Open Silent Voice App</button>
              </div>
            </div>
          </section>

          {/* Section 5: Learn Section (Flip Cards) */}
          <section id="learn" className="learn-grid-container">
            <div className="container">
              <div className="learn-header">
                <span className="section-label">Dictionary</span>
                <h2 className="section-title">Learn Common Signs</h2>
              </div>
              
              <div className="learn-cards-scroll-container" ref={dictionaryScrollRef}>
                <div className="learn-cards-grid">
                  {[
                    {
                      name: "How Much",
                      image: "/assets/isl_sign_howmuch.png",
                      desc: "Hold both hands in front of your chest with index fingers pointing directly towards each other horizontally and thumbs extended upwards."
                    },
                    {
                      name: "Take Care",
                      image: "/assets/isl_sign_please.png",
                      desc: "Extend your hand flat and circle it gently over your chest."
                    },
                    {
                      name: "I Love You",
                      image: "/assets/isl_sign_iloveyou.png",
                      desc: "Raise one hand, extending the index finger, pinky finger, and thumb, while holding the middle and ring fingers down."
                    },
                    {
                      name: "You",
                      image: "/assets/isl_sign_you.png",
                      desc: "Point your dominant hand's index finger directly forward towards the screen/viewer."
                    },
                    {
                      name: "God's Plan",
                      image: "/assets/isl_sign_godsplan.png",
                      desc: "Raise both hands high, pointing index fingers upwards towards the sky."
                    },
                    {
                      name: "Hello",
                      image: "/assets/isl_sign_hello.png",
                      desc: "Hold your dominant hand up with fingers open and extended, facing the screen in a friendly wave."
                    }
                  ].map((sign, index) => (
                    <div className="dictionary-card" key={index}>
                      <div className="dictionary-card-inner">
                        <div className="dict-front">
                          <img src={sign.image} alt={sign.name} style={{ width: '100%', height: '140px', objectFit: 'contain', marginBottom: '12px' }} />
                          <h3 style={{ fontSize: '1.4rem' }}>{sign.name}</h3>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Hover to reveal details</p>
                        </div>
                        <div className="dict-back">
                          <h4 style={{ fontSize: '1.1rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>How to Perform</h4>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', lineHeight: '1.4' }}>{sign.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Section 6: About Section */}
          <section id="about" className="about-team-section">
            <div className="container">
              <div className="about-header">
                <span className="section-label">Team & Platform</span>
                <h2 className="section-title">Meet the Team Behind</h2>
              </div>
              <p className="about-intro">
                Silent Voice is designed to modernize communications. Combining bleeding-edge browser-level computer vision and neural networking pipelines, the platform translates body postures and gestural language into readable transcripts in milliseconds.
              </p>

              <div className="team-avatars-grid">
                {[
                  { name: "Ayandip", role: "Fullstack Engineer & Lead", img: "/assets/member1.jpg" },
                  { name: "Dipayan", role: "AI Engineer", img: "/assets/member2.jpg" },
                  { name: "Devjit", role: "Python Dev", img: "/assets/member3.jpg" },
                  { name: "Aniket", role: "Lead ML Engineer", img: "/assets/member4.jpg" },
                  { name: "Pallab", role: "AI Researcher", img: "/assets/member5.jpg" }
                ].map((member, index) => (
                  <div className="team-member-card" key={index}>
                    {member.img ? (
                      <img 
                        src={member.img} 
                        alt={`${member.name} - ${member.role}`} 
                        className="team-member-avatar"
                        style={{ objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <div className="team-member-avatar">{member.name.slice(0, 2).toUpperCase()}</div>
                    )}
                    <h4>{member.name}</h4>
                    <p>{member.role}</p>
                  </div>
                ))}
              </div>

              <div className="tech-container">
                <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '8px' }}>Tech Stack Integration</h3>
                <div className="tech-badges">
                  <div className="tech-logo-item">
                    <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/google.svg" alt="Google MediaPipe logo" className="tech-logo-img" />
                    <span className="tech-logo-label">MediaPipe</span>
                  </div>
                  <div className="tech-logo-item">
                    <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/keras.svg" alt="Keras logo" className="tech-logo-img" />
                    <span className="tech-logo-label">Keras</span>
                  </div>
                  <div className="tech-logo-item">
                    <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/tensorflow.svg" alt="TensorFlow logo" className="tech-logo-img" />
                    <span className="tech-logo-label">TensorFlow</span>
                  </div>
                  <div className="tech-logo-item">
                    <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/django.svg" alt="Django logo" className="tech-logo-img" />
                    <span className="tech-logo-label">Django</span>
                  </div>
                  <div className="tech-logo-item">
                    <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/express.svg" alt="Express logo" className="tech-logo-img" />
                    <span className="tech-logo-label">Express</span>
                  </div>
                  <div className="tech-logo-item">
                    <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/react.svg" alt="React logo" className="tech-logo-img" />
                    <span className="tech-logo-label">React</span>
                  </div>
                  <div className="tech-logo-item">
                    <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/vite.svg" alt="Vite logo" className="tech-logo-img" />
                    <span className="tech-logo-label">Vite</span>
                  </div>
                  <div className="tech-logo-item">
                    <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/typescript.svg" alt="TypeScript logo" className="tech-logo-img" />
                    <span className="tech-logo-label">TypeScript</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 7: Footer */}
          <footer className="footer-section">
            <div className="container">
              <div className="footer-main-grid">
                <div className="footer-brand" style={{ textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-color)' }}>
                    <span>SilenTalk</span>
                  </div>
                  <p className="footer-brand-tagline">Real-time Indian Sign Language translation bridging gaps across schools, offices, and society.</p>
                </div>
                <div className="footer-links-group" style={{ textAlign: 'left' }}>
                  <h4>Quick Links</h4>
                  <ul className="footer-nav-links">
                    <li><a href="#try" onClick={(e) => { e.preventDefault(); document.getElementById('try')?.scrollIntoView({ behavior: 'smooth' }); }}>Practice Game</a></li>
                    <li><a href="#mission" onClick={(e) => { e.preventDefault(); document.getElementById('mission')?.scrollIntoView({ behavior: 'smooth' }); }}>Our Mission</a></li>
                    <li><a href="#learn" onClick={(e) => { e.preventDefault(); document.getElementById('learn')?.scrollIntoView({ behavior: 'smooth' }); }}>Learn Dictionary</a></li>
                    <li><a href="#about" onClick={(e) => { e.preventDefault(); document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }); }}>About Team</a></li>
                  </ul>
                </div>
              </div>
              <div className="footer-bottom-bar">
                <p>&copy; 2026 SilenTalk. All rights reserved.</p>
                <p style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Made with <Heart size={14} style={{ fill: 'red', stroke: 'red' }} /> for the Indian Deaf Community</p>
              </div>
            </div>
          </footer>

          </div>
        </div>
      )}

      {view === 'login' && (
        <LoginPage 
          backendUrl={backendUrl}
          onBack={() => setView('landing')}
          onLoginSuccess={() => setView('landing')}
          triggerToast={triggerToast}
          isLoggingInWithGoogle={isLoggingInWithGoogle}
          setIsLoggingInWithGoogle={setIsLoggingInWithGoogle}
          handleGoogleLogin={handleGoogleLogin}
        />
      )}

      {view === 'dashboard' && (
        <DashboardPage 
          onBack={() => setView('landing')}
          onStartLearning={() => { setView('self'); }}
          onCreateRoom={triggerCreateRoom}
          onJoinRoom={(rid) => { setRoomId(rid); setRole(null); setView('room'); }}
          onLogout={handleLogout}
          userData={user}
        />
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

          <div className="room-content practice-layout">
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
                    {translatedWords.map((item, idx) => (
                      <span key={idx} className="subtitles-word">
                        {item.word}
                        <span className="word-confidence" style={{ fontSize: '0.75em', opacity: 0.6, marginLeft: '4px' }}>
                          ({(item.confidence * 100).toFixed(0)}%)
                        </span>
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
                    {translatedWords.map((item, idx) => (
                      <span key={idx} className="subtitles-word">
                        {item.word}
                        <span className="word-confidence" style={{ fontSize: '0.75em', opacity: 0.6, marginLeft: '4px' }}>
                          ({(item.confidence * 100).toFixed(0)}%)
                        </span>
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
