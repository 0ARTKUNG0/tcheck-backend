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

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/user/signup` | Register a new user |
| POST | `/api/user/signin` | Sign in |
| POST | `/api/user/signout` | Sign out (clears cookie) |
| POST | `/api/user/update-username` | Update username (requires auth) |

See [swagger.yaml](swagger.yaml) for full API documentation.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express 5
- **Database:** MongoDB with Mongoose 9
- **Auth:** JWT (httpOnly cookies) + bcryptjs
