import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    # Rough FX for comparing PKR/INR budgets to USD marketplace prices (Amazon/eBay).
    PKR_PER_USD: float = float(os.getenv("PKR_PER_USD", "280") or "280")
    INR_PER_USD: float = float(os.getenv("INR_PER_USD", "83") or "83")

    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "") or ""
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b") or "openai/gpt-oss-20b"
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    RAPIDAPI_KEY: str = os.getenv("RAPIDAPI_KEY", "") or ""
    RAPIDAPI_HOST: str = os.getenv(
        "RAPIDAPI_HOST", "real-time-amazon-data.p.rapidapi.com"
    )
    MONGODB_DB: str = os.getenv("MONGODB_DB", "shopping_db")
    MONGODB_COLLECTION: str = os.getenv("MONGODB_COLLECTION", "products")


settings = Settings()
