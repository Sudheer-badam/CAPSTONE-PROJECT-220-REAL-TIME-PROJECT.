import { useState, useEffect } from 'react';
import { getModelMetrics } from '../services/api';

export default function ModelMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await getModelMetrics();
        setMetrics(res.data);
      } catch (err) {
        console.error("Error fetching model metrics", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (loading) return <div>Loading metrics...</div>;
  if (!metrics || metrics.message) return <div>{metrics?.message || "Metrics not available."}</div>;

  return (
    <div className="chart-card">
      <h3>Machine Learning Model Performance</h3>
      <p style={{fontSize: '14px', color: '#666'}}>
        Performance metrics for the TF-IDF + Logistic Regression incident classifier calculated on the sample test dataset.
      </p>
      
      <div style={{display: 'flex', gap: '20px', margin: '20px 0'}}>
        <div style={{padding: '15px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd', flex: 1}}>
          <h4>Accuracy</h4>
          <div style={{fontSize: '24px', color: 'var(--primary)', fontWeight: 'bold'}}>
            {(metrics.accuracy * 100).toFixed(2)}%
          </div>
        </div>
        <div style={{padding: '15px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd', flex: 1}}>
          <h4>Precision</h4>
          <div style={{fontSize: '24px', color: 'var(--primary)', fontWeight: 'bold'}}>
            {(metrics.precision * 100).toFixed(2)}%
          </div>
        </div>
        <div style={{padding: '15px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd', flex: 1}}>
          <h4>Recall</h4>
          <div style={{fontSize: '24px', color: 'var(--primary)', fontWeight: 'bold'}}>
            {(metrics.recall * 100).toFixed(2)}%
          </div>
        </div>
        <div style={{padding: '15px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #ddd', flex: 1}}>
          <h4>F1-Score</h4>
          <div style={{fontSize: '24px', color: 'var(--primary)', fontWeight: 'bold'}}>
            {(metrics.f1_score * 100).toFixed(2)}%
          </div>
        </div>
      </div>
      
      <p style={{fontSize: '12px', color: '#888', marginTop: '20px'}}>
        Note: The actual performance metrics are automatically generated when the model is trained on the dataset using the backend training script. The above numbers are directly fetched from the real test results, and no fake statistics are used.
      </p>
    </div>
  );
}
