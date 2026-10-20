import { describe, expect, it } from "vitest";
import { csvRecords, parseCsv } from "@/lib/client/csv";

describe("bulk CSV parsing", () => {
  it("handles quotes, commas, newlines inside quotes, CRLF and a BOM", () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","line1\nline2"\r\n"say ""hi""",\r\n');
    expect(rows).toEqual([["a", "b"], ["x, y", "line1\nline2"], ['say "hi"', ""]]);
  });

  it("maps rows to the template's columns and skips blank lines", () => {
    const recs = csvRecords("Product_Name,selling_points\n硅胶水杯,可折叠\n\n,\nTaza,plegable\n");
    expect(recs).toEqual([
      { product_name: "硅胶水杯", selling_points: "可折叠" },
      { product_name: "Taza", selling_points: "plegable" },
    ]);
  });
});
