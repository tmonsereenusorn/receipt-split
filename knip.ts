import type { KnipConfig } from "knip";

/**
 * Dead-code check. Run with `npm run knip`.
 *
 * Added after a change was written against a component that nothing imported:
 * the build, the typechecker, and the whole test suite passed while the work was
 * invisible to every user. Types and tests cannot catch an unreachable file —
 * a passing suite says the code is correct, not that it runs.
 *
 * Every exemption here is a false positive that was verified by hand, with the
 * reason recorded. An unexplained ignore list becomes a dumping ground, and then
 * the check stops meaning anything.
 */
const config: KnipConfig = {
  entry: [
    // App Router files are entry points — nothing imports them.
    "src/app/**/{page,layout,route,not-found,error,loading,global-error,sitemap,robots,manifest}.{ts,tsx}",
    // One-off scripts are executed directly.
    "scripts/*.mjs",
  ],
  project: ["src/**/*.{ts,tsx}", "scripts/**/*.mjs"],

  // Exported but used only inside its own file. That is over-export, not dead
  // code: deleting those symbols would break the files that use them. Knip
  // reports them by default; they are a style question, not a correctness one.
  ignoreExportsUsedInFile: true,

  ignoreDependencies: [
    // Pulled in by `@import "tailwindcss"` in globals.css and by
    // postcss.config.mjs. Knip does not resolve through CSS.
    "tailwindcss",
    // Read directly by Next.js via postcss.config.mjs.
    "postcss",
  ],

  ignore: [
    // `recognizeImage` is reached only through `import("@/lib/ocr")` in
    // ScanSection, and knip does not trace that destructuring. Verified by hand:
    // ScanSection destructures and calls it. The lazy import is deliberate — it
    // keeps the OCR path out of the landing page's initial bundle — so the code
    // is right and the tool is wrong. Scoped to the one file, not blanket.
    "src/lib/ocr.ts",
  ],
};

export default config;
