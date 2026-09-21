import os
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
import logging

logger = logging.getLogger(__name__)

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "incident_classifier.joblib")

class IncidentClassifier:
    def __init__(self):
        self.model = None
        self._load_model()
        
    def _load_model(self):
        """Loads the pre-trained model if it exists."""
        if os.path.exists(MODEL_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
                logger.info(f"Loaded model from {MODEL_PATH}")
            except Exception as e:
                logger.error(f"Failed to load model: {e}")
                self.model = None

    def train_and_save(self, X_train, y_train):
        """
        Trains a TF-IDF + Logistic Regression pipeline and saves it.
        """
        pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(max_features=1000, ngram_range=(1,2))),
            ('clf', LogisticRegression(random_state=42, max_iter=1000, class_weight='balanced'))
        ])
        
        logger.info("Training Incident Classifier...")
        pipeline.fit(X_train, y_train)
        
        # Save model
        joblib.dump(pipeline, MODEL_PATH)
        self.model = pipeline
        logger.info(f"Model saved to {MODEL_PATH}")
        return pipeline

    def predict(self, text: str) -> dict:
        """
        Predicts the incident category for a given text.
        """
        if not self.model:
            # Fallback if model not trained
            return {
                "incident_type": "Other",
                "confidence": 0.0
            }
            
        prediction = self.model.predict([text])[0]
        
        # Get probability
        probabilities = self.model.predict_proba([text])[0]
        max_prob = max(probabilities)
        
        return {
            "incident_type": str(prediction),
            "confidence": float(max_prob)
        }

classifier_instance = IncidentClassifier()

def classify_incident(text: str) -> dict:
    """Wrapper function to classify text"""
    return classifier_instance.predict(text)
