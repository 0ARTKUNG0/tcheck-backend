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

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGODB_URL` | MongoDB connection string | `mongodb://localhost:27017/tcheck` |
| `JWT_SECRET` | Secret key for JWT signing | — |
| `NODE_ENV` | Environment mode | `development` / `production` |
| `BASE_URL` | Allowed CORS origin | `http://localhost:3000` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with nodemon |
| `npm start` | Start production server |

## API

Base URL: `/api`

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/user/signup` | Register a new user |
| POST | `/api/user/signin` | Sign in |
| POST | `/api/user/signout` | Sign out (clears cookie) |

### Protected Endpoints (Requires Authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/profile` | Get current user profile |
| POST | `/api/user/update-username` | Update username |

### Admin Endpoints (Requires Admin Role)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/admin/users` | Get all users (admin only) |
| PUT | `/api/user/admin/update-role` | Update user role (admin only) |

See [swagger.yaml](swagger.yaml) for full API documentation.

## Authentication & Authorization

The application uses JWT-based authentication with httpOnly cookies.

### Middleware

- **verifyToken**: Validates JWT token from cookies or Authorization header
- **isAdmin**: Restricts access to admin users only
- **hasRole**: Restricts access based on specified roles

### Token Format

Tokens can be provided via:
1. Cookie: `req.cookies.token`
2. Authorization Header: `Bearer <token>`

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express 5
- **Database:** MongoDB with Mongoose 9
- **Auth:** JWT (httpOnly cookies) + bcryptjs
