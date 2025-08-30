# Vedic Astrology Chatbot Server

A streaming chatbot server that provides Vedic astrology responses using RAG (Retrieval-Augmented Generation) with vector search and Gemini AI.

## API Endpoints

### 1. Standard Gemini Endpoint
**URL:** `POST /gemini`

```bash
curl -X POST http://localhost:3000/gemini \
  -H "Content-Type: application/json" \
  -d '{
    "id": "chat-123",
    "message": {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "What is the significance of Saturn in Vedic astrology?"
        }
      ],
      "id": "msg-456"
    },
    "selectedChatModel": "gemini-pro",
    "selectedVisibilityType": "public",
    "numResults": 5
  }'
```

### 2. Tone-Specific Endpoint (Professional)
**URL:** `POST /gemini-tone`

```bash
curl -X POST http://localhost:3000/gemini-tone \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the significance of Saturn in Vedic astrology?",
    "tone": "professional",
    "numResults": 5
  }'
```

### 3. Tone-Specific Endpoint (Casual)
**URL:** `POST /gemini-tone`

```bash
curl -X POST http://localhost:3000/gemini-tone \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the significance of Saturn in Vedic astrology?",
    "tone": "casual",
    "numResults": 5
  }'
```

## Response Format

All endpoints return Server-Sent Events (SSE) with streaming responses containing:
- Progressive text chunks
- Search metadata
- Vector search results
- Final completion marker: `data: [DONE]`

## Getting Started

1. Start the server:
```bash
npm start
```

2. The server runs on `http://localhost:3000`

3. Use any of the curl commands above to