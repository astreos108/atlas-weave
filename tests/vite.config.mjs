import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
  server: {
    hmr: false,
    watch: {
      ignored: ["**/research/**"],
    },
  },
});
