// Minimal, dependency-free PDF report builder.
// Produces a single-page PDF with a title, a metadata/date-range block,
// a summary section and optional tabular rows. Text is escaped for PDF
// literal strings; the byte layout mirrors the existing certificate builder
// already used in advancedController so no new dependency is required.

const escapePdf = (s) => String(s ?? "").replace(/([\\()])/g, "\\$1");

function textOps(lines) {
  const ops = ["BT", "/F1 16 Tf", "60 800 Td"];
  lines.forEach((line, index) => {
    const size = line.bold ? 13 : line.size || 11;
    if (index > 0) ops.push(`0 -${line.gap || 22} Td`);
    ops.push(`/F1 ${size} Tf`);
    ops.push(`(${escapePdf(line.text)}) Tj`);
  });
  ops.push("ET");
  return ops.join(" ");
}

/**
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string[]} [opts.meta]   - metadata lines, e.g. date range / generated at
 * @param {Array<{text:string, bold?:boolean, size?:number, gap?:number}>} [opts.lines]
 * @param {string[]} [opts.tableHeaders]
 * @param {string[][]} [opts.tableRows]
 */
export function buildReportPdf({ title, meta = [], lines = [], tableHeaders = [], tableRows = [] } = {}) {
  const content = [];
  content.push({ text: title, bold: true, size: 19, gap: 26 });
  meta.forEach((m) => content.push({ text: m, size: 10, gap: 16 }));
  content.push({ text: "", size: 8, gap: 10 });
  lines.forEach((l) => content.push({ text: l, size: 11, gap: 18 }));
  if (tableHeaders.length) {
    content.push({ text: "", size: 8, gap: 8 });
    content.push({ text: tableHeaders.join("   |   "), bold: true, size: 11, gap: 20 });
    tableRows.forEach((row) => content.push({ text: row.join("   |   "), size: 10, gap: 16 }));
  }

  const stream = textOps(content);
  const objs = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>endobj",
    "4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj",
    `5 0 obj<< /Length ${Buffer.byteLength(stream)} >>stream\n${stream}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const o of objs) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${o}\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
