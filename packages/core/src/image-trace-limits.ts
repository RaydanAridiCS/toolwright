/** Kept apart from image-trace.ts so the page can read the limit without loading the tracing library. */

/** Above this many pixels tracing is refused, because it would take too long and give an enormous file. */
export const MAX_TRACE_PIXELS = 1_500_000;
