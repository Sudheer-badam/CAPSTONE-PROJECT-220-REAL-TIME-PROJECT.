import { useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { signInWithPopup, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleCaptchaChange = (value) => {
    // value is the captcha token, null if expired
    if (value) {
      setCaptchaVerified(true);
    } else {
      setCaptchaVerified(false);
    }
  };

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

        <div className="recaptcha-wrapper">
          <ReCAPTCHA
            sitekey="6LdrbMgtAAAAACEWwnDxgujYnoFh0k06KeS3DgK4"
            onChange={handleCaptchaChange}
          />
        </div>

        <div className="terms-wrapper">
          <label className="terms-label">
            <input 
              type="checkbox" 
              checked={termsAccepted} 
              onChange={(e) => setTermsAccepted(e.target.checked)} 
            />
            <span>I agree to the <a>Terms & Conditions</a> and <a>Privacy Policy</a></span>
          </label>
        </div>

        <button
          className="login-btn google"
          onClick={handleGoogleLogin}
          disabled={loading || !captchaVerified || !termsAccepted}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
          Sign in with Google
        </button>

        <button
          className="login-btn microsoft"
          onClick={handleMicrosoftLogin}
          disabled={loading || !captchaVerified || !termsAccepted}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/microsoft.svg" alt="Microsoft" />
          Sign in with Microsoft
        </button>
      </div>
    </div>
  );
}
