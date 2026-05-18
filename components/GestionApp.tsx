"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Supabase config ───────────────────────────────────────────────────────────
const SUPA_URL = "https://tnstmdckdraladewdocf.supabase.co";
const SUPA_KEY = "sb_publishable_tFyiNQh9qfwnultGIMLq-w_lM_bfL6g";
const headers  = { "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}` };

async function dbGet(table: string, filter = "") {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?order=created_at.desc${filter}`, { headers });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function dbInsert(table: string, data: Record<string, unknown>) {
  const { id: _id, ...body } = data; void _id;
  const clean = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, v === "" ? null : v]));
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, { method: "POST", headers: { ...headers, "Prefer": "return=representation" }, body: JSON.stringify(clean) });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json())[0];
}
async function dbUpdate(table: string, id: string, data: Record<string, unknown>) {
  const clean = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === "" ? null : v]));
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, { method: "PATCH", headers: { ...headers, "Prefer": "return=representation" }, body: JSON.stringify(clean) });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json())[0];
}
async function dbDelete(table: string, id: string) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, { method: "DELETE", headers });
  if (!r.ok) throw new Error(await r.text());
}
async function dbDeleteWhere(table: string, field: string, value: string) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${field}=eq.${value}`, { method: "DELETE", headers });
  if (!r.ok) throw new Error(await r.text());
}

interface Item { id?: string; descripcion: string; cantidad: number; precio_unitario: number; orden: number; }

function notificarUrgenteTodos() { fetch("/api/notificar", { method: "POST" }).catch(console.error); }
async function getNumeroDoc(tipo: "PR" | "FV"): Promise<string> {
  const r = await fetch("/api/factura-numero", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo }) });
  return (await r.json()).numero || `${tipo}-${new Date().getFullYear()}-0001`;
}
async function enviarFacturaEmail(emailCliente: string, factura: Record<string, unknown>): Promise<boolean> {
  const r = await fetch("/api/factura-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailCliente, factura }) });
  return r.ok;
}

const VAPID_PUBLIC = "BCH1ymwR0tNamx2WFTPvOzyVE9C4iEDmuwOWzOjOmG2E7FF3aMSbUzvtkCxYqsEqthETWsozk5Na3jteDJGZM-w";
function urlBase64ToUint8Array(b: string) {
  const pad = "=".repeat((4 - b.length % 4) % 4);
  return Uint8Array.from([...window.atob((b + pad).replace(/-/g, "+").replace(/_/g, "/"))].map(c => c.charCodeAt(0)));
}
async function registerPushSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    if ((await Notification.requestPermission()) !== "granted") return false;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) });
    const j = sub.toJSON(); const keys = j.keys as { p256dh: string; auth: string };
    await fetch(`${SUPA_URL}/rest/v1/push_subscriptions`, { method: "POST", headers: { ...headers, "Prefer": "resolution=merge-duplicates" }, body: JSON.stringify({ endpoint: j.endpoint, p256dh: keys.p256dh, auth: keys.auth }) });
    return true;
  } catch { return false; }
}
function fireNotif(title: string, body: string) {
  if (Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon: "/sol-de-mayo.png" }); } catch {}
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

// ─── PDF ───────────────────────────────────────────────────────────────────────
function generarFacturaHTML(factura: Record<string, unknown>, items: Item[]): string {
  const titulo   = factura.tipo === "PR" ? "Presupuesto" : "Factura";
  const fechaStr = factura.fecha ? new Date(String(factura.fecha)+"T12:00:00").toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"numeric"}) : "";
  const subtotal = items.reduce((a,i) => a + i.cantidad*i.precio_unitario, 0);
  const iva      = factura.tieneIva ? subtotal*0.21 : 0;
  const total    = subtotal + iva;
  const logoUrl  = typeof window !== "undefined" ? `${window.location.origin}/logo-bayres.png` : "/logo-bayres.png";
  const rows     = items.map(i=>`<tr><td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px">${i.descripcion}</td><td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:center">${i.cantidad}</td><td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:right">${i.precio_unitario.toFixed(2).replace(".",",")} €</td><td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:right">${(i.cantidad*i.precio_unitario).toFixed(2).replace(".",",")} €</td></tr>`).join("");
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#333;padding:24px;font-size:13px}.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:3px solid #1a3c8f;padding-bottom:16px}.emp .nm{font-size:13px;font-weight:bold;color:#1a3c8f}.emp .sb{font-size:11px;color:#666;margin-top:2px}.logo{width:140px}.tit{font-size:32px;font-weight:bold;color:#1a3c8f;margin-bottom:6px}.fecha{font-size:13px;margin-bottom:20px}.fecha span{font-weight:bold}.crow{display:flex;justify-content:space-between;margin-bottom:20px}.ccol .lbl{font-size:12px;font-weight:bold;margin-bottom:4px}.ccol .val{font-size:13px}table{width:100%;border-collapse:collapse;margin-bottom:0}thead tr{background:#1a3c8f}th{padding:10px;color:white;font-size:13px;font-weight:bold;text-align:left}th.r{text-align:right}th.c{text-align:center}.tots td{padding:5px 10px;font-size:13px;border:none}.tff{font-size:18px;font-weight:bold;color:#1a3c8f}.ftr{margin-top:32px;border-top:1px solid #ddd;padding-top:12px;display:flex;justify-content:space-between;font-size:11px;color:#666}</style></head><body>
<div class="hdr"><div class="emp"><div class="nm">PERSIANAS BAYRES S.L.</div><div class="sb">NIF: B44820504</div><div class="sb">Carrer de l'Herba Lluisa, 41 planta ch, puerta 6</div><div class="sb">Mutxamel, 03110.</div></div><img src="${logoUrl}" class="logo"/></div>
<div class="tit">${titulo}</div><div class="fecha">Fecha: <span>${fechaStr}</span></div>
<div class="crow"><div class="ccol"><div class="lbl">Cliente:</div><div class="val">${factura.cliente}</div>${factura.direccionCliente?`<div class="val">${factura.direccionCliente}</div>`:""} ${factura.nifCliente?`<div class="val">NIF: ${factura.nifCliente}</div>`:""}</div><div class="ccol" style="text-align:right"><div class="lbl">N.º de ${titulo}</div><div class="val">${factura.numeroDoc}</div></div></div>
<table><thead><tr><th>Descripción</th><th class="c" style="width:70px">Cantidad</th><th class="r" style="width:110px">Precio unitario</th><th class="r" style="width:110px">Precio total</th></tr></thead><tbody>${rows}</tbody></table>
<table class="tots"><tr><td colspan="2"></td><td style="text-align:right;font-weight:bold;padding-top:12px">Total</td><td style="text-align:right;padding-top:12px">${subtotal.toFixed(2).replace(".",",")} €</td></tr>${factura.tieneIva?`<tr><td colspan="2"></td><td style="text-align:right;font-weight:bold">IVA 21%</td><td style="text-align:right">${iva.toFixed(2).replace(".",",")} €</td></tr>`:""}<tr><td colspan="2"></td><td class="tff" style="text-align:right">${total.toFixed(2).replace(".",",")} €</td><td class="tff" style="text-align:right">${total.toFixed(2).replace(".",",")} €</td></tr></table>
<div class="ftr"><div><strong>Comunícate con nosotros</strong></div><div>Teléfono: 695 26 69 81<br>Email: Persianasbayres@gmail.com</div></div></body></html>`;
}

async function generarPDF(factura: Record<string, unknown>, items: Item[]) {
  const html2pdf = (await import("html2pdf.js")).default;
  const html = generarFacturaHTML(factura, items);
  const el   = document.createElement("div");
  el.innerHTML = html; el.style.position = "absolute"; el.style.left = "-9999px";
  document.body.appendChild(el);
  await html2pdf().set({ margin:[8,8,8,8], filename:`${factura.numeroDoc}.pdf`, image:{type:"jpeg",quality:0.98}, html2canvas:{scale:2,useCORS:true,logging:false}, jsPDF:{unit:"mm",format:"a4",orientation:"portrait"} }).from(el).save();
  document.body.removeChild(el);
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const NAVY   = "#0F2D6B";
const NAVY2  = "#0A1F4E";
const ACCENT = "#1E7FD8";
const IVA    = 0.21;
const ESTADOS_P: Record<string,{label:string;color:string}> = {
  pendiente:{label:"Pendiente",color:"#D97706"}, enviado:{label:"Enviado",color:ACCENT},
  aceptado:{label:"Aceptado",color:"#059669"}, rechazado:{label:"Rechazado",color:"#DC2626"}, vencido:{label:"Vencido",color:"#6B7280"},
};
const ESTADOS_T: Record<string,{label:string;color:string}> = {
  pendiente:{label:"Pendiente",color:"#D97706"}, en_curso:{label:"En curso",color:ACCENT},
  completado:{label:"Completado",color:"#059669"}, cancelado:{label:"Cancelado",color:"#DC2626"},
};
const ZONAS     = ["Alicante","Playa San Juan","San Juan Pueblo","Mutxamel","El Campello","Bussot","Benidorm","Jávea","Otra"];
const SERVICIOS = ["Reparación persiana","Instalación persiana","Motorización persiana","Mosquitera","Aire acondicionado","Electricidad","Otro"];
const VALID_TABS = ["presupuestos","materiales","trabajos"];
const ITEM_BLANK: Item = { descripcion:"", cantidad:1, precio_unitario:0, orden:0 };

const fmt       = (d: string) => d ? new Date(d+"T12:00:00").toLocaleDateString("es-ES",{day:"2-digit",month:"short"}) : "—";
const mapsUrl   = (dir: string) => `https://maps.google.com/?q=${encodeURIComponent(dir+", España")}`;
const calcTotalItems = (items: Item[]) => items.reduce((a,i)=>a+i.cantidad*i.precio_unitario,0);

