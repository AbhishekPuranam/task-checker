/** @type {import('next').NextConfig} */
const nextConfig = {
  // Set basePath for /admin routing
  basePath: '/admin',
  
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Optimize build performance
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
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
