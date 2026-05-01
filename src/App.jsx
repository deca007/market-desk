import {
  Activity,
  AlertCircle,
  BarChart3,
  Bot,
  ChevronDown,
  GitFork,
  Lightbulb,
  Newspaper,
  Plus,
  Router,
  Search,
  Star,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const defaultTickers = ['CSCO', 'ANET', 'JNPR', 'MSFT']
const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:8787'
const refreshSeconds = 60
const entryFlashBufferPct = 4
const trackedEntryStorageKey = 'stock-tracker-entry-prices'
const headerTimezones = [
  { label: 'PT', timeZone: 'America/Los_Angeles' },
  { label: 'ET', timeZone: 'America/New_York' },
  { label: 'UTC', timeZone: 'UTC' },
  { label: 'IST', timeZone: 'Asia/Kolkata' },
]

const metricExplanations = {
  expected30Day: 'Model estimate 30 trading days out, reduced by a volatility uncertainty buffer.',
  expected90Day: 'Model estimate 90 trading days out, reduced by a larger uncertainty buffer.',
  edge90: 'Potential upside or downside from the current price to the 90-day forecast.',
  safetyGap: 'How far the current price sits above the model entry target. Bigger means more patience.',
  sma50: 'Average closing price across roughly the last 50 trading days. Useful for near-term trend.',
  sma200: 'Average closing price across roughly the last 200 trading days. Useful for long-term trend.',
  week52Low: 'Lowest traded price found in the available one-year history.',
  week52High: 'Highest traded price found in the available one-year history.',
  drawdown: 'Percent below the 52-week high. Near zero means the stock is close to recent highs.',
  volume: 'Most recent daily share volume from the quote source.',
  trend: 'Annualized trend estimate blended from regression slope and 20/60/120-day momentum.',
}

function money(value) {
  if (!Number.isFinite(value)) return 'N/A'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

function compact(value) {
  if (!Number.isFinite(value)) return 'N/A'
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function pct(value) {
  if (!Number.isFinite(value)) return 'N/A'
  return `${value.toFixed(1)}%`
}

function dateTime(value) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function shortDate(value) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function clockTime(timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(new Date())
}

function cleanText(value) {
  return (value || '').replaceAll('&nbsp;', ' ').replace(/\s+/g, ' ').trim()
}

function compactHeadline(title) {
  const clean = cleanText(title)
  if (!clean) return 'Untitled item'

  for (const separator of [' - ', ' | ', ' — ']) {
    const parts = clean.split(separator)
    if (parts.length > 1 && parts.at(-1).length <= 40) {
      return parts.slice(0, -1).join(separator)
    }
  }

  return clean
}

function compactSummary(value, maxLength = 150) {
  const clean = cleanText(value)
  if (!clean) return ''
  if (clean.length <= maxLength) return clean
  return `${clean.slice(0, maxLength).trimEnd()}...`
}

function relativeAge(value) {
  if (!value) return 'Unknown'
  const ageHours = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 3_600_000))
  if (ageHours < 24) return `${ageHours}h ago`
  return `${Math.round(ageHours / 24)}d ago`
}

function trackedEntryAlert(currentPrice, trackedEntry) {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(trackedEntry)) {
    return {
      state: 'idle',
      label: 'Tracking entry',
      detail: 'Waiting for an entry signal',
    }
  }

  const distancePct = ((currentPrice - trackedEntry) / trackedEntry) * 100

  if (distancePct <= 0) {
    return {
      state: 'hit',
      label: 'At entry',
      detail: `${Math.abs(distancePct).toFixed(1)}% through entry`,
    }
  }

  if (distancePct <= entryFlashBufferPct) {
    return {
      state: 'near',
      label: 'Near entry',
      detail: `${distancePct.toFixed(1)}% above entry`,
    }
  }

  return {
    state: 'idle',
    label: 'Tracking entry',
    detail: `${distancePct.toFixed(1)}% above entry`,
  }
}

function secondsUntilNextRefresh(lastRefresh) {
  if (!lastRefresh) return refreshSeconds
  const elapsed = Math.floor((Date.now() - lastRefresh.getTime()) / 1000)
  return Math.max(0, refreshSeconds - elapsed)
}

