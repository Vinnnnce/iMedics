type Cell = string | number | boolean | Date | null | undefined;

/** Spreadsheets run text starting with these characters as formulas; neutralise them (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Cell[][]): string {
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, rows: Cell[][]): Response {
  return new Response("\uFEFF" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
