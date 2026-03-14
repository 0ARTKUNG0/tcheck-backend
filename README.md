# backend-tcheck

REST API backend for tcheck built with Node.js, Express 5, and MongoDB.

## Recent Updates

### March 2026 - Rate Limit Handling & Thai Text Segmentation

- ✅ **Improved AI Provider Rate Limit Handling**: AI provider 429 errors now return proper HTTP 429 responses with user-friendly Thai messages instead of generic 500 errors
- ✅ **Thai Text Chunking Utility**: New `utils/textSegmenter.util.js` for safely splitting Thai text at word boundaries (uses `Intl.Segmenter`)
- ✅ **Enhanced Error Codes**: Added `AI_RATE_LIMIT` error code for better error handling during high concurrent usage
- ✅ **Unlimited Document Content**: Removed 5,000 character limit on document content field (now supports up to 16MB)

See [docs/claude_update_rate_limit.md](../docs/claude_update_rate_limit.md) and [docs/claude_update_document_text_type.md](../docs/claude_update_document_text_type.md) for detailed documentation.

## Prerequisites

- Node.js
- MongoDB

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and configure your environment variables:
   ```bash
   cp .env.example .env
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

All environment variables are **required** and validated at startup.

### Core Configuration

| Variable      | Description                | Example                            |
| ------------- | -------------------------- | ---------------------------------- |
| `PORT`        | Server port                | `5000`                             |
| `MONGODB_URL` | MongoDB connection string  | `mongodb://localhost:27017/tcheck` |
| `JWT_SECRET`  | Secret key for JWT signing | `your-secure-secret-key`           |
| `NODE_ENV`    | Environment mode           | `development` / `production`       |
| `BASE_URL`    | Allowed CORS origin        | `http://localhost:3000`            |

### AI Provider Configuration

| Variable             | Description                           | Default                             |
| -------------------- | ------------------------------------- | ----------------------------------- |
| `AI_PROVIDER`        | AI provider to use                    | `typhoon`, `lmstudio`, or `openai` |
| `AI_MAX_TEXT_LENGTH` | Maximum text length for grammar check | `5000`                              |
| `AI_TIMEOUT_MS`      | AI request timeout in milliseconds    | `12000`                             |

### Token Limits by User Role (characters allowed per request)

| Variable                | Description                 | Default |
| ----------------------- | --------------------------- | ------- |
| `TOKEN_LIMIT_GUEST`     | Guest users (not logged in) | `1000`  |
| `TOKEN_LIMIT_USER_FREE` | Free tier users             | `4000`  |
| `TOKEN_LIMIT_USER_PRO`  | Pro tier users              | `10000` |
| `TOKEN_LIMIT_ADMIN`     | Admin users                 | `50000` |

### Typhoon AI Configuration (required if AI_PROVIDER=typhoon)

| Variable           | Description          | Default                      |
| ------------------ | -------------------- | ---------------------------- |
| `TYPHOON_API_KEY`  | Your Typhoon API key | (required)                   |
| `TYPHOON_BASE_URL` | Typhoon API base URL | `https://api.opentyphoon.ai` |
| `TYPHOON_MODEL`    | Model to use         | `typhoon-v1.5-instruct`      |

### LM Studio Configuration (required if AI_PROVIDER=lmstudio)

| Variable            | Description              | Default                 |
| ------------------- | ------------------------ | ----------------------- |
| `LMSTUDIO_BASE_URL` | LM Studio server URL     | `http://localhost:1234` |
| `LMSTUDIO_MODEL`    | Model name for LM Studio | `local-model`           |

### OpenAI-Compatible Provider Configuration (required if AI_PROVIDER=openai)

Works with any OpenAI-compatible API: OpenAI, Gemini, Groq, Together, Mistral, DeepSeek, Ollama, etc.

| Variable                     | Description       | Example                  |
| ---------------------------- | ----------------- | ------------------------ |
| `OPENAI_COMPATIBLE_BASE_URL` | API base URL      | `https://api.openai.com` |
| `OPENAI_COMPATIBLE_API_KEY`  | API key           | `sk-xxx`                 |
| `OPENAI_COMPATIBLE_MODEL`    | Model name to use | `gpt-4o-mini`            |

### Rate Limiting Configuration (per-minute limits by role)

| Variable              | Description                       | Default |
| --------------------- | --------------------------------- | ------- |
| `AI_RATE_LIMIT_GUEST` | Guest users - requests/minute     | `5`     |
| `AI_RATE_LIMIT_FREE`  | Free tier users - requests/minute | `10`    |
| `AI_RATE_LIMIT_PRO`   | Pro tier users - requests/minute  | `30`    |
| `AI_RATE_LIMIT_ADMIN` | Admin users - requests/minute     | `100`   |
| `AI_RATE_WINDOW_MS`   | Rate limit window in milliseconds | `60000` |

