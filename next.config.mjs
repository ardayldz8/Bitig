import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proje dışındaki lockfile'lar yüzünden workspace kökü yanlış seçilmesin.
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
