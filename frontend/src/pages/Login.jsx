import { useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { signInWithPopup, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'terms' | 'privacy' | null

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
            <span>I agree to the <a onClick={() => setActiveModal('terms')}>Terms & Conditions</a> and <a onClick={() => setActiveModal('privacy')}>Privacy Policy</a></span>
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

      {/* Terms and Conditions Modal */}
      {activeModal === 'terms' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Terms & Conditions</h2>
            <p>Welcome to the Women's Safety Dashboard. By using this application, you agree to the following terms:</p>
            <h3>1. Purpose of the Platform</h3>
            <p>This platform is designed to analyze social media sentiment and identify potential risk zones to enhance women's safety. It is an analytical tool and should not be used as a replacement for emergency services (like 911).</p>
            <h3>2. User Responsibilities</h3>
            <ul>
              <li>You agree to use the data provided responsibly and ethically.</li>
              <li>You must not use this platform to harass, stalk, or harm any individuals.</li>
              <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
            </ul>
            <h3>3. Data Accuracy</h3>
            <p>While we use advanced AI models to predict risk and analyze sentiment, predictions are not 100% accurate. We are not liable for any actions taken based solely on the dashboard's automated insights.</p>
            <button className="close-modal-btn" onClick={() => setActiveModal(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {activeModal === 'privacy' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Privacy Policy</h2>
            <p>Your privacy is important to us. This policy outlines how we handle your data:</p>
            <h3>1. Information We Collect</h3>
            <p>We collect your basic profile information (Name, Email) when you authenticate via Google or Microsoft. We do not store your passwords.</p>
            <h3>2. How We Use Your Data</h3>
            <p>Your email is strictly used for authentication and authorization to access the secure dashboard. We do not sell your personal data to third parties.</p>
            <h3>3. IoT and Location Data</h3>
            <p>The SOS events and location data displayed on the dashboard are simulated or aggregated for analytical purposes. Any real-world IoT integrations are strictly bound by localized privacy laws and anonymized before processing.</p>
            <button className="close-modal-btn" onClick={() => setActiveModal(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
