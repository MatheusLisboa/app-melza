/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
    // Soft nav entre abas: reusa RSC payload no client (~30s)
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
