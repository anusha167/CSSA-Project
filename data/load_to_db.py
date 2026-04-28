import csv
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(
    dbname="slang_db",
    user=os.getenv("DB_USER", "postgres"),
    password=os.getenv("DB_PASSWORD"),
    host=os.getenv("DB_HOST", "localhost"),
    port=os.getenv("DB_PORT", "5432"),
)
cur = conn.cursor()

csv_path = os.path.join(os.path.dirname(__file__), "slang_words_with_definitions.csv")

inserted = 0
skipped = 0

with open(csv_path, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        word = row["word"].strip()
        formal = row["definition"].strip()
        slang = row["slang_definition"].strip()

        cur.execute(
            """
            INSERT INTO slang_words (word, formal_definition, slang_definition)
            VALUES (%s, %s, %s)
            ON CONFLICT (word) DO UPDATE
                SET formal_definition = EXCLUDED.formal_definition,
                    slang_definition  = EXCLUDED.slang_definition
            """,
            (word, formal, slang),
        )
        inserted += 1

conn.commit()
cur.close()
conn.close()

print(f"Done. {inserted} rows upserted, {skipped} skipped.")
