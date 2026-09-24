import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    // This runs on the event laptop over a plain-HTTP venue LAN, reached via
    // localhost, the laptop's (changing) LAN IP, and phones at once — so a
    // single fixed origin can't be known, and SvelteKit's cross-origin form
    // check would 403 every login/score POST. It's a trusted, offline, local
    // tool with no cross-site attacker surface, so every origin is trusted.
    csrf: { trustedOrigins: ["*"] },
  },
};

export default config;
