import { Suspense } from "react";
import Link from "next/link";
import buildInfo from "@/lib/build-info.json";
import { site } from "@/content/site";
import { MobileMenu } from "@/components/mobile-menu";
import { getSessionUser } from "@/lib/auth";

const builtAt = new Date(buildInfo.built_at)
  .toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
  .replace(/AM/, "am")
  .replace(/PM/, "pm");

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

const links = [
  { href: "/about", label: site.navLabels.about },
  { href: "/tenets", label: site.navLabels.tenets },
  { href: "/vibe-coding-lessons", label: site.navLabels.lessons },
  { href: "/connect", label: site.navLabels.connect },
];

/**
 * The session-dependent slice of the desktop nav. It is the ONLY reason any
 * route in this app was dynamic — Nav renders in the root layout, so the
 * cookie read at lib/auth.ts propagated to all 13 page routes (#19). Behind a
 * Suspense boundary it becomes a dynamic hole in an otherwise static shell.
 */
async function SessionSlot() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <li>
        <Link href="/signin" className="font-medium text-neutral-800 hover:text-neutral-950">
          {site.navLabels.signIn}
        </Link>
      </li>
    );
  }

  return (
    <>
      <li className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 py-1 pl-1 pr-3">
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white"
        >
          {(user.name ?? user.email)[0].toUpperCase()}
        </span>
        <span className="max-w-[10rem] truncate font-medium text-neutral-800">
          {user.name ?? user.email}
        </span>
      </li>
      <li>
        <form action="/api/auth/signout" method="post">
          <button type="submit" className="hover:text-neutral-900">
            sign out
          </button>
        </form>
      </li>
    </>
  );
}

/**
 * Reserves the chip's height so the shell doesn't shift when the slot resolves.
 * Deliberately not a "sign in" link: that would be wrong for signed-in readers
 * and would flash before correcting itself.
 */
function SessionSlotFallback() {
  return <li aria-hidden className="h-8 w-20" />;
}

/** Same boundary for the phone nav, which also branches on the session. */
async function MobileSlot() {
  const user = await getSessionUser();
  return <MobileMenu links={links} signInLabel={site.navLabels.signIn} user={user} />;
}

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <nav className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-[15px] font-normal tracking-tight">
          the <span className="font-bold">piano house</span> project
        </Link>

        <ul className="hidden items-center gap-6 text-sm text-neutral-600 sm:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="hover:text-neutral-900">
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <a
              href="https://github.com/nicolovejoy"
              target="_blank"
              rel="noopener"
              aria-label="Nico on GitHub"
              className="block hover:text-neutral-900"
            >
              <GitHubMark className="size-4" />
            </a>
          </li>
          <Suspense fallback={<SessionSlotFallback />}>
            <SessionSlot />
          </Suspense>
        </ul>

        <Suspense
          fallback={<MobileMenu links={links} signInLabel={site.navLabels.signIn} user={null} />}
        >
          <MobileSlot />
        </Suspense>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-neutral-200">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-2 px-6 py-8 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <span>{site.footerTagline}</span>
        <span className="font-mono text-[11px] text-neutral-400">
          Built {builtAt} PT{buildInfo.commit && <> · {buildInfo.commit}</>}
        </span>
      </div>
    </footer>
  );
}
