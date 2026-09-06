const { version } = require('./package.json')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The release this build came from, so the admin dashboard can say what is
  // actually deployed. `main` is production and Vercel builds every push, so
  // without this the only way to tell a tag from the commit after it is to
  // read the Vercel dashboard. Read at build time from the one place the
  // number lives; see docs/RELEASING.md.
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
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
