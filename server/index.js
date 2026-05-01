import cors from 'cors'
import express from 'express'
import { XMLParser } from 'fast-xml-parser'

const app = express()
const port = Number(process.env.PORT || 8787)
const cache = new Map()
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
})

app.use(cors())
app.use(express.json())

const MARKET_CACHE_MS = 55 * 1000
const NEWS_CACHE_MS = 55 * 1000
const SENTIMENT_CACHE_MS = 55 * 1000
const GITHUB_CACHE_MS = 60 * 60 * 1000
const IDEAS_CACHE_MS = 60 * 60 * 1000

const networkKeywords = [
  'network',
  'networking',
  'routing',
  'switching',
  'bgp',
  'ospf',
  'evpn',
  'vxlan',
  'mpls',
  'sd-wan',
  'sase',
  'zero trust',
  'cisco',
  'juniper',
  'arista',
  'palo alto',
  'fortinet',
  'f5',
  'cloudflare',
  'akamai',
  'outage',
  'dns',
  'ddos',
  'ipv6',
  'wi-fi',
  'ethernet',
]

const aiKeywords = [
  'ai',
  'artificial intelligence',
  'machine learning',
  'deep learning',
  'llm',
  'large language model',
  'openai',
  'anthropic',
  'google deepmind',
  'nvidia',
  'gpu',
  'inference',
  'training',
  'agent',
  'model',
  'datacenter',
  'data center',
  'semiconductor',
]

const sourceWeights = {
  'Google News': 24,
  'Network World': 24,
  'APNIC Blog': 23,
  'Cisco Blogs': 22,
  'AWS Networking': 22,
  'BleepingComputer': 22,
  'Juniper Blogs': 21,
  'The Register': 20,
  Cloudflare: 18,
  'Hacker News': 11,
  Reddit: 6,
  'X/Twitter': 5,
  TechCrunch: 22,
  VentureBeat: 22,
  'MIT Technology Review': 20,
  'The Verge': 18,
}

