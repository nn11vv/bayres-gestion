import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
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
  .subtitulo { font-size: 12px; color: #666; margin-top: 4px; }
  .doc-info { display: flex; justify-content: space-between; margin-bottom: 24px; }
  .doc-tipo { font-size: 22px; font-weight: bold; color: #0F2D6B; }
  .doc-numero { font-size: 14px; color: #666; }
  .cliente-box { background: #f5f7ff; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
  .cliente-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .cliente-nombre { font-size: 16px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #0F2D6B; color: white; padding: 10px 12px; text-align: left; font-size: 13px; }
  td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
  .totales { width: 100%; }
  .totales td { border: none; padding: 4px 12px; }
  .total-final { font-weight: bold; font-size: 16px; color: #0F2D6B; border-top: 2px solid #0F2D6B !important; padding-top: 8px !important; }
  .footer { border-top: 1px solid #eee; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #888; text-align: center; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <div class="empresa">PERSIANAS BAYRES S.L.</div>
    <div class="subtitulo">NIF: B44820504</div>
    <div class="subtitulo">Carrer de l'Herba Lluisa, 41 planta ch, puerta 6 · Mutxamel, 03110 · Alicante</div>
  </div>

  <div class="doc-info">
    <div>
      <div class="doc-tipo">${titulo}</div>
      <div class="doc-numero">${numeroDoc}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:13px;color:#666">Fecha</div>
      <div style="font-size:15px;font-weight:bold">${new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}</div>
    </div>
  </div>

  <div class="cliente-box">
    <div class="cliente-label">Cliente</div>
    <div class="cliente-nombre">${cliente}</div>
    ${direccionCliente ? `<div style="font-size:13px;color:#666;margin-top:4px">${direccionCliente}</div>` : ""}
    ${nifCliente ? `<div style="font-size:13px;color:#666;margin-top:2px">NIF: ${nifCliente}</div>` : '<div style="font-size:13px;color:#888;margin-top:2px">Contado</div>'}
  </div>

  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th style="text-align:right;width:80px">Uds.</th>
        <th style="text-align:right;width:100px">P. Unit.</th>
        <th style="text-align:right;width:100px">Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${servicio}${descripcion ? `<br><span style="font-size:12px;color:#888">${descripcion}</span>` : ""}</td>
        <td style="text-align:right">1</td>
        <td style="text-align:right">${base.toFixed(2)}€</td>
        <td style="text-align:right">${base.toFixed(2)}€</td>
      </tr>
    </tbody>
  </table>

  <table class="totales">
    <tr><td style="text-align:right;color:#888">Subtotal</td><td style="text-align:right;width:120px">${base.toFixed(2)}€</td></tr>
    ${tieneIva ? `<tr><td style="text-align:right;color:#888">IVA 21%</td><td style="text-align:right">${iva.toFixed(2)}€</td></tr>` : ""}
    <tr><td class="total-final" style="text-align:right">Total</td><td class="total-final" style="text-align:right">${total.toFixed(2)}€</td></tr>
  </table>

  <div class="footer">
    Teléfono: 695 26 69 81 · Email: persianasbayres@gmail.com
  </div>
</div>
</body>
</html>`;

    const { error } = await resend.emails.send({
      from: "Bayres Servicios <onboarding@resend.dev>",
      to:   [emailCliente],
      subject: `${titulo} ${numeroDoc} — Bayres Servicios`,
      html,
    });

    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}