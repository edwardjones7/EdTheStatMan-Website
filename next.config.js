/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  optimizeFonts: false,
  async redirects() {
    return [
      {
        source: '/pricing',
        destination: '/win',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
