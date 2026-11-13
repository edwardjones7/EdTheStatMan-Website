// Kickoff weather for outdoor football.
//
// Wind is what moves a total, and ESPN's scoreboard only carries temperature
// and a condition word. The National Weather Service hourly forecast has wind
// and gusts, is free and public domain (fine for a commercial site, unlike
// Open-Meteo's free tier), and needs coordinates, hence the stadium table.
//
// NFL only for wind: 30-odd stadiums is a table we can keep right; college
// football's 130+ venues get ESPN's temperature and condition instead. A game
// is only matched to a stadium when ESPN's venue city agrees, so neutral-site
// and international games never borrow the home team's weather.

const UA = { 'User-Agent': 'EdTheStatMan.com weather (https://edthestatman.com)', Accept: 'application/geo+json' }

/** Open-air and retractable NFL home stadiums. Domes need no weather. */
const NFL_STADIUMS: Record<string, { city: string; lat: number; lon: number }> = {
  BUF: { city: 'Orchard Park', lat: 42.7738, lon: -78.787 },
  MIA: { city: 'Miami Gardens', lat: 25.958, lon: -80.2389 },
  NE: { city: 'Foxborough', lat: 42.0909, lon: -71.2643 },
  NYG: { city: 'East Rutherford', lat: 40.8135, lon: -74.0745 },
  NYJ: { city: 'East Rutherford', lat: 40.8135, lon: -74.0745 },
  BAL: { city: 'Baltimore', lat: 39.278, lon: -76.6227 },
  CIN: { city: 'Cincinnati', lat: 39.0955, lon: -84.5161 },
  CLE: { city: 'Cleveland', lat: 41.5061, lon: -81.6995 },
  PIT: { city: 'Pittsburgh', lat: 40.4468, lon: -80.0158 },
  JAX: { city: 'Jacksonville', lat: 30.3239, lon: -81.6373 },
  TEN: { city: 'Nashville', lat: 36.1665, lon: -86.7713 },
  DEN: { city: 'Denver', lat: 39.7439, lon: -105.0201 },
  KC: { city: 'Kansas City', lat: 39.0489, lon: -94.4839 },
  PHI: { city: 'Philadelphia', lat: 39.9008, lon: -75.1675 },
  WSH: { city: 'Landover', lat: 38.9078, lon: -76.8645 },
  CHI: { city: 'Chicago', lat: 41.8623, lon: -87.6167 },
  GB: { city: 'Green Bay', lat: 44.5013, lon: -88.0622 },
  CAR: { city: 'Charlotte', lat: 35.2258, lon: -80.8528 },
  TB: { city: 'Tampa', lat: 27.9759, lon: -82.5033 },
  SF: { city: 'Santa Clara', lat: 37.403, lon: -121.97 },
  SEA: { city: 'Seattle', lat: 47.5952, lon: -122.3316 },
}

export interface Weather {
  tempF: number | null
  windMph: number | null
  /** Short description ("Light Rain", "Sunny"). */
  sky: string | null
  precipPct: number | null
  source: 'nws' | 'espn'
}

function mph(s: unknown): number | null {
  const nums = String(s ?? '').match(/\d+/g)
  return nums ? Math.max(...nums.map(Number)) : null
}

async function hourlyUrl(lat: number, lon: number): Promise<string | null> {
  const res = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
    headers: UA,
    next: { revalidate: 60 * 60 * 24 * 7 },
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) return null
  return (await res.json())?.properties?.forecastHourly ?? null
}

/** NWS forecast for the hour of kickoff, or null outside the ~6-day window. */
async function nwsAt(lat: number, lon: number, kickoff: string): Promise<Weather | null> {
  const url = await hourlyUrl(lat, lon)
  if (!url) return null
  const res = await fetch(url, { headers: UA, next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) })
  if (!res.ok) return null
  const t = Date.parse(kickoff)
  const p = ((await res.json())?.properties?.periods ?? []).find(
    (x: any) => Date.parse(x.startTime) <= t && t < Date.parse(x.endTime)
  )
  if (!p) return null
  return {
    tempF: typeof p.temperature === 'number' ? p.temperature : null,
    windMph: mph(p.windSpeed),
    sky: p.shortForecast ?? null,
    precipPct: p.probabilityOfPrecipitation?.value ?? null,
    source: 'nws',
  }
}

/**
 * Weather for one game. `espn` is the scoreboard's own weather block (temp and
 * condition), used when NWS has nothing. Never throws.
 */
export async function gameWeather(opts: {
  sport: string
  homeAbbrev: string
  venueCity: string | null
  indoor: boolean
  kickoff: string | null
  espn?: { temperature?: number; displayValue?: string } | null
}): Promise<Weather | null> {
  if (opts.indoor || !opts.kickoff) return null
  try {
    const s = opts.sport === 'nfl' ? NFL_STADIUMS[opts.homeAbbrev] : undefined
    if (s && opts.venueCity && s.city.toLowerCase() === opts.venueCity.toLowerCase()) {
      const w = await nwsAt(s.lat, s.lon, opts.kickoff)
      if (w) return w
    }
  } catch {
    // fall through to ESPN
  }
  if (opts.espn && (opts.espn.temperature != null || opts.espn.displayValue)) {
    return {
      tempF: opts.espn.temperature ?? null,
      windMph: null,
      sky: opts.espn.displayValue ?? null,
      precipPct: null,
      source: 'espn',
    }
  }
  return null
}

/** Worth calling out: wind that affects kicking and passing, or likely rain/snow. */
export function weatherMatters(w: Weather | null): boolean {
  if (!w) return false
  const wet = /snow|rain|storm|thunder|shower/i.test(w.sky ?? '') && !/slight chance/i.test(w.sky ?? '')
  // NWS gives a probability; ESPN only a word, so trust the word there.
  return (w.windMph ?? 0) >= 15 || (w.tempF ?? 60) <= 25 ||
    (w.precipPct != null ? w.precipPct >= 50 : wet)
}

export function weatherText(w: Weather): string {
  return [
    w.tempF != null ? `${w.tempF}°F` : null,
    w.windMph != null ? `wind ${w.windMph} mph` : null,
    w.sky,
    w.precipPct != null && w.precipPct >= 30 ? `${w.precipPct}% precip` : null,
  ].filter(Boolean).join(' · ')
}