function RefreshPill({ lastRefresh, countdown }) {
  const progress = ((refreshSeconds - countdown) / refreshSeconds) * 100

  return (
    <div className="refresh-cluster">
      <div className="refresh-status" style={{ '--refresh-progress': `${progress}%` }}>
        <Activity size={15} />
        <div>
          <strong>Auto refresh</strong>
          <span>{countdown}s</span>
        </div>
        <small>{lastRefresh ? dateTime(lastRefresh) : 'Waiting'}</small>
      </div>
    </div>
  )
}

function StockMetric({ label, value, explanation, tone }) {
  return (
    <div className={tone || ''}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      <p>{explanation}</p>
    </div>
  )
}

function StockCard({ stock, onRemove, trackedEntry }) {
  const research = stock.research
  const currentPrice = Number.isFinite(stock.price) ? stock.price : research?.current
  const trackedEntryPrice = Number.isFinite(trackedEntry?.price) ? trackedEntry.price : research?.idealEntry
  const entrySignal = trackedEntryAlert(currentPrice, trackedEntryPrice)
  const alertClass =
    entrySignal.state === 'hit' ? 'alert-entry-hit' : entrySignal.state === 'near' ? 'alert-near-entry' : ''
  const upsideToForecast =
    Number.isFinite(research?.forecast?.expected90Day) && Number.isFinite(research?.current)
      ? ((research.forecast.expected90Day - research.current) / research.current) * 100
      : null
  const zoneLabel =
    Number.isFinite(research?.accumulationLow) && Number.isFinite(research?.accumulationHigh)
      ? `${money(research.accumulationLow)} - ${money(research.accumulationHigh)} zone`
      : 'Entry zone unavailable'
  const trackingNote = trackedEntry?.updatedAt ? `Tracked ${shortDate(trackedEntry.updatedAt)}` : 'Tracking live'
  const forecastDetail = Number.isFinite(upsideToForecast) ? `${upsideToForecast >= 0 ? '+' : ''}${pct(upsideToForecast)} expected` : 'Forecast loading'
  const priceDetail = Number.isFinite(research?.metrics?.drawdownPct) ? `${pct(research.metrics.drawdownPct)} off 52W high` : 'Trend context loading'
  const entryDetail = entrySignal.state === 'idle' ? trackingNote : `${entrySignal.detail} · ${trackingNote}`

  return (
    <article className={`stock-card ${alertClass}`}>
      <div className="stock-topline">
        <div>
          <div className="symbol-row">
            <h3>{stock.symbol}</h3>
            <span className={`quality ${research.dataQuality}`}>{research.dataQuality}</span>
            {entrySignal.state !== 'idle' ? <span className={`entry-pill ${entrySignal.state}`}>{entrySignal.label}</span> : null}
          </div>
          <p>{stock.name}</p>
        </div>
        <button className="icon-button subtle" type="button" onClick={() => onRemove(stock.symbol)} aria-label={`Remove ${stock.symbol}`}>
          <X size={18} />
        </button>
      </div>

      <div className="stock-hero-strip" role="group" aria-label={`${stock.symbol} snapshot`}>
        <div className="stock-hero">
          <span>Price</span>
          <strong>{money(currentPrice)}</strong>
          <small>{priceDetail}</small>
        </div>
        <div className={`stock-hero entry ${entrySignal.state}`}>
          <span>Best entry</span>
          <strong>{money(trackedEntryPrice)}</strong>
          <small>{entryDetail}</small>
        </div>
        <div className="stock-hero target">
          <span>90D target</span>
          <strong>{money(research.forecast.expected90Day)}</strong>
          <small>{forecastDetail}</small>
        </div>
      </div>

      <details className="stock-drawer">
        <summary>
          <div className="stock-drawer-copy">
            <strong>{research.verdict}</strong>
            <small>{entrySignal.state === 'idle' ? zoneLabel : `${entrySignal.detail} · ${trackingNote}`}</small>
          </div>
          <span className={`stock-drawer-score ${entrySignal.state}`}>{research.score}</span>
          <ChevronDown size={18} />
        </summary>

        <div className="stock-drawer-body">
          <div className="score-row">
            <div className="score-ring" data-score={research.score} style={{ '--score': `${research.score}%` }}>
              {research.score}
            </div>
            <div>
              <strong>{research.verdict}</strong>
              <p>{compactSummary(research.rationale.join(' · '), 120)}</p>
            </div>
          </div>

          <div className="range">
            <span>{money(research.accumulationLow)}</span>
            <div />
            <span>{money(research.accumulationHigh)}</span>
          </div>

          <p className="rationale-copy">{research.rationale.join(' · ')}</p>

          <details className="metric-drawer">
            <summary>
              <span>Model detail</span>
              <strong>{money(research.forecast.expected90Day)} 90D</strong>
              <ChevronDown size={18} />
            </summary>
            <dl className="metrics">
              <StockMetric label="30D forecast" value={money(research.forecast.expected30Day)} explanation={metricExplanations.expected30Day} />
              <StockMetric label="90D forecast" value={money(research.forecast.expected90Day)} explanation={metricExplanations.expected90Day} />
              <StockMetric
                label="90D edge"
                value={pct(upsideToForecast)}
                explanation={metricExplanations.edge90}
                tone={Number.isFinite(upsideToForecast) && upsideToForecast > 0 ? 'positive' : 'negative'}
              />
              <StockMetric label="Safety gap" value={pct(research.marginOfSafetyPct)} explanation={metricExplanations.safetyGap} />
              <StockMetric label="50D avg" value={money(research.metrics.sma50)} explanation={metricExplanations.sma50} />
              <StockMetric label="200D avg" value={money(research.metrics.sma200)} explanation={metricExplanations.sma200} />
              <StockMetric label="52W low" value={money(research.metrics.week52Low)} explanation={metricExplanations.week52Low} />
              <StockMetric label="52W high" value={money(research.metrics.week52High)} explanation={metricExplanations.week52High} />
              <StockMetric label="Drawdown" value={pct(research.metrics.drawdownPct)} explanation={metricExplanations.drawdown} />
              <StockMetric label="Volume" value={compact(stock.volume)} explanation={metricExplanations.volume} />
              <StockMetric label="Trend" value={pct(research.forecast.trendAnnualPct)} explanation={metricExplanations.trend} />
            </dl>
          </details>
        </div>
      </details>
    </article>
  )
}

