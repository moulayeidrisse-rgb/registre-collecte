import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    // Migrations : connexion directe si DIRECT_URL est fournie (ex. Neon avec pooling), sinon DATABASE_URL
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
