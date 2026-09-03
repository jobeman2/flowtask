/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@flowtask/ui', '@flowtask/types', '@flowtask/validation', '@flowtask/config'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_BASE_URL || 'https://flowtask.ethiodeploy.com'}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

