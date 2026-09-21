import re

def clean_text(text: str) -> str:
    """
    Cleans raw text for analysis.
    - Converts to lowercase
    - Removes URLs
    - Removes unnecessary special characters
    - Normalizes whitespace
    """
    if not isinstance(text, str):
        return ""
    
    # Convert to lowercase
    text = text.lower()
    
    # Remove URLs
    text = re.sub(r'http\S+|www\S+|https\S+', '', text, flags=re.MULTILINE)
    
    # Remove special characters except basic punctuation (keep some for VADER)
    # Removing emojis and weird symbols
    text = re.sub(r'[^a-z0-9\s.,!?#]', '', text)
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text
