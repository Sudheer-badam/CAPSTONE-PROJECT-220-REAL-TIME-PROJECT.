import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const getDashboardSummary = () => api.get('/api/dashboard/summary');
export const getSentimentData = () => api.get('/api/dashboard/sentiment');
export const getIncidentData = () => api.get('/api/dashboard/incidents');
export const getLocationsData = () => api.get('/api/dashboard/locations');
export const getRiskZones = () => api.get('/api/risk-zones');
export const getIoTEvents = () => api.get('/api/iot/events');
export const getModelMetrics = () => api.get('/api/model/metrics');
export const triggerSOS = (data) => api.post('/api/iot/sos', data);
export const triggerLocationUpdate = (data) => api.post('/api/iot/location', data);
export const activateDangerZone = (data) => api.post('/api/iot/danger-zone', data);
export const runAnalysis = () => api.post('/api/analysis/run');

export default api;
