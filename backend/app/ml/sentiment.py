import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer
import logging

logger = logging.getLogger(__name__)

# Ensure lexicon is available
try:
    nltk.data.find('sentiment/vader_lexicon')
except LookupError:
    nltk.download('vader_lexicon', quiet=True)

sia = SentimentIntensityAnalyzer()

def analyze_sentiment(text: str) -> dict:
    """
    Analyzes the sentiment of a given text using VADER.
    Returns scores and a discrete label.
    """
    if not text:
        return {
            "positive_score": 0.0,
            "negative_score": 0.0,
            "neutral_score": 1.0,
            "compound_score": 0.0,
            "sentiment_label": "Neutral"
        }
        
    scores = sia.polarity_scores(text)
    compound = scores['compound']
    
    if compound >= 0.05:
        label = "Positive"
    elif compound <= -0.05:
        label = "Negative"
    else:
        label = "Neutral"
        
    return {
        "positive_score": scores['pos'],
        "negative_score": scores['neg'],
        "neutral_score": scores['neu'],
        "compound_score": compound,
        "sentiment_label": label
    }
