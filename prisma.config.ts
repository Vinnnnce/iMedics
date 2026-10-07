// prisma.config.ts
import "dotenv/config"; // Ensure your environment variables are loaded
import { defineConfig, env } from "prisma/config"; // Import the 'env' helper

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // This helper returns a strict 'string' type and fixes the TypeScript error!
    url: env("DATABASE_URL"), 
  },
});
