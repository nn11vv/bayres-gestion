-- Recordatorio de seguimiento para presupuestos 'enviado' sin respuesta.
-- NULL = no se ha enviado recordatorio aún.

ALTER TABLE presupuestos
  ADD COLUMN IF NOT EXISTS recordatorio_enviado_at timestamptz;
