// @ts-check
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import starlightLinksValidator from "starlight-links-validator";
import { createStarlightTypeDocPlugin } from "starlight-typedoc";

const REPO = "https://github.com/drock07/board-game-toolkit";

// API reference, generated from each package's TSDoc into src/content/docs/api
const [engineApi, engineApiSidebar] = createStarlightTypeDocPlugin();
const [reactApi, reactApiSidebar] = createStarlightTypeDocPlugin();
const typeDoc = {
  excludePrivate: true,
  excludeInternal: true,
  // Link "Defined in" to the source on GitHub
  gitRevision: "main",
  sourceLinkTemplate: `${REPO}/blob/{gitRevision}/{path}#L{line}`,
};

export default defineConfig({
  site: "https://drock07.github.io",
  base: "/board-game-toolkit",
  trailingSlash: "always",
  integrations: [
    starlight({
      // Fails the build on a broken internal link or anchor
      plugins: [
        starlightLinksValidator(),
        engineApi({
          entryPoints: [
            "../packages/engine/src/index.ts",
            "../packages/engine/src/testing/index.ts",
          ],
          tsconfig: "../packages/engine/tsconfig.build.json",
          output: "api/engine",
          sidebar: { label: "Engine API", collapsed: true },
          typeDoc: {
            ...typeDoc,
            entryModule: "@drock07/board-game-toolkit-engine",
          },
        }),
        reactApi({
          entryPoints: [
            "../packages/react/src/index.ts",
            "../packages/react/src/devtools/index.ts",
          ],
          tsconfig: "../packages/react/tsconfig.build.json",
          output: "api/react",
          sidebar: { label: "React API", collapsed: true },
          typeDoc: {
            ...typeDoc,
            entryModule: "@drock07/board-game-toolkit-react",
          },
        }),
      ],
      title: "Board Game Toolkit",
      description:
        "A TypeScript toolkit for board games: a JSON flow spec, a pure deterministic engine, and a React host.",
      logo: { src: "./src/assets/logo.svg" },
      favicon: "/favicon.svg",
      social: [{ icon: "github", label: "GitHub", href: REPO }],
      editLink: { baseUrl: `${REPO}/edit/main/docs/` },
      customCss: [
        "@fontsource/ibm-plex-sans/400.css",
        "@fontsource/ibm-plex-sans/500.css",
        "@fontsource/ibm-plex-sans/600.css",
        "@fontsource/ibm-plex-sans/700.css",
        "@fontsource/ibm-plex-mono/400.css",
        "@fontsource/ibm-plex-mono/500.css",
        "./src/styles/global.css",
      ],
      sidebar: [
        {
          label: "Start here",
          items: [
            "start/introduction",
            "start/installation",
            "start/quickstart",
          ],
        },
        {
          label: "Concepts",
          items: [{ autogenerate: { directory: "concepts" } }],
        },
        { label: "Guides", items: [{ autogenerate: { directory: "guides" } }] },
        {
          label: "Reference",
          items: [
            {
              label: "Flow nodes",
              items: [{ autogenerate: { directory: "reference/flow" } }],
            },
            engineApiSidebar,
            reactApiSidebar,
          ],
        },
        {
          label: "Examples",
          items: [{ autogenerate: { directory: "examples" } }],
        },
      ],
      components: {
        // Brings old hash links (/#/crazy-eights) to their new pages
        Head: "./src/overrides/Head.astro",
        // The landing page's header
        Hero: "./src/overrides/Hero.astro",
      },
    }),
    react(),
  ],
  vite: { plugins: [tailwindcss()] },
});