const S = {
  input:    {width:"100%",background:"#0D2259",border:"1px solid #1A3A7A",borderRadius:10,color:"#EEF2FF",padding:"10px 12px",fontSize:15,boxSizing:"border-box" as const,fontFamily:"inherit",outline:"none"},
  select:   {width:"100%",background:"#0D2259",border:"1px solid #1A3A7A",borderRadius:10,color:"#EEF2FF",padding:"10px 12px",fontSize:15,boxSizing:"border-box" as const,fontFamily:"inherit",outline:"none"},
  btnPrim:  {background:ACCENT,border:"none",borderRadius:10,color:"#fff",padding:"13px 20px",fontSize:15,fontWeight:700,cursor:"pointer",width:"100%",fontFamily:"inherit"},
  btnGhost: {background:"#0D2259",border:"1px solid #1A3A7A",borderRadius:10,color:"#93B4E8",padding:"11px 20px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"},
};

// ─── SPLASH SCREEN ─────────────────────────────────────────────────────────────
function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"idle" | "animating" | "hold" | "out">("idle");
  const LAMAS = 8;

  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Primer render: idle, sin transición.
    // Dos frames después: animating, para que el DOM ya haya pintado el estado inicial.
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setPhase("animating");

        timers.push(setTimeout(() => setPhase("hold"), 1600));
        timers.push(setTimeout(() => setPhase("out"), 2200));
        timers.push(setTimeout(() => onDone(), 2800));
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      timers.forEach(clearTimeout);
    };
  }, [onDone]);

  const isInitial = phase === "idle";

  return (
    <div style={{
      position:"fixed", inset:0, background:NAVY, zIndex:9999,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      opacity: phase === "out" ? 0 : 1,
      transition: phase === "out" ? "opacity 0.6s ease" : "none",
    }}>
      {/* Sol de Mayo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/sol-de-mayo.png"
        alt=""
        style={{
          width:90,
          height:90,
          objectFit:"contain",
          marginBottom:32,
          opacity: isInitial ? 0 : 1,
          transform: isInitial ? "scale(0.7)" : "scale(1)",
          transition: isInitial ? "none" : "opacity 0.5s ease, transform 0.5s ease",
        }}
      />

      {/* Persiana animada SVG */}
      <div style={{ width:180, height:140, position:"relative", overflow:"hidden", border:"2px solid rgba(255,255,255,0.15)", borderRadius:4 }}>
        {/* Marco superior fijo */}
        <div style={{ position:"absolute", top:0, left:0, right:0, height:8, background:"rgba(255,255,255,0.25)", borderRadius:"4px 4px 0 0", zIndex:2 }} />
        {/* Lamas que suben */}
        {Array.from({length:LAMAS}).map((_,i) => {
          const lamaH = 16;
          const delay  = (LAMAS - 1 - i) * 120;
          const top = 10 + i * lamaH;
          const rollTop = -lamaH * (LAMAS - i);
          return (
            <div key={i} style={{
              position:"absolute", left:0, right:0, height:lamaH,
              top: isInitial ? top : rollTop,
              background: i%2===0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)",
              borderBottom:"1px solid rgba(255,255,255,0.08)",
              opacity: isInitial ? 1 : 0,
              transform: isInitial ? "scaleY(1)" : "scaleY(0.35)",
              transformOrigin: "top center",
              transition: isInitial ? "none" : `top 0.55s ease ${delay}ms, opacity 0.35s ease ${delay + 120}ms, transform 0.45s ease ${delay}ms`,
            }} />
          );
        })}
      </div>

      {/* Logo Bayres */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-bayres.png.png"
        alt="Persianas Bayres"
        style={{
          width:160,
          marginTop:28,
          opacity: isInitial ? 0 : 1,
          transition: isInitial ? "none" : "opacity 0.5s ease 0.8s",
          borderRadius:8,
        }}
      />
    </div>
  );
}

