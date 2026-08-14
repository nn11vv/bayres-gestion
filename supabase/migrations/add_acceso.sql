-- Campo de acceso/indicaciones (uso interno, no aparece en PDF/email).

ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS acceso text;
ALTER TABLE trabajos ADD COLUMN IF NOT EXISTS acceso text;
