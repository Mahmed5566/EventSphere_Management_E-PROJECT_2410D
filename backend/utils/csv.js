// Dependency-free CSV serialisation with safe quoting.
// headers may be strings or { key, label } objects.
// rows is an array of plain objects.

export function escapeCsvCell(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers, rows = []) {
  const cols = headers.map((h) => (typeof h === "object" ? h : { key: h, label: h }));
  const head = cols.map((c) => escapeCsvCell(c.label)).join(",");
  const body = rows
    .map((row) => cols.map((c) => escapeCsvCell(row[c.key])).join(","))
    .join("\n");
  return body ? `${head}\n${body}` : head;
}
