import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      setError('Failed to log in with Google. Ensure the provider is enabled in Firebase Console.');
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    try {
      setError('');
      setLoading(true);
      const provider = new OAuthProvider('microsoft.com');
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      setError('Failed to log in with Microsoft. Ensure the provider is enabled in Firebase Console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/logo.jpeg" alt="Capstone Logo" style={{ height: '80px', borderRadius: '50%', marginBottom: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
        <h1>Welcome Back</h1>
        <p>Sign in to access the Women's Safety Dashboard</p>
        
        {error && <div className="login-error">{error}</div>}

        <button 
          className="login-btn google" 
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
          Sign in with Google
        </button>

        <button 
          className="login-btn microsoft" 
          onClick={handleMicrosoftLogin}
          disabled={loading}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/microsoft.svg" alt="Microsoft" />
          Sign in with Microsoft
        </button>
      </div>
    </div>
  );
}