const directNewsFeeds = [
  { source: 'Network World', url: 'https://www.networkworld.com/feed' },
  { source: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
  { source: 'The Register', url: 'https://www.theregister.com/headlines.atom' },
  { source: 'Cloudflare', url: 'https://blog.cloudflare.com/rss/' },
  { source: 'Cisco Blogs', url: 'https://blogs.cisco.com/feed' },
  { source: 'Juniper Blogs', url: 'https://blogs.juniper.net/feed' },
  { source: 'APNIC Blog', url: 'https://blog.apnic.net/feed/' },
  { source: 'AWS Networking', url: 'https://aws.amazon.com/blogs/networking-and-content-delivery/feed/' },
]

const aiNewsFeeds = [
  { source: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { source: 'VentureBeat', url: 'https://venturebeat.com/category/ai/feed/' },
  { source: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/' },
  { source: 'The Verge', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
]

const newsWords = [
  'announces',
  'launches',
  'releases',
  'reports',
  'confirms',
  'outage',
  'incident',
  'breach',
  'vulnerability',
  'patch',
  'acquires',
  'earnings',
  'partnership',
  'deploys',
  'update',
]

const forumWords = ['help', 'question', 'advice', 'how do i', 'recommendation', 'what are you using', 'career']

const networkingProjectIdeas = [
  {
    title: 'EVPN/VXLAN Route Type Explorer',
    difficulty: 'Medium',
    stack: 'Python, FastAPI, React',
    summary: 'Paste BGP EVPN routes and render route type, VNI, ESI, RD/RT, and next-hop relationships.',
  },
  {
    title: 'BGP Change Blast Radius Simulator',
    difficulty: 'Hard',
    stack: 'Go, Batfish, Graphviz',
    summary: 'Model prefix-policy changes and show affected peers, paths, and route advertisements before deployment.',
  },
  {
    title: 'Config Drift Radar',
    difficulty: 'Medium',
    stack: 'Python, Nornir, SQLite',
    summary: 'Pull device configs, normalize vendor syntax, and flag drift from golden intent by site and role.',
  },
  {
    title: 'PeeringDB Delta Watcher',
    difficulty: 'Medium',
    stack: 'TypeScript, Postgres, React',
    summary: 'Track PeeringDB updates by ASN, facility, IXP, and policy changes, then surface what may affect onboarding or traffic shifts.',
  },
  {
    title: 'Interface Error Storyboard',
    difficulty: 'Easy',
    stack: 'Python, SNMP/gNMI, Chart.js',
    summary: 'Track CRC, drops, discards, and utilization, then generate a human-readable probable-cause timeline.',
  },
  {
    title: 'Streaming Telemetry Rule Lab',
    difficulty: 'Medium',
    stack: 'Go, gNMI, Prometheus, Grafana',
    summary: 'Replay interface, BGP, and queue telemetry into alert rules so operators can tune thresholds before production rollout.',
  },
  {
    title: 'AI Fabric Oversubscription Calculator',
    difficulty: 'Medium',
    stack: 'TypeScript, React',
    summary: 'Plan GPU leaf/spine fabrics with radix, rail count, ECMP width, and expected incast pressure.',
  },
  {
    title: 'Maintenance Window Precheck Bot',
    difficulty: 'Medium',
    stack: 'Python, Netmiko, Slack',
    summary: 'Run route, BFD, LLDP, optics, and config sanity checks before and after a planned change.',
  },
  {
    title: 'Network Deployment Guardrails',
    difficulty: 'Hard',
    stack: 'Python, Nornir, Batfish, GitHub Actions',
    summary: 'Validate intent, simulate blast radius, and block risky templates before a rollout touches production devices.',
  },
  {
    title: 'DNS Outage Triage Workbench',
    difficulty: 'Easy',
    stack: 'Node, DNS over HTTPS, React',
    summary: 'Compare authoritative, recursive, DNSSEC, latency, and resolver behavior from multiple vantage points.',
  },
  {
    title: 'NOC Event Correlator',
    difficulty: 'Medium',
    stack: 'Python, Kafka, React',
    summary: 'Fuse syslog, traps, interface counters, and ticket metadata into one incident timeline for faster operator triage.',
  },
  {
    title: 'Packet Walk Debugger',
    difficulty: 'Hard',
    stack: 'Python, pyATS, Mermaid',
    summary: 'Given source/destination/port, trace expected L2/L3/security path and highlight missing telemetry.',
  },
]

function cacheGet(key) {
  const entry = cache.get(key)
  if (!entry || entry.expiresAt < Date.now()) return null
  return entry.value
}

function cacheSet(key, value, ttl) {
  cache.set(key, { value, expiresAt: Date.now() + ttl })
  return value
}

function cachePeek(key) {
  return cache.get(key)?.value || null
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function isoDateDaysAgo(days) {
  const value = new Date()
  value.setUTCDate(value.getUTCDate() - days)
  return value.toISOString().slice(0, 10)
}

function daysSince(value) {
  if (!value) return 999
  return Math.max(0, (Date.now() - new Date(value).getTime()) / 86_400_000)
}

function githubFreshness(repo) {
  const createdDays = daysSince(repo.created_at)
  const pushedDays = daysSince(repo.pushed_at || repo.updated_at)

  if (createdDays < 1) return 'New today'
  if (createdDays < 7) return 'New this week'
  if (pushedDays < 1) return 'Updated today'
  if (pushedDays < 3) return 'Active this week'
  return `Updated ${Math.round(pushedDays)}d ago`
}

function githubRepoScore(repo) {
  const starScore = Math.log10((repo.stargazers_count || 0) + 1) * 22
  const createdBoost = Math.max(0, 18 - daysSince(repo.created_at) * 0.9)
  const pushedBoost = Math.max(0, 20 - daysSince(repo.pushed_at || repo.updated_at) * 1.4)
  return starScore + createdBoost + pushedBoost
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'StockTrackerNetworkEngineer/1.0',
      Accept: '*/*',
      ...(options.headers || {}),
    },
  })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  return response.text()
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'StockTrackerNetworkEngineer/1.0',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  return response.json()
}

function normalizeSymbol(symbol) {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '')
}

function numberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function lastFiniteNumber(values = []) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = numberOrNull(values[index])
    if (Number.isFinite(value)) return value
  }
  return null
}

