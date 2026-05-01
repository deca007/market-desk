# Market Desk

Compact dashboard for tracking stock watchlist setups, Fear & Greed sentiment, networking and AI news, fresh GitHub projects, and daily build ideas in one place.

## Stack

- Frontend: React + Vite
- Backend: Express
- Data: Yahoo Finance, CNN Fear & Greed, RSS feeds, Reddit, GitHub

## Local Run

```bash
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

API:

```text
http://localhost:8787
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
```

## Notes

- Auto-refresh runs every 60 seconds.
- Daily project ideas refresh once every 24 hours.
- Stock setup data is for watchlist research only, not financial advice.
