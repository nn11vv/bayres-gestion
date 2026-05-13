import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { emailCliente, factura } = await req.json();

    const {
      numeroDoc, tipo, fecha, cliente, direccionCliente,
      nifCliente, servicio, descripcion, importe, tieneIva
    } = factura;

    const base   = Number(importe || 0);
    const iva    = tieneIva ? base * 0.21 : 0;
    const total  = base + iva;
    const titulo = tipo === "PR" ? "Presupuesto" : "Factura";

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 32px; }
  .header { border-bottom: 2px solid #0F2D6B; padding-bottom: 16px; margin-bottom: 24px; }
  .empresa { font-size: 20px; font-weight: bold; color: #0F2D6B; }
  .sub { font-size: 12px; color: #666; margin-top: 4px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 24px; }
  .doc-tipo { font-size: 22px; font-weight: bold; color: #0F2D6B; }
  .doc-num { font-size: 14px; color: #666; }
  .cbox { background: #f5f7ff; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
  .clabel { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .cnombre { font-size: 16px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #0F2D6B; color: white; padding: 10px 12px; text-align: left; font-size: 13px; }
  td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
  .tr { text-align: right; }
  .bold { font-weight: bold; color: #0F2D6B; }
  .btop { border-top: 2px solid #0F2D6B !important; padding-top: 8px !important; }
  .footer { border-top: 1px solid #eee; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #888; text-align: center; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <div class="empresa">PERSIANAS BAYRES S.L.</div>
    <div class="sub">NIF: B44820504</div>
    <div class="sub">Carrer de l'Herba Lluisa, 41 planta ch, puerta 6 · Mutxamel, 03110 · Alicante</div>
  </div>
  <div class="row">
    <div>
      <div class="doc-tipo">${titulo}</div>
      <div class="doc-num">${numeroDoc}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:13px;color:#666">Fecha</div>
      <div style="font-size:15px;font-weight:bold">${new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}</div>
    </div>
  </div>
  <div class="cbox">
    <div class="clabel">Cliente</div>
    <div class="cnombre">${cliente}</div>
    ${direccionCliente ? `<div style="font-size:13px;color:#666;margin-top:4px">${direccionCliente}</div>` : ""}
    ${nifCliente ? `<div style="font-size:13px;color:#666;margin-top:2px">NIF: ${nifCliente}</div>` : '<div style="font-size:13px;color:#888;margin-top:2px">Contado</div>'}
  </div>
  <table>
    <thead><tr>
      <th>Descripción</th>
      <th class="tr" style="width:60px">Uds.</th>
      <th class="tr" style="width:90px">P. Unit.</th>
      <th class="tr" style="width:90px">Total</th>
    </tr></thead>
    <tbody><tr>
      <td>${servicio}${descripcion ? `<br><span style="font-size:12px;color:#888">${descripcion}</span>` : ""}</td>
      <td class="tr">1</td>
      <td class="tr">${base.toFixed(2)}€</td>
      <td class="tr">${base.toFixed(2)}€</td>
    </tr></tbody>
  </table>
  <table>
    <tr><td class="tr" style="color:#888;border:none;padding:4px 12px">Subtotal</td><td class="tr" style="border:none;padding:4px 12px;width:100px">${base.toFixed(2)}€</td></tr>
    ${tieneIva ? `<tr><td class="tr" style="color:#888;border:none;padding:4px 12px">IVA 21%</td><td class="tr" style="border:none;padding:4px 12px">${iva.toFixed(2)}€</td></tr>` : ""}
    <tr><td class="tr bold btop" style="padding:8px 12px">Total</td><td class="tr bold btop" style="padding:8px 12px">${total.toFixed(2)}€</td></tr>
  </table>
  <div class="footer">Teléfono: 695 26 69 81 · Email: persianasbayres@gmail.com</div>
</div>
</body></html>`;

    const { error } = await resend.emails.send({
      from:    "Bayres Servicios <onboarding@resend.dev>",
      to:      [emailCliente],
      subject: `${titulo} ${numeroDoc} — Bayres Servicios`,
      html,
    });

    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}