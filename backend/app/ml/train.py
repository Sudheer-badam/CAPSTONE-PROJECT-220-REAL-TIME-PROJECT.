import pandas as pd
import os
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
import sys
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from app.ml.preprocess import clean_text
from app.ml.classifier import IncidentClassifier

DATA_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'safety_posts.csv'))

def evaluate_and_train():
    if not os.path.exists(DATA_PATH):
        print(f"Dataset not found at {DATA_PATH}")
        return
        
    df = pd.read_csv(DATA_PATH)
    
    # Preprocess text
    df['cleaned_text'] = df['text'].apply(clean_text)
    
    # Check if we have incident_type
    if 'incident_type' not in df.columns:
        print("Missing incident_type column for training.")
        return
        
    # Remove null labels
    df = df.dropna(subset=['incident_type', 'cleaned_text'])
    
    X = df['cleaned_text']
    y = df['incident_type']
    
    # Need at least 2 samples per class ideally, but for small synthetic data we just do a simple split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
    
    classifier = IncidentClassifier()
    model = classifier.train_and_save(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    
    accuracy = accuracy_score(y_test, y_pred)
    
    # Use zero_division=0 to handle cases where test set misses some classes
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='weighted', zero_division=0)
    
    conf_matrix = confusion_matrix(y_test, y_pred).tolist()
    labels = sorted(list(set(y_test) | set(y_pred)))
    
    metrics = {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "confusion_matrix": conf_matrix,
        "labels": labels
    }
    
    print("Evaluation Metrics:")
    print(f"Accuracy: {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall: {recall:.4f}")
    print(f"F1-Score: {f1:.4f}")
    
    # Save metrics to a JSON file to be served by API later
    metrics_path = os.path.join(os.path.dirname(__file__), "metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics, f)
        
    print(f"Metrics saved to {metrics_path}")

if __name__ == "__main__":
    evaluate_and_train()
