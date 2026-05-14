/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // SPA fallback - qualquer rota desconhecida vai para index.html
      {
        source: "/verificacao",
        destination: "/index.html",
      },
      {
        source: "/verificacao/:path*",
        destination: "/index.html",
      },
    ]
  },
}

module.exports = nextConfig
