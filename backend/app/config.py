from pydantic_settings import BaseSettings
import os
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "mysql+pymysql://USERNAME:PASSWORD@localhost:3306/womens_safety")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://capstone-project-220-realworld-project.vercel.app")
    RISK_MIN_REPORTS: int = int(os.getenv("RISK_MIN_REPORTS", 5))

settings = Settings()
