// lib/accounting/csv.ts
// ============================================================
// Génération de CSV (Excel/QuickBooks/Acomba friendly).
// Préfixe BOM UTF-8 + CRLF pour préserver les accents.
// ============================================================

function escapeCell(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",\r\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(escapeCell).join(',')]
  for (const r of rows) lines.push(r.map(escapeCell).join(','))
  return '﻿' + lines.join('\r\n')
}
