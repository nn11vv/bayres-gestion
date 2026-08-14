import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const SUPA_URL = "https://tnstmdckdraladewdocf.supabase.co";
  const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuc3RtZGNrZHJhbGFkZXdkb2NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNzMxNDIsImV4cCI6MjA5Mzc0OTE0Mn0.N8lpUCiRRzzJIfQbuWjPAq5h47HOmYOTNHbrsFxOUc8";

  try {
    // Sin body (llamada histórica de materiales urgentes) -> {} para no
    // cambiar ese comportamiento. Con body {title, body} (seguimiento de
    // presupuestos) se reenvía tal cual a la edge function.
    const payload = await req.json().catch(() => ({}));
    const r = await fetch(`${SUPA_URL}/functions/v1/notificar-urgentes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}