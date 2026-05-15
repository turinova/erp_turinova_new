import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "xgkaviefifbllbmfbyfe.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // If you later use other Supabase projects, add them here too.
      // You can also widen this to "*.supabase.co" once you're sure.
    ],
  },
};

export default nextConfig;