**Note:** Per-second limits are enforced automatically:

- Guest: 1/sec
- Free: 2/sec
- Pro: 4/sec
- Admin: 5/sec (Typhoon's max)

## Scripts

| Command       | Description                   |
| ------------- | ----------------------------- |
| `npm run dev` | Start dev server with nodemon |
| `npm start`   | Start production server       |

## API Endpoints

Base URL: `/api`

### Public Endpoints

| Method | Endpoint            | Description                    | Request Body                                 |
| ------ | ------------------- | ------------------------------ | -------------------------------------------- |
| POST   | `/api/user/signup`  | Register a new user            | `{ user_name, user_email, user_password }`   |
| POST   | `/api/user/signin`  | Sign in with email or username | `{ user_email or user_name, user_password }` |
| POST   | `/api/user/signout` | Sign out (clears cookie)       | -                                            |

**User Signup Validation:**
- Email must be valid format (validated with regex)
- Password must be at least 6 characters
- Email is normalized to lowercase before storage
- Returns `400 VALIDATION_ERROR` for invalid input
- Returns `409 DUPLICATE_EMAIL` if email already exists

### Protected Endpoints (Requires Authentication)

| Method | Endpoint                    | Description              | Request Body    |
| ------ | --------------------------- | ------------------------ | --------------- |
| GET    | `/api/user/profile`         | Get current user profile | -               |
| POST   | `/api/user/update-username` | Update username          | `{ user_name }` |

### Grammar Check (Optional Authentication - Guests Allowed)

| Method | Endpoint             | Description                  | Request Body      | Rate Limit by Role                                      |
| ------ | -------------------- | ---------------------------- | ----------------- | ------------------------------------------------------- |
| POST   | `/api/grammar/check` | Check Thai grammar and typos | `{ text, mode? }` | Guest: 5/min, Free: 10/min, Pro: 30/min, Admin: 100/min |

**Request:**

```json
{
  "text": "ข้อความภาษาไทย",
  "mode": "normal" // optional: strict, normal, casual
}
```

**Success Response (200):**

```json
{
  "issues": [
    {
      "start": 12,
      "end": 14,
      "span": "ไท",
      "replacement": "ไทย",
      "reason": "ขาดตัว ย"
    }
  ],
  "metadata": {
    "text_length": 50,
    "issues_found": 1,
    "mode": "normal",
    "provider": "typhoon",
    "requestId": "abc123...",
    "userRole": "user-free",
    "tokenLimit": 4000,
    "tokenUsed": 50,
    "tokenRemaining": 3950
  }
}
```

**Token Limits by Role:**

- **Guest** (not logged in): 1,000 characters/request
- **user-free**: 4,000 characters/request
- **user-pro**: 10,000 characters/request
- **admin**: 50,000 characters/request

**Error Responses:**

- `400 VALIDATION_ERROR` - Invalid request (missing text, invalid mode)
- `400 TOKEN_LIMIT_EXCEEDED` - Text exceeds user's token limit
- `429 RATE_LIMITED` - Too many requests (app-level rate limit)
- `429 AI_RATE_LIMIT` - AI provider rate limit hit (concurrent users)
- `502 AI_UPSTREAM_ERROR` - AI service unavailable
- `502 PARSE_ERROR` - Failed to parse AI response
- `504 AI_TIMEOUT` - AI service timeout
- `500 INTERNAL_ERROR` - Unexpected server error

**Note on AI_RATE_LIMIT:** When the AI provider returns a 429 status (e.g., during high concurrent usage), the API returns a user-friendly Thai message: "ระบบ AI มีผู้ใช้งานพร้อมกันจำนวนมาก โปรดรอสักครู่แล้วกดตรวจสอบใหม่อีกครั้ง" (The AI system has many concurrent users, please wait a moment and try again).

### Document Management (Requires user-free, user-pro, or admin role)

| Method | Endpoint        | Description           | Request Body                         | Query Params        |
| ------ | --------------- | --------------------- | ------------------------------------ | ------------------- |
| POST   | `/api/docs`     | Create new document   | `{ title?, content?, corrections? }` | -                   |
| GET    | `/api/docs`     | List user's documents | -                                    | `page, limit, sort` |
| GET    | `/api/docs/:id` | Get document by ID    | -                                    | -                   |
| PATCH  | `/api/docs/:id` | Update document       | `{ title?, content?, corrections? }` | -                   |
| DELETE | `/api/docs/:id` | Delete document       | -                                    | -                   |

**Document Defaults:**

- `title`: "เอกสารไม่มีชื่อ" (max 80 chars)
- `content`: "" (unlimited, up to 16MB MongoDB document limit)
- `corrections`: [] (max 6 items, oldest removed when exceeded)

**Corrections Format:**

```json
{
  "corrections": [
    { "span": "สวัสกี", "replacement": "สวัสดี", "reason": "พยัญชนะผิด" }
  ]
}
```

Each correction must have `span` (string), `replacement` (string), and `reason` (string).

On update, new corrections are appended to existing ones. Only the latest 6 are kept.

**List Response includes:**

- `items`: Array of `{ id, title, snippet, correctionsCount, updatedAt }`
- `page`, `limit`, `total`
- `snippet`: First 120 characters of content

**Ownership Policy:**

- Users can only read/update/delete their own documents
- Returns `403 FORBIDDEN` if accessing another user's document

## User Roles

The system supports three user roles:

- **`user-free`** (default) - Free tier users
- **`user-pro`** - Pro/premium users
- **`admin`** - Administrator users

New signups automatically get the `user-free` role.

## Authentication

The application uses JWT-based authentication with httpOnly cookies for security.

### How It Works

1. **Sign up/Sign in**: Server sets an httpOnly cookie with JWT token (3 hour expiration)
2. **Protected routes**: Middleware verifies token from cookie or `Authorization: Bearer` header
3. **Sign out**: Server clears the authentication cookie

### Token Details

- **Expiration**: 3 hour
- **Storage**: httpOnly cookie (prevents XSS attacks)
- **Secure flag**: Enabled in production (HTTPS only)
- **SameSite**: `strict` (CSRF protection)

### Middleware

- **`verifyToken`**: Validates JWT token from cookies or `Authorization: Bearer` header
- **`isAdmin`**: Restricts access to admin users only
- **`hasRole`**: Restricts access based on specified roles

## Security Features

- ✅ Password hashing with bcryptjs (10 salt rounds)
- ✅ JWT tokens in httpOnly cookies (prevents XSS)
- ✅ Environment variable validation at startup
- ✅ Duplicate email detection (handled at database level)
- ✅ Proper HTTP status codes (409 for conflicts, 404 for not found)
- ✅ Server starts only after successful DB connection
- ✅ CORS configured with specific origin whitelist

## AI-Powered Thai Grammar Checker

The backend includes an AI-powered Thai grammar and typo checker supporting multiple AI providers.

### Features

- **Multi-Provider Support**: Works with Typhoon API, local LM Studio, or any OpenAI-compatible API
- **Guest Access**: Non-logged-in users can use the service with limited tokens
- **Role-Based Token Limits**: Different character limits based on user role
- **Dual Rate Limiting**: Per-second (1-5 req/sec) and per-minute (5-100 req/min) based on role
- **Character Positions**: Returns start/end offsets for frontend highlighting (like Grammarly)
- **Minimal Edit Policy**: AI enforced to only fix typos/spelling, not rewrite sentences
- **Validation Guardrails**: Code-level checks reject semantic word substitutions

### How It Works

1. User sends Thai text to `/api/grammar/check`
2. System validates token limit based on user role
3. Rate limiting applies (per-second and per-minute)
4. AI provider analyzes text for typos/grammar issues
5. Response normalized and validated (max 20 issues)
6. Issues filtered to ensure minimal edits only (no semantic changes)
7. Returns issues with character positions for highlighting

### System Prompt Policy

The AI is instructed to:

- Find ALL typos and fix with minimal edits
- Detect: missing characters, missing tone marks, wrong characters, wrong tone marks
- **NOT** change to different words (e.g., "เทียง" → "เที่ยง" ✓, but "เทียง" → "เย็น" ✗)
- **NOT** rewrite sentences
- Return max 20 issues ordered by position

### Validation Guardrails

Server-side validation ensures:

- Edit distance: max 1-2 character changes allowed
- Character overlap: minimum 50% shared characters required
- Rejects semantic substitutions even if AI suggests them
- Logs filtered changes: `[FILTER] Rejected semantic change: "เทียง" -> "เย็น"`

### Provider Configuration

Switch between providers via `AI_PROVIDER` environment variable:

**Typhoon API** (`AI_PROVIDER=typhoon`):

- Uses `typhoon-v1.5-instruct` model
- Requires API key from OpenTyphoon
- Endpoint: `https://api.opentyphoon.ai/v1/chat/completions`

**LM Studio** (`AI_PROVIDER=lmstudio`):

- Runs locally on your machine
- Uses whatever model is loaded
- Default endpoint: `http://localhost:1234/v1/chat/completions`

**OpenAI-Compatible** (`AI_PROVIDER=openai`):

- Works with any API that follows the OpenAI chat completions format
- Supports: OpenAI, Gemini, Groq, Together, Mistral, DeepSeek, Ollama, etc.
- Auto-detects URL structure (handles `/v1` and `/v1beta` paths)
- Includes truncated JSON repair for models with verbose output

## Error Handling

| Status Code | Meaning                                        | Error Code             |
| ----------- | ---------------------------------------------- | ---------------------- |
| `400`       | Bad Request (missing fields, validation error) | `VALIDATION_ERROR`     |
| `400`       | Token limit exceeded                           | `TOKEN_LIMIT_EXCEEDED` |
| `401`       | Unauthorized (invalid credentials or no token) | -                      |
| `403`       | Forbidden (ownership or role violation)        | `FORBIDDEN`            |
| `404`       | Not Found (resource not found)                 | `NOT_FOUND`            |
| `409`       | Conflict (email already exists)                | -                      |
| `429`       | Rate limited (app-level)                       | `RATE_LIMITED`         |
| `429`       | AI provider rate limited (concurrent users)    | `AI_RATE_LIMIT`        |
| `500`       | Internal Server Error                          | `INTERNAL_ERROR`       |
| `502`       | AI service unavailable                         | `AI_UPSTREAM_ERROR`    |
| `502`       | Failed to parse AI response                    | `PARSE_ERROR`          |
| `504`       | AI service timeout                             | `AI_TIMEOUT`           |

## Testing Document Endpoints with curl

```bash
# 1. Sign up first
curl -X POST http://localhost:5000/api/user/signup \
  -H "Content-Type: application/json" \
  -d '{"user_name":"Test User","user_email":"test@example.com","user_password":"password123"}' \
  -c cookies.txt

# 2. Create a document
curl -X POST http://localhost:5000/api/docs \
  -H "Content-Type: application/json" \
  -d '{"title":"My Document","content":"This is my content"}' \
  -b cookies.txt

# 3. List documents
curl -X GET http://localhost:5000/api/docs \
  -b cookies.txt

# 4. Get specific document (replace {id} with actual ID)
curl -X GET http://localhost:5000/api/docs/{id} \
  -b cookies.txt

# 5. Update document
curl -X PATCH http://localhost:5000/api/docs/{id} \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title","content":"Updated content"}' \
  -b cookies.txt

# 6. Delete document
curl -X DELETE http://localhost:5000/api/docs/{id} \
  -b cookies.txt
```

## Utilities

### Thai Text Chunking

The backend includes a utility for safely chunking Thai text without breaking words. This is useful for processing long documents that need to be split before sending to AI providers.

**Location:** `utils/textSegmenter.util.js`

**Function:** `chunkThaiText(text, maxLength)`

**Parameters:**
- `text` (string): The Thai text to be chunked
- `maxLength` (number): Maximum length of each chunk in characters

**Returns:** `string[]` - Array of text chunks that respect word boundaries

**Example Usage:**

```javascript
const { chunkThaiText } = require('./utils/textSegmenter.util');

const text = "สวัสดีครับ ผมชื่อจอห์น ยินดีที่ได้รู้จักคุณ";
const chunks = chunkThaiText(text, 20);
// Returns: ["สวัสดีครับ ผมชื่อจอห์น", "ยินดีที่ได้รู้จักคุณ"]
```

**Features:**
- Uses `Intl.Segmenter` with Thai locale for accurate word boundary detection
- Ensures text is split only at proper word boundaries (never breaks words in half)
- Handles edge cases (empty input, very long single words, etc.)
- Safe for all Thai text including mixed Thai-English content

**Use Cases:**
- Pre-processing long documents before sending to AI providers
- Handling text that exceeds API token limits
- Batch processing of large documents

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express 5
- **Database:** MongoDB with Mongoose 9
- **Auth:** JWT (httpOnly cookies) + bcryptjs

## API Documentation

- **Interactive API Docs**: [View on SwaggerHub](https://app.swaggerhub.com/apis-docs/none-767/tcheck-backend-api/1.3.0?view=uiDocs) - Try out the API directly in your browser
- **Postman Collection**: Import `tcheck-backend.postman_collection.json` to test all endpoints
- **OpenAPI Spec**: See `swagger.yml` for complete API documentation

The collections include:

- User authentication (signup, signin, signout)
- User profile management
- Document CRUD operations
- AI grammar checking
