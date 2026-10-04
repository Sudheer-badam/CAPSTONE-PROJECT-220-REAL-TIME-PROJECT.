import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function AdminManagerModal({ isOpen, onClose }) {
  const [tempAdmins, setTempAdmins] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  
  const [verifying, setVerifying] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setNewAdminEmail('');
      setVerifiedUser(null);
      setVerifyError('');
      return;
    }
    const unsub = onSnapshot(collection(db, 'temporary_admins'), (snapshot) => {
      const admins = [];
      snapshot.forEach(doc => {
        admins.push({ email: doc.id, ...doc.data() });
      });
      setTempAdmins(admins);
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEmailChange = (e) => {
    setNewAdminEmail(e.target.value);
    setVerifiedUser(null);
    setVerifyError('');
  };

  const handleVerify = async () => {
    if (!newAdminEmail.trim()) return;
    setVerifying(true);
    setVerifiedUser(null);
    setVerifyError('');

    try {
      const q = query(collection(db, 'user_logins'), where('email', '==', newAdminEmail.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docs = querySnapshot.docs.map(d => d.data());
        docs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const userDetails = docs[0];
        
        setVerifiedUser({
          name: userDetails.user_name,
          email: userDetails.email,
          photoUrl: userDetails.photo_url || null,
          isNew: false
        });
      } else {
        // Fallback: Use the email prefix as their "name" until they log in
        const emailPrefix = newAdminEmail.split('@')[0];
        const formattedName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1).toLowerCase();
        
        setVerifiedUser({
          name: `${formattedName} (Not Registered Yet)`,
          email: newAdminEmail.trim().toLowerCase(),
          photoUrl: null,
          isNew: true
        });
      }
    } catch (err) {
      console.error("Verification error:", err);
      setVerifyError("Error verifying user.");
    } finally {
      setVerifying(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!verifiedUser) return;
    try {
      await setDoc(doc(db, 'temporary_admins', verifiedUser.email), {
        added_at: new Date().toISOString()
      });
      setNewAdminEmail('');
      setVerifiedUser(null);
    } catch (error) {
      console.error("Error adding admin:", error);
      alert("Failed to add admin");
    }
  };

  const handleRemoveAdmin = async (email) => {
    if (window.confirm(`Are you sure you want to remove ${email} from temporary admins?`)) {
      try {
        await deleteDoc(doc(db, 'temporary_admins', email));
      } catch (error) {
        console.error("Error removing admin:", error);
        alert("Failed to remove admin");
      }
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '500px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)', color: 'black'
      }}>
        <h2 style={{ marginTop: 0 }}>Manage Temporary Admins</h2>
        <p style={{ fontSize: '14px', color: '#555' }}>
          Temporary admins get all admin features (live map, resolving alerts, broadcast viewing) except adding other admins.
        </p>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <input 
            type="email" 
            placeholder="User Email" 
            value={newAdminEmail}
            onChange={handleEmailChange}
            style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
          />
          <button 
            onClick={handleVerify}
            disabled={verifying || !newAdminEmail.trim() || verifiedUser}
            style={{
              padding: '10px 20px', background: verifiedUser ? '#6c757d' : '#007bff', color: 'white',
              border: 'none', borderRadius: '6px', cursor: (verifying || verifiedUser) ? 'not-allowed' : 'pointer', fontWeight: 'bold'
            }}
          >
            {verifying ? 'Verifying...' : (verifiedUser ? 'Verified' : 'Verify')}
          </button>
        </div>
        
        {verifyError && <div style={{ color: 'red', fontSize: '13px', marginBottom: '15px' }}>{verifyError}</div>}

        {verifiedUser && (
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', 
            background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef', marginBottom: '20px'
          }}>
            {verifiedUser.photoUrl ? (
              <img src={verifiedUser.photoUrl} alt="Profile" style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
            ) : (
              <div style={{ 
                width: '50px', height: '50px', borderRadius: '50%', background: '#D4AF37', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '20px' 
              }}>
                {verifiedUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', fontSize: '16px' }}>{verifiedUser.name}</strong>
              <span style={{ fontSize: '13px', color: '#666' }}>{verifiedUser.email}</span>
            </div>
            <button 
              onClick={handleAddAdmin}
              style={{
                padding: '10px 20px', background: '#28a745', color: 'white',
                border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
              }}
            >
              Confirm Add
            </button>
          </div>
        )}

        <div>
          <h3 style={{ fontSize: '16px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>Current Temporary Admins</h3>
          {tempAdmins.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>No temporary admins added.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '200px', overflowY: 'auto' }}>
              {tempAdmins.map((admin) => (
                <li key={admin.email} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  padding: '10px 0', borderBottom: '1px solid #eee' 
                }}>
                  <span>{admin.email}</span>
                  <button 
                    onClick={() => handleRemoveAdmin(admin.email)}
                    style={{
                      padding: '5px 10px', background: '#dc3545', color: 'white',
                      border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button 
          onClick={onClose}
          style={{
            marginTop: '25px', width: '100%', padding: '12px', background: '#6c757d', color: 'white',
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
