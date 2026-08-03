import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProject, getProjectBody, projectHistoryKey, projects } from "@/lib/projects";
import { site } from "@/content/site";
import { getProjectHistory } from "@/lib/history";
import { getCommitActivity, getPublicRepo } from "@/lib/github";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { getNotes, isFollowing } from "@/lib/community";
import { StatusBadge } from "@/components/status-badge";
import { ContributionCalendar } from "@/components/contribution-calendar";
import { CollapsibleSection } from "@/components/collapsible-section";
import { OgPreview } from "@/components/og-preview";
import { Evolution } from "@/components/evolution";
import { FollowButton } from "./follow-button";
import { LivePreviewLayout, LivePreviewTrigger } from "./live-preview";
import { Notes } from "./notes";

async function CommitGraph({ github }: { github: string }) {
  const weeks = await getCommitActivity(github);
  if (!weeks) return null;
  return <ContributionCalendar weeks={weeks} />;
}

function weekLabel(iso: string): string {
  return new Date(iso.replace(" ", "T") + "Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const actLink =
  "font-mono text-[0.66rem] tracking-[0.08em] uppercase text-neutral-600 underline decoration-neutral-300 underline-offset-4 hover:text-neutral-900 hover:decoration-neutral-500";

// `export const revalidate = 86400` lived here but was inert — the page reads
// cookies() below, which forced dynamic rendering regardless. cacheComponents
// rejects the segment config outright; per-scope cacheLife replaces it.

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: `${project.name} — ${site.title}`,
    description: project.tagline,
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProject(slug);
  const Body = getProjectBody(slug);
  if (!project || !Body) notFound();

  const history = await getProjectHistory(projectHistoryKey(project));
  const user = await getSessionUser();
  const admin = isAdmin(user);
  // Strip authorId before it crosses to the client; delete rights resolve here.
  const notes = (await getNotes(slug)).map(({ authorId, ...n }) => ({
    ...n,
    canDelete: admin || (!!user && authorId === user.id),
  }));
  const following = user ? await isFollowing(user.id, slug) : false;
  const repo = project.github ? await getPublicRepo(project.github) : null;
  // embed: true requires url (validated in check-content.mjs), so this is
  // the "permitted" switch from issue #12.
  const embedUrl = project.embed ? project.url : undefined;

  const hasEvolution =
    history.totalSessions > 0 || history.weekly.length > 0 || history.recent.length > 0;
  const latestWeek =
    [...history.weekly].sort((a, b) => b.weekOf.localeCompare(a.weekOf))[0] ?? null;

  const body = (
    // @container: the header below reflows by *available* width, not viewport
    // width — #12's split view squeezes this into a ~1/3-viewport column, and
    // a viewport-based `sm:` breakpoint would still fire there and overlap
    // the title with the preview card. @xl (36rem/576px, Tailwind's container
    // query scale — narrower than its viewport scale) sits between the split
    // column's ~400px and the full page's ~720px.
    <div className="@container mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← All projects
      </Link>

      {/* Above the fold: title + actions on the left, live-site preview on the right. */}
      <div className="mt-8 flex flex-col gap-6 @xl:flex-row @xl:items-start">
        <div className="min-w-0 flex-1">
          <header>
            <div className="flex items-center gap-2.5">
              <span className="mono-label">{project.category}</span>
              <span className="text-neutral-300" aria-hidden="true">
                ·
              </span>
              <StatusBadge status={project.status} />
            </div>
            <h1 className="mt-2 font-serif text-[2.75rem] leading-[1.05] tracking-[-0.02em] max-[560px]:text-[2.2rem]">
              {project.name}
            </h1>
            <p className="mt-3 max-w-[46ch] font-serif text-xl italic text-neutral-600">
              {project.tagline}
            </p>

            {latestWeek && (
              <div className="mt-[18px] flex gap-7 border-t border-b border-neutral-200 py-3.5">
                <div>
                  <span className="mono-label block">latest</span>
                  <span className="text-sm text-neutral-900">{weekLabel(latestWeek.weekOf)}</span>
                </div>
                <div>
                  <span className="mono-label block">activity</span>
                  <span className="text-sm text-neutral-900">
                    {latestWeek.sessionCount} session{latestWeek.sessionCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div>
                  <span className="mono-label block">source</span>
                  <span className="text-sm text-neutral-900">↳ from claude</span>
                </div>
              </div>
            )}

            <div className="mt-[18px] flex flex-wrap items-center gap-4">
              {project.url && (
                <a
                  href={project.url}
                  className="inline-flex items-center gap-1.5 rounded-md border border-invert bg-invert px-3 py-1.5 font-mono text-[0.66rem] tracking-[0.1em] text-invert-fg uppercase hover:border-[var(--n-700)] hover:bg-[var(--n-700)]"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visit site ↗
                </a>
              )}
              {repo && (
                <a href={repo.htmlUrl} className={actLink} target="_blank" rel="noopener noreferrer">
                  code on github ↗
                </a>
              )}
              {embedUrl && <LivePreviewTrigger url={embedUrl} />}
              <FollowButton project={slug} following={following} signedIn={!!user} />
              <Link href={`/connect?project=${project.slug}`} className={actLink}>
                get in touch
              </Link>
            </div>
          </header>
        </div>

        {project.url && (
          <div className="shrink-0 @xl:w-80">
            <Suspense
              fallback={
                <div className="aspect-[1200/630] w-full animate-pulse rounded-xl bg-neutral-100" />
              }
            >
              <OgPreview project={project} />
            </Suspense>
          </div>
        )}
      </div>

      <CollapsibleSection title="about" defaultOpen>
        <article className="prose prose-stone dark:prose-invert prose-lg max-w-none">
          <Body />
        </article>
      </CollapsibleSection>

      {(hasEvolution || project.github) && (
        <CollapsibleSection title="evolution">
          {hasEvolution && <Evolution history={history} />}
          {project.github && (
            <Suspense
              fallback={<div className="mt-8 h-[100px] animate-pulse rounded-lg bg-neutral-100" />}
            >
              <CommitGraph github={project.github} />
            </Suspense>
          )}
        </CollapsibleSection>
      )}

      <CollapsibleSection title="notes">
        <Notes
          project={slug}
          notes={notes}
          currentName={user?.name ?? null}
          signedIn={!!user}
        />
      </CollapsibleSection>
    </div>
  );

  if (!embedUrl) return body;
  return (
    <LivePreviewLayout name={project.name} url={embedUrl}>
      {body}
    </LivePreviewLayout>
  );
}
