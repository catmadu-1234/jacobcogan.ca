import { ApiError } from "./api";

/** A plain-language reason a save failed, with a little attitude. Shown next to "Couldn't save". */
export function saveErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const code = typeof err.body?.error === "string" ? err.body.error : "";
    if (code === "invalid") {
      const issues = Array.isArray(err.body?.issues) ? (err.body.issues as { path?: string; message?: string }[]) : [];
      const first = issues[0];
      return first?.path
        ? `"${first.path}" isn't quite right (${first.message ?? "invalid"}). Fix it and we're golden.`
        : "Something you typed isn't valid. Give it a once-over.";
    }
    if (code === "too-large") return "That's more than we can swallow in one go. Trim it down a bit.";
    if (code === "not-found") return "This one's been deleted out from under you. Gone. Poof.";
    if (code === "cross-site") return "That belongs to the other side. Hands off.";
    if (code === "unauthenticated" || err.status === 401) return "You've been signed out. Reload and pick your side again.";
    if (err.status === 403) return "You're not allowed to do that here.";
    if (err.status === 404) return "This one's been deleted out from under you. Gone. Poof.";
    if (err.status === 413) return "That's more than we can swallow in one go. Trim it down a bit.";
    if (err.status === 429) return "Easy, speedy. Too many saves at once. Wait a sec and retry.";
    if (err.status >= 500) return "Our side tripped over its own feet. Not you. Retry in a moment.";
    return `The server said no (${err.status}). Retry, and if it persists, tell Jacob.`;
  }
  return "Couldn't even reach the server. Check your connection and retry.";
}