async function fetchYahooChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`
  const payload = await fetchJson(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 StockTrackerNetworkEngineer/1.0',
    },
  })
  const result = payload.chart?.result?.[0]
  const meta = result?.meta || {}
  const timestamps = result?.timestamp || []
  const quote = result?.indicators?.quote?.[0] || {}
  const opens = quote.open || []
  const closes = quote.close || []
  const highs = quote.high || []
  const lows = quote.low || []
  const volumes = quote.volume || []

  const history = timestamps
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: numberOrNull(opens[index]),
      close: numberOrNull(closes[index]),
      high: numberOrNull(highs[index]),
      low: numberOrNull(lows[index]),
      volume: numberOrNull(volumes[index]),
    }))
    .filter((point) => point.close)

  const latestPoint = history.at(-1) || {}

  return {
    quote: {
      symbol: meta.symbol || symbol,
      name: meta.longName || meta.shortName || meta.symbol || symbol,
      price: numberOrNull(meta.regularMarketPrice) || latestPoint.close || lastFiniteNumber(closes),
      open: latestPoint.open || lastFiniteNumber(opens),
      high: latestPoint.high || lastFiniteNumber(highs),
      low: latestPoint.low || lastFiniteNumber(lows),
      volume: latestPoint.volume || lastFiniteNumber(volumes),
      asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : history.at(-1)?.date || '',
      quoteSource: 'Yahoo Finance',
    },
    history,
  }
}

function average(values) {
  const usable = values.filter((value) => Number.isFinite(value))
  if (!usable.length) return null
  return usable.reduce((sum, value) => sum + value, 0) / usable.length
}

function standardDeviation(values) {
  const avg = average(values)
  if (!avg) return null
  const variance = average(values.map((value) => (value - avg) ** 2))
  return variance ? Math.sqrt(variance) : null
}

function pct(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 10 : null
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function slope(values) {
  const usable = values.filter(Number.isFinite)
  if (usable.length < 2) return null
  const xMean = (usable.length - 1) / 2
  const yMean = average(usable)
  const numerator = usable.reduce((sum, value, index) => sum + (index - xMean) * (value - yMean), 0)
  const denominator = usable.reduce((sum, _value, index) => sum + (index - xMean) ** 2, 0)
  return denominator ? numerator / denominator : null
}

function rateOfChange(closes, days) {
  if (closes.length <= days) return null
  const previous = closes.at(-days - 1)
  const current = closes.at(-1)
  return previous ? (current - previous) / previous : null
}

function buildForecast(closes, current, annualVol) {
  if (!current || closes.length < 40) {
    return {
      expected30Day: null,
      expected90Day: null,
      trendAnnualPct: null,
      momentum20Pct: null,
      momentum60Pct: null,
      momentum120Pct: null,
      confidence: 'low',
    }
  }

  const logCloses = closes.map(Math.log)
  const dailyTrend = slope(logCloses.slice(-120)) || 0
  const momentum20 = rateOfChange(closes, 20) || 0
  const momentum60 = rateOfChange(closes, 60) || 0
  const momentum120 = rateOfChange(closes, 120) || 0
  const blendedDailyReturn = dailyTrend * 0.45 + (momentum20 / 20) * 0.25 + (momentum60 / 60) * 0.2 + (momentum120 / 120) * 0.1
  const cappedDailyReturn = clamp(blendedDailyReturn, -0.004, 0.004)
  const uncertainty30 = (annualVol || 0.28) * Math.sqrt(30 / 252) * 0.42
  const uncertainty90 = (annualVol || 0.28) * Math.sqrt(90 / 252) * 0.42

  return {
    expected30Day: current * Math.exp(cappedDailyReturn * 30 - uncertainty30),
    expected90Day: current * Math.exp(cappedDailyReturn * 90 - uncertainty90),
    trendAnnualPct: pct(Math.exp(cappedDailyReturn * 252) - 1),
    momentum20Pct: pct(momentum20),
    momentum60Pct: pct(momentum60),
    momentum120Pct: pct(momentum120),
    confidence: closes.length > 200 ? 'medium' : 'low',
  }
}

function buildResearch(symbol, quote, history, historyError) {
  const closes = history.map((point) => point.close).filter(Boolean)
  const highs = history.map((point) => point.high).filter(Boolean)
  const lows = history.map((point) => point.low).filter(Boolean)
  const current = quote.price || closes.at(-1)
  const sma50 = average(closes.slice(-50))
  const sma200 = average(closes.slice(-200))
  const week52High = highs.length ? Math.max(...highs) : quote.high
  const week52Low = lows.length ? Math.min(...lows) : quote.low
  const returns = closes
    .slice(1)
    .map((close, index) => (close - closes[index]) / closes[index])
    .filter(Number.isFinite)
  const dailyVol = standardDeviation(returns)
  const annualVol = dailyVol ? dailyVol * Math.sqrt(252) : null
  const drawdown = current && week52High ? (week52High - current) / week52High : null
  const forecast = buildForecast(closes, current, annualVol)
  const rangePosition =
    current && week52High && week52Low && week52High !== week52Low
      ? (current - week52Low) / (week52High - week52Low)
      : null

  const anchorValues = [
    sma200,
    sma50 ? sma50 * 0.96 : null,
    week52Low ? week52Low * 1.08 : null,
    forecast.expected90Day ? forecast.expected90Day * 0.94 : null,
  ].filter(Boolean)
  const technicalFairValue = average(anchorValues) || current
  const volatilityDiscount = annualVol ? Math.min(0.16, Math.max(0.04, annualVol * 0.22)) : 0.08
  const momentumPenalty = forecast.trendAnnualPct !== null && forecast.trendAnnualPct < 0 ? 0.04 : 0
  const greedPenalty = forecast.trendAnnualPct !== null && forecast.trendAnnualPct > 35 ? 0.03 : 0
  const buyBelow = technicalFairValue
    ? technicalFairValue * (1 - volatilityDiscount - momentumPenalty - greedPenalty)
    : current * 0.9
  const accumulationLow = buyBelow * 0.97
  const accumulationHigh = buyBelow * 1.03
  const idealEntry = Math.min(buyBelow, forecast.expected30Day || buyBelow, sma50 || buyBelow)
  const marginOfSafetyPct = current && idealEntry ? pct((current - idealEntry) / current) : null

  let score = 50
  if (rangePosition !== null) score += (0.5 - rangePosition) * 42
  if (sma200 && current) score += current < sma200 ? 11 : -8
  if (sma50 && sma200) score += sma50 > sma200 ? 8 : -5
  if (drawdown !== null) score += Math.min(16, drawdown * 40)
  if (forecast.trendAnnualPct !== null) score += clamp(forecast.trendAnnualPct / 6, -12, 12)
  if (forecast.momentum60Pct !== null) score += clamp(forecast.momentum60Pct / 4, -8, 8)
  if (annualVol !== null) score -= Math.min(12, annualVol * 13)
  score = Math.max(0, Math.min(100, Math.round(score)))

  const verdict =
    score >= 72
      ? 'Strong entry setup'
      : score >= 58
        ? 'Building setup'
        : score >= 42
          ? 'Neutral'
          : 'Avoid chasing'

  const rationale = [
    sma200 && current
      ? `${current < sma200 ? 'Price is below' : 'Price is above'} the 200-day average`
      : 'Long-term average unavailable',
    rangePosition !== null
      ? `52-week range position is ${pct(rangePosition)}%`
      : '52-week range unavailable',
    annualVol !== null ? `Annualized volatility estimate is ${pct(annualVol)}%` : historyError || 'Volatility unavailable',
    forecast.trendAnnualPct !== null ? `Forward trend estimate is ${forecast.trendAnnualPct}% annualized` : 'Forecast unavailable',
  ]

  return {
    symbol,
    current,
    verdict,
    score,
    buyBelow,
    idealEntry,
    marginOfSafetyPct,
    accumulationLow,
    accumulationHigh,
    forecast,
    metrics: {
      sma50,
      sma200,
      week52High,
      week52Low,
      drawdownPct: pct(drawdown),
      rangePositionPct: pct(rangePosition),
      annualVolatilityPct: pct(annualVol),
    },
    rationale,
    historyPoints: history.slice(-90),
    dataQuality: history.length > 150 ? 'full' : history.length ? 'partial' : 'quote-only',
  }
}

async function fetchFearGreed() {
  const cached = cacheGet('sentiment')
  if (cached) return cached

  try {
    const payload = await fetchJson('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: {
        Accept: 'application/json',
        Referer: 'https://edition.cnn.com/',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    })
    const fg = payload.fear_and_greed
    const indicators = [
      ['market_momentum_sp500', 'Market momentum'],
      ['stock_price_strength', 'Stock price strength'],
      ['stock_price_breadth', 'Stock price breadth'],
      ['put_call_options', 'Put/call options'],
      ['market_volatility_vix', 'Market volatility'],
      ['junk_bond_demand', 'Junk bond demand'],
      ['safe_haven_demand', 'Safe haven demand'],
    ]
      .filter(([key]) => payload[key])
      .map(([key, label]) => ({
        key,
        label,
        score: Math.round(payload[key].score * 10) / 10,
        rating: payload[key].rating,
      }))

    return cacheSet(
      'sentiment',
      {
        source: 'CNN Fear & Greed',
        sourceUrl: 'https://edition.cnn.com/markets/fear-and-greed',
        score: Math.round(fg.score * 10) / 10,
        rating: fg.rating,
        timestamp: fg.timestamp,
        previousClose: Math.round(fg.previous_close * 10) / 10,
        previousWeek: Math.round(fg.previous_1_week * 10) / 10,
        previousMonth: Math.round(fg.previous_1_month * 10) / 10,
        previousYear: Math.round(fg.previous_1_year * 10) / 10,
        indicators,
        mode: 'live',
      },
      SENTIMENT_CACHE_MS,
    )
  } catch (error) {
    return cacheSet(
      'sentiment',
      {
        source: 'Fallback sentiment',
        score: 50,
        rating: 'neutral',
        timestamp: new Date().toISOString(),
        previousClose: null,
        previousWeek: null,
        previousMonth: null,
        previousYear: null,
        indicators: [],
        mode: 'fallback',
        note: `CNN Fear & Greed unavailable: ${error.message}`,
      },
      SENTIMENT_CACHE_MS,
    )
  }
}

app.get('/api/sentiment', async (_request, response) => {
  response.json(await fetchFearGreed())
})

app.get('/api/stocks', async (request, response) => {
  const symbols = String(request.query.symbols || 'CSCO,ANET,JNPR')
    .split(',')
    .map(normalizeSymbol)
    .filter(Boolean)
    .slice(0, 12)
  const cacheKey = `stocks:${symbols.join(',')}`
  const cached = cacheGet(cacheKey)
  if (cached) return response.json(cached)
  const stale = cachePeek(cacheKey)

  try {
    const staleStocks = new Map((stale?.stocks || []).map((stock) => [stock.symbol, stock]))
    const chartResults = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const { quote, history } = await fetchYahooChart(symbol)
        return {
          ...quote,
          research: buildResearch(quote.symbol, quote, history, ''),
        }
      }),
    )

    const failedSymbols = []
    const stocks = symbols
      .map((symbol, index) => {
        const result = chartResults[index]
        if (result.status === 'fulfilled') return result.value
        failedSymbols.push(symbol)
        return staleStocks.get(symbol) || null
      })
      .filter(Boolean)

    if (!stocks.length) {
      if (stale?.stocks?.length) {
        return response.json({
          ...stale,
          warning: 'Live stock fetch failed. Showing the last cached watchlist snapshot.',
        })
      }
      throw new Error('Live quote source unavailable')
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      disclaimer:
        'Research model for education and watchlist discipline only. It is not financial advice.',
      stocks,
      warning: failedSymbols.length
        ? `Some symbols are temporarily using cached data or are unavailable: ${failedSymbols.join(', ')}`
        : '',
    }
    response.json(cacheSet(cacheKey, payload, MARKET_CACHE_MS))
  } catch (error) {
    response.status(502).json({ error: error.message })
  }
})

function stripHtml(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function articleAgeHours(article) {
  const published = new Date(article.publishedAt).getTime()
  if (!Number.isFinite(published)) return 24
  return Math.max(0, (Date.now() - published) / 36e5)
}

function keywordScore(article, keywords = networkKeywords) {
  const text = `${article.title} ${article.summary || ''}`.toLowerCase()
  return keywords.reduce((score, keyword) => (text.includes(keyword) ? score + 4 : score), 0)
}

function rankArticle(article, keywords = networkKeywords) {
  const recency = Math.max(0, 30 - articleAgeHours(article))
  const engagement = Math.min(28, Math.log10((article.points || 0) + (article.comments || 0) * 2 + 1) * 14)
  const source = sourceWeights[article.source] || 8
  const text = `${article.title} ${article.summary || ''}`.toLowerCase()
  const newsBoost = newsWords.some((word) => text.includes(word)) ? 12 : 0
  const forumPenalty = article.kind === 'discussion' || forumWords.some((word) => text.includes(word)) ? 18 : 0
  const socialPenalty = article.kind === 'social-signal' ? 14 : 0
  return Math.round((recency + engagement + source + keywordScore(article, keywords) + newsBoost - forumPenalty - socialPenalty) * 10) / 10
}

function articleItemsFromParsedFeed(parsed, source) {
  if (parsed.rss?.channel?.item) {
    const items = Array.isArray(parsed.rss.channel.item) ? parsed.rss.channel.item : [parsed.rss.channel.item]
    return items.map((item) => ({
      source,
      kind: 'news',
      title: stripHtml(item.title),
      summary: stripHtml(item.description || item['content:encoded'] || ''),
      url: item.link,
      publishedAt: new Date(item.pubDate || item['dc:date'] || Date.now()).toISOString(),
      origin: source,
    }))
  }

  if (parsed.feed?.entry) {
    const entries = Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry]
    return entries.map((entry) => {
      const link = Array.isArray(entry.link) ? entry.link.find((item) => item.href)?.href : entry.link?.href || entry.link
      return {
        source,
        kind: 'news',
        title: stripHtml(entry.title),
        summary: stripHtml(entry.summary || entry.content || ''),
        url: link,
        publishedAt: new Date(entry.updated || entry.published || Date.now()).toISOString(),
        origin: source,
      }
    })
  }

  return []
}

async function fetchDirectNewsFeeds(feeds = directNewsFeeds) {
  const feedResults = await Promise.allSettled(
    feeds.map(async (feed) => {
      const xml = await fetchText(feed.url)
      return articleItemsFromParsedFeed(xmlParser.parse(xml), feed.source)
    }),
  )

  return {
    articles: feedResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
    statuses: feeds.map((feed, index) => {
      const result = feedResults[index]
      return {
        source: feed.source,
        ok: result.status === 'fulfilled',
        count: result.status === 'fulfilled' ? result.value.length : 0,
        note: result.status === 'rejected' ? result.reason.message : '',
      }
    }),
  }
}

async function fetchGoogleNews(queryText) {
  const query = encodeURIComponent(`${queryText} when:1d`)
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`
  const xml = await fetchText(url)
  const parsed = xmlParser.parse(xml)
  const items = parsed.rss?.channel?.item || []
  return items.map((item) => ({
    source: 'Google News',
    kind: 'news',
    title: stripHtml(item.title),
    summary: stripHtml(item.description),
    url: item.link,
    publishedAt: new Date(item.pubDate || Date.now()).toISOString(),
    origin: item.source?.['#text'] || item.source || hostFromUrl(item.link),
  }))
}

