import type { Facet } from "@senka/core/types";

/** What to write in each catalogue field, why it helps the artist, and why it helps people viewing the work. */
export const FACET_HELP: Record<Facet | "year" | "dimensions", string> = {
  medium:
    "What it's made of or how it was made: oil, graphite, clay, video. Add as many as apply. Tracking your materials shows you what you keep reaching for, and tells viewers how to read the surface in front of them.",
  project:
    "The series or body of work it belongs to. A work can sit in more than one. Grouping by project shows you how your ideas build over time, and lets viewers follow a thread instead of meeting one-off pieces.",
  content:
    "What's in it: people, landscapes, dogs. Add as many as apply. Naming your subjects shows you what you keep coming back to, and helps viewers find the work they care about.",
  exhibition:
    "The shows it has hung in, one entry per show. Add every one. It builds a record of the work's history for you, and viewers see where it has been seen.",
  year: "The year you finished it, written with four digits, like 2024. Writing years the same way lets you see how your work changes over time, and lets viewers browse by year.",
  dimensions:
    "Its size, written the same way each time, like 24 × 36 in. It helps you plan frames, shipping and shows, and tells viewers how big the work really is.",
};