function FearGreedPanel({ sentiment }) {
  const score = Number.isFinite(sentiment?.score) ? sentiment.score : 50
  const label = sentiment?.rating || 'neutral'
  const scoreClass = score >= 75 ? 'extreme-greed' : score >= 55 ? 'greed' : score <= 25 ? 'extreme-fear' : score <= 45 ? 'fear' : 'neutral'
  const indicators = sentiment?.indicators || []
  const summaryTone =
    score >= 75 ? 'Risk is running hot' : score >= 55 ? 'Buyers still have control' : score <= 25 ? 'Stress is elevated' : score <= 45 ? 'Tape is defensive' : 'Positioning is balanced'
  const leadIndicator = indicators[0] ? `${indicators[0].label}: ${indicators[0].score}` : 'Indicator blend unavailable'

  return (
    <article className={`stock-card sentiment-card ${scoreClass}`}>
      <div className="stock-topline sentiment-topline">
        <div>
          <div className="symbol-row">
            <h3>Fear & Greed</h3>
            <span className={`sentiment-badge ${scoreClass}`}>{label}</span>
          </div>
          <p>{sentiment?.source || 'Market sentiment snapshot'}</p>
        </div>
        <div className="sentiment-score-orb">{score.toFixed(0)}</div>
      </div>

      <div className="sentiment-strip">
        <div className="sentiment-stat emphasis">
          <span>Score</span>
          <strong>{score.toFixed(1)}</strong>
          <small>{summaryTone}</small>
        </div>
        <div className="sentiment-stat">
          <span>Prev close</span>
          <strong>{sentiment?.previousClose ?? 'N/A'}</strong>
          <small>Yesterday</small>
        </div>
        <div className="sentiment-stat">
          <span>1 month</span>
          <strong>{sentiment?.previousMonth ?? 'N/A'}</strong>
          <small>30D context</small>
        </div>
      </div>

      <details className="stock-drawer sentiment-drawer">
        <summary>
          <div className="stock-drawer-copy">
            <strong>{label}</strong>
            <small>{leadIndicator}</small>
          </div>
          <span className="stock-drawer-score">{indicators.length} signals</span>
          <ChevronDown size={18} />
        </summary>

        <div className="stock-drawer-body">
          <div className="sentiment-comparison">
            <div>
              <span>1 year</span>
              <strong>{sentiment?.previousYear ?? 'N/A'}</strong>
            </div>
            <div>
              <span>Source</span>
              <strong>{sentiment?.source || 'N/A'}</strong>
            </div>
            <div>
              <span>Mode</span>
              <strong>{summaryTone}</strong>
            </div>
          </div>

          <div className="indicator-strip">
            {indicators.slice(0, 4).map((indicator) => (
              <div key={indicator.key}>
                <span>{indicator.label}</span>
                <strong>{indicator.score}</strong>
              </div>
            ))}
          </div>
          {sentiment?.note ? <p className="source-note">{compactSummary(sentiment.note, 140)}</p> : null}
        </div>
      </details>
    </article>
  )
}