async function fetchHackerNewsForQuery(query) {
  const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)
  const params = new URLSearchParams({
    query,
    tags: 'story',
    numericFilters: `created_at_i>${since}`,
    hitsPerPage: '30',
  })
  const payload = await fetchJson(`https://hn.algolia.com/api/v1/search_by_date?${params}`)
  return (payload.hits || []).map((hit) => ({
    source: 'Hacker News',
    kind: 'social-signal',
    title: stripHtml(hit.title || hit.story_title),
    summary: '',
    url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    publishedAt: new Date(hit.created_at).toISOString(),
    points: hit.points || 0,
    comments: hit.num_comments || 0,
    origin: hostFromUrl(hit.url) || 'news.ycombinator.com',
  }))
}

async function fetchRedditForTopic(topic) {
  const subreddits =
    topic === 'ai'
      ? 'artificial+MachineLearning+OpenAI+singularity'
      : 'networking+networksecurity+sysadmin'
  const payload = await fetchJson(`https://www.reddit.com/r/${subreddits}/top.json?t=day&limit=30`, {
    headers: { 'User-Agent': 'StockTrackerNetworkEngineer/1.0 by local-user' },
  })
  return (payload.data?.children || []).map(({ data }) => ({
    source: 'Reddit',
    kind: data.is_self ? 'discussion' : 'social-signal',
    title: stripHtml(data.title),
    summary: stripHtml(data.selftext || ''),
    url: `https://reddit.com${data.permalink}`,
    publishedAt: new Date(data.created_utc * 1000).toISOString(),
    points: data.score || 0,
    comments: data.num_comments || 0,
    origin: `r/${data.subreddit}`,
  }))
}

