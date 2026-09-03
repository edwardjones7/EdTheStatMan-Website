/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  optimizeFonts: false,
  async redirects() {
    return [
      { source: '/pricing', destination: '/win', permanent: true },
      // v3 IA. These URLs have SEO equity (nfl_games.slug is frozen at insert
      // precisely for this reason), so every move is a 308, not a drop.
      { source: '/betting-systems', destination: '/vault/systems', permanent: true },
      { source: '/betting-trends', destination: '/vault/trends', permanent: true },
      { source: '/model-picks', destination: '/portfolio', permanent: true },
      { source: '/results', destination: '/portfolio/performance', permanent: true },
      { source: '/nfl', destination: '/desk/nfl', permanent: true },
      { source: '/nfl/games/:slug', destination: '/desk/nfl/g/:slug', permanent: true },
    ]
  },
}

module.exports = nextConfig
