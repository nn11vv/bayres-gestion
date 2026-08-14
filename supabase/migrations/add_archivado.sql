-- Archivado automático de presupuestos y trabajos.
-- No es borrado: archivado_at solo oculta el registro de las vistas normales.

ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS archivado_at timestamptz;
ALTER TABLE trabajos ADD COLUMN IF NOT EXISTS archivado_at timestamptz;
