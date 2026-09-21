from app.firebase_service import get_firestore_db

def get_db():
    db = get_firestore_db()
    try:
        yield db
    finally:
        pass
