import { describe, expect, it } from "vitest";
import { escapeCell, sanitizeCell, toCsv } from "@/lib/csv";

describe("CSV — neutralisation des injections de formules", () => {
  it.each(["=1+1", "+33 6", "-2+3", "@SUM(A1)", "\t=cmd", "\r=x", '=HYPERLINK("http://x")'])("préfixe « %s »", (v) => {
    expect(sanitizeCell(v).startsWith("'")).toBe(true);
  });
  it("laisse les nombres purs, y compris négatifs", () => {
    expect(sanitizeCell("-12,5")).toBe("-12,5");
    expect(sanitizeCell(42)).toBe("42");
  });
  it("échappe séparateurs, guillemets et retours à la ligne", () => {
    expect(escapeCell('a;b')).toBe('"a;b"');
    expect(escapeCell('dit "bonjour"')).toBe('"dit ""bonjour"""');
    expect(escapeCell("ligne1\nligne2")).toBe('"ligne1\nligne2"');
  });
  it("produit un fichier avec BOM, en-tête et CRLF", () => {
    const csv = toCsv(["A", "B"], [["=x", null], [1, "é"]]);
    expect(csv.startsWith("﻿A;B\r\n")).toBe(true);
    expect(csv).toContain("'=x;\r\n");
    expect(csv.endsWith("1;é\r\n")).toBe(true);
  });
});
