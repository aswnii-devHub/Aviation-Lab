
import { jsPDF } from "jspdf";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;

const MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_LIMIT = PAGE_HEIGHT - 22;

function createPdf(chapter, documentTitle, questions) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  let y = 40;

  function drawHeader() {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(chapter, PAGE_WIDTH / 2, 17, {
      align: "center",
      maxWidth: CONTENT_WIDTH,
    });
    doc.setFontSize(12);
    doc.text(documentTitle, PAGE_WIDTH / 2, 25, {
      align: "center",
    });
    doc.setLineWidth(0.3);
    doc.line(MARGIN, 30, PAGE_WIDTH - MARGIN, 30);
  }

  function addPage() {
    doc.addPage();
    drawHeader();
    y = 40;
  }

  function addParagraph(text, options = {}) {
    const fontSize = options.fontSize || 10.5;
    const indent = options.indent || 0;
    const gapAfter = options.gapAfter ?? 3;
    doc.setFont(
      "helvetica",
      options.bold ? "bold" : "normal"
    );
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(
      String(text || ""),
      CONTENT_WIDTH - indent
    );
    const lineHeight = fontSize * 0.5 + 1.5;

    lines.forEach((line) => {
      if (y + lineHeight > BOTTOM_LIMIT) {
        addPage();
      }
      doc.text(line, MARGIN + indent, y);
      y += lineHeight;
    });
    y += gapAfter;
  }

  function getCorrectOption(question) {
    const answer = question.correctAnswer?.trim() || "";

    return (
      question.options?.find(
        (option) =>
          option.trim().startsWith(`${answer}.`) ||
          option.trim().startsWith(`${answer})`)
      ) || answer
    );
  }
  drawHeader();
  questions.forEach((question, index) => {
    const questionNumber = index + 1;
    if (documentTitle === "Question Paper") {
      addParagraph(
        `${questionNumber}. ${question.question}`,
        {
          bold: true,
          fontSize: 11,
          gapAfter: 3,
        }
      );
      (question.options || []).forEach((option) => {
        addParagraph(option, {
          indent: 5,
          fontSize: 10.5,
          gapAfter: 1.5,
        });
      });
      y += 5;
    }
    if (documentTitle === "Answer Key") {
      addParagraph(
        `${questionNumber}. ${getCorrectOption(question)}`,
        {
          bold: true,
          fontSize: 11,
          gapAfter: 5,
        }
      );
    }

    if (documentTitle === "Explanations") {
      addParagraph(
        `${questionNumber}. ${question.question}`,
        {
          bold: true,
          fontSize: 11,
        }
      );

      if (question.concept) {
        addParagraph(`Concept: ${question.concept}`, {
          bold: true,
          fontSize: 10,
        });
      }

      addParagraph(
        `Correct Answer: ${getCorrectOption(question)}`,
        {
          bold: true,
          fontSize: 10.5,
        }
      );
      addParagraph(
        question.explanation || "No explanation available.",
        {
          fontSize: 10.5,
          gapAfter: 8,
        }
      );
    }
  });

  // Add page numbers to every page.
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      String(page),
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 10,
      { align: "center" }
    );
  }
  return doc;
}

function sanitizeFilename(value) {
  return (
    value
      .replace(/[<>:"/\\|?*]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "Aviation"
  );
}

export function exportAviationPdfs({ chapter, questions }) {
  if (!questions || !questions.length) {
    throw new Error("No questions available to export.");
  }

  const chapterName = chapter || "Aviation";
  const filename = sanitizeFilename(chapterName);
  const documents = [
    {
      title: "Question Paper",
      suffix: "Question-Paper",
    },
    {
      title: "Answer Key",
      suffix: "Answer-Key",
    },
    {
      title: "Explanations",
      suffix: "Explanations",
    },
  ];

  documents.forEach(({ title, suffix }) => {
    const pdf = createPdf(
      chapterName,
      title,
      questions
    );
    pdf.save(`${filename}-${suffix}.pdf`);
  });
}
