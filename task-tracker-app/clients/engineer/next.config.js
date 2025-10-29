/** @type {import('next').NextConfig} */
const nextConfig = {
  // Set basePath for /engineer routing
  basePath: '/engineer',
  
  // Enable standalone output for Docker
  output: 'standalone',
  
  // API proxy to backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://tasktracker-app-dev:5000/api/:path*',
      },
    ];
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
  },
  
  // Disable strict mode for development
  reactStrictMode: true,
}

module.exports = nextConfig