async function fetchTwitterForQuery(query) {
  const bearerToken = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN
  if (!bearerToken) {
    return []
  }

  const params = new URLSearchParams({
    query: `${query} lang:en -is:retweet`,
    'tweet.fields': 'created_at,public_metrics',
    max_results: '20',
  })
  const payload = await fetchJson(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  })
  return (payload.data || []).map((tweet) => ({
    source: 'X/Twitter',
    kind: 'social-signal',
    title: stripHtml(tweet.text).slice(0, 180),
    summary: '',
    url: `https://x.com/i/web/status/${tweet.id}`,
    publishedAt: new Date(tweet.created_at).toISOString(),
    points: tweet.public_metrics?.like_count || 0,
    comments: tweet.public_metrics?.reply_count || 0,
    origin: 'x.com',
  }))
}

function dedupeArticles(articles) {
  const seen = new Set()
  return articles.filter((article) => {
    if (!article.title || !article.url) return false
    const fingerprint = article.title
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .split(' ')
      .filter((word) => word.length > 3)
      .slice(0, 8)
      .join(' ')
    if (seen.has(fingerprint)) return false
    seen.add(fingerprint)
    return true
  })
}

async function buildNewsPayload(topic) {
  const isAi = topic === 'ai'
  const cacheKey = isAi ? 'news:ai' : 'news:networking'
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const googleQuery = isAi
    ? '("artificial intelligence" OR AI OR OpenAI OR Anthropic OR "Google DeepMind" OR Nvidia OR LLM OR "machine learning")'
    : '(networking OR cisco OR juniper OR arista OR bgp OR evpn OR vxlan OR sd-wan OR sase OR "network outage")'
  const socialQuery = isAi
    ? 'AI OR OpenAI OR Anthropic OR "Google DeepMind" OR Nvidia OR LLM'
    : 'networking OR bgp OR cisco OR juniper OR cloudflare OR outage'
  const directFeeds = isAi ? aiNewsFeeds : directNewsFeeds
  const keywords = isAi ? aiKeywords : networkKeywords

  const sourceResults = await Promise.allSettled([
    fetchGoogleNews(googleQuery),
    fetchDirectNewsFeeds(directFeeds),
    fetchHackerNewsForQuery(socialQuery),
    fetchRedditForTopic(topic),
    fetchTwitterForQuery(socialQuery),
  ])
  const sourceNames = ['Google News', 'Direct feeds', 'Hacker News', 'Reddit', 'X/Twitter']
  const statuses = sourceResults.flatMap((result, index) => {
    if (sourceNames[index] === 'Direct feeds' && result.status === 'fulfilled') {
      return result.value.statuses
    }
    return {
      source: sourceNames[index],
      ok: result.status === 'fulfilled',
      count: result.status === 'fulfilled' ? result.value.length : 0,
      note:
        sourceNames[index] === 'X/Twitter' && !(process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN)
          ? 'Set X_BEARER_TOKEN or TWITTER_BEARER_TOKEN to include recent X posts.'
          : result.status === 'rejected'
            ? result.reason.message
            : '',
    }
  })
  const articles = sourceResults
    .flatMap((result, index) => {
      if (result.status !== 'fulfilled') return []
      return sourceNames[index] === 'Direct feeds' ? result.value.articles : result.value
    })
    .map((article) => ({ ...article, rank: rankArticle(article, keywords) }))

  const primaryArticles = articles.filter((article) => articleAgeHours(article) <= 24.5).filter((article) => keywordScore(article, keywords) >= 4)
  const broadenedArticles =
    primaryArticles.length >= 8
      ? primaryArticles
      : articles.filter((article) => articleAgeHours(article) <= 72).filter((article) => keywordScore(article, keywords) >= 2)
  const finalArticles = dedupeArticles(broadenedArticles).sort((a, b) => b.rank - a.rank).slice(0, 10)
  const windowLabel =
    primaryArticles.length >= 8
      ? 'Showing the strongest headlines from the last 24 hours.'
      : 'Showing the strongest headlines from the last 72 hours because the last 24 hours were thin.'

  return cacheSet(
    cacheKey,
    {
      generatedAt: new Date().toISOString(),
      topic,
      statuses,
      windowLabel,
      rankingMethod:
        'rank = recency + primary-source weight + topic relevance + news-event boost + capped engagement; social and discussion items are discounted harder than direct reporting',
      articles: finalArticles,
    },
    NEWS_CACHE_MS,
  )
}

