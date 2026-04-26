import requests
import pandas as pd
from dotenv import load_dotenv
import os

load_dotenv()

API_KEY = os.getenv('MW_DICTIONARY_KEY')
THESAURUS_KEY = os.getenv('MW_THESAURUS_KEY')

def get_definition(word):
    '''
    Takes a word, build the MW API URL witht the given word, calls the API, converts the word into readable data.
    '''
    url = f"https://www.dictionaryapi.com/api/v3/references/collegiate/json/{word}?key={API_KEY}"
    response = requests.get(url)
    data = response.json()
               
    if isinstance(data[0], dict):
        definition = data[0]['shortdef'][0] if data[0]["shortdef"] else "No definition found."
        return definition
    else:
        return "No definition found."
    
words_df = pd.read_csv('data/slang_words.csv')
words_df['definition'] = words_df['word'].apply(get_definition)
words_df.to_csv('data/slang_words_with_definitions.csv', index=False)

print("Definitions fetched and saved to slang_words_with_definitions.csv")