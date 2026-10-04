import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function AdminManagerModal({ isOpen, onClose }) {
  const [tempAdmins, setTempAdmins] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  useEffect(() => {
    if (!isOpen) return;
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

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    try {
      await setDoc(doc(db, 'temporary_admins', newAdminEmail.trim().toLowerCase()), {
        added_at: new Date().toISOString()
      });
      setNewAdminEmail('');
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

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input 
            type="email" 
            placeholder="User Email" 
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
          />
          <button 
            onClick={handleAddAdmin}
            style={{
              padding: '10px 20px', background: '#28a745', color: 'white',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            Add Admin
          </button>
        </div>

        <div>
          <h3 style={{ fontSize: '16px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>Current Temporary Admins</h3>
          {tempAdmins.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>No temporary admins added.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
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
