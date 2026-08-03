import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Partial Prerendering: every page route ships a static shell, with the
  // session chip (and anything else request-scoped) streamed into a Suspense
  // hole. Replaces the old experimental.ppr flag. See #19.
  cacheComponents: true,
  experimental: {
    // Cookie-dynamic pages (nav reads getSessionUser()) default to 0s client
    // router cache, so every nav click refetches the full RSC payload. Cheap
    // interim win for #19; structural PPR/static-shell fix is separate.
    // Tradeoff: session UI (nav chip, sign-in link) can lag up to 30s after
    // sign-in/out.
    staleTimes: {
      dynamic: 30,
    },
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
