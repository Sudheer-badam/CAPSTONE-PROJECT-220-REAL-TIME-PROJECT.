import os
import firebase_admin
from firebase_admin import credentials, firestore
from app.config import settings

# Initialize Firebase only once
_db = None

def get_firestore_db():
    global _db
    if _db is not None:
        return _db

    # Look for the credentials file path in the environment, Render's default, or local
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
    if not cred_path:
        if os.path.exists("/etc/secrets/firebase-credentials.json"):
            cred_path = "/etc/secrets/firebase-credentials.json"
        else:
            cred_path = "firebase-credentials.json"
            
    if os.path.exists(cred_path):
        try:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            _db = firestore.client()
            print(f"Firebase initialized successfully using {cred_path}")
        except Exception as e:
            raise Exception(f"Failed to initialize Firebase: {e}")
    else:
        raise Exception(f"Firebase credentials not found at {cred_path}. Firebase integration is required.")
        
    return _db

def sync_iot_event(event_data: dict):
    """
    Syncs an IoT event (like SOS or Location Update) to Firestore
    so that frontend clients can listen to it in real-time.
    """
    db = get_firestore_db()
    if not db:
        return
        
    try:
        # We store events in a 'iot_events' collection
        doc_ref = db.collection('iot_events').document()
        # Ensure datetimes are converted to strings if they are not already
        if 'created_at' in event_data and not isinstance(event_data['created_at'], str):
            event_data['created_at'] = event_data['created_at'].isoformat()
            
        doc_ref.set(event_data)
        print(f"Successfully synced IoT Event to Firebase: {doc_ref.id}")
    except Exception as e:
        print(f"Error syncing IoT Event to Firebase: {e}")

def sync_risk_zone(zone_data: dict):
    """
    Syncs a risk zone to Firestore.
    """
    db = get_firestore_db()
    if not db:
        return
        
    try:
        # We store risk zones in a 'risk_zones' collection. 
        # Using zone ID as the document ID for easy updates.
        doc_id = str(zone_data.get('id', 'new_zone'))
        doc_ref = db.collection('risk_zones').document(doc_id)
        
        if 'calculated_at' in zone_data and not isinstance(zone_data['calculated_at'], str):
            zone_data['calculated_at'] = zone_data['calculated_at'].isoformat()
            
        doc_ref.set(zone_data)
    except Exception as e:
        print(f"Error syncing Risk Zone to Firebase: {e}")