// ─── Micro components ──────────────────────────────────────────────────────────
function Badge({estado,map}:{estado:string;map:Record<string,{label:string;color:string}>}) {
  const e=map[estado]||{label:estado,color:"#6B7280"};
  return <span style={{background:e.color+"22",color:e.color,border:`1px solid ${e.color}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,letterSpacing:0.4,whiteSpace:"nowrap"}}>{e.label.toUpperCase()}</span>;
}
function Field({label,children}:{label:string;children:React.ReactNode}) {
  return <div style={{marginBottom:14}}><label style={{display:"block",fontSize:11,fontWeight:600,color:"#7AA0D4",marginBottom:5,letterSpacing:0.5,textTransform:"uppercase"}}>{label}</label>{children}</div>;
}
function Toggle({active,onChange,label}:{active:boolean;onChange:()=>void;label:string}) {
  return <div onClick={onChange} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0D2259",borderRadius:10,padding:"12px 14px",marginBottom:14,border:"1px solid #1A3A7A",cursor:"pointer"}}><span style={{color:"#7AA0D4",fontSize:14,fontWeight:600}}>{label}</span><div style={{width:44,height:24,borderRadius:12,background:active?ACCENT:"#2C2C2E",position:"relative",transition:"background 0.2s",border:"1px solid #1A3A7A",flexShrink:0}}><div style={{position:"absolute",top:2,left:active?20:2,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/></div></div>;
}
function DireccionField({value,onChange}:{value:string;onChange:(v:string)=>void}) {
  return <Field label="Dirección"><div style={{display:"flex",gap:8}}><input style={{...S.input,flex:1}} value={value} onChange={e=>onChange(e.target.value)} placeholder="Ej: Calle Mayor 14, Alicante"/>{value.trim()&&<a href={mapsUrl(value)} target="_blank" rel="noreferrer" style={{background:ACCENT,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",width:42,flexShrink:0,textDecoration:"none",fontSize:18}}>📍</a>}</div></Field>;
}
function Modal({title,onClose,children,zIndex=100}:{title:string;onClose:()=>void;children:React.ReactNode;zIndex?:number}) {
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex,display:"flex",alignItems:"flex-end",justifyContent:"center"}}><div style={{background:"#0A1F4E",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,padding:"24px 20px 40px",maxHeight:"90vh",overflowY:"auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><span style={{fontWeight:700,fontSize:17,color:"#EEF2FF"}}>{title}</span><button onClick={onClose} style={{background:"#0D2259",border:"1px solid #1A3A7A",borderRadius:8,color:"#7AA0D4",padding:"6px 10px",cursor:"pointer",fontSize:16}}>✕</button></div>{children}</div></div>;
}
function ConfirmModal({msg,onConfirm,onCancel}:{msg:string;onConfirm:()=>void;onCancel:()=>void}) {
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><div style={{background:"#0A1F4E",borderRadius:16,padding:24,maxWidth:360,width:"100%",border:"1px solid #1A3A7A"}}><div style={{fontSize:15,color:"#EEF2FF",marginBottom:20,lineHeight:1.5}}>{msg}</div><div style={{display:"flex",gap:10}}><button onClick={onCancel} style={{...S.btnGhost,flex:1}}>Cancelar</button><button onClick={onConfirm} style={{...S.btnPrim,flex:1,background:"#DC2626"}}>Confirmar</button></div></div></div>;
}
function FAB({onClick}:{onClick:()=>void}) {
  return <button onClick={onClick} style={{position:"fixed",bottom:90,right:20,width:52,height:52,borderRadius:"50%",background:ACCENT,border:"none",color:"#fff",fontSize:24,cursor:"pointer",boxShadow:"0 4px 20px #1E7FD855",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>;
}
function StatCard({label,value,color}:{label:string;value:string|number;color:string}) {
  return <div style={{background:color+"15",border:`1px solid ${color}30`,borderRadius:12,padding:"12px 14px"}}><div style={{fontSize:11,color,fontWeight:700,letterSpacing:0.5,textTransform:"uppercase",marginBottom:4}}>{label}</div><div style={{fontSize:22,fontWeight:800,color:"#EEF2FF"}}>{value}</div></div>;
}
function FilterPills({options,active,onChange}:{options:[string,string][];active:string;onChange:(k:string)=>void}) {
  return <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,paddingBottom:4}}>{options.map(([k,label])=><button key={k} onClick={()=>onChange(k)} style={{border:"none",borderRadius:20,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",background:active===k?ACCENT:"#0D2259",color:active===k?"#fff":"#7AA0D4"}}>{label}</button>)}</div>;
}
function MapsLink({direccion}:{direccion?:string}) {
  if(!direccion) return null;
  return <a href={mapsUrl(direccion)} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",gap:8,background:"#0D2259",borderRadius:10,padding:"10px 14px",marginBottom:14,textDecoration:"none",border:"1px solid #1A3A7A"}}><span style={{fontSize:18}}>📍</span><span style={{fontSize:13,color:"#93B4E8",flex:1}}>{direccion}</span><span style={{fontSize:11,color:ACCENT,fontWeight:700}}>MAPS →</span></a>;
}
function ExpandableNote({text}:{text:string}) {
  const [exp,setExp]=useState(false);
  const long=text.length>80;
  return <div onClick={()=>long&&setExp(!exp)} style={{background:"#0D2259",borderRadius:10,padding:12,marginBottom:14,fontSize:13,color:"#93B4E8",border:"1px solid #1A3A7A",cursor:long?"pointer":"default"}}>📝 {exp||!long?text:text.slice(0,80)+"..."}{long&&<span style={{color:ACCENT,fontSize:11,marginLeft:6}}>{exp?"ver menos":"ver más"}</span>}</div>;
}
function Empty(){return <div style={{color:"#3A5A9A",textAlign:"center",padding:"30px 0",fontSize:14}}>Sin registros en esta categoría</div>;}
function Spinner(){return <div style={{color:"#3A5A9A",textAlign:"center",padding:"30px 0",fontSize:13}}>Cargando...</div>;}
function ErrBanner({msg,onClose}:{msg:string;onClose:()=>void}){
  return <div style={{background:"#7F1D1D",border:"1px solid #DC2626",borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13,color:"#FCA5A5"}}>⚠️ {msg}</span><button onClick={onClose} style={{background:"none",border:"none",color:"#FCA5A5",cursor:"pointer",fontSize:16}}>✕</button></div>;
}

function ItemsEditor({items,onChange}:{items:Item[];onChange:(items:Item[])=>void}) {
  const subtotal=calcTotalItems(items);
  const add=()=>onChange([...items,{...ITEM_BLANK,orden:items.length}]);
  const remove=(i:number)=>onChange(items.filter((_,idx)=>idx!==i));
  const update=(i:number,field:keyof Item,value:string|number)=>onChange(items.map((item,idx)=>idx===i?{...item,[field]:value}:item));
  return <div style={{marginBottom:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <label style={{fontSize:11,fontWeight:600,color:"#7AA0D4",letterSpacing:0.5,textTransform:"uppercase"}}>Items del presupuesto</label>
      <button onClick={add} style={{background:ACCENT,border:"none",borderRadius:8,color:"#fff",padding:"4px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Añadir</button>
    </div>
    {items.length===0&&<div style={{color:"#3A5A9A",fontSize:13,padding:"8px 0"}}>Sin items — tocá "+ Añadir" para empezar</div>}
    {items.map((item,i)=>(
      <div key={i} style={{background:"#0D2259",border:"1px solid #1A3A7A",borderRadius:10,padding:12,marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:12,color:"#7AA0D4",fontWeight:600}}>Item {i+1}</span>
          <button onClick={()=>remove(i)} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:16,padding:0}}>✕</button>
        </div>
        <input style={{...S.input,marginBottom:8}} value={item.descripcion} onChange={e=>update(i,"descripcion",e.target.value)} placeholder="Descripción del item"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div><label style={{display:"block",fontSize:10,color:"#7AA0D4",marginBottom:4}}>CANTIDAD</label><input style={S.input} type="number" min="1" value={item.cantidad} onChange={e=>update(i,"cantidad",Number(e.target.value))}/></div>
          <div><label style={{display:"block",fontSize:10,color:"#7AA0D4",marginBottom:4}}>PRECIO UNIT. (€)</label><input style={S.input} type="number" min="0" step="0.01" value={item.precio_unitario} onChange={e=>update(i,"precio_unitario",Number(e.target.value))}/></div>
        </div>
        <div style={{textAlign:"right",fontSize:13,color:ACCENT,fontWeight:700,marginTop:6}}>{(item.cantidad*item.precio_unitario).toFixed(2)}€</div>
      </div>
    ))}
    {items.length>0&&<div style={{background:"#0D2259",borderRadius:10,padding:"10px 14px",border:"1px solid #1A3A7A"}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#7AA0D4",fontSize:13}}>Subtotal</span><span style={{color:"#EEF2FF",fontSize:13,fontWeight:700}}>{subtotal.toFixed(2)}€</span></div></div>}
  </div>;
}

function FacturaModal({registro,tipo,items,onClose}:{registro:Record<string,unknown>;tipo:"PR"|"FV";items:Item[];onClose:()=>void}) {
  const [emailCliente,setEmailCliente]=useState(registro.email_cliente as string||"");
  const [dirCli,setDirCli]=useState(registro.direccion_cliente as string||registro.direccion as string||"");
  const [nifCli,setNifCli]=useState(registro.nif_cliente as string||"");
  const [sending,setSending]=useState(false);
  const [generando,setGenerando]=useState(false);
  const [emailDone,setEmailDone]=useState(false);
  const [err,setErr]=useState<string|null>(null);
  const [numeroDoc,setNumeroDoc]=useState<string>(registro.numero_doc as string||"");
  useEffect(()=>{
    if(registro.numero_doc)return;
    getNumeroDoc(tipo).then(n=>{setNumeroDoc(n);dbUpdate(tipo==="PR"?"presupuestos":"trabajos",registro.id as string,{numero_doc:n}).catch(console.error);});
  },[registro,tipo]);
  const subtotal=calcTotalItems(items);
  const iva=registro.tiene_iva?subtotal*IVA:0;
  const total=subtotal+iva;
  const factura:Record<string,unknown>={numeroDoc,tipo,fecha:registro.fecha,cliente:registro.cliente,direccionCliente:dirCli,nifCliente:nifCli,servicio:registro.servicio,descripcion:registro.nota,tieneIva:registro.tiene_iva};
  const handlePDF=async()=>{setGenerando(true);setErr(null);try{await generarPDF(factura,items);}catch(e){setErr(String(e));}setGenerando(false);};
  const handleEmail=async()=>{if(!emailCliente.trim()){setErr("Ingresá el email del cliente");return;}setSending(true);setErr(null);const ok=await enviarFacturaEmail(emailCliente,{...factura,items});setSending(false);if(ok)setEmailDone(true);else setErr("Error al enviar.");};
  return <Modal title="Generar factura" onClose={onClose} zIndex={200}>
    {err&&<ErrBanner msg={err} onClose={()=>setErr(null)}/>}
    {emailDone&&<div style={{background:"#064E3B",border:"1px solid #059669",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#6EE7B7"}}>✅ Email enviado correctamente</div>}
    <div style={{background:"#0D2259",borderRadius:10,padding:"10px 14px",marginBottom:16,border:"1px solid #1A3A7A"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#7AA0D4",fontSize:13}}>Número</span><span style={{color:"#EEF2FF",fontSize:13,fontWeight:700}}>{numeroDoc||"Generando..."}</span></div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:registro.tiene_iva?4:0}}><span style={{color:"#7AA0D4",fontSize:13}}>Subtotal</span><span style={{color:"#EEF2FF",fontSize:13}}>{subtotal.toFixed(2)}€</span></div>
      {registro.tiene_iva&&<><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#7AA0D4",fontSize:13}}>IVA 21%</span><span style={{color:"#EEF2FF",fontSize:13}}>{iva.toFixed(2)}€</span></div><div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1A3A7A",paddingTop:6}}><span style={{color:"#EEF2FF",fontSize:14,fontWeight:700}}>Total</span><span style={{color:ACCENT,fontSize:15,fontWeight:800}}>{total.toFixed(2)}€</span></div></>}
    </div>
    <Field label="Dirección del cliente (opcional)"><input style={S.input} value={dirCli} onChange={e=>setDirCli(e.target.value)} placeholder="Calle, número, ciudad"/></Field>
    <Field label="NIF del cliente (opcional)"><input style={S.input} value={nifCli} onChange={e=>setNifCli(e.target.value)} placeholder="Si está vacío aparece 'Contado'"/></Field>
    <Field label="Email del cliente (para envío)"><input style={S.input} type="email" value={emailCliente} onChange={e=>setEmailCliente(e.target.value)} placeholder="cliente@email.com"/></Field>
    <div style={{display:"flex",gap:10,marginTop:4}}>
      <button onClick={handlePDF} disabled={generando} style={{...S.btnGhost,flex:1,opacity:generando?0.7:1}}>{generando?"Generando...":"📄 PDF"}</button>
      <button onClick={handleEmail} disabled={sending} style={{...S.btnPrim,flex:1,opacity:sending?0.7:1}}>{sending?"Enviando...":"📧 Email"}</button>
    </div>
  </Modal>;
}

// ─── PRESUPUESTOS ──────────────────────────────────────────────────────────────
function PresupuestosTab({onCrearTrabajo}:{onCrearTrabajo:(p:Record<string,unknown>)=>void}) {
  const [data,setData]=useState<Record<string,unknown>[]>([]);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState<string|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [editing,setEditing]=useState<Record<string,unknown>|null>(null);
  const [filter,setFilter]=useState("all");
  const [detail,setDetail]=useState<Record<string,unknown>|null>(null);
  const [saving,setSaving]=useState(false);
  const [confirmDel,setConfirmDel]=useState<string|null>(null);
  const [confirmTrabajo,setConfirmTrabajo]=useState<Record<string,unknown>|null>(null);
  const [showFactura,setShowFactura]=useState<Record<string,unknown>|null>(null);
  const [facturaItems,setFacturaItems]=useState<Item[]>([]);
  const [items,setItems]=useState<Item[]>([{...ITEM_BLANK}]);
  const blank={cliente:"",zona:ZONAS[0],direccion:"",servicio:SERVICIOS[0],estado:"pendiente",fecha:new Date().toISOString().slice(0,10),nota:"",tiene_iva:false,email_cliente:"",direccion_cliente:"",nif_cliente:""};
  const [form,setForm]=useState<Record<string,unknown>>(blank);

  const load=useCallback(async()=>{try{setLoading(true);setData(await dbGet("presupuestos"));}catch(e){setErr((e as Error).message);}finally{setLoading(false);}},[] );
  useEffect(()=>{load();},[load]);

  const filtered=filter==="all"?data:data.filter(p=>p.estado===filter);
  const totalAcep=data.filter(p=>p.estado==="aceptado").reduce((a,p)=>a+Number(p.importe||0),0);
  const nPend=data.filter(p=>p.estado==="pendiente").length;

  const openNew=()=>{setEditing(null);setForm(blank);setItems([{...ITEM_BLANK}]);setShowForm(true);};
  const openEdit=async(p:Record<string,unknown>)=>{
    setEditing(p);setForm({...p});
    try{const ei=await dbGet("presupuesto_items",`&presupuesto_id=eq.${p.id}&order=orden.asc`);setItems(ei.length>0?ei:[{...ITEM_BLANK}]);}catch{setItems([{...ITEM_BLANK}]);}
    setShowForm(true);setDetail(null);
  };
  const submit=async()=>{
    if(!(form.cliente as string).trim())return;setSaving(true);
    try{
      const subtotal=calcTotalItems(items);
      const totalFinal=form.tiene_iva?subtotal*(1+IVA):subtotal;
      const formFinal={...form,importe:totalFinal};
      let pid:string;
      if(editing){const u=await dbUpdate("presupuestos",editing.id as string,formFinal);setData(d=>d.map(p=>p.id===editing.id?u:p));pid=editing.id as string;await dbDeleteWhere("presupuesto_items","presupuesto_id",pid);}
      else{const u=await dbInsert("presupuestos",formFinal);setData(d=>[u,...d]);pid=u.id;}
      for(let i=0;i<items.length;i++){if(items[i].descripcion.trim()){await dbInsert("presupuesto_items",{presupuesto_id:pid,descripcion:items[i].descripcion,cantidad:items[i].cantidad,precio_unitario:items[i].precio_unitario,orden:i});}}
      setShowForm(false);
    }catch(e){setErr((e as Error).message);}finally{setSaving(false);}
  };
  const del=async(id:string)=>{try{await dbDelete("presupuestos",id);setData(d=>d.filter(p=>p.id!==id));setDetail(null);setConfirmDel(null);}catch(e){setErr((e as Error).message);}};
  const changeEstado=async(id:string,estado:string)=>{
    try{await dbUpdate("presupuestos",id,{estado});setData(d=>d.map(p=>p.id===id?{...p,estado}:p));setDetail(d=>d?{...d,estado}:null);
    if(estado==="aceptado"){const pres=data.find(p=>p.id===id);if(pres)setConfirmTrabajo({...pres,estado:"aceptado"});}}catch(e){setErr((e as Error).message);}
  };
  const abrirFactura=async(p:Record<string,unknown>)=>{
    try{const pi=await dbGet("presupuesto_items",`&presupuesto_id=eq.${p.id}&order=orden.asc`);setFacturaItems(pi);}catch{setFacturaItems([]);}
    setShowFactura(p);
  };

  return <div>
    {err&&<ErrBanner msg={err} onClose={()=>setErr(null)}/>}
    {confirmDel&&<ConfirmModal msg="¿Eliminar este presupuesto?" onConfirm={()=>del(confirmDel)} onCancel={()=>setConfirmDel(null)}/>}
    {confirmTrabajo&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><div style={{background:"#0A1F4E",borderRadius:16,padding:24,maxWidth:360,width:"100%",border:"1px solid #1A3A7A"}}><div style={{fontSize:15,color:"#EEF2FF",marginBottom:8,fontWeight:700}}>✅ Presupuesto aceptado</div><div style={{fontSize:14,color:"#7AA0D4",marginBottom:20}}>¿Crear un trabajo a partir de este presupuesto?</div><div style={{display:"flex",gap:10}}><button onClick={()=>setConfirmTrabajo(null)} style={{...S.btnGhost,flex:1}}>No por ahora</button><button onClick={()=>{onCrearTrabajo(confirmTrabajo!);setConfirmTrabajo(null);setDetail(null);}} style={{...S.btnPrim,flex:1}}>Crear trabajo</button></div></div></div>}
    {showFactura&&<FacturaModal registro={showFactura} tipo="PR" items={facturaItems} onClose={()=>setShowFactura(null)}/>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
      <StatCard label="Aceptados" value={`${totalAcep.toFixed(2)}€`} color="#059669"/>
      <StatCard label="Pendientes" value={nPend} color="#D97706"/>
    </div>
    <FilterPills options={[["all","Todos"],...Object.entries(ESTADOS_P).map(([k,v])=>[k,v.label] as [string,string])]} active={filter} onChange={setFilter}/>
    {loading?<Spinner/>:<div style={{display:"flex",flexDirection:"column",gap:8}}>
      {filtered.length===0&&<Empty/>}
      {filtered.map(p=>(
        <div key={p.id as string} onClick={()=>setDetail(p)} style={{background:"#0A1F4E",border:"1px solid #1A3A7A",borderRadius:14,padding:14,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontWeight:700,fontSize:15,color:"#EEF2FF"}}>{p.cliente as string}</span>
            <div style={{textAlign:"right"}}><span style={{fontWeight:800,fontSize:15,color:ACCENT}}>{p.importe?`${Number(p.importe).toFixed(2)}€`:"—"}</span>{p.tiene_iva&&<span style={{display:"block",fontSize:10,color:"#7AA0D4"}}>c/IVA</span>}</div>
          </div>
          <div style={{fontSize:13,color:"#7AA0D4",marginBottom:8}}>{p.servicio as string} · {p.zona as string}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><Badge estado={p.estado as string} map={ESTADOS_P}/><span style={{fontSize:12,color:"#3A5A9A"}}>{fmt(p.fecha as string)}</span></div>
        </div>
      ))}
    </div>}
    <FAB onClick={openNew}/>
    {detail&&<Modal title="Presupuesto" onClose={()=>setDetail(null)}>
      <div style={{marginBottom:16}}><div style={{fontSize:20,fontWeight:800,color:"#EEF2FF",marginBottom:4}}>{detail.cliente as string}</div><div style={{fontSize:14,color:"#7AA0D4"}}>{detail.servicio as string} · {detail.zona as string}</div></div>
      <MapsLink direccion={detail.direccion as string}/>
      <div style={{background:"#0D2259",borderRadius:10,padding:14,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#7AA0D4",fontSize:13}}>Total {detail.tiene_iva?"(c/IVA)":"(sin IVA)"}</span><span style={{color:ACCENT,fontWeight:800,fontSize:16}}>{detail.importe?`${Number(detail.importe).toFixed(2)}€`:"—"}</span></div>
        <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#7AA0D4",fontSize:13}}>Fecha</span><span style={{color:"#EEF2FF",fontSize:13}}>{fmt(detail.fecha as string)}</span></div>
      </div>
      {detail.nota&&<ExpandableNote text={detail.nota as string}/>}
      <Field label="Cambiar estado"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>{Object.entries(ESTADOS_P).map(([k,v])=><button key={k} onClick={()=>changeEstado(detail.id as string,k)} style={{border:`1px solid ${v.color}55`,borderRadius:8,padding:"8px 6px",background:detail.estado===k?v.color+"22":"transparent",color:v.color,fontSize:12,fontWeight:700,cursor:"pointer"}}>{v.label}</button>)}</div></Field>
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <button onClick={()=>openEdit(detail)} style={{...S.btnGhost,flex:1}}>✏️ Editar</button>
        <button onClick={()=>abrirFactura(detail)} style={{...S.btnGhost,flex:1}}>🧾 Factura</button>
        <button onClick={()=>setConfirmDel(detail.id as string)} style={{...S.btnGhost,flex:1,color:"#DC2626",borderColor:"#DC262640"}}>🗑️</button>
      </div>
    </Modal>}
    {showForm&&<Modal title={editing?"Editar presupuesto":"Nuevo presupuesto"} onClose={()=>setShowForm(false)}>
      <Field label="Cliente"><input style={S.input} value={form.cliente as string} onChange={e=>setForm({...form,cliente:e.target.value})} placeholder="Nombre del cliente"/></Field>
      <Field label="Zona"><select style={S.select} value={form.zona as string} onChange={e=>setForm({...form,zona:e.target.value})}>{ZONAS.map(z=><option key={z}>{z}</option>)}</select></Field>
      <DireccionField value={(form.direccion as string)||""} onChange={v=>setForm({...form,direccion:v})}/>
      <Field label="Servicio"><select style={S.select} value={form.servicio as string} onChange={e=>setForm({...form,servicio:e.target.value})}>{SERVICIOS.map(s=><option key={s}>{s}</option>)}</select></Field>
      <ItemsEditor items={items} onChange={setItems}/>
      <Toggle active={!!form.tiene_iva} onChange={()=>setForm({...form,tiene_iva:!form.tiene_iva})} label="Aplicar IVA 21%"/>
      {form.tiene_iva&&items.length>0&&(()=>{const sub=calcTotalItems(items);const iv=sub*IVA;return <div style={{background:"#0D2259",borderRadius:10,padding:"10px 14px",marginBottom:14,border:"1px solid #1A3A7A"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#7AA0D4",fontSize:13}}>IVA 21%</span><span style={{color:"#EEF2FF",fontSize:13}}>{iv.toFixed(2)}€</span></div><div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1A3A7A",paddingTop:6}}><span style={{color:"#EEF2FF",fontSize:14,fontWeight:700}}>Total</span><span style={{color:ACCENT,fontSize:16,fontWeight:800}}>{(sub+iv).toFixed(2)}€</span></div></div>;})()} 
      <Field label="Estado"><select style={S.select} value={form.estado as string} onChange={e=>setForm({...form,estado:e.target.value})}>{Object.entries(ESTADOS_P).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></Field>
      <Field label="Fecha"><input style={S.input} type="date" value={form.fecha as string} onChange={e=>setForm({...form,fecha:e.target.value})}/></Field>
      <Field label="Nota"><textarea style={{...S.input,minHeight:70,resize:"vertical"}} value={form.nota as string} onChange={e=>setForm({...form,nota:e.target.value})} placeholder="Observaciones adicionales..."/></Field>
      <button onClick={submit} disabled={saving} style={{...S.btnPrim,opacity:saving?0.7:1}}>{saving?"Guardando...":editing?"Guardar cambios":"Añadir presupuesto"}</button>
    </Modal>}
  </div>;
}

// ─── MATERIALES ────────────────────────────────────────────────────────────────
function MaterialesTab() {
  const [data,setData]=useState<Record<string,unknown>[]>([]);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState<string|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [filter,setFilter]=useState("pendiente");
  const [notifOk,setNotifOk]=useState(typeof Notification!=="undefined"&&Notification.permission==="granted");
  const [banner,setBanner]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [confirmDel,setConfirmDel]=useState<string|null>(null);
  const [form,setForm]=useState({item:"",cantidad:"",urgente:false,comprado:false,nota:""});
  const load=useCallback(async()=>{try{setLoading(true);setData(await dbGet("materiales"));}catch(e){setErr((e as Error).message);}finally{setLoading(false);}},[] );
  useEffect(()=>{load();},[load]);
  const pendientes=data.filter(m=>!m.comprado),comprados=data.filter(m=>m.comprado);
  const urgentes=pendientes.filter(m=>m.urgente).length;
  const shown=filter==="pendiente"?pendientes:comprados;
  const showBanner=(item:string)=>{setBanner(item);setTimeout(()=>setBanner(null),4000);};
  const toggle=async(id:string,field:string)=>{const prev=data.find(m=>m.id===id);if(!prev)return;const val=!prev[field];try{await dbUpdate("materiales",id,{[field]:val});setData(d=>d.map(m=>m.id===id?{...m,[field]:val}:m));if(field==="urgente"&&val){if(notifOk)fireNotif("⚡ Material urgente — Bayres",`${prev.item as string} marcado como urgente`);showBanner(prev.item as string);notificarUrgenteTodos();}}catch(e){setErr((e as Error).message);}};
  const del=async(id:string)=>{try{await dbDelete("materiales",id);setData(d=>d.filter(m=>m.id!==id));setConfirmDel(null);}catch(e){setErr((e as Error).message);}};
  const submit=async()=>{if(!form.item.trim())return;setSaving(true);try{const u=await dbInsert("materiales",form);setData(d=>[u,...d]);if(form.urgente){if(notifOk)fireNotif("⚡ Material urgente — Bayres",`${form.item} añadido como urgente`);showBanner(form.item);notificarUrgenteTodos();}setShowForm(false);setForm({item:"",cantidad:"",urgente:false,comprado:false,nota:""});}catch(e){setErr((e as Error).message);}finally{setSaving(false);}};
  return <div>
    {err&&<ErrBanner msg={err} onClose={()=>setErr(null)}/>}
    {confirmDel&&<ConfirmModal msg="¿Eliminar este material?" onConfirm={()=>del(confirmDel)} onCancel={()=>setConfirmDel(null)}/>}
    {banner&&<div style={{background:"#7F1D1D",border:"1px solid #DC2626",borderRadius:12,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:18}}>⚡</span><div><div style={{fontWeight:700,fontSize:13,color:"#FCA5A5"}}>Material urgente</div><div style={{fontSize:12,color:"#F87171"}}>{banner} — aviso enviado al equipo</div></div></div>}
    {!notifOk&&<button onClick={async()=>setNotifOk(await registerPushSubscription())} style={{width:"100%",background:"#0D2259",border:"1px dashed #1E7FD8",borderRadius:12,padding:"10px 14px",marginBottom:14,color:"#7AA0D4",fontSize:13,cursor:"pointer",textAlign:"left"}}>🔔 Activar notificaciones push para alertas de urgente</button>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
      <StatCard label="Urgentes" value={urgentes} color="#DC2626"/>
      <StatCard label="Por comprar" value={pendientes.length} color={ACCENT}/>
    </div>
    <FilterPills options={[["pendiente","Por comprar"],["comprado","Comprado"]]} active={filter} onChange={setFilter}/>
    {loading?<Spinner/>:<div style={{display:"flex",flexDirection:"column",gap:8}}>
      {shown.length===0&&<Empty/>}
      {shown.map(m=>(
        <div key={m.id as string} style={{background:"#0A1F4E",border:`1px solid ${m.urgente&&!m.comprado?"#DC262640":"#1A3A7A"}`,borderRadius:14,padding:14,display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>toggle(m.id as string,"comprado")} style={{width:28,height:28,borderRadius:"50%",border:`2px solid ${m.comprado?"#059669":"#1A3A7A"}`,background:m.comprado?"#059669":"transparent",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff"}}>{m.comprado?"✓":""}</button>
          <div style={{flex:1,minWidth:0}}>
            {m.urgente&&!m.comprado&&<div style={{fontSize:10,color:"#DC2626",fontWeight:700,letterSpacing:0.5,marginBottom:2}}>⚡ URGENTE</div>}
            <div style={{fontWeight:700,fontSize:15,color:m.comprado?"#3A5A9A":"#EEF2FF",textDecoration:m.comprado?"line-through":"none"}}>{m.item as string}</div>
            <div style={{fontSize:13,color:"#4A6A9A"}}>{m.cantidad as string}{m.nota?` · ${m.nota as string}`:""}</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            {!m.comprado&&<button onClick={()=>toggle(m.id as string,"urgente")} style={{background:m.urgente?"#DC262620":"#0D2259",border:`1px solid ${m.urgente?"#DC262660":"#1A3A7A"}`,borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:14}}>⚡</button>}
            <button onClick={()=>setConfirmDel(m.id as string)} style={{background:"#0D2259",border:"1px solid #1A3A7A",borderRadius:8,padding:"6px 8px",cursor:"pointer",fontSize:14}}>🗑️</button>
          </div>
        </div>
      ))}
    </div>}
    <FAB onClick={()=>setShowForm(true)}/>
    {showForm&&<Modal title="Añadir material" onClose={()=>setShowForm(false)}>
      <Field label="Material"><input style={S.input} value={form.item} onChange={e=>setForm({...form,item:e.target.value})} placeholder="Ej: Ejes 19mm, cintas 18mm beige..."/></Field>
      <Field label="Cantidad"><input style={S.input} value={form.cantidad} onChange={e=>setForm({...form,cantidad:e.target.value})} placeholder="Ej: 10 uds, 3 rollos..."/></Field>
      <Field label="Nota (tienda, referencia...)"><input style={S.input} value={form.nota} onChange={e=>setForm({...form,nota:e.target.value})} placeholder="Ferretería Roca, ref. 0012..."/></Field>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,background:"#0D2259",borderRadius:10,padding:"12px 14px",border:"1px solid #1A3A7A"}}>
        <input type="checkbox" id="urgente" checked={form.urgente} onChange={e=>setForm({...form,urgente:e.target.checked})} style={{width:18,height:18,cursor:"pointer"} as React.CSSProperties}/>
        <label htmlFor="urgente" style={{color:"#FCA5A5",fontWeight:600,fontSize:14,cursor:"pointer"}}>⚡ Marcar como urgente</label>
      </div>
      <button onClick={submit} disabled={saving} style={{...S.btnPrim,opacity:saving?0.7:1}}>{saving?"Guardando...":"Añadir a la lista"}</button>
    </Modal>}
  </div>;
}

// ─── TRABAJOS ──────────────────────────────────────────────────────────────────
function TrabajosTab({precargar}:{precargar:Record<string,unknown>|null}) {
  const [data,setData]=useState<Record<string,unknown>[]>([]);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState<string|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [editing,setEditing]=useState<Record<string,unknown>|null>(null);
  const [filter,setFilter]=useState("all");
  const [detail,setDetail]=useState<Record<string,unknown>|null>(null);
  const [saving,setSaving]=useState(false);
  const [confirmDel,setConfirmDel]=useState<string|null>(null);
  const [showFactura,setShowFactura]=useState<Record<string,unknown>|null>(null);
  const [facturaItems,setFacturaItems]=useState<Item[]>([]);
  const blank={cliente:"",zona:ZONAS[0],direccion:"",servicio:SERVICIOS[0],estado:"pendiente",fecha:new Date().toISOString().slice(0,10),nota:"",hora_inicio:"",email_cliente:"",direccion_cliente:"",nif_cliente:"",tiene_iva:false,importe:""};
  const [form,setForm]=useState<Record<string,unknown>>(blank);
  const load=useCallback(async()=>{try{setLoading(true);setData(await dbGet("trabajos"));}catch(e){setErr((e as Error).message);}finally{setLoading(false);}},[] );
  useEffect(()=>{load();},[load]);
  useEffect(()=>{if(!precargar)return;setForm({...blank,cliente:precargar.cliente,zona:precargar.zona,direccion:precargar.direccion||"",servicio:precargar.servicio,nota:precargar.nota||"",email_cliente:precargar.email_cliente||"",tiene_iva:precargar.tiene_iva||false,importe:precargar.importe||""});setEditing(null);setShowForm(true);},[precargar]);
  const filtered=filter==="all"?data:data.filter(t=>t.estado===filter);
  const enCurso=data.filter(t=>t.estado==="en_curso").length;
  const hoy=data.filter(t=>t.fecha===new Date().toISOString().slice(0,10)).length;
  const openNew=()=>{setEditing(null);setForm(blank);setShowForm(true);};
  const openEdit=(t:Record<string,unknown>)=>{setEditing(t);setForm({...t});setShowForm(true);setDetail(null);};
  const submit=async()=>{if(!(form.cliente as string).trim())return;setSaving(true);try{if(editing){const u=await dbUpdate("trabajos",editing.id as string,form);setData(d=>d.map(t=>t.id===editing.id?u:t));}else{const u=await dbInsert("trabajos",form);setData(d=>[u,...d]);}setShowForm(false);}catch(e){setErr((e as Error).message);}finally{setSaving(false);}};
  const del=async(id:string)=>{try{await dbDelete("trabajos",id);setData(d=>d.filter(t=>t.id!==id));setDetail(null);setConfirmDel(null);}catch(e){setErr((e as Error).message);}};
  const changeEstado=async(id:string,estado:string)=>{try{await dbUpdate("trabajos",id,{estado});setData(d=>d.map(t=>t.id===id?{...t,estado}:t));setDetail(d=>d?{...d,estado}:null);}catch(e){setErr((e as Error).message);}};
  const abrirFactura=(t:Record<string,unknown>)=>{const its:Item[]=t.importe?[{descripcion:t.servicio as string,cantidad:1,precio_unitario:Number(t.importe),orden:0}]:[];setFacturaItems(its);setShowFactura(t);};
  return <div>
    {err&&<ErrBanner msg={err} onClose={()=>setErr(null)}/>}
    {confirmDel&&<ConfirmModal msg="¿Eliminar este trabajo?" onConfirm={()=>del(confirmDel)} onCancel={()=>setConfirmDel(null)}/>}
    {showFactura&&<FacturaModal registro={showFactura} tipo="FV" items={facturaItems} onClose={()=>setShowFactura(null)}/>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
      <StatCard label="En curso" value={enCurso} color={ACCENT}/>
      <StatCard label="Hoy" value={hoy} color="#059669"/>
    </div>
    <FilterPills options={[["all","Todos"],...Object.entries(ESTADOS_T).map(([k,v])=>[k,v.label] as [string,string])]} active={filter} onChange={setFilter}/>
    {loading?<Spinner/>:<div style={{display:"flex",flexDirection:"column",gap:8}}>
      {filtered.length===0&&<Empty/>}
      {filtered.map(t=>(
        <div key={t.id as string} onClick={()=>setDetail(t)} style={{background:"#0A1F4E",border:"1px solid #1A3A7A",borderRadius:14,padding:14,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontWeight:700,fontSize:15,color:"#EEF2FF"}}>{t.cliente as string}</span>
            <div style={{textAlign:"right"}}><span style={{fontSize:12,color:"#3A5A9A"}}>{fmt(t.fecha as string)}</span>{t.hora_inicio&&<span style={{display:"block",fontSize:11,color:"#7AA0D4"}}>🕐 {t.hora_inicio as string}</span>}</div>
          </div>
          <div style={{fontSize:13,color:"#7AA0D4",marginBottom:8}}>{t.servicio as string} · {t.zona as string}</div>
          <Badge estado={t.estado as string} map={ESTADOS_T}/>
        </div>
      ))}
    </div>}
    <FAB onClick={openNew}/>
    {detail&&<Modal title="Trabajo" onClose={()=>setDetail(null)}>
      <div style={{marginBottom:16}}><div style={{fontSize:20,fontWeight:800,color:"#EEF2FF",marginBottom:4}}>{detail.cliente as string}</div><div style={{fontSize:14,color:"#7AA0D4"}}>{detail.servicio as string} · {detail.zona as string} · {fmt(detail.fecha as string)}{detail.hora_inicio?` · 🕐 ${detail.hora_inicio as string}`:""}</div></div>
      <MapsLink direccion={detail.direccion as string}/>
      {detail.nota&&<ExpandableNote text={detail.nota as string}/>}
      <Field label="Cambiar estado"><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>{Object.entries(ESTADOS_T).map(([k,v])=><button key={k} onClick={()=>changeEstado(detail.id as string,k)} style={{border:`1px solid ${v.color}55`,borderRadius:8,padding:"8px 6px",background:detail.estado===k?v.color+"22":"transparent",color:v.color,fontSize:12,fontWeight:700,cursor:"pointer"}}>{v.label}</button>)}</div></Field>
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <button onClick={()=>openEdit(detail)} style={{...S.btnGhost,flex:1}}>✏️ Editar</button>
        <button onClick={()=>abrirFactura(detail)} style={{...S.btnGhost,flex:1}}>🧾 Factura</button>
        <button onClick={()=>setConfirmDel(detail.id as string)} style={{...S.btnGhost,flex:1,color:"#DC2626",borderColor:"#DC262640"}}>🗑️</button>
      </div>
    </Modal>}
    {showForm&&<Modal title={editing?"Editar trabajo":"Nuevo trabajo"} onClose={()=>setShowForm(false)}>
      <Field label="Cliente"><input style={S.input} value={form.cliente as string} onChange={e=>setForm({...form,cliente:e.target.value})} placeholder="Nombre del cliente"/></Field>
      <Field label="Zona"><select style={S.select} value={form.zona as string} onChange={e=>setForm({...form,zona:e.target.value})}>{ZONAS.map(z=><option key={z}>{z}</option>)}</select></Field>
      <DireccionField value={(form.direccion as string)||""} onChange={v=>setForm({...form,direccion:v})}/>
      <Field label="Servicio"><select style={S.select} value={form.servicio as string} onChange={e=>setForm({...form,servicio:e.target.value})}>{SERVICIOS.map(s=><option key={s}>{s}</option>)}</select></Field>
      <Field label="Estado"><select style={S.select} value={form.estado as string} onChange={e=>setForm({...form,estado:e.target.value})}>{Object.entries(ESTADOS_T).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></Field>
      <Field label="Fecha"><input style={S.input} type="date" value={form.fecha as string} onChange={e=>setForm({...form,fecha:e.target.value})}/></Field>
      <Field label="Hora de inicio"><input style={S.input} type="time" value={(form.hora_inicio as string)||""} onChange={e=>setForm({...form,hora_inicio:e.target.value})}/></Field>
      <Field label="Importe (€)"><input style={S.input} type="number" value={(form.importe as string)||""} onChange={e=>setForm({...form,importe:e.target.value})} placeholder="0"/></Field>
      <Field label="Nota"><textarea style={{...S.input,minHeight:70,resize:"vertical"}} value={form.nota as string} onChange={e=>setForm({...form,nota:e.target.value})} placeholder="Observaciones, acceso, materiales..."/></Field>
      <button onClick={submit} disabled={saving} style={{...S.btnPrim,opacity:saving?0.7:1}}>{saving?"Guardando...":editing?"Guardar cambios":"Añadir trabajo"}</button>
    </Modal>}
  </div>;
}

// ─── ROOT ──────────────────────────────────────────────────────────────────────
export default function GestionApp() {
  const [tab,setTab]=useState("presupuestos");
  const [trabajoPrecar,setTrabajoPrecar]=useState<Record<string,unknown>|null>(null);
  const [splashDone,setSplashDone]=useState(false);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const t=params.get("tab");
    if(t&&VALID_TABS.includes(t))setTab(t);
  },[]);

  const TABS=[
    {key:"presupuestos",label:"Presupuestos",icon:"📋"},
    {key:"materiales",  label:"Compras",      icon:"🛒"},
    {key:"trabajos",    label:"Trabajos",      icon:"🔧"},
  ];

  return (
    <>
      {!splashDone && <SplashScreen onDone={()=>setSplashDone(true)} />}
      <div style={{background:NAVY2,minHeight:"100vh",fontFamily:"system-ui,sans-serif",color:"#EEF2FF",maxWidth:480,margin:"0 auto",paddingBottom:80}}>
        <div style={{background:NAVY,padding:"14px 20px 12px",borderBottom:"1px solid #1A3A7A",position:"sticky",top:0,zIndex:40}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sol-de-mayo.png" alt="" style={{width:40,height:40,objectFit:"contain",flexShrink:0}}/>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-bayres.png" alt="Persianas Bayres" style={{height:28,objectFit:"contain",flex:1,maxWidth:160,borderRadius:4}}/>
            <div style={{background:"#0D2259",borderRadius:10,padding:"6px 10px",fontSize:11,color:"#7AA0D4",fontWeight:600,border:"1px solid #1A3A7A",whiteSpace:"nowrap"}}>
              {new Date().toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short"})}
            </div>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:"#EEF2FF",marginTop:4,paddingLeft:52}}>Gestión</div>
        </div>
        <div style={{padding:"16px 16px 0"}}>
          {tab==="presupuestos"&&<PresupuestosTab onCrearTrabajo={p=>{setTrabajoPrecar(p);setTab("trabajos");}}/>}
          {tab==="materiales"  &&<MaterialesTab/>}
          {tab==="trabajos"    &&<TrabajosTab precargar={trabajoPrecar}/>}
        </div>
        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:NAVY,borderTop:"1px solid #1A3A7A",display:"flex",zIndex:60}}>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>{setTab(t.key);if(t.key!=="trabajos")setTrabajoPrecar(null);}} style={{flex:1,background:"none",border:"none",padding:"12px 8px 16px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
              <span style={{fontSize:18}}>{t.icon}</span>
              <span style={{fontSize:10,fontWeight:700,letterSpacing:0.5,color:tab===t.key?ACCENT:"#3A5A9A"}}>{t.label.toUpperCase()}</span>
              {tab===t.key&&<div style={{width:20,height:2,background:ACCENT,borderRadius:2}}/>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
