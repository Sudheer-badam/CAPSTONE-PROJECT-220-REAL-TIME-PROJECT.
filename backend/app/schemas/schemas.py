from pydantic import BaseModel
from typing import List, Optional
from datetime import date, time, datetime

# --- Input Schemas ---
class IoTLocationInput(BaseModel):
    device_id: str
    latitude: float
    longitude: float
    user_name: Optional[str] = None

class IoTSOSInput(BaseModel):
    device_id: str
    latitude: float
    longitude: float
    user_name: Optional[str] = None

# --- Response Schemas ---
class RiskZoneCheckResponse(BaseModel):
    risk_zone: bool
    zone_name: Optional[str] = None
    message: str

class SOSResponse(BaseModel):
    success: bool
    event: str
    message: str

class DashboardSummaryResponse(BaseModel):
    total_posts: int
    positive_count: int
    negative_count: int
    neutral_count: int
    incident_count: int
    risk_zone_count: int
    recent_events_count: int

class SentimentDistribution(BaseModel):
    label: str
    count: int

class IncidentDistribution(BaseModel):
    incident_type: str
    count: int

class TrendData(BaseModel):
    date: str
    count: int

class LocationData(BaseModel):
    id: int
    location: str
    latitude: float
    longitude: float
    incident_type: str
    sentiment: str

class IoTEventData(BaseModel):
    id: int
    device_code: str
    event_type: str
    latitude: float
    longitude: float
    message: str
    created_at: datetime
