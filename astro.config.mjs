// @ts-check
import { defineConfig, fontProviders } from "astro/config";

// https://astro.build/config
export default defineConfig({
  // TODO: definir o domínio de produção para gerar canonical/OG absolutos.
  // Ex.: site: "https://energia.behive.global",
  // site: "",

  // Inter é a fonte oficial da marca Hive (Brands-Hive.pdf — Light/Medium/Bold).
  // O provider do Astro baixa, subseta e self-hospeda os arquivos no build:
  // nenhuma requisição a fonts.googleapis.com em produção.
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Inter",
      cssVariable: "--font-inter",
      weights: [300, 400, 500, 600, 700],
      styles: ["normal"],
      subsets: ["latin", "latin-ext"],
      display: "swap",
      fallbacks: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
    },
  ],
});
