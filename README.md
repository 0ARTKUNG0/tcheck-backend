# backend-tcheck

REST API backend for tcheck built with Node.js, Express 5, and MongoDB.

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

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGODB_URL` | MongoDB connection string | `mongodb://localhost:27017/tcheck` |
| `JWT_SECRET` | Secret key for JWT signing | `your-secure-secret-key` |
| `NODE_ENV` | Environment mode | `development` / `production` |
| `BASE_URL` | Allowed CORS origin | `http://localhost:3000` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with nodemon |
| `npm start` | Start production server |
| `npm test` | Run tests with Jest |

## API Endpoints

Base URL: `/api`

### Public Endpoints

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| POST | `/api/user/signup` | Register a new user | `{ user_name, user_email, user_password }` |
| POST | `/api/user/signin` | Sign in with email or username | `{ user_email or user_name, user_password }` |
| POST | `/api/user/signout` | Sign out (clears cookie) | - |

### Protected Endpoints (Requires Authentication)

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| GET | `/api/user/profile` | Get current user profile | - |
| POST | `/api/user/update-username` | Update username | `{ user_name }` |

## User Roles

The system supports three user roles:

- **`user-free`** (default) - Free tier users
- **`user-pro`** - Pro/premium users
- **`admin`** - Administrator users

New signups automatically get the `user-free` role.

## Authentication

The application uses JWT-based authentication with httpOnly cookies for security.

### How It Works

1. **Sign up/Sign in**: Server sets an httpOnly cookie with JWT token (1 hour expiration)
2. **Protected routes**: Middleware verifies token from cookie
3. **Sign out**: Server clears the authentication cookie

### Token Details

- **Expiration**: 1 hour
- **Storage**: httpOnly cookie (prevents XSS attacks)
- **Secure flag**: Enabled in production (HTTPS only)
- **SameSite**: `strict` (CSRF protection)

### Middleware

- **`verifyToken`**: Validates JWT token from cookies
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

## Error Handling

| Status Code | Meaning |
|-------------|---------|
| `400` | Bad Request (missing fields) |
| `401` | Unauthorized (invalid credentials or no token) |
| `404` | Not Found (user not found) |
| `409` | Conflict (email already exists) |
| `500` | Internal Server Error |

## Testing

Tests use Jest with an in-memory MongoDB instance.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express 5
- **Database:** MongoDB with Mongoose 9
- **Auth:** JWT (httpOnly cookies) + bcryptjs
- **Testing:** Jest + Supertest + MongoDB Memory Server

## Postman Collection

Import the `tcheck-backend.postman_collection.json` file into Postman to test all API endpoints.

The collection includes:
- User signup
- User signin
- User signout
- Update username
- Health check endpoint
