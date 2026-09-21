const STORAGE_KEY = "housefile:hostId";

// No accounts yet for the hackathon build — a random id kept in this
// browser stands in for a logged-in host until convex-auth is wired up.
export function getOrCreateHostId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
