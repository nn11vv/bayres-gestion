"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Supabase config ───────────────────────────────────────────────────────────
const SUPA_URL = "https://tnstmdckdraladewdocf.supabase.co";
const SUPA_KEY = "sb_publishable_tFyiNQh9qfwnultGIMLq-w_lM_bfL6g";
const headers  = {
  "Content-Type": "application/json",
  "apikey": SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
};

async function dbGet(table: string) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?order=created_at.desc`, { headers });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function dbInsert(table: string, data: Record<string, unknown>) {
  const { id: _id, ...body } = data;
  void _id;
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers, "Prefer": "return=representation" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json())[0];
}
async function dbUpdate(table: string, id: string, data: Record<string, unknown>) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, "Prefer": "return=representation" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json())[0];
}
async function dbDelete(table: string, id: string) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, { method: "DELETE", headers });
  if (!r.ok) throw new Error(await r.text());
}

// ─── Push notifications ────────────────────────────────────────────────────────
const VAPID_PUBLIC = "BCH1ymwR0tNamx2WFTPvOzyVE9C4iEDmuwOWzOjOmG2E7FF3aMSbUzvtkCxYqsEqthETWsozk5Na3jteDJGZM-w";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function registerPushSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
    const subJson = sub.toJSON();
    const keys = subJson.keys as { p256dh: string; auth: string };
    await fetch(`${SUPA_URL}/rest/v1/push_subscriptions`, {
      method: "POST",
      headers: { ...headers, "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ endpoint: subJson.endpoint, p256dh: keys.p256dh, auth: keys.auth }),
    });
    return true;
  } catch (e) {
    console.error("Push registration error:", e);
    return false;
  }
}

function fireNotif(title: string, body: string) {
  if (Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon: "/sol-de-mayo.png" }); } catch {}
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const NAVY   = "#0F2D6B";
const NAVY2  = "#0A1F4E";
const ACCENT = "#1E7FD8";

const ESTADOS_P: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "#D97706" },
  enviado:   { label: "Enviado",   color: ACCENT },
  aceptado:  { label: "Aceptado",  color: "#059669" },
  rechazado: { label: "Rechazado", color: "#DC2626" },
  vencido:   { label: "Vencido",   color: "#6B7280" },
};
const ESTADOS_T: Record<string, { label: string; color: string }> = {
  pendiente:  { label: "Pendiente",  color: "#D97706" },
  en_curso:   { label: "En curso",   color: ACCENT },
  completado: { label: "Completado", color: "#059669" },
  cancelado:  { label: "Cancelado",  color: "#DC2626" },
};
const ZONAS     = ["Alicante","Playa San Juan","San Juan Pueblo","Mutxamel","El Campello","Bussot","Benidorm","Jávea","Otra"];
const SERVICIOS = ["Reparación persiana","Instalación persiana","Motorización persiana","Mosquitera","Aire acondicionado","Electricidad","Otro"];

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt     = (d: string) => d ? new Date(d + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—";
const mapsUrl = (dir: string) => `https://maps.google.com/?q=${encodeURIComponent(dir + ", España")}`;

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = {
  input:    { width: "100%", background: "#0D2259", border: "1px solid #1A3A7A", borderRadius: 10, color: "#EEF2FF", padding: "10px 12px", fontSize: 15, boxSizing: "border-box" as const, fontFamily: "inherit", outline: "none" },
  select:   { width: "100%", background: "#0D2259", border: "1px solid #1A3A7A", borderRadius: 10, color: "#EEF2FF", padding: "10px 12px", fontSize: 15, boxSizing: "border-box" as const, fontFamily: "inherit", outline: "none" },
  btnPrim:  { background: ACCENT, border: "none", borderRadius: 10, color: "#fff", padding: "13px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", fontFamily: "inherit" },
  btnGhost: { background: "#0D2259", border: "1px solid #1A3A7A", borderRadius: 10, color: "#93B4E8", padding: "11px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
};

// ─── Micro components ──────────────────────────────────────────────────────────
function Badge({ estado, map }: { estado: string; map: Record<string, { label: string; color: string }> }) {
  const e = map[estado] || { label: estado, color: "#6B7280" };
  return <span style={{ background: e.color+"22", color: e.color, border: `1px solid ${e.color}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: 0.4, whiteSpace: "nowrap" }}>{e.label.toUpperCase()}</span>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#7AA0D4", marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}
function DireccionField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Dirección">
      <div style={{ display: "flex", gap: 8 }}>
        <input style={{ ...S.input, flex: 1 }} value={value} onChange={e => onChange(e.target.value)} placeholder="Ej: Calle Mayor 14, Alicante" />
        {value.trim() && (
          <a href={mapsUrl(value)} target="_blank" rel="noreferrer" style={{ background: ACCENT, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", width: 42, flexShrink: 0, textDecoration: "none", fontSize: 18 }}>📍</a>
        )}
      </div>
    </Field>
  );
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "#0A1F4E", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: "24px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: "#EEF2FF" }}>{title}</span>
          <button onClick={onClose} style={{ background: "#0D2259", border: "1px solid #1A3A7A", borderRadius: 8, color: "#7AA0D4", padding: "6px 10px", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function FAB({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} style={{ position: "fixed", bottom: 90, right: 20, width: 52, height: 52, borderRadius: "50%", background: ACCENT, border: "none", color: "#fff", fontSize: 24, cursor: "pointer", boxShadow: "0 4px 20px #1E7FD855", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>;
}
function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ background: color+"15", border: `1px solid ${color}30`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#EEF2FF" }}>{value}</div>
    </div>
  );
}
function FilterPills({ options, active, onChange }: { options: [string, string][]; active: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} style={{ border: "none", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", background: active===k ? ACCENT : "#0D2259", color: active===k ? "#fff" : "#7AA0D4" }}>{label}</button>
      ))}
    </div>
  );
}
function MapsLink({ direccion }: { direccion?: string }) {
  if (!direccion) return null;
  return (
    <a href={mapsUrl(direccion)} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, background: "#0D2259", borderRadius: 10, padding: "10px 14px", marginBottom: 14, textDecoration: "none", border: "1px solid #1A3A7A" }}>
      <span style={{ fontSize: 18 }}>📍</span>
      <span style={{ fontSize: 13, color: "#93B4E8", flex: 1 }}>{direccion}</span>
      <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700 }}>MAPS →</span>
    </a>
  );
}
function Note({ text }: { text: string }) {
  return <div style={{ background: "#0D2259", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13, color: "#93B4E8", border: "1px solid #1A3A7A" }}>📝 {text}</div>;
}
function Empty() {
  return <div style={{ color: "#3A5A9A", textAlign: "center", padding: "30px 0", fontSize: 14 }}>Sin registros en esta categoría</div>;
}
function Spinner() {
  return <div style={{ color: "#3A5A9A", textAlign: "center", padding: "30px 0", fontSize: 13 }}>Cargando...</div>;
}
function ErrBanner({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div style={{ background: "#7F1D1D", border: "1px solid #DC2626", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 13, color: "#FCA5A5" }}>⚠️ {msg}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#FCA5A5", cursor: "pointer", fontSize: 16 }}>✕</button>
    </div>
  );
}

// ─── PRESUPUESTOS ──────────────────────────────────────────────────────────────
function PresupuestosTab() {
  const [data,     setData]     = useState<Record<string, unknown>[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<Record<string, unknown> | null>(null);
  const [filter,   setFilter]   = useState("all");
  const [detail,   setDetail]   = useState<Record<string, unknown> | null>(null);
  const [saving,   setSaving]   = useState(false);
  const blank = { cliente: "", zona: ZONAS[0], direccion: "", servicio: SERVICIOS[0], importe: "", estado: "pendiente", fecha: new Date().toISOString().slice(0,10), nota: "" };
  const [form, setForm] = useState<Record<string, unknown>>(blank);

  const load = useCallback(async () => {
    try { setLoading(true); setData(await dbGet("presupuestos")); } catch(e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered  = filter === "all" ? data : data.filter(p => p.estado === filter);
  const totalAcep = data.filter(p => p.estado==="aceptado").reduce((a, p) => a + Number(p.importe||0), 0);
  const nPend     = data.filter(p => p.estado==="pendiente").length;

  const openNew  = () => { setEditing(null); setForm(blank); setShowForm(true); };
  const openEdit = (p: Record<string, unknown>) => { setEditing(p); setForm({...p}); setShowForm(true); setDetail(null); };
  const submit   = async () => {
    if (!(form.cliente as string).trim()) return;
    setSaving(true);
    try {
      if (editing) { const u = await dbUpdate("presupuestos", editing.id as string, form); setData(d => d.map(p => p.id===editing.id ? u : p)); }
      else         { const u = await dbInsert("presupuestos", form); setData(d => [u, ...d]); }
      setShowForm(false);
    } catch(e) { setErr((e as Error).message); } finally { setSaving(false); }
  };
  const del = async (id: string) => {
    try { await dbDelete("presupuestos", id); setData(d => d.filter(p => p.id!==id)); setDetail(null); } catch(e) { setErr((e as Error).message); }
  };
  const changeEstado = async (id: string, estado: string) => {
    try { await dbUpdate("presupuestos", id, { estado }); setData(d => d.map(p => p.id===id ? {...p,estado} : p)); setDetail(d => d ? {...d,estado} : null); } catch(e) { setErr((e as Error).message); }
  };

  return (
    <div>
      {err && <ErrBanner msg={err} onClose={() => setErr(null)} />}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <StatCard label="Aceptados"  value={`${totalAcep}€`} color="#059669" />
        <StatCard label="Pendientes" value={nPend}            color="#D97706" />
      </div>
      <FilterPills options={[["all","Todos"], ...Object.entries(ESTADOS_P).map(([k,v]) => [k,v.label] as [string,string])]} active={filter} onChange={setFilter} />
      {loading ? <Spinner /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.length === 0 && <Empty />}
          {filtered.map(p => (
            <div key={p.id as string} onClick={() => setDetail(p)} style={{ background: "#0A1F4E", border: "1px solid #1A3A7A", borderRadius: 14, padding: 14, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: "#EEF2FF" }}>{p.cliente as string}</span>
                <span style={{ fontWeight: 800, fontSize: 15, color: ACCENT }}>{p.importe ? `${p.importe}€` : "—"}</span>
              </div>
              <div style={{ fontSize: 13, color: "#7AA0D4", marginBottom: 8 }}>{p.servicio as string} · {p.zona as string}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Badge estado={p.estado as string} map={ESTADOS_P} />
                <span style={{ fontSize: 12, color: "#3A5A9A" }}>{fmt(p.fecha as string)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <FAB onClick={openNew} />
      {detail && (
        <Modal title="Presupuesto" onClose={() => setDetail(null)}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#EEF2FF", marginBottom: 4 }}>{detail.cliente as string}</div>
            <div style={{ fontSize: 14, color: "#7AA0D4" }}>{detail.servicio as string} · {detail.zona as string}</div>
          </div>
          <MapsLink direccion={detail.direccion as string} />
          <div style={{ background: "#0D2259", borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: "#7AA0D4", fontSize: 13 }}>Importe</span><span style={{ color: ACCENT, fontWeight: 800, fontSize: 16 }}>{detail.importe ? `${detail.importe}€` : "—"}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#7AA0D4", fontSize: 13 }}>Fecha</span><span style={{ color: "#EEF2FF", fontSize: 13 }}>{fmt(detail.fecha as string)}</span></div>
          </div>
          {detail.nota && <Note text={detail.nota as string} />}
          <Field label="Cambiar estado">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {Object.entries(ESTADOS_P).map(([k,v]) => (
                <button key={k} onClick={() => changeEstado(detail.id as string, k)} style={{ border: `1px solid ${v.color}55`, borderRadius: 8, padding: "8px 6px", background: detail.estado===k ? v.color+"22" : "transparent", color: v.color, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{v.label}</button>
              ))}
            </div>
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => openEdit(detail)} style={{ ...S.btnGhost, flex: 1 }}>✏️ Editar</button>
            <button onClick={() => del(detail.id as string)} style={{ ...S.btnGhost, flex: 1, color: "#DC2626", borderColor: "#DC262640" }}>🗑️ Borrar</button>
          </div>
        </Modal>
      )}
      {showForm && (
        <Modal title={editing ? "Editar presupuesto" : "Nuevo presupuesto"} onClose={() => setShowForm(false)}>
          <Field label="Cliente"><input style={S.input} value={form.cliente as string} onChange={e=>setForm({...form,cliente:e.target.value})} placeholder="Nombre del cliente" /></Field>
          <Field label="Zona"><select style={S.select} value={form.zona as string} onChange={e=>setForm({...form,zona:e.target.value})}>{ZONAS.map(z=><option key={z}>{z}</option>)}</select></Field>
          <DireccionField value={(form.direccion as string)||""} onChange={v=>setForm({...form,direccion:v})} />
          <Field label="Servicio"><select style={S.select} value={form.servicio as string} onChange={e=>setForm({...form,servicio:e.target.value})}>{SERVICIOS.map(s=><option key={s}>{s}</option>)}</select></Field>
          <Field label="Importe (€)"><input style={S.input} type="number" value={form.importe as string} onChange={e=>setForm({...form,importe:e.target.value})} placeholder="0" /></Field>
          <Field label="Estado"><select style={S.select} value={form.estado as string} onChange={e=>setForm({...form,estado:e.target.value})}>{Object.entries(ESTADOS_P).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></Field>
          <Field label="Fecha"><input style={S.input} type="date" value={form.fecha as string} onChange={e=>setForm({...form,fecha:e.target.value})} /></Field>
          <Field label="Nota"><textarea style={{...S.input,minHeight:70,resize:"vertical"}} value={form.nota as string} onChange={e=>setForm({...form,nota:e.target.value})} placeholder="Recordatorio, observaciones..." /></Field>
          <button onClick={submit} disabled={saving} style={{...S.btnPrim,opacity:saving?0.7:1}}>{saving?"Guardando...":editing?"Guardar cambios":"Añadir presupuesto"}</button>
        </Modal>
      )}
    </div>
  );
}

// ─── MATERIALES ────────────────────────────────────────────────────────────────
function MaterialesTab() {
  const [data,     setData]    = useState<Record<string, unknown>[]>([]);
  const [loading,  setLoading] = useState(true);
  const [err,      setErr]     = useState<string | null>(null);
  const [showForm, setShowForm]= useState(false);
  const [filter,   setFilter]  = useState("pendiente");
  const [notifOk,  setNotifOk] = useState(typeof Notification !== "undefined" && Notification.permission === "granted");
  const [banner,   setBanner]  = useState<string | null>(null);
  const [saving,   setSaving]  = useState(false);
  const [form, setForm] = useState({ item: "", cantidad: "", urgente: false, comprado: false, nota: "" });

  const load = useCallback(async () => {
    try { setLoading(true); setData(await dbGet("materiales")); } catch(e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const pendientes = data.filter(m => !m.comprado);
  const comprados  = data.filter(m =>  m.comprado);
  const urgentes   = pendientes.filter(m => m.urgente).length;
  const shown      = filter === "pendiente" ? pendientes : comprados;

  const showBanner = (item: string) => { setBanner(item); setTimeout(() => setBanner(null), 4000); };

  const toggle = async (id: string, field: string) => {
    const prev = data.find(m => m.id===id);
    if (!prev) return;
    const val = !prev[field];
    try {
      await dbUpdate("materiales", id, { [field]: val });
      setData(d => d.map(m => m.id===id ? {...m,[field]:val} : m));
      if (field==="urgente" && val) {
        if (notifOk) fireNotif("⚡ Material urgente — Bayres", `${prev.item as string} marcado como urgente`);
        showBanner(prev.item as string);
      }
    } catch(e) { setErr((e as Error).message); }
  };
  const del = async (id: string) => {
    try { await dbDelete("materiales", id); setData(d => d.filter(m => m.id!==id)); } catch(e) { setErr((e as Error).message); }
  };
  const submit = async () => {
    if (!form.item.trim()) return;
    setSaving(true);
    try {
      const u = await dbInsert("materiales", form);
      setData(d => [u, ...d]);
      if (form.urgente) { if (notifOk) fireNotif("⚡ Material urgente — Bayres", `${form.item} añadido como urgente`); showBanner(form.item); }
      setShowForm(false);
      setForm({ item: "", cantidad: "", urgente: false, comprado: false, nota: "" });
    } catch(e) { setErr((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <div>
      {err && <ErrBanner msg={err} onClose={() => setErr(null)} />}
      {banner && (
        <div style={{ background: "#7F1D1D", border: "1px solid #DC2626", borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <div><div style={{ fontWeight: 700, fontSize: 13, color: "#FCA5A5" }}>Material urgente</div><div style={{ fontSize: 12, color: "#F87171" }}>{banner} — aviso enviado al equipo</div></div>
        </div>
      )}
      {!notifOk && (
        <button onClick={async () => setNotifOk(await registerPushSubscription())} style={{ width: "100%", background: "#0D2259", border: "1px dashed #1E7FD8", borderRadius: 12, padding: "10px 14px", marginBottom: 14, color: "#7AA0D4", fontSize: 13, cursor: "pointer", textAlign: "left" }}>
          🔔 Activar notificaciones push para alertas de urgente
        </button>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <StatCard label="Urgentes"    value={urgentes}          color="#DC2626" />
        <StatCard label="Por comprar" value={pendientes.length} color={ACCENT}  />
      </div>
      <FilterPills options={[["pendiente","Por comprar"],["comprado","Comprado"]]} active={filter} onChange={setFilter} />
      {loading ? <Spinner /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shown.length === 0 && <Empty />}
          {shown.map(m => (
            <div key={m.id as string} style={{ background: "#0A1F4E", border: `1px solid ${m.urgente&&!m.comprado?"#DC262640":"#1A3A7A"}`, borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => toggle(m.id as string,"comprado")} style={{ width:28,height:28,borderRadius:"50%",border:`2px solid ${m.comprado?"#059669":"#1A3A7A"}`,background:m.comprado?"#059669":"transparent",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff" }}>
                {m.comprado?"✓":""}
              </button>
              <div style={{ flex:1,minWidth:0 }}>
                {m.urgente&&!m.comprado&&<div style={{ fontSize:10,color:"#DC2626",fontWeight:700,letterSpacing:0.5,marginBottom:2 }}>⚡ URGENTE</div>}
                <div style={{ fontWeight:700,fontSize:15,color:m.comprado?"#3A5A9A":"#EEF2FF",textDecoration:m.comprado?"line-through":"none" }}>{m.item as string}</div>
                <div style={{ fontSize:13,color:"#4A6A9A" }}>{m.cantidad as string}{m.nota?` · ${m.nota as string}`:""}</div>
              </div>
              <div style={{ display:"flex",gap:6 }}>
                {!m.comprado&&<button onClick={()=>toggle(m.id as string,"urgente")} style={{ background:m.urgente?"#DC262620":"#0D2259",border:`1px solid ${m.urgente?"#DC262660":"#1A3A7A"}`,borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:14 }}>⚡</button>}
                <button onClick={()=>del(m.id as string)} style={{ background:"#0D2259",border:"1px solid #1A3A7A",borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:14 }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <FAB onClick={() => setShowForm(true)} />
      {showForm && (
        <Modal title="Añadir material" onClose={() => setShowForm(false)}>
          <Field label="Material"><input style={S.input} value={form.item} onChange={e=>setForm({...form,item:e.target.value})} placeholder="Ej: Ejes 19mm, cintas 18mm beige..." /></Field>
          <Field label="Cantidad"><input style={S.input} value={form.cantidad} onChange={e=>setForm({...form,cantidad:e.target.value})} placeholder="Ej: 10 uds, 3 rollos..." /></Field>
          <Field label="Nota (tienda, referencia...)"><input style={S.input} value={form.nota} onChange={e=>setForm({...form,nota:e.target.value})} placeholder="Ferretería Roca, ref. 0012..." /></Field>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:18,background:"#0D2259",borderRadius:10,padding:"12px 14px",border:"1px solid #1A3A7A" }}>
            <input type="checkbox" id="urgente" checked={form.urgente} onChange={e=>setForm({...form,urgente:e.target.checked})} style={{ width:18,height:18,cursor:"pointer" } as React.CSSProperties} />
            <label htmlFor="urgente" style={{ color:"#FCA5A5",fontWeight:600,fontSize:14,cursor:"pointer" }}>⚡ Marcar como urgente</label>
          </div>
          <button onClick={submit} disabled={saving} style={{...S.btnPrim,opacity:saving?0.7:1}}>{saving?"Guardando...":"Añadir a la lista"}</button>
        </Modal>
      )}
    </div>
  );
}

// ─── TRABAJOS ──────────────────────────────────────────────────────────────────
function TrabajosTab() {
  const [data,     setData]     = useState<Record<string, unknown>[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<Record<string, unknown> | null>(null);
  const [filter,   setFilter]   = useState("all");
  const [detail,   setDetail]   = useState<Record<string, unknown> | null>(null);
  const [saving,   setSaving]   = useState(false);
  const blank = { cliente: "", zona: ZONAS[0], direccion: "", servicio: SERVICIOS[0], estado: "pendiente", fecha: new Date().toISOString().slice(0,10), nota: "" };
  const [form, setForm] = useState<Record<string, unknown>>(blank);

  const load = useCallback(async () => {
    try { setLoading(true); setData(await dbGet("trabajos")); } catch(e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = filter==="all" ? data : data.filter(t => t.estado===filter);
  const enCurso  = data.filter(t => t.estado==="en_curso").length;
  const hoy      = data.filter(t => t.fecha===new Date().toISOString().slice(0,10)).length;

  const openNew  = () => { setEditing(null); setForm(blank); setShowForm(true); };
  const openEdit = (t: Record<string, unknown>) => { setEditing(t); setForm({...t}); setShowForm(true); setDetail(null); };
  const submit   = async () => {
    if (!(form.cliente as string).trim()) return;
    setSaving(true);
    try {
      if (editing) { const u = await dbUpdate("trabajos", editing.id as string, form); setData(d => d.map(t => t.id===editing.id?u:t)); }
      else         { const u = await dbInsert("trabajos", form); setData(d => [u,...d]); }
      setShowForm(false);
    } catch(e) { setErr((e as Error).message); } finally { setSaving(false); }
  };
  const del = async (id: string) => {
    try { await dbDelete("trabajos",id); setData(d => d.filter(t=>t.id!==id)); setDetail(null); } catch(e) { setErr((e as Error).message); }
  };
  const changeEstado = async (id: string, estado: string) => {
    try { await dbUpdate("trabajos",id,{estado}); setData(d => d.map(t=>t.id===id?{...t,estado}:t)); setDetail(d=>d?{...d,estado}:null); } catch(e) { setErr((e as Error).message); }
  };

  return (
    <div>
      {err && <ErrBanner msg={err} onClose={() => setErr(null)} />}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16 }}>
        <StatCard label="En curso" value={enCurso} color={ACCENT} />
        <StatCard label="Hoy"      value={hoy}     color="#059669" />
      </div>
      <FilterPills options={[["all","Todos"],...Object.entries(ESTADOS_T).map(([k,v]) => [k,v.label] as [string,string])]} active={filter} onChange={setFilter} />
      {loading ? <Spinner /> : (
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          {filtered.length===0&&<Empty />}
          {filtered.map(t => (
            <div key={t.id as string} onClick={()=>setDetail(t)} style={{ background:"#0A1F4E",border:"1px solid #1A3A7A",borderRadius:14,padding:14,cursor:"pointer" }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                <span style={{ fontWeight:700,fontSize:15,color:"#EEF2FF" }}>{t.cliente as string}</span>
                <span style={{ fontSize:12,color:"#3A5A9A" }}>{fmt(t.fecha as string)}</span>
              </div>
              <div style={{ fontSize:13,color:"#7AA0D4",marginBottom:8 }}>{t.servicio as string} · {t.zona as string}</div>
              <Badge estado={t.estado as string} map={ESTADOS_T} />
            </div>
          ))}
        </div>
      )}
      <FAB onClick={openNew} />
      {detail && (
        <Modal title="Trabajo" onClose={()=>setDetail(null)}>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:20,fontWeight:800,color:"#EEF2FF",marginBottom:4 }}>{detail.cliente as string}</div>
            <div style={{ fontSize:14,color:"#7AA0D4" }}>{detail.servicio as string} · {detail.zona as string} · {fmt(detail.fecha as string)}</div>
          </div>
          <MapsLink direccion={detail.direccion as string} />
          {detail.nota&&<Note text={detail.nota as string} />}
          <Field label="Cambiar estado">
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
              {Object.entries(ESTADOS_T).map(([k,v])=>(
                <button key={k} onClick={()=>changeEstado(detail.id as string,k)} style={{ border:`1px solid ${v.color}55`,borderRadius:8,padding:"8px 6px",background:detail.estado===k?v.color+"22":"transparent",color:v.color,fontSize:12,fontWeight:700,cursor:"pointer" }}>{v.label}</button>
              ))}
            </div>
          </Field>
          <div style={{ display:"flex",gap:8,marginTop:8 }}>
            <button onClick={()=>openEdit(detail)} style={{...S.btnGhost,flex:1}}>✏️ Editar</button>
            <button onClick={()=>del(detail.id as string)} style={{...S.btnGhost,flex:1,color:"#DC2626",borderColor:"#DC262640"}}>🗑️ Borrar</button>
          </div>
        </Modal>
      )}
      {showForm && (
        <Modal title={editing?"Editar trabajo":"Nuevo trabajo"} onClose={()=>setShowForm(false)}>
          <Field label="Cliente"><input style={S.input} value={form.cliente as string} onChange={e=>setForm({...form,cliente:e.target.value})} placeholder="Nombre del cliente" /></Field>
          <Field label="Zona"><select style={S.select} value={form.zona as string} onChange={e=>setForm({...form,zona:e.target.value})}>{ZONAS.map(z=><option key={z}>{z}</option>)}</select></Field>
          <DireccionField value={(form.direccion as string)||""} onChange={v=>setForm({...form,direccion:v})} />
          <Field label="Servicio"><select style={S.select} value={form.servicio as string} onChange={e=>setForm({...form,servicio:e.target.value})}>{SERVICIOS.map(s=><option key={s}>{s}</option>)}</select></Field>
          <Field label="Estado"><select style={S.select} value={form.estado as string} onChange={e=>setForm({...form,estado:e.target.value})}>{Object.entries(ESTADOS_T).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></Field>
          <Field label="Fecha"><input style={S.input} type="date" value={form.fecha as string} onChange={e=>setForm({...form,fecha:e.target.value})} /></Field>
          <Field label="Nota"><textarea style={{...S.input,minHeight:70,resize:"vertical"}} value={form.nota as string} onChange={e=>setForm({...form,nota:e.target.value})} placeholder="Observaciones, acceso, materiales..." /></Field>
          <button onClick={submit} disabled={saving} style={{...S.btnPrim,opacity:saving?0.7:1}}>{saving?"Guardando...":editing?"Guardar cambios":"Añadir trabajo"}</button>
        </Modal>
      )}
    </div>
  );
}

// ─── ROOT ──────────────────────────────────────────────────────────────────────
export default function GestionApp() {
  const [tab, setTab] = useState("presupuestos");
  const TABS = [
    { key: "presupuestos", label: "Presupuestos", icon: "📋" },
    { key: "materiales",   label: "Compras",       icon: "🛒" },
    { key: "trabajos",     label: "Trabajos",       icon: "🔧" },
  ];

  return (
    <div style={{ background: NAVY2, minHeight: "100vh", fontFamily: "system-ui, sans-serif", color: "#EEF2FF", maxWidth: 480, margin: "0 auto", paddingBottom: 80 }}>
      <div style={{ background: NAVY, padding: "14px 20px 12px", borderBottom: "1px solid #1A3A7A", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sol-de-mayo.png" alt="Sol de Mayo" style={{ width: 46, height: 46, objectFit: "contain" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "#7AA0D4", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", lineHeight: 1 }}>Bayres Servicios</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#EEF2FF", lineHeight: 1.3 }}>Gestión</div>
          </div>
          <div style={{ background: "#0D2259", borderRadius: 10, padding: "6px 12px", fontSize: 12, color: "#7AA0D4", fontWeight: 600, border: "1px solid #1A3A7A", whiteSpace: "nowrap" }}>
            {new Date().toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
          </div>
        </div>
      </div>
      <div style={{ padding: "16px 16px 0" }}>
        {tab === "presupuestos" && <PresupuestosTab />}
        {tab === "materiales"   && <MaterialesTab   />}
        {tab === "trabajos"     && <TrabajosTab      />}
      </div>
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: NAVY, borderTop: "1px solid #1A3A7A", display: "flex", zIndex: 60 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, background: "none", border: "none", padding: "12px 8px 16px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: tab===t.key ? ACCENT : "#3A5A9A" }}>{t.label.toUpperCase()}</span>
            {tab === t.key && <div style={{ width: 20, height: 2, background: ACCENT, borderRadius: 2 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}