function NewsPanel({ title, description, icon, payload, loading }) {
  const articles = payload.articles || []

  return (
    <section className="news-section">
      <div className="section-heading compact-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {loading ? <span className="loading"><Activity size={16} />Scanning</span> : icon}
      </div>

      <details className="source-drawer">
        <summary>
          <span>Sources</span>
          <ChevronDown size={18} />
        </summary>
        <div className="source-status">
          {(payload.statuses || []).map((status) => (
            <span key={status.source} className={status.ok && status.count ? 'ok' : 'warn'} title={status.note}>
              {status.source}: {status.count}
            </span>
          ))}
        </div>
        <div className="ranking-note">
          <BarChart3 size={17} />
          {payload.rankingMethod || 'Ranking method loads with news.'}
        </div>
      </details>

      <div className="news-list">
        {articles.map((article, index) => (
          <NewsItem key={`${article.url}-${index}`} article={article} index={index} />
        ))}
      </div>

      {!loading && !articles.length ? <p className="empty-feed">No fresh headlines right now.</p> : null}
    </section>
  )
}

function GithubProjects({ title, payload, loading }) {
  const projects = payload.projects || []

  return (
    <section className="github-panel">
      <div className="section-heading compact-heading">
        <div>
          <h2>{title}</h2>
          <p>{payload.windowLabel || 'Fresh repos created or updated recently.'}</p>
        </div>
        {loading ? <span className="loading"><Activity size={16} />Loading</span> : <GitFork size={21} />}
      </div>

      <div className="github-list">
        {projects.slice(0, 6).map((project, index) => (
          <a className="github-item" key={project.url} href={project.url} target="_blank" rel="noreferrer">
            <div className="github-rank">{index + 1}</div>
            <div className="github-copy">
              <div className="github-meta">
                <span>{project.language}</span>
                <span>{project.freshness || relativeAge(project.updatedAt)}</span>
              </div>
              <strong>{project.name}</strong>
              <p>{compactSummary(project.description, 140)}</p>
            </div>
            <div className="github-stats">
              <span><Star size={14} />{compact(project.stars)}</span>
              <span><GitFork size={14} />{compact(project.forks)}</span>
            </div>
          </a>
        ))}
      </div>

      {payload.warning ? <p className="panel-note">{payload.warning}</p> : null}
      {!loading && !projects.length ? <p className="empty-feed">No fresh repositories right now.</p> : null}
    </section>
  )
}

