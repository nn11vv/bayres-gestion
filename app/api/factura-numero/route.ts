import { NextResponse } from "next/server";

const SUPA_URL = "https://tnstmdckdraladewdocf.supabase.co";
const SUPA_KEY = "sb_publishable_tFyiNQh9qfwnultGIMLq-w_lM_bfL6g";
const headers  = {
  "Content-Type": "application/json",
  "apikey": SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
};

export async function POST(req: Request) {
  try {
    const { tipo } = await req.json(); // "PR" o "FV"
    const year = new Date().getFullYear();
    const prefix = `${tipo}-${year}-`;

    // Buscar el último número usado
    const table = tipo === "PR" ? "presupuestos" : "trabajos";
    const r = await fetch(
      `${SUPA_URL}/rest/v1/${table}?numero_doc=like.${prefix}*&select=numero_doc&order=numero_doc.desc&limit=1`,
      { headers }
    );
    const data = await r.json();

    let siguiente = 1;
    if (data && data.length > 0 && data[0].numero_doc) {
      const last = data[0].numero_doc;
      const num  = parseInt(last.split("-").pop() || "0", 10);
      siguiente  = num + 1;
    }

    const numero = `${prefix}${String(siguiente).padStart(4, "0")}`;
    return NextResponse.json({ numero });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}