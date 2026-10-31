const pdfParse = require("pdf-parse");

function itemsToLines(items) {
  const rows = [];
  for (const item of items || []) {
    if (typeof item.str !== "string" || !item.str.trim()) continue;
    const y = Math.round(item.transform?.[5] ?? 0);
    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x: item.transform?.[4] ?? 0, text: item.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows
    .map((row) =>
      row.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

async function extractPdfPages(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length)
    throw new Error("The uploaded PDF is empty.");
  if (typeof pdfParse !== "function")
    throw new Error(
      "This project requires pdf-parse 1.1.1. Run npm.cmd install in the server folder.",
    );
  const pages = [];
  await pdfParse(buffer, {
    pagerender: async (pageData) => {
      const content = await pageData.getTextContent();
      const text = itemsToLines(content.items);
      pages.push({ number: pages.length + 1, text });
      return text;
    },
  });
  if (!pages.length) throw new Error("No pages could be read from the PDF.");
  return pages;
}

module.exports = { extractPdfPages, itemsToLines };
