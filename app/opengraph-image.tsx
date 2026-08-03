import { ImageResponse } from "next/og";
import { cacheLife } from "next/cache";
import { site } from "@/content/site";

export const alt = site.footerTagline;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 'use cache' keeps this route prerendered. Without it the two font fetches are
// uncached runtime data under cacheComponents, which demoted the card from
// static to per-request — an external Google Fonts round-trip on every social
// scrape. Fonts are immutable, so the longest profile is right.
async function loadGoogleFont(family: string, weight: number) {
  "use cache";
  cacheLife("max");

  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family,
  )}:wght@${weight}&display=swap`;
  const css = await (await fetch(url)).text();
  const match = css.match(/src: url\((.+?)\) format\(/);
  if (!match) throw new Error(`Font load failed: ${family} ${weight}`);
  return await (await fetch(match[1])).arrayBuffer();
}

export default async function OGImage() {
  const [regular, bold] = await Promise.all([
    loadGoogleFont("Geist", 400),
    loadGoogleFont("Geist", 700),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px 96px",
          background: "#ffffff",
          color: "#171717",
          fontFamily: "Geist, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 24,
            color: "#525252",
            letterSpacing: 1,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              background: "#171717",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M 5 12 L 16 4 L 27 12"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <line
                x1="5"
                y1="12"
                x2="5"
                y2="28"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <line
                x1="27"
                y1="12"
                x2="27"
                y2="28"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <line
                x1="5"
                y1="28"
                x2="27"
                y2="28"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <rect x="9" y="20" width="2" height="6" fill="white" />
              <rect x="13" y="20" width="2" height="6" fill="white" />
              <rect x="17" y="20" width="2" height="6" fill="white" />
              <rect x="21" y="20" width="2" height="6" fill="white" />
            </svg>
          </div>
          <span>pianohouseproject.org</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Spaces are baked into the spans rather than expressed as `gap`,
              which Satori rendered unevenly. flexShrink/nowrap are load-bearing:
              without them Satori wraps "piano house" onto two lines. */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              flexWrap: "nowrap",
              fontSize: 90,
              letterSpacing: -2,
              lineHeight: 1,
            }}
          >
            <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}>the&nbsp;</span>
            <span
              style={{ fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}
            >
              piano house
            </span>
            <span style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
              &nbsp;project
            </span>
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 44,
              color: "#525252",
              lineHeight: 1.3,
            }}
          >
            {site.tagline}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: regular, weight: 400 },
        { name: "Geist", data: bold, weight: 700 },
      ],
    },
  );
}
