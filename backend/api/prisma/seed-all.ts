// Master seed script: drops DB and runs all seeders in correct order.
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scripts = [
  "seed.ts",
  "seed-tps-sampah.ts",
  "seed-trucks.ts",
  "seed-facilities.ts",
];

function run(script: string) {
  const fullPath = path.resolve(__dirname, script);
  console.log(`\n============================================`);
  console.log(`Running ${script}...`);
  console.log(`============================================`);
  execSync(`npx tsx "${fullPath}"`, { stdio: "inherit", cwd: path.resolve(__dirname, "..") });
}

async function main() {
  console.log("============================================");
  console.log("AURORA Master Seed Started");
  console.log("============================================");

  for (const script of scripts) {
    run(script);
  }

  console.log("\n============================================");
  console.log("AURORA Master Seed Complete!");
  console.log("============================================");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
