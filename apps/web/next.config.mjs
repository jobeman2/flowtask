/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@flowtask/ui', '@flowtask/types', '@flowtask/validation', '@flowtask/config'],
};

export default nextConfig;
