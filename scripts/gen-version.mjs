// Corre antes de cada `next build` (ver package.json > prebuild). Escribe un id
// único en public/version.json para que el cliente pueda detectar que hay un
// deploy más nuevo que el bundle que tiene cargado.
import { writeFileSync } from "fs";

const buildId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
writeFileSync("public/version.json", JSON.stringify({ buildId }));
console.log(`[gen-version] buildId=${buildId}`);
