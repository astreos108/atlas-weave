import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    entries: ["src/**/*.js"],
    include: ["mermaid", "dompurify"],
  },
  server: {
    hmr: false,
    watch: {
      ignored: ["**/research/**"],
    },
  },
});
