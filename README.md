# CSSA Slang Extension

A Chrome extension that detects and contextualizes slang words for non-native English speakers. When a user highlights a word in Gmail or Canvas, a popup explains what it means and how it's being used in that specific context.

## How it works

User highlights a slang word in Gmail or Canvas
→ Chrome extension sends the word + surrounding sentence to the backend
→ Backend looks it up in the database
→ Returns the slang definition and context
→ Popup displays the result

## Structure

extension/   → Chrome extension (frontend)
backend/     → Python/FastAPI server
data/        → Slang word list and definitions
report/      → Full ML implementation plan
