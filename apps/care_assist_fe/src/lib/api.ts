// Read-only calls to the CARE API with the doctor's own login token (same as CARE's own pages).
// Only GET, except the value-set "expand" search, which CARE itself also calls as POST to look up
// SNOMED names; it changes nothing.
const API_BASE = String(import.meta.env.REACT_CARE_API_URL || "").replace(
  /\/+$/,
  "",
);

function headers() {
  const token = localStorage.getItem("care_access_token");
  if (!token) throw new Error("not logged in");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(API_BASE + path, {
    headers: headers(),
    credentials: "omit",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export interface CodeConcept {
  code: string;
  display: string;
  system: string;
}

// SNOMED search through CARE's own value set (the same search the "Add Diagnosis" box uses).
export async function searchCondition(
  name: string,
): Promise<CodeConcept | null> {
  try {
    const r = await fetch(
      `${API_BASE}/api/v1/valueset/system-condition-code/expand/`,
      {
        method: "POST",
        headers: headers(),
        credentials: "omit",
        body: JSON.stringify({ search: name, count: 5 }),
      },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { results?: CodeConcept[] };
    const list = j.results || [];
    return (
      list.find((c) => c.display.toLowerCase() === name.toLowerCase()) ||
      list[0] ||
      null
    );
  } catch {
    return null;
  }
}
