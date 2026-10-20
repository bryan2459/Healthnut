# Forme — personal trainer discovery

A light-themed React landing page for discovering personal trainers, with an Express API and a SQLite-backed waitlist.

## Run locally

1. Install Node.js 18 or newer.
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and set `ADMIN_TOKEN` to a long, private random value.
4. Start the app: `npm run dev`
5. Open the Vite URL shown in the terminal (usually `http://localhost:5173`).

SQLite creates `server/data/waitlist.sqlite` automatically when the API starts. The waitlist table stores each signup's name, unique email address, optional goal, and signup timestamp.

## Viewing waitlist responses

Open the admin dashboard at `http://localhost:5173/admin` (or your deployed app's `/admin` URL) and enter the `ADMIN_TOKEN` configured in `.env`. The admin API requires this token; waitlist data is not publicly accessible. Do not expose the token in frontend code or commit `.env`.

## Production

Run `npm run build`, then set `ADMIN_TOKEN` and run `npm start`. The Express server serves the built React app and API. Keep the SQLite data directory on persistent storage when deploying.

## API

- `POST /api/waitlist` — accepts `{ "name": "...", "email": "...", "goal": "..." }`.
- `GET /api/waitlist` — returns signup entries; requires `Authorization: Bearer <ADMIN_TOKEN>`.


Note:
Landing page that enable you to find a personal trainer. List each personal trainers expertise with a picture,location and hourly rate and what you can gain from using this personal trainer. Provide a waitlist in sqlite. You are able to see the responses. Light theme. Use react and SQLite

Open the admin dashboard at `http://localhost:5173/admin` (or your deployed app's `/admin` URL) and enter the `ADMIN_TOKEN` configured in `.env`. The admin API requires this token; 

`a653bb300e5f92c3505eae822b498b423200ed8cbbbef6fd56d767c845567ac9`
