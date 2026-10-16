import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeCsvCell, toCsv } from "../utils/csv.js";
import { buildReportPdf } from "../utils/pdfReport.js";

test("CSV cells with commas, quotes and newlines are quoted safely", () => {
  assert.equal(escapeCsvCell("plain"), "plain");
  assert.equal(escapeCsvCell("a,b"), '"a,b"');
  assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsvCell("line1\nline2"), '"line1\nline2"');
  assert.equal(escapeCsvCell(null), "");
});

test("toCsv renders a header and rows", () => {
  const csv = toCsv([{ key: "a", label: "A" }, { key: "b", label: "B" }], [{ a: 1, b: "x,y" }]);
  assert.equal(csv, 'A,B\n1,"x,y"');
});

test("buildReportPdf returns a valid PDF buffer containing the title", () => {
  const pdf = buildReportPdf({ title: "EventSphere Report", meta: ["range"], lines: ["Revenue: 100"], tableHeaders: ["Event"], tableRows: [["Gala"]] });
  assert.equal(Buffer.isBuffer(pdf), true);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.match(pdf.toString("latin1"), /EventSphere Report/);
  assert.match(pdf.toString("latin1"), /%%EOF/);
});
