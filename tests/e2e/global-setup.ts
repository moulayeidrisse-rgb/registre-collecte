import { execSync } from "node:child_process";

export default function globalSetup() {
  const env = { ...process.env };
  // charge .env.e2e et vérifie qu'on vise bien la base de test E2E
  const run = (cmd: string) => execSync(`npx dotenv -e .env.e2e -- ${cmd}`, { stdio: "inherit", env });
  run(`sh -c 'case "$DATABASE_URL" in *registre_e2e*) ;; *) echo "Base E2E inattendue" && exit 1;; esac'`);
  run("npx prisma migrate deploy");
  run("sh -c 'SEED_RESET=1 npm run db:seed'");
}
