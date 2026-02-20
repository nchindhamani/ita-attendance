/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  async rewrites() {
    // In development, proxy API requests to Python FastAPI server (port 8000)
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:8000/api/:path*',
        },
      ];
    }
    // In production, Vercel handles routing via vercel.json
    // /api/* routes to /python-api/index.py
    return [];
  },
};

export default nextConfig;
