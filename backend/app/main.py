from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from google.cloud.firestore import Query
import pandas as pd
import json
import os
import requests
from datetime import datetime

from app.database import get_db
from app.schemas import schemas
from app.services.risk_service import recalculate_risk_zones, check_if_in_risk_zone, get_ist_now
from app.ml.preprocess import clean_text
from app.ml.sentiment import analyze_sentiment
from app.ml.classifier import classify_incident
from app.config import settings

app = FastAPI(
    title="Women's Safety Platform API",
    description="API for B.Tech Capstone Project (Firebase Firestore Edition)",
    version="1.0.0"
)

def get_address_from_coords(lat, lon):
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}"
        headers = {'User-Agent': 'WomensSafetyApp/1.0'}
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return data.get('display_name', 'Unknown Location')
    except Exception as e:
        print(f"Error reverse geocoding: {e}")
    return "Unknown Location"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

@app.get("/api/debug/firebase")
def debug_firebase():
    import os
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-credentials.json")
    exists = os.path.exists(cred_path)
    content_preview = None
    if exists:
        try:
            with open(cred_path, 'r') as f:
                content = f.read()
                content_preview = content[:50] + "..."
        except Exception as e:
            content_preview = str(e)
            
    try:
        from app.firebase_service import get_firestore_db
        get_firestore_db()
        status = "Success"
        error = None
    except Exception as e:
        status = "Failed"
        error = str(e)
        
    return {
        "cred_path": cred_path,
        "exists": exists,
        "content_preview": content_preview,
        "init_status": status,
        "error": error
    }

@app.post("/api/analysis/run")
def run_analysis(db = Depends(get_db)):
    """Reads dataset, analyzes it, and populates database."""
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
        
    data_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'safety_posts.csv'))
    if not os.path.exists(data_path):
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    df = pd.read_csv(data_path)
    
    # Clear existing data
    for doc in db.collection('posts').stream():
        doc.reference.delete()
    for doc in db.collection('analysis_results').stream():
        doc.reference.delete()
    
    batch = db.batch()
    count = 0
    
    for _, row in df.iterrows():
        raw_text = str(row['text'])
        cleaned = clean_text(raw_text)
        
        post_date = datetime.strptime(row['date'], '%Y-%m-%d').date().isoformat() if pd.notnull(row['date']) else None
        post_time = datetime.strptime(row['time'], '%H:%M:%S').time().isoformat() if pd.notnull(row['time']) else None
        
        sentiment_res = analyze_sentiment(cleaned)
        class_res = classify_incident(cleaned)
        incident_type = str(row['incident_type']) if pd.notnull(row['incident_type']) else class_res['incident_type']
        
        post_ref = db.collection('posts').document()
        post_data = {
            "id": post_ref.id,
            "text": raw_text,
            "cleaned_text": cleaned,
            "date": post_date,
            "time": post_time,
            "location": str(row['location']) if pd.notnull(row['location']) else None,
            "latitude": float(row['latitude']) if pd.notnull(row['latitude']) else None,
            "longitude": float(row['longitude']) if pd.notnull(row['longitude']) else None,
            "created_at": get_ist_now().isoformat(),
            # Denormalize analysis results for easier querying in NoSQL
            "sentiment": sentiment_res['sentiment_label'],
            "incident_type": incident_type
        }
        batch.set(post_ref, post_data)
        
        analysis_ref = db.collection('analysis_results').document()
        analysis_data = {
            "id": analysis_ref.id,
            "post_id": post_ref.id,
            "sentiment": sentiment_res['sentiment_label'],
            "positive_score": sentiment_res['positive_score'],
            "negative_score": sentiment_res['negative_score'],
            "neutral_score": sentiment_res['neutral_score'],
            "compound_score": sentiment_res['compound_score'],
            "incident_type": incident_type,
            "confidence": class_res['confidence'],
            "created_at": get_ist_now().isoformat()
        }
        batch.set(analysis_ref, analysis_data)
        
        count += 1
        if count >= 400: # Firestore batch limit is 500
            batch.commit()
            batch = db.batch()
            count = 0
            
    if count > 0:
        batch.commit()
    
    recalculate_risk_zones(db)
    
    return {"message": "Analysis complete and database populated."}


