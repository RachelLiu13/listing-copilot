import type { ListingCopy } from "./listing/types";

const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** One row per listing, with the columns sellers paste into flat-file templates. */
export function listingCsv(rows: { productName: string; platform: string; copy: ListingCopy }[]): string {
  const header = ["product_name", "platform", "title", "bullet_1", "bullet_2", "bullet_3", "bullet_4", "bullet_5", "description", "search_terms"];
  const lines = rows.map(({ productName, platform, copy }) => {
    const bullets = Array.from({ length: 5 }, (_, i) => copy.bullets[i] ?? "");
    return [productName, platform, copy.title, ...bullets, copy.description, copy.searchTerms.join(" ")].map(cell).join(",");
  });
  // BOM so Excel opens UTF-8 (product names in any script) correctly.
  return "﻿" + [header.join(","), ...lines].join("\r\n") + "\r\n";
}
