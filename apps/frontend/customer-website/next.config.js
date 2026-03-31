/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@repo/shared-frontend', '@repo/shared-common'],
}

module.exports = nextConfig