@app.get("/api/dashboard/summary", response_model=schemas.DashboardSummaryResponse)
def get_dashboard_summary(db = Depends(get_db)):
    if not db: return {}
    
    # In Firestore, counting requires scanning or using aggregate queries
    posts = list(db.collection('posts').stream())
    analysis = list(db.collection('analysis_results').stream())
    zones = list(db.collection('risk_zones').where('status', '==', 'Active').stream())
    events = list(db.collection('iot_events').stream())
    
    pos_count = sum(1 for a in analysis if a.to_dict().get('sentiment') == 'Positive')
    neg_count = sum(1 for a in analysis if a.to_dict().get('sentiment') == 'Negative')
    neu_count = sum(1 for a in analysis if a.to_dict().get('sentiment') == 'Neutral')
    inc_count = sum(1 for a in analysis if a.to_dict().get('incident_type') != 'Other')
    
    return {
        "total_posts": len(posts),
        "positive_count": pos_count,
        "negative_count": neg_count,
        "neutral_count": neu_count,
        "incident_count": inc_count,
        "risk_zone_count": len(zones),
        "recent_events_count": len(events)
    }

@app.get("/api/dashboard/sentiment")
def get_sentiment_distribution(db = Depends(get_db)):
    if not db: return []
    analysis = list(db.collection('analysis_results').stream())
    counts = {}
    for a in analysis:
        s = a.to_dict().get('sentiment', 'Unknown')
        counts[s] = counts.get(s, 0) + 1
    return [{"label": k, "count": v} for k, v in counts.items()]

@app.get("/api/dashboard/incidents")
def get_incident_distribution(db = Depends(get_db)):
    if not db: return []
    analysis = list(db.collection('analysis_results').stream())
    counts = {}
    for a in analysis:
        i = a.to_dict().get('incident_type', 'Unknown')
        counts[i] = counts.get(i, 0) + 1
    return [{"incident_type": k, "count": v} for k, v in counts.items()]

@app.get("/api/dashboard/locations")
def get_locations(db = Depends(get_db)):
    if not db: return []
    posts = list(db.collection('posts').stream())
    data = []
    for p_doc in posts:
        p = p_doc.to_dict()
        if p.get('latitude') is not None and p.get('longitude') is not None:
            data.append({
                "id": p.get('id'),
                "location": p.get('location'),
                "latitude": p.get('latitude'),
                "longitude": p.get('longitude'),
                "incident_type": p.get('incident_type', 'Unknown'),
                "sentiment": p.get('sentiment', 'Unknown')
            })
    return data

@app.get("/api/risk-zones")
def get_risk_zones(db = Depends(get_db)):
    if not db: return []
    zones = list(db.collection('risk_zones').stream())
    return [z.to_dict() for z in zones]

def cleanup_old_iot_events(db):
    try:
        # Keep only the latest 100 events to prevent infinite database growth
        docs = db.collection('iot_events').order_by('created_at', direction=Query.DESCENDING).offset(100).stream()
        batch = db.batch()
        count = 0
        for doc in docs:
            batch.delete(doc.reference)
            count += 1
            if count >= 400: # Firestore batch limit
                batch.commit()
                batch = db.batch()
                count = 0
        if count > 0:
            batch.commit()
    except Exception as e:
        print(f"Error cleaning up old iot events: {e}")

