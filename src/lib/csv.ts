/**
 * Génération CSV sûre.
 * - Neutralise les injections de formules (CWE-1236) : toute cellule commençant par
 *   = + - @ tabulation ou retour chariot est préfixée d'une apostrophe, sauf les nombres purs.
 * - Échappe guillemets, séparateurs et retours à la ligne.
 * - Séparateur « ; » et BOM UTF-8 pour une ouverture correcte dans Excel en français.
 */

const DANGEROUS_PREFIX = /^[=+\-@\t\r]/;
const PURE_NUMBER = /^-?\d+([.,]\d+)?$/;

export function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : String(value);
  if (DANGEROUS_PREFIX.test(s) && !PURE_NUMBER.test(s)) {
    s = `'${s}`;
  }
  return s;
}

export function escapeCell(value: unknown, separator = ";"): string {
  const s = sanitizeCell(value);
  const needsQuotes =
    s.includes(separator) || s.includes('"') || s.includes("\n") || s.includes("\r") || /^\s|\s$/.test(s);
  return needsQuotes ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][], separator = ";"): string {
  const lines = [header, ...rows].map((r) => r.map((c) => escapeCell(c, separator)).join(separator));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
