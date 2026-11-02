
import {
  Document,
  Paragraph,
  TextRun,
  Header,
  Footer,
  AlignmentType,
  PageNumber,
  Packer,
} from "docx";

import { saveAs } from "file-saver";

function sanitizeFilename(value) {
  return (
    value
      .replace(/[<>:"/\\|?*]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "Aviation"
  );
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

function createHeader(chapter, title) {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: chapter,
            bold: true,
            size: 28,
          }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 24,
          }),
        ],
        border: {
          bottom: {
            style: "single",
            size: 4,
            color: "808080",
            space: 6,
          },
        },
        spacing: { after: 200 },
      }),
    ],
  });
}

function createFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            children: [
              PageNumber.CURRENT,
            ],
          }),
        ],
      }),
    ],
  });
}

function createQuestionPaperContent(questions) {
  const content = [];
  questions.forEach((question, index) => {
    content.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${index + 1}. ${question.question}`,
            bold: true,
            size: 22,
          }),
        ],
        spacing: {
          before: 200,
          after: 160,
          line: 300,
        },
        keepNext: true,
      })
    );
    (question.options || []).forEach((option, optionIndex) => {
      content.push(
        new Paragraph({
          children: [
            new TextRun({
              text: option,
              size: 21,
            }),
          ],
          indent: { left: 360 },
          spacing: {
            after: 100,
            line: 276,
          },
          keepNext:
            optionIndex !== question.options.length - 1,
        })
      );
    });
    content.push(
      new Paragraph({
        text: "",
        spacing: { after: 200 },
      })
    );
  });
  return content;
}

function createAnswerKeyContent(questions) {
  return questions.map((question, index) =>
    new Paragraph({
      children: [
        new TextRun({
          text: `${index + 1}. ${getCorrectOption(question)}`,
          bold: true,
          size: 22,
        }),
      ],
      spacing: {
        before: 180,
        after: 180,
      },
    })
  );
}

function createExplanationContent(questions) {
  const content = [];
  questions.forEach((question, index) => {
    content.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${index + 1}. ${question.question}`,
            bold: true,
            size: 22,
          }),
        ],
        spacing: {
          before: 200,
          after: 120,
        },
      })
    );

    if (question.concept) {
      content.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Concept: ${question.concept}`,
              bold: true,
              size: 20,
            }),
          ],
          spacing: { after: 120 },
        })
      );
    }
    content.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Correct Answer: ${getCorrectOption(question)}`,
            bold: true,
            size: 21,
          }),
        ],
        spacing: { after: 120 },
      })
    );
    content.push(
      new Paragraph({
        children: [
          new TextRun({
            text:
              question.explanation ||
              "No explanation available.",
            size: 21,
          }),
        ],
        spacing: {
          after: 300,
          line: 276,
        },
      })
    );
  });
  return content;
}

function createWordDocument(chapter, title, content) {
  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
            },
            margin: {
              top: 1200,
              right: 1020,
              bottom: 1200,
              left: 1020,
              header: 500,
              footer: 500,
            },
          },
        },
        headers: {
          default: createHeader(chapter, title),
        },
        footers: {
          default: createFooter(),
        },
        children: content,
      },
    ],
  });
}

export async function exportAviationWord({
  chapter,
  questions,
}) {
  if (!questions || !questions.length) {
    throw new Error("No questions available to export.");
  }

  const chapterName = chapter || "Aviation";
  const filename = sanitizeFilename(chapterName);
  const documents = [
    {
      title: "Question Paper",
      suffix: "Question-Paper",
      getContent: createQuestionPaperContent,
    },
    {
      title: "Answer Key",
      suffix: "Answer-Key",
      getContent: createAnswerKeyContent,
    },
    {
      title: "Explanations",
      suffix: "Explanations",
      getContent: createExplanationContent,
    },
  ];

  for (const item of documents) {
    const content = item.getContent(questions);
    const doc = createWordDocument(
      chapterName,
      item.title,
      content
    );
    const blob = await Packer.toBlob(doc);
    saveAs(
      blob,
      `${filename}-${item.suffix}.docx`
    );
    // Small delay between browser downloads
    await new Promise((resolve) =>
      setTimeout(resolve, 500)
    );
  }
}
