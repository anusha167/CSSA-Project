from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import psycopg2.extras
from google import genai
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../.env"))

app = FastAPI(title="CSSA Slang API")

# Allow the Chrome extension to call this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ── Database helpers ──────────────────────────────────────────────────────────

def get_connection():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME", "slang_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
    )


def lookup_in_db(word: str):
    """Return (formal_definition, slang_definition) from DB, or None if not found."""
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT formal_definition, slang_definition FROM slang_words WHERE LOWER(word) = LOWER(%s)",
            (word,),
        )
        return cur.fetchone()
    finally:
        conn.close()


# ── Gemini fallback ───────────────────────────────────────────────────────────

gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def get_slang_definition_from_gemini(word: str) -> str:
    """Ask Gemini for a slang definition when the word isn't in the DB."""
    response = gemini_client.models.generate_content(
        model="gemini-2.5-flash",
        contents=(
            f"Give a single clear concise definition of the slang meaning of '{word}'. "
            "Under 20 words. PG only. No extra text, just the definition."
        ),
    )
    return response.text.strip()


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/word/{word}")
def get_word(word: str):
    """
    Look up a word.
    - If it's in the database, return both formal and slang definitions.
    - If not, fall back to Gemini for a slang definition (no formal definition).
    """
    word = word.strip()
    if not word:
        raise HTTPException(status_code=400, detail="Word cannot be empty.")

    row = lookup_in_db(word)

    if row:
        return {
            "word": word,
            "source": "database",
            "formal_definition": row["formal_definition"],
            "slang_definition": row["slang_definition"],
        }

    # Word not in DB — fall back to Gemini
    try:
        slang_def = get_slang_definition_from_gemini(word)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini fallback failed: {e}")

    return {
        "word": word,
        "source": "gemini",
        "formal_definition": None,
        "slang_definition": slang_def,
    }


@app.get("/health")
def health():
    return {"status": "ok"}