@app.post("/api/iot/location", response_model=schemas.RiskZoneCheckResponse)
def iot_location_update(data: schemas.IoTLocationInput, background_tasks: BackgroundTasks, db = Depends(get_db)):
    if not db: raise HTTPException(status_code=500)
    
    device_ref = db.collection('iot_devices').document(data.device_id)
    device_doc = device_ref.get()
    
    if not device_doc.exists:
        device_ref.set({
            "device_code": data.device_id,
            "device_name": "New Device",
            "last_latitude": data.latitude,
            "last_longitude": data.longitude,
            "last_seen": get_ist_now().isoformat(),
            "status": "Active"
        })
    else:
        device_ref.update({
            "last_latitude": data.latitude,
            "last_longitude": data.longitude,
            "last_seen": get_ist_now().isoformat()
        })
        
    address = get_address_from_coords(data.latitude, data.longitude)
    
    base_message = f"Location update near: {address}"
    final_message = f"{base_message} (Triggered by: {data.user_name})" if data.user_name else base_message
    
    event_ref = db.collection('iot_events').document()
    event_ref.set({
        "id": event_ref.id,
        "device_code": data.device_id,
        "event_type": "LOCATION_UPDATE",
        "latitude": data.latitude,
        "longitude": data.longitude,
        "message": final_message,
        "date": get_ist_now().date().isoformat(),
        "time": get_ist_now().time().isoformat(),
        "created_at": get_ist_now().isoformat()
    })
    
    in_zone, zone_name = check_if_in_risk_zone(db, data.latitude, data.longitude)
    
    # Automatically clean up old events in the background
    background_tasks.add_task(cleanup_old_iot_events, db)
    
    return {
        "risk_zone": in_zone,
        "zone_name": zone_name,
        "message": "Potential risk zone detected" if in_zone else "Location safe"
    }

@app.post("/api/iot/sos", response_model=schemas.SOSResponse)
def iot_sos(data: schemas.IoTSOSInput, background_tasks: BackgroundTasks, db = Depends(get_db)):
    if not db: raise HTTPException(status_code=500)
    
    device_ref = db.collection('iot_devices').document(data.device_id)
    if not device_ref.get().exists:
        device_ref.set({
            "device_code": data.device_id,
            "device_name": "New Device",
            "last_latitude": data.latitude,
            "last_longitude": data.longitude,
            "last_seen": get_ist_now().isoformat(),
            "status": "Active"
        })
        
    address = get_address_from_coords(data.latitude, data.longitude)
    
    base_message = f"EMERGENCY at: {address}"
    final_message = f"{base_message} (Triggered by: {data.user_name})" if data.user_name else base_message
    
    event_ref = db.collection('iot_events').document()
    event_ref.set({
        "id": event_ref.id,
        "device_code": data.device_id,
        "event_type": "SOS",
        "latitude": data.latitude,
        "longitude": data.longitude,
        "message": final_message,
        "date": get_ist_now().date().isoformat(),
        "time": get_ist_now().time().isoformat(),
        "created_at": get_ist_now().isoformat()
    })
    
    post_ref = db.collection('posts').document()
    post_ref.set({
        "id": post_ref.id,
        "text": "EMERGENCY SOS Triggered from IoT Device",
        "cleaned_text": clean_text("EMERGENCY SOS Triggered from IoT Device"),
        "date": get_ist_now().date().isoformat(),
        "time": get_ist_now().time().isoformat(),
        "location": address,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "created_at": get_ist_now().isoformat(),
        "sentiment": "Negative",
        "incident_type": "Emergency"
    })
    
    analysis_ref = db.collection('analysis_results').document()
    analysis_ref.set({
        "id": analysis_ref.id,
        "post_id": post_ref.id,
        "sentiment": "Negative",
        "positive_score": 0.0,
        "negative_score": 1.0,
        "neutral_score": 0.0,
        "compound_score": -0.9,
        "incident_type": "Emergency",
        "confidence": 1.0,
        "created_at": get_ist_now().isoformat()
    })
    
    recalculate_risk_zones(db)
    
    # Automatically clean up old events in the background
    background_tasks.add_task(cleanup_old_iot_events, db)
    
    return {
        "success": True,
        "event": "SOS",
        "message": "SOS event received and logged."
    }

@app.get("/api/iot/events")
def get_iot_events(db = Depends(get_db)):
    if not db: return []
    events_docs = db.collection('iot_events').order_by('created_at', direction=Query.DESCENDING).limit(20).stream()
    return [doc.to_dict() for doc in events_docs]

@app.get("/api/model/metrics")
def get_model_metrics():
    metrics_path = os.path.abspath(os.path.join(os.path.dirname(__file__), 'ml', 'metrics.json'))
    if os.path.exists(metrics_path):
        with open(metrics_path, 'r') as f:
            return json.load(f)
    return {"message": "Metrics not available. Run training first."}
