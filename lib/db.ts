// ─── Supabase config ───────────────────────────────────────────────────────────
export const SUPA_URL = "https://tnstmdckdraladewdocf.supabase.co";
export const SUPA_KEY = "sb_publishable_tFyiNQh9qfwnultGIMLq-w_lM_bfL6g";
export const headers  = { "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}` };

export async function dbGet(table: string, filter = "") {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?order=created_at.desc${filter}`, { headers });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
export async function dbInsert(table: string, data: Record<string, unknown>) {
  const { id: _id, ...body } = data; void _id;
  const clean = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, v === "" ? null : v]));
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, { method: "POST", headers: { ...headers, "Prefer": "return=representation" }, body: JSON.stringify(clean) });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json())[0];
}
export async function dbUpdate(table: string, id: string, data: Record<string, unknown>) {
  const clean = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === "" ? null : v]));
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, { method: "PATCH", headers: { ...headers, "Prefer": "return=representation" }, body: JSON.stringify(clean) });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json())[0];
}
export async function dbDelete(table: string, id: string) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, { method: "DELETE", headers });
  if (!r.ok) throw new Error(await r.text());
}
export async function dbDeleteWhere(table: string, field: string, value: string) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${field}=eq.${value}`, { method: "DELETE", headers });
  if (!r.ok) throw new Error(await r.text());
}
// Bulk PATCH with a raw PostgREST filter string (e.g. "estado=eq.x&fecha=lt.y").
export async function dbUpdateWhere(table: string, filter: string, data: Record<string, unknown>) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${filter}`, { method: "PATCH", headers: { ...headers, "Prefer": "return=representation" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as Record<string, unknown>[];
}
