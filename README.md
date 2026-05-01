# Stock Tracker

A local full-stack dashboard for tracking stock watchlists, market sentiment, networking/AI news, GitHub projects, and daily networking project ideas.

The app is built for a network engineer workflow: quick stock context, current infrastructure news, useful open-source projects, and practical build ideas in one compact dashboard.

## Features

- Add and remove stock tickers from a local watchlist.
- Auto-refresh dashboard data every 60 seconds.
- Display stock quote, best entry target, model score, buy zone, and a price chart with X/Y labels.
- Show collapsible stock model details:
  - 30D forecast
  - 90D forecast
  - 90D edge
  - safety gap
  - 50D / 200D averages
  - 52-week low/high
  - drawdown
  - volume
  - trend estimate
- Show CNN Fear & Greed sentiment in a compact single-pane meter.
- Rank top networking news and top AI news.
- Show top GitHub projects related to networking and AI.
- Generate daily networking project ideas.

## Tech Stack

- Frontend: React, Vite, Lucide icons
- Backend: Express
- Parsing: fast-xml-parser
- Data sources:
  - Stooq quote CSV
  - Yahoo Finance chart endpoint
  - CNN Fear & Greed data endpoint
  - Google News RSS
  - selected RSS/Atom feeds
  - Hacker News Algolia API
  - Reddit JSON feed
  - GitHub Search API
  - optional X/Twitter API

## Start The App

Install dependencies:

```bash
npm install
```

Start frontend and backend together:

```bash
npm run dev
```

Open:

```text
http://localhost:5173/
```

The API server runs on:

```text
http://localhost:8787/
```

## Deploy On Vercel

This repo is currently a Vite frontend plus an Express API server. Vercel can deploy the frontend directly. The Express API should either be deployed separately or converted into Vercel serverless functions.

Recommended path:

1. Push this project to GitHub.
2. Deploy the Express API to a backend host such as Render, Railway, Fly.io, or a small VM.
3. In Vercel, import the GitHub repo.
4. Use these Vercel build settings:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

5. Add this Vercel environment variable:

```text
VITE_API_BASE=https://your-api-host.example.com
```

6. Deploy.

If you want Vercel-only hosting, convert `server/index.js` into Vercel API routes under `api/`. After that, set:

```text
VITE_API_BASE=
```

or update the frontend to call relative paths like `/api/stocks`.

## Useful Scripts

```bash
npm run dev
npm run client
npm run server
npm run lint
npm run build
npm run preview
```

## Optional X/Twitter Support

Recent X/Twitter posts are only included if a bearer token is available:

```bash
export X_BEARER_TOKEN="your_token_here"
npm run dev
```

Without this token, the app still uses Google News, direct feeds, Hacker News, Reddit, GitHub, and market APIs.

## API Endpoints

Stocks:

```text
GET /api/stocks?symbols=CSCO,ANET,MSFT
```

Market sentiment:

```text
GET /api/sentiment
```

News:

```text
GET /api/news?topic=networking
GET /api/news?topic=ai
GET /api/networking-news
GET /api/ai-news
```

GitHub projects:

```text
GET /api/github-projects?topic=networking
GET /api/github-projects?topic=ai
```

Daily project ideas:

```text
GET /api/project-ideas
```

## Stock Model

The stock model is educational and intended for watchlist discipline. It is not financial advice.

For each ticker, the backend pulls:

- latest quote from Stooq
- available 1-year daily history from Yahoo Finance

It calculates:

- 50-day simple moving average
- 200-day simple moving average
- 52-week high and low
- drawdown from 52-week high
- daily and annualized volatility
- 20/60/120-day momentum
- trend slope from recent log prices
- 30-day and 90-day forecast estimates

The forecast blends:

- recent trend slope
- 20-day momentum
- 60-day momentum
- 120-day momentum
- volatility uncertainty discount

The best entry target uses:

- 200-day average
- discounted 50-day average
- 52-week low anchor
- discounted 90-day forecast
- volatility discount
- momentum penalty when trend is negative
- greed penalty when trend is very extended

The model score starts at 50 and adjusts for:

- 52-week range position
- price versus 200-day average
- 50-day versus 200-day trend
- drawdown
- trend estimate
- 60-day momentum
- volatility penalty

Score labels:

```text
72-100  Strong entry setup
58-71   Building setup
42-57   Neutral
0-41    Avoid chasing
```

## News Ranking Algorithm

The news ranking algorithm favors actual news/reporting over generic discussion threads.

For each candidate article/post:

```text
rank = recency
     + source weight
     + topic keyword relevance
     + news-event boost
     + capped social engagement
     - discussion/social penalty
```

Inputs:

- Recency: newer items from the past 24 hours rank higher.
- Source weight: direct reporting sources score higher than social sources.
- Keyword relevance: networking or AI keywords add relevance points.
- News-event boost: terms like outage, incident, vulnerability, launch, release, patch, acquisition, or report increase score.
- Engagement: points/comments/likes are capped so viral social posts do not dominate.
- Penalty: help/advice/discussion posts are discounted.

Networking topic keywords include:

```text
networking, bgp, ospf, evpn, vxlan, mpls, sd-wan, sase, dns,
ddos, ipv6, ethernet, cisco, juniper, arista, cloudflare
```

AI topic keywords include:

```text
ai, artificial intelligence, machine learning, llm, openai,
anthropic, google deepmind, nvidia, gpu, inference, training,
agent, model, datacenter
```

## GitHub Project Ranking

GitHub panels use the GitHub Search API sorted by stars.

Networking query:

```text
network-automation stars:>100
```

AI query:

```text
llm stars:>1000
```

The dashboard displays the top projects with:

- repository name
- description
- stars
- forks
- language
- last update timestamp from the API

## Caching And Refresh

Browser dashboard:

- refreshes every 60 seconds
- manual refresh resets the countdown

Backend cache TTLs:

- stock data: 55 seconds
- news data: 55 seconds
- Fear & Greed sentiment: 55 seconds
- GitHub projects: 10 minutes
- daily project ideas: 1 hour

The 55-second cache for live market/news data gives the 60-second frontend refresh enough room to fetch fresh server data.

## Notes

- Stock prices and research output are for education only.
- Forecasts are simple technical estimates, not predictive guarantees.
- Some public data sources may rate-limit or block requests.
- X/Twitter data requires `X_BEARER_TOKEN`.
