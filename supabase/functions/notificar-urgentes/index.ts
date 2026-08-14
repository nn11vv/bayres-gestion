import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPA_URL     = Deno.env.get("SUPABASE_URL")!;
const SUPA_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (req) => {
  const db = createClient(SUPA_URL, SUPA_KEY);

  let title: string;
  let body: string;

  // Payload propio (ej: recordatorio de seguimiento de presupuestos, enviado
  // desde /api/notificar con {title, body}). Si no viene, se mantiene el
  // comportamiento original: chequeo de materiales urgentes.
  const custom = await req.json().catch(() => null);

  if (custom?.title && custom?.body) {
    title = custom.title;
    body = custom.body;
  } else {
    const { data: urgentes } = await db
      .from("materiales")
      .select("item")
      .eq("urgente", true)
      .eq("comprado", false);

    if (!urgentes || urgentes.length === 0) {
      return new Response("Sin urgentes pendientes", { status: 200 });
    }

    const lista = urgentes.map((m: { item: string }) => m.item).join(", ");
    title = `⚡ ${urgentes.length} urgente${urgentes.length > 1 ? "s" : ""} — Bayres`;
    body = lista;
  }

  const { data: subs } = await db.from("push_subscriptions").select("*");

  if (!subs || subs.length === 0) {
    return new Response("Sin suscriptores registrados", { status: 200 });
  }

  const payload = JSON.stringify({ title, body, icon: "/sol-de-mayo.png" });

  const results = await Promise.allSettled(
    subs.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

  const enviados = results.filter(r => r.status === "fulfilled").length;
  const fallidos = results.filter(r => r.status === "rejected").length;

  return new Response(
    JSON.stringify({ enviados, fallidos }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