function ProjectIdeas({ payload, loading }) {
  return (
    <section className="ideas-panel">
      <div className="section-heading compact-heading">
        <div>
          <h2>Daily project ideas</h2>
          <p>Networking builds worth prototyping</p>
        </div>
        {loading ? <span className="loading"><Activity size={16} />Thinking</span> : <Lightbulb size={21} />}
      </div>
      <div className="idea-list">
        {(payload.ideas || []).slice(0, 4).map((idea) => (
          <details className="idea-item" key={idea.title}>
            <summary>
              <div className="idea-summary-copy">
                <strong>{idea.title}</strong>
                <p>{idea.summary}</p>
              </div>
              <span>{idea.difficulty}</span>
              <ChevronDown size={18} />
            </summary>
            <div className="idea-body">
              <p>{idea.summary}</p>
              <div className="idea-stack">
                <span>Suggested stack</span>
                <strong>{idea.stack || 'Flexible'}</strong>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}

function NewsItem({ article, index }) {
  const title = compactHeadline(article.title)
  const summary = compactSummary(article.summary, 150)

  return (
    <a className="news-item" href={article.url} target="_blank" rel="noreferrer" title={title}>
      <div className="rank">{index + 1}</div>
      <div className="news-copy">
        <div className="news-meta">
          <span>{article.source}</span>
          <span>{article.origin}</span>
          <span>{shortDate(article.publishedAt)}</span>
        </div>
        <h3>{title}</h3>
        {summary ? <p>{summary}</p> : null}
      </div>
      <div className="news-item-tail">
        <div className="rank-score">{Math.round(article.rank)}</div>
        <small>Open</small>
      </div>
    </a>
  )
}

function App() {
  const [tickers, setTickers] = useState(() => {
    const saved = localStorage.getItem('stock-tracker-tickers')
    return saved ? JSON.parse(saved) : defaultTickers
  })
  const [entry, setEntry] = useState('')
  const [trackedEntries, setTrackedEntries] = useState(() => {
    const saved = localStorage.getItem(trackedEntryStorageKey)
    return saved ? JSON.parse(saved) : {}
  })
  const [stocks, setStocks] = useState([])
  const [stockWarning, setStockWarning] = useState('')
  const [news, setNews] = useState({ articles: [], statuses: [] })
  const [aiNews, setAiNews] = useState({ articles: [], statuses: [] })
  const [networkProjects, setNetworkProjects] = useState({ projects: [] })
  const [aiProjects, setAiProjects] = useState({ projects: [] })
  const [projectIdeas, setProjectIdeas] = useState({ ideas: [] })
  const [sentiment, setSentiment] = useState(null)
  const [loadingStocks, setLoadingStocks] = useState(true)
  const [loadingNews, setLoadingNews] = useState(true)
  const [loadingAiNews, setLoadingAiNews] = useState(true)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingIdeas, setLoadingIdeas] = useState(true)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState(null)
  const [countdown, setCountdown] = useState(refreshSeconds)

  const tickerQuery = useMemo(() => tickers.join(','), [tickers])
  const stockTileMinWidth = useMemo(() => {
    const tileCount = stocks.length + 1
    if (tileCount >= 10) return '158px'
    if (tileCount >= 8) return '170px'
    if (tileCount >= 6) return '182px'
    if (tileCount >= 4) return '196px'
    return '214px'
  }, [stocks.length])
  const headerClocks = useMemo(
    () => headerTimezones.map((zone) => ({ ...zone, value: clockTime(zone.timeZone) })),
    [countdown],
  )

  useEffect(() => {
    localStorage.setItem('stock-tracker-tickers', JSON.stringify(tickers))
  }, [tickers])

  useEffect(() => {
    localStorage.setItem(trackedEntryStorageKey, JSON.stringify(trackedEntries))
  }, [trackedEntries])

  useEffect(() => {
    setTrackedEntries((current) => {
      const next = { ...current }
      const activeTickers = new Set(tickers)
      let changed = false

      Object.keys(next).forEach((symbol) => {
        if (!activeTickers.has(symbol)) {
          delete next[symbol]
          changed = true
        }
      })

      stocks.forEach((stock) => {
        const idealEntry = stock.research?.idealEntry
        if (!Number.isFinite(idealEntry)) return

        const existing = current[stock.symbol]
        if (!existing || Math.abs(existing.price - idealEntry) >= 0.01) {
          next[stock.symbol] = {
            price: idealEntry,
            updatedAt: new Date().toISOString(),
          }
          changed = true
        }
      })

      return changed ? next : current
    })
  }, [stocks, tickers])

  const loadStocks = useCallback(async () => {
    setLoadingStocks(true)
    setError('')
    try {
      const response = await fetch(`${apiBase}/api/stocks?symbols=${encodeURIComponent(tickerQuery)}`)
      if (!response.ok) throw new Error(await response.text())
      const payload = await response.json()
      setStocks(payload.stocks || [])
      setStockWarning(payload.warning || '')
    } catch (loadError) {
      setStockWarning('')
      setError(`Stock data failed: ${loadError.message}`)
    } finally {
      setLoadingStocks(false)
    }
  }, [tickerQuery])

  const loadNews = useCallback(async () => {
    setLoadingNews(true)
    try {
      const response = await fetch(`${apiBase}/api/news`)
      if (!response.ok) throw new Error(await response.text())
      setNews(await response.json())
    } catch (loadError) {
      setError((current) => `${current ? `${current} ` : ''}News data failed: ${loadError.message}`)
    } finally {
      setLoadingNews(false)
    }
  }, [])

  const loadAiNews = useCallback(async () => {
    setLoadingAiNews(true)
    try {
      const response = await fetch(`${apiBase}/api/news?topic=ai`)
      if (!response.ok) throw new Error(await response.text())
      setAiNews(await response.json())
    } catch (loadError) {
      setError((current) => `${current ? `${current} ` : ''}AI news failed: ${loadError.message}`)
    } finally {
      setLoadingAiNews(false)
    }
  }, [])

  const loadSentiment = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/api/sentiment`)
      if (!response.ok) throw new Error(await response.text())
      setSentiment(await response.json())
    } catch (loadError) {
      setError((current) => `${current ? `${current} ` : ''}Sentiment failed: ${loadError.message}`)
    }
  }, [])

  const loadGithubProjects = useCallback(async () => {
    setLoadingProjects(true)
    try {
      const [networkResponse, aiResponse] = await Promise.all([
        fetch(`${apiBase}/api/github-projects?topic=networking`),
        fetch(`${apiBase}/api/github-projects?topic=ai`),
      ])
      const networkPayload = networkResponse.ok ? await networkResponse.json() : { projects: [], warning: await networkResponse.text() }
      const aiPayload = aiResponse.ok ? await aiResponse.json() : { projects: [], warning: await aiResponse.text() }
      setNetworkProjects(networkPayload)
      setAiProjects(aiPayload)
    } catch (loadError) {
      setNetworkProjects({ projects: [], warning: loadError.message })
      setAiProjects({ projects: [], warning: loadError.message })
    } finally {
      setLoadingProjects(false)
    }
  }, [])

  const loadProjectIdeas = useCallback(async () => {
    setLoadingIdeas(true)
    try {
      const response = await fetch(`${apiBase}/api/project-ideas`)
      if (!response.ok) throw new Error(await response.text())
      setProjectIdeas(await response.json())
    } catch (loadError) {
      setError((current) => `${current ? `${current} ` : ''}Project ideas failed: ${loadError.message}`)
    } finally {
      setLoadingIdeas(false)
    }
  }, [])

  useEffect(() => {
    if (tickerQuery) loadStocks()
  }, [tickerQuery, loadStocks])

  useEffect(() => {
    loadNews()
    loadAiNews()
    loadSentiment()
    loadGithubProjects()
    loadProjectIdeas()
  }, [loadNews, loadAiNews, loadSentiment, loadGithubProjects, loadProjectIdeas])

  useEffect(() => {
    const refreshAll = () => {
      loadStocks()
      loadNews()
      loadAiNews()
      loadSentiment()
      loadGithubProjects()
      loadProjectIdeas()
      const refreshedAt = new Date()
      setLastRefresh(refreshedAt)
      setCountdown(refreshSeconds)
    }
    const firstRefresh = new Date()
    setLastRefresh(firstRefresh)
    setCountdown(refreshSeconds)
    const interval = window.setInterval(refreshAll, 60_000)
    return () => window.clearInterval(interval)
  }, [loadStocks, loadNews, loadAiNews, loadSentiment, loadGithubProjects, loadProjectIdeas])

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setCountdown(secondsUntilNextRefresh(lastRefresh))
    }, 1000)
    return () => window.clearInterval(ticker)
  }, [lastRefresh])

  function addTicker(event) {
    event.preventDefault()
    const symbol = entry.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '')
    if (!symbol || tickers.includes(symbol)) return
    setTickers((current) => [...current, symbol].slice(0, 12))
    setEntry('')
  }

  function removeTicker(symbol) {
    setTickers((current) => current.filter((ticker) => ticker !== symbol))
    setTrackedEntries((current) => {
      if (!current[symbol]) return current
      const next = { ...current }
      delete next[symbol]
      return next
    })
  }

  return (
    <main className="shell">
      <header className="app-header">
        <div className="hero-copy-block">
          <div className="eyebrow">
            <Router size={18} />
            Market Desk
          </div>
          <div className="hero-title-row">
            <h1>Market Tracker</h1>
            <div className="header-clocks" aria-label="Timezone clocks">
              {headerClocks.map((clock) => (
                <div className="clock-pill" key={clock.label}>
                  <div>
                    <strong>{clock.label}</strong>
                    <span>{clock.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="header-actions">
          <RefreshPill lastRefresh={lastRefresh} countdown={countdown} />
        </div>
      </header>

      {error ? (
        <section className="alert">
          <AlertCircle size={20} />
          <span>{error}</span>
        </section>
      ) : null}

      <section className="dashboard-stack">
        <section className="watchlist-panel">
          <div className="section-heading">
            <div>
              <h2>Watchlist</h2>
              <p>Tickers, sentiment, and compact setups in one live grid.</p>
            </div>
            {loadingStocks ? <span className="loading"><Activity size={16} />Loading</span> : null}
          </div>

          <section className="toolbar watchlist-toolbar" aria-label="Ticker controls">
            <form className="ticker-form" onSubmit={addTicker}>
              <Search size={16} />
              <input value={entry} onChange={(event) => setEntry(event.target.value)} placeholder="Add ticker" />
              <button type="submit">
                <Plus size={16} />
                Add
              </button>
            </form>

            <details className="watchlist-drawer watchlist-drawer-inline" open>
              <summary>
                <span>Tracked tickers</span>
                <strong>{tickers.length}</strong>
                <ChevronDown size={16} />
              </summary>
              <div className="watchlist">
                {tickers.map((ticker) => (
                  <button key={ticker} type="button" onClick={() => removeTicker(ticker)}>
                    {ticker}
                    <X size={12} />
                  </button>
                ))}
              </div>
            </details>
          </section>

          {stockWarning ? <p className="panel-note">{stockWarning}</p> : null}

          <div className="stock-grid" style={{ '--stock-tile-min': stockTileMinWidth }}>
            <FearGreedPanel sentiment={sentiment} />
            {stocks.map((stock) => (
              <StockCard key={stock.symbol} stock={stock} onRemove={removeTicker} trackedEntry={trackedEntries[stock.symbol]} />
            ))}
          </div>
        </section>

        <section className="two-column-section">
          <NewsPanel
            title="Network News"
            description="Fast read of the last 24h."
            icon={<Newspaper size={21} />}
            payload={news}
            loading={loadingNews}
          />
          <NewsPanel
            title="AI News"
            description="Compact scan of the AI tape."
            icon={<Bot size={21} />}
            payload={aiNews}
            loading={loadingAiNews}
          />
        </section>

        <section className="two-column-section">
          <GithubProjects title="Networking GitHub" payload={networkProjects} loading={loadingProjects} />
          <GithubProjects title="AI GitHub" payload={aiProjects} loading={loadingProjects} />
        </section>

        <ProjectIdeas payload={projectIdeas} loading={loadingIdeas} />
      </section>
    </main>
  )
}

export default App
