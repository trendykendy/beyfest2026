import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: true, // bind 0.0.0.0 so phones on the venue LAN can reach dev too
  },
});
