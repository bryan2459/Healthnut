# Forme — personal trainer discovery

A light-themed React landing page for discovering personal trainers, with an Express API and a SQLite-backed waitlist.

## Run locally

1. Install Node.js 18 or newer.
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and set `ADMIN_TOKEN` to a long, private random value.
4. Start the app: `npm run dev`
5. Open the Vite URL shown in the terminal (usually `http://localhost:5173`).

SQLite creates `server/data/waitlist.sqlite` automatically when the API starts. The `waitlist` table stores landing-page signups, while completed intake forms create `Lead` records in `users` with a fitness focus and matched trainer. The database also initializes `coaches`, `transactions`, and `sessions` tables. Coaches include an hourly rate, and the four featured landing-page trainers are added to the roster once if they are not already present. Foreign-key constraints are enabled, and deleting a related user or coach applies the configured cascade or coach-unassignment behavior.

## Viewing waitlist responses

Open the admin dashboard at `http://localhost:5173/admin` (or your deployed app's `/admin` URL) and enter the `ADMIN_TOKEN` configured in `.env`. The dashboard lets you add, edit, delete, and list trainers and users, including each intake user's matched trainer and status, and view waitlist responses. Admin API routes require this token; waitlist, user, and trainer management data are not publicly accessible. The landing page displays the coach roster and public hourly rates. Deleting a trainer also removes their booked sessions and unassigns clients, according to the configured foreign-key behavior. Do not expose the token in frontend code or commit `.env`.

## Production

Run `npm run build`, then set `ADMIN_TOKEN` and run `npm start`. The Express server serves the built React app and API. Keep the SQLite data directory on persistent storage when deploying.

## API

- `POST /api/waitlist` - accepts `{ "name": "...", "email": "...", "goal": "..." }`.
- `POST /api/intake` - creates a Lead user from `{ "name": "...", "email": "...", "goal": "..." }` and returns the best matching trainer.
- `GET /api/users` - lists intake users and their matched trainers; requires admin authorization.
- `POST /api/users` - adds a user; requires admin authorization. Accepts `{ "fullName": "...", "email": "...", "fitnessFocus": "...", "accountStatus": "Lead", "coachId": "auto" }`.
- `PUT /api/users/:userId` - updates user details, status, and trainer match; requires admin authorization.
- `DELETE /api/users/:userId` - deletes a user; requires admin authorization.
- `GET /api/waitlist` - returns signup entries; requires the configured admin token.
- `GET /api/trainers` - returns the trainer details used by the public landing page.
- `GET /api/coaches` - returns the trainer roster; requires the configured admin token.
- `POST /api/coaches` - adds a trainer; requires the configured admin token.
- `PUT /api/coaches/:coachId` - updates trainer roster details; requires the configured admin token.
- `DELETE /api/coaches/:coachId` - deletes a trainer; requires the configured admin token.
