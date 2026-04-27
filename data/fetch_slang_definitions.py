import pandas as pd
from google import genai
from dotenv import load_dotenv
import os

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def get_slang_definition(word):
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=f"Give a single clear concise definition of the slang meaning of '{word}'. Under 20 words. PG only. No extra text, just the definition."
    )
    return response.text.strip()

df = pd.read_csv("data/slang_words_with_definitions.csv")

df["slang_definition"] = df["word"].apply(get_slang_definition)

df.to_csv("data/slang_words_with_definitions.csv", index=False)

print("Done! Slang definitions added.")