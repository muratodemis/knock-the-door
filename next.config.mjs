/** @type {import('next').NextConfig} */
const basePath = process.env.NODE_ENV === "production" ? "/knock" : "";

const nextConfig = {
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};
export default nextConfig;
