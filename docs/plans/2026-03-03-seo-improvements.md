# SEO Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add meta tags, OpenGraph, Twitter cards, sitemap, robots.txt, structured data, and web manifest to improve search engine visibility and social sharing.

**Architecture:** All SEO features use Next.js App Router conventions (metadata exports, route-based sitemap/robots/manifest files). No external dependencies needed.

**Tech Stack:** Next.js 16 Metadata API, JSON-LD structured data

**Site URL:** `https://shplit.vercel.app`

---

### Task 1: Expand Root Layout Metadata

**Files:**
- Modify: `src/app/layout.tsx:16-19`

**Step 1: Update the metadata export**

Replace the existing `metadata` export with:

```typescript
export const metadata: Metadata = {
  metadataBase: new URL("https://shplit.vercel.app"),
  title: {
    default: "Shplit — Split Receipts with Friends",
    template: "%s | Shplit",
  },
  description:
    "Scan any receipt, split it with friends, and share a live link. No app download needed.",
  keywords: [
    "split receipt",
    "bill splitter",
    "receipt scanner",
    "split the bill",
    "restaurant bill split",
    "group dining",
    "shared expenses",
  ],
  openGraph: {
    type: "website",
    siteName: "Shplit",
    title: "Shplit — Split Receipts with Friends",
    description:
      "Scan any receipt, split it with friends, and share a live link. No app download needed.",
    url: "https://shplit.vercel.app",
  },
  twitter: {
    card: "summary",
    title: "Shplit — Split Receipts with Friends",
    description:
      "Scan any receipt, split it with friends, and share a live link. No app download needed.",
  },
  alternates: {
    canonical: "https://shplit.vercel.app",
  },
};
```

**Step 2: Verify dev server renders meta tags**

Run: `npm run dev` then check page source for `og:title`, `twitter:card`, `canonical` tags.

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(seo): expand root layout with OpenGraph, Twitter, and canonical metadata"
```

---

### Task 2: Add OpenGraph/Twitter to Receipt Page

**Files:**
- Modify: `src/app/receipt/[id]/page.tsx:5-21`

**Step 1: Expand generateMetadata return**

Update the existing `generateMetadata` function to include OpenGraph and Twitter tags:

```typescript
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const receipt = await getReceipt(id);
  const name = receipt?.restaurantName;
  const title = name ? `${name} Shplit` : "Shplit";
  const description = name
    ? `Split the bill from ${name} with friends`
    : "Split receipts with friends";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://shplit.vercel.app/receipt/${id}`,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}
```

**Step 2: Commit**

```bash
git add src/app/receipt/[id]/page.tsx
git commit -m "feat(seo): add OpenGraph and Twitter metadata to receipt pages"
```

---

### Task 3: Create sitemap.ts

**Files:**
- Create: `src/app/sitemap.ts`

**Step 1: Create the sitemap file**

```typescript
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://shplit.vercel.app",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
```

Only the landing page is included — receipt pages are dynamic/ephemeral and shouldn't be indexed.

**Step 2: Verify**

Run: `curl http://localhost:3000/sitemap.xml` — should return XML with the landing page URL.

**Step 3: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(seo): add sitemap.ts for search engine indexing"
```

---

### Task 4: Create robots.ts

**Files:**
- Create: `src/app/robots.ts`

**Step 1: Create the robots file**

```typescript
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: "https://shplit.vercel.app/sitemap.xml",
  };
}
```

**Step 2: Verify**

Run: `curl http://localhost:3000/robots.txt` — should show `User-agent: *`, `Allow: /`, `Disallow: /api/`, and sitemap URL.

**Step 3: Commit**

```bash
git add src/app/robots.ts
git commit -m "feat(seo): add robots.ts with sitemap reference"
```

---

### Task 5: Add JSON-LD Structured Data

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Add JSON-LD script to the body**

Add a `<script>` tag inside `<body>`, before `<main>`:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Shplit",
      url: "https://shplit.vercel.app",
      description:
        "Scan any receipt, split it with friends, and share a live link. No app download needed.",
      applicationCategory: "FinanceApplication",
      operatingSystem: "Any",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    }),
  }}
/>
```

**Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(seo): add JSON-LD structured data for WebApplication schema"
```

---

### Task 6: Add Web App Manifest

**Files:**
- Create: `src/app/manifest.ts`

**Step 1: Create the manifest file**

```typescript
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shplit — Split Receipts with Friends",
    short_name: "Shplit",
    description:
      "Scan any receipt, split it with friends, and share a live link.",
    start_url: "/",
    display: "standalone",
    background_color: "#1a1a1a",
    theme_color: "#1a1a1a",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
```

**Step 2: Verify**

Run: `curl http://localhost:3000/manifest.webmanifest` — should return JSON with app info.

**Step 3: Commit**

```bash
git add src/app/manifest.ts
git commit -m "feat(seo): add web app manifest for PWA support"
```

---

### Task 7: Build Verification

**Step 1: Run the build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 2: Run existing tests**

Run: `npm test`
Expected: All 39 tests pass (no regressions).

**Step 3: Final commit if any fixes needed**
