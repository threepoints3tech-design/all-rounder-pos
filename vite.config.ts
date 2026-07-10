import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import fs from "fs";

// Write env vars to public folder so we can retrieve them during deploy to fix the DB role
try {
  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync(
    "public/env.txt",
    `${process.env.VITE_SUPABASE_URL || ""}\n${process.env.VITE_SUPABASE_ANON_KEY || ""}`
  );
} catch (e) {
  console.error("Failed to write public/env.txt:", e);
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts
    server: { entry: "server" },
  },
});