app.get('/api/news', async (request, response) => {
  const topic = request.query.topic === 'ai' ? 'ai' : 'networking'
  response.json(await buildNewsPayload(topic))
})

app.get('/api/ai-news', async (_request, response) => {
  response.json(await buildNewsPayload('ai'))
})

app.get('/api/networking-news', async (_request, response) => {
  response.json(await buildNewsPayload('networking'))
})

async function fetchGithubProjects(topic) {
  const cacheKey = `github:${topic}:${todayKey()}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached
  const stale = cachePeek(cacheKey)

  const isAi = topic === 'ai'
  const createdSince = isoDateDaysAgo(30)
  const pushedSince = isoDateDaysAgo(14)
  const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_PAT
  const searchPlans = isAi
    ? [
        { query: `llm created:>=${createdSince} stars:>=5 archived:false`, sort: 'updated' },
        { query: `ai agent pushed:>=${pushedSince} stars:>=20 archived:false`, sort: 'updated' },
        { query: `rag created:>=${createdSince} stars:>=3 archived:false`, sort: 'updated' },
      ]
    : [
        { query: `"network deployment" pushed:>=${pushedSince} stars:>=2 archived:false`, sort: 'updated' },
        { query: `telemetry gnmi pushed:>=${pushedSince} stars:>=2 archived:false`, sort: 'updated' },
        { query: `peeringdb pushed:>=${createdSince} stars:>=1 archived:false`, sort: 'updated' },
        { query: `"network operations" pushed:>=${pushedSince} stars:>=2 archived:false`, sort: 'updated' },
        { query: `netbox automation pushed:>=${pushedSince} stars:>=5 archived:false`, sort: 'updated' },
        { query: `bgp route policy pushed:>=${pushedSince} stars:>=3 archived:false`, sort: 'updated' },
      ]
  const githubHeaders = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
  }
  const activePlans = githubToken ? searchPlans : searchPlans.slice(0, 2)

  const payloads = await Promise.allSettled(
    activePlans.map(({ query, sort }) =>
      fetchJson(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=desc&per_page=12`,
        { headers: githubHeaders },
      ),
    ),
  )
  const fulfilledPayloads = payloads.filter((payload) => payload.status === 'fulfilled').map((payload) => payload.value)
  const rejectedPayloads = payloads.filter((payload) => payload.status === 'rejected')

  if (!fulfilledPayloads.length) {
    if (stale) {
      return {
        ...stale,
        warning: 'GitHub search is rate-limited right now. Showing the last cached results.',
      }
    }

    return {
      topic,
      generatedAt: new Date().toISOString(),
      windowLabel: isAi
        ? 'GitHub search is cooling down. Add GITHUB_TOKEN for higher request limits.'
        : 'GitHub search is cooling down. Add GITHUB_TOKEN for higher request limits on repo discovery.',
      warning: rejectedPayloads[0]?.reason?.message || 'GitHub API rate-limited or unavailable.',
      projects: [],
    }
  }

  const dedupedRepos = Array.from(
    fulfilledPayloads
      .flatMap((payload) => payload.items || [])
      .reduce((lookup, repo) => {
        const key = repo.full_name.toLowerCase()
        const existing = lookup.get(key)
        if (!existing || githubRepoScore(repo) > githubRepoScore(existing)) {
          lookup.set(key, repo)
        }
        return lookup
      }, new Map())
      .values(),
  )

  return cacheSet(
    cacheKey,
    {
      topic,
      generatedAt: new Date().toISOString(),
      windowLabel: isAi
        ? 'Fresh repos created or pushed in the last 2-4 weeks.'
        : 'Fresh deployment, telemetry, PeeringDB, NOC, and routing repos from the last few weeks.',
      warning:
        !githubToken && rejectedPayloads.length
          ? 'Public GitHub search is rate-limited more aggressively than authenticated requests.'
          : !githubToken
            ? ''
            : '',
      projects: dedupedRepos
        .sort((a, b) => githubRepoScore(b) - githubRepoScore(a))
        .slice(0, 8)
        .map((repo) => ({
        name: repo.full_name,
        description: repo.description || 'No description provided.',
        url: repo.html_url,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        language: repo.language || 'Mixed',
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
        pushedAt: repo.pushed_at,
        freshness: githubFreshness(repo),
      })),
    },
    GITHUB_CACHE_MS,
  )
}

app.get('/api/github-projects', async (request, response) => {
  try {
    const topic = request.query.topic === 'ai' ? 'ai' : 'networking'
    response.json(await fetchGithubProjects(topic))
  } catch (error) {
    response.status(502).json({ error: error.message })
  }
})

app.get('/api/project-ideas', (_request, response) => {
  const cacheKey = `ideas:${todayKey()}`
  const cached = cacheGet(cacheKey)
  if (cached) return response.json(cached)

  const daySeed = Number(todayKey().replaceAll('-', ''))
  const ideas = networkingProjectIdeas
    .map((idea, index) => ({ ...idea, order: (daySeed + index * 17) % 97 }))
    .sort((a, b) => a.order - b.order)
    .slice(0, 4)
    .map((idea) => ({
      title: idea.title,
      difficulty: idea.difficulty,
      stack: idea.stack,
      summary: idea.summary,
    }))

  response.json(
    cacheSet(
      cacheKey,
      {
        generatedAt: new Date().toISOString(),
        ideas,
      },
      IDEAS_CACHE_MS,
    ),
  )
})

app.listen(port, () => {
  console.log(`Stock tracker API listening on http://localhost:${port}`)
})
