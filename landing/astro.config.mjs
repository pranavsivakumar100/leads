// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Public marketing domain. Override with PUBLIC_SITE_URL at build time.
const SITE = process.env.PUBLIC_SITE_URL || "https://leadflow.example.com";

export default defineConfig({
  site: SITE,
  integrations: [sitemap()],
});
