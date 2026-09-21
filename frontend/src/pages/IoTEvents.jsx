import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function IoTEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to the last 20 IoT events ordered by created_at
    const q = query(
      collection(db, "iot_events"),
      orderBy("created_at", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEvents = [];
      snapshot.forEach((doc) => {
        fetchedEvents.push({ id: doc.id, ...doc.data() });
      });
      setEvents(fetchedEvents);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching IoT events", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div>Loading real-time events...</div>;

  return (
    <div className="table-container">
      <h3 style={{marginTop: 0, color: 'var(--primary)'}}>Recent IoT & SOS Events (Real-Time)</h3>
      {events.length === 0 ? (
        <p>No IoT events recorded yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Device ID</th>
              <th>Event Type</th>
              <th>Location (Lat, Lon)</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {events.map(event => (
              <tr key={event.id} style={{backgroundColor: event.event_type === 'SOS' ? '#ffebee' : 'inherit'}}>
                <td>{new Date(event.created_at).toLocaleString()}</td>
                <td>{event.device_code}</td>
                <td>
                  <strong style={{color: event.event_type === 'SOS' ? 'red' : 'inherit'}}>
                    {event.event_type}
                  </strong>
                </td>
                <td>{event.latitude}, {event.longitude}</td>
                <td>{event.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
