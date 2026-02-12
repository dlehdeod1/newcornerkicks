/** @type {import('next').NextConfig} */
const nextConfig = {
  // API 서버 주소 (Cloudflare Workers)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL
          ? `${process.env.NEXT_PUBLIC_API_URL}/:path*`
          : 'http://localhost:8787/:path*',
      },
    ]
  },
}

export default nextConfig
