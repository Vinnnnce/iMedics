// prisma.config.ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

// The datasource URL is only required by migration / introspection commands
// (`db:migrate`, `db:deploy`, `db pull`, ...). Client generation, formatting,
// and validation work without it, so we omit the datasource entirely when no
// URL is configured instead of throwing at config-load time or silently
// substituting a placeholder.
//
// When it IS configured we prefer DIRECT_URL (bypasses the Neon pooler) and
// fall back to DATABASE_URL.
function datasourceUrl(): string | undefined {
  return process.env.DIRECT_URL || process.env.DATABASE_URL;
}

const config = defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});

const url = datasourceUrl();
if (url) {
  config.datasource = { url };
}

export default config;
