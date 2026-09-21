from app.config import settings
import math
from datetime import datetime
import pytz

def get_ist_now():
    return datetime.now(pytz.timezone('Asia/Kolkata'))

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates in meters using Haversine formula"""
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return float('inf')
        
    R = 6371e3 # Earth radius in meters
    phi1 = lat1 * math.pi / 180
    phi2 = lat2 * math.pi / 180
    delta_phi = (lat2 - lat1) * math.pi / 180
    delta_lambda = (lon2 - lon1) * math.pi / 180
    
    a = math.sin(delta_phi/2) * math.sin(delta_phi/2) + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda/2) * math.sin(delta_lambda/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def recalculate_risk_zones(db):
    """
    Groups nearby reports and creates/updates risk zones based on frequency.
    """
    if not db:
        return
        
    posts_ref = db.collection('posts')
    # Filter for posts that have latitude (Firestore doesn't support IS NOT NULL easily, 
    # but we can filter those that have location field if we set it)
    # We will just fetch all posts and filter in memory for simplicity
    posts_docs = posts_ref.stream()
    posts = [doc.to_dict() for doc in posts_docs]
    
    # Group by location name for simplicity and academic scope
    location_groups = {}
    for post in posts:
        if 'latitude' in post and 'longitude' in post and post.get('latitude') is not None and post.get('longitude') is not None:
            location = post.get('location', 'Unknown')
            if location not in location_groups:
                location_groups[location] = []
            location_groups[location].append(post)
            
    # Clear existing risk zones in firestore
    risk_zones_ref = db.collection('risk_zones')
    for doc in risk_zones_ref.stream():
        doc.reference.delete()
        
    for loc_name, loc_posts in location_groups.items():
        if len(loc_posts) >= settings.RISK_MIN_REPORTS:
            avg_lat = sum(p['latitude'] for p in loc_posts) / len(loc_posts)
            avg_lon = sum(p['longitude'] for p in loc_posts) / len(loc_posts)
            
            zone = {
                "name": f"Potential Risk Zone: {loc_name}",
                "latitude": avg_lat,
                "longitude": avg_lon,
                "radius_meters": 300.0,
                "report_count": len(loc_posts),
                "status": "Active",
                "calculated_at": get_ist_now().isoformat()
            }
            
            # Write to Firestore
            doc_ref = risk_zones_ref.document()
            zone["id"] = doc_ref.id
            doc_ref.set(zone)

def check_if_in_risk_zone(db, latitude: float, longitude: float):
    """Check if given coordinates fall inside any active risk zone."""
    if not db:
        return False, None
        
    zones_docs = db.collection('risk_zones').where('status', '==', 'Active').stream()
    
    for doc in zones_docs:
        zone = doc.to_dict()
        dist = calculate_distance(latitude, longitude, zone.get('latitude'), zone.get('longitude'))
        if dist <= zone.get('radius_meters', 300.0):
            return True, zone.get('name')
            
    return False, None
