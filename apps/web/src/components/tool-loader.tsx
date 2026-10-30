"use client";

import { Component, lazy, Suspense, useEffect, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import { toolLoaders } from "@toolwright/tools/loaders";
import { Alert, Button } from "@toolwright/ui";
import { pushRecent } from "../lib/local-list";

function ToolSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading tool">
      <div className="skeleton h-24 w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="skeleton h-72" />
        <div className="skeleton h-72" />
      </div>
    </div>
  );
}

class ToolErrorBoundary extends Component<{ children: ReactNode; slug: string }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidUpdate(prev: { slug: string }) {
    if (prev.slug !== this.props.slug && this.state.error) this.setState({ error: null });
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <Alert tone="error" title="This tool failed to load">
        <p>
          {navigator.onLine === false ? "You appear to be offline and this tool has not been saved for offline use yet. " : "Something went wrong while starting it. "}
          Reloading the page usually fixes it.
        </p>
        <Button className="mt-3" size="sm" variant="outline" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </Alert>
    );
  }
}

// One lazy component per tool, created once. Tools read the URL hash, localStorage and other browser-only APIs,
// so they render after mount. The page around them (title, description, FAQ) is still server-rendered for SEO.
const components = new Map<string, LazyExoticComponent<ComponentType>>();

function componentFor(slug: string): LazyExoticComponent<ComponentType> | null {
  const loader = toolLoaders[slug];
  if (!loader) return null;
  let component = components.get(slug);
  if (!component) {
    component = lazy(loader);
    components.set(slug, component);
  }
  return component;
}

/** `track={false}` keeps the tool out of the visitor's "recently used" list (used by the home page bench). */
export function ToolLoader({ slug, track = true }: { slug: string; track?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (track) pushRecent(slug);
  }, [slug, track]);

  const Tool = componentFor(slug);
  if (!Tool) return <Alert tone="error">This tool could not be found.</Alert>;
  if (!mounted) return <ToolSkeleton />;
  return (
    <ToolErrorBoundary slug={slug}>
      <Suspense fallback={<ToolSkeleton />}>
        {/* Cached per slug at module level, so the component identity is stable across renders. */}
        {/* eslint-disable-next-line react-hooks/static-components */}
        <Tool />
      </Suspense>
    </ToolErrorBoundary>
  );
}
