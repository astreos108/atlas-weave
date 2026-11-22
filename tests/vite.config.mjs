import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    noDiscovery: true,
    include: ["mermaid", "dompurify"],
  },
  server: {
    hmr: false,
    watch: {
      ignored: ["**/research/**"],
    },
  },
});
