import { dbUpdate, dbUpdateWhere } from "./db";

const DAY_MS = 24 * 60 * 60 * 1000;

// Archiva registros viejos. No borra nada — solo marca archivado_at.
//
// trabajos: 'hora_inicio' es solo HH:MM (sin fecha), no sirve para calcular
// antigüedad por sí solo, así que se usa 'fecha' (fecha del trabajo).
//
// presupuestos: 'rechazado_at' es la fecha real de rechazo (se completa en
// cada changeEstado) y es el campo correcto para la antigüedad. 'fecha' solo
// se usa como respaldo para registros que quedaron marcados 'rechazado' antes
// de que existiera esa columna.
export async function archivarRegistrosAntiguos(): Promise<number> {
  const now = new Date().toISOString();

  const cutoffTrabajos = new Date(Date.now() - 7 * DAY_MS).toISOString().slice(0, 10);
  const trabajosArchivados = await dbUpdateWhere(
    "trabajos",
    `estado=eq.completado&archivado_at=is.null&fecha=lt.${cutoffTrabajos}`,
    { archivado_at: now }
  );

  const cutoffPresTs = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const cutoffPresFecha = cutoffPresTs.slice(0, 10);
  const presupuestosArchivados = await dbUpdateWhere(
    "presupuestos",
    `estado=eq.rechazado&archivado_at=is.null&or=(and(rechazado_at.not.is.null,rechazado_at.lt.${cutoffPresTs}),and(rechazado_at.is.null,fecha.lt.${cutoffPresFecha}))`,
    { archivado_at: now }
  );

  return trabajosArchivados.length + presupuestosArchivados.length;
}

export async function archivarManualmente(tabla: "presupuestos" | "trabajos", id: string) {
  return dbUpdate(tabla, id, { archivado_at: new Date().toISOString() });
}

export async function desarchivar(tabla: "presupuestos" | "trabajos", id: string) {
  return dbUpdate(tabla, id, { archivado_at: null });
}
