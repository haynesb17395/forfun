Trivia with Friends
===================

Play real-time trivia with friends. Create a room, share the code, and go!

Run locally
-----------

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser. Create a room, then share the room code with friends so they can join from their browsers.

Features
--------

- Create/join rooms with short codes
- Host controls: start, reveal, next, end
- Real-time answers, reveal, and scoreboard
- Simple, modern UI

Environment
-----------

- Node 18+
- No external DB (in-memory). For production, replace with persistent storage.

Scripts
-------

- `npm run dev`: start with nodemon
- `npm start`: start server

Notes
-----

- Questions are in `data/questions.json`.
- Static client is served from `public/`.

