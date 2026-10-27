/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  reactStrictMode: true,
  // The live Realtime study was retired; links shared while it ran land on
  // the homepage's introduction video instead of a missing page.
  async redirects() {
    return [
      { source: "/realtime", destination: "/", permanent: true },
      { source: "/realtime/:cameraId", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
