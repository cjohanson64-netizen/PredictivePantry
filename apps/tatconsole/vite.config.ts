import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@tryangletree/core": path.resolve(__dirname, "../../tryangletree-core/src/index.ts"),
    },
  },
})