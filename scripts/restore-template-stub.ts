import { writeFileSync } from "node:fs";
import path from "node:path";

const out = path.join(process.cwd(), "src", "generated", "demo-template.ts");
writeFileSync(
  out,
  "/** Replaced during `npm run build` with the seeded demo database. Kept empty in git. */\nexport const demoTemplate = \"\";\n",
);
