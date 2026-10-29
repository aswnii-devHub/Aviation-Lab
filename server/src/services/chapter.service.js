"use strict";

const PAGE_MARKER = /^\s*--\s*(\d+)\s+of\s+(\d+)\s*--\s*$/;
const WORD_NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

function splitIntoPages(sourceText) {
  const pages = [];
  let currentPage = null;
  let total = null;
  let lines = [];
  for (const line of sourceText.split(/\r?\n/)) {
    const match = line.match(PAGE_MARKER);
    if (match) {
      if (currentPage !== null) pages.push({ number: currentPage, text: lines.join("\n").trim() });
      currentPage = Number(match[1]);
      total = Number(match[2]);
      lines = [];
    } else lines.push(line);
  }
  if (currentPage !== null) pages.push({ number: currentPage, text: lines.join("\n").trim() });
  return pages.length ? pages : [{ number: 1, text: sourceText.trim() }];
}

function normalizeText(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[’‘']/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function getHeadingCandidate(lines, index) {
  const raw = (lines[index] || "").trim();
  if (!raw || /(?:\.{2,}|…{2,})\s*\d+\s*$/.test(raw)) return null;

  // Layout A: "2 Airworthiness of Aircraft" / "Chapter 2: Airworthiness..."
  let match = raw.match(/^(?:chapter\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|\d{1,2})[.)]?(?:\s+([A-Za-z][A-Za-z0-9 ,/&()'’—–-]{2,110}))?$/i);
  if (!match) return null;

  const token = match[1].toLowerCase();
  const number = /^\d+$/.test(token) ? Number(token) : WORD_NUMBERS[token];
  let title = (match[2] || "").trim();

  // Some PDF layouts put only the chapter number on one line and the title on the next.
  if (!title) {
    for (let i = index + 1; i < Math.min(lines.length, index + 6); i++) {
      const candidate = (lines[i] || "").trim();
      if (!candidate || /^\d{1,3}$/.test(candidate) || /^chapter\s*$/i.test(candidate)) continue;
      if (/(?:\.{2,}|…{2,})\s*\d+\s*$/.test(candidate)) continue;
      title = candidate;
      break;
    }
  }

  const normalizedTitle = normalizeText(title);
  if (number < 1 || !normalizedTitle || normalizedTitle.length < 5) return null;
  if (/^(what|which|when|where|who|how|why|according|refer|select|state|is|are|does|do|can|could|should|would)\b/i.test(title)) return null;
  if (/^(questions?|answers?|contents?|index|introduction)$/i.test(title)) return null;

  const nearby = lines.slice(index + 1, index + 12).map(normalizeText);
  const repeated = nearby.some((s) => s === normalizedTitle || s.includes(normalizedTitle) || normalizedTitle.includes(s) && s.length > 12);
  const sectionStart = nearby.some((s) => /^(introduction|background|scope|definitions?)\b/.test(s));
  if (!repeated && !sectionStart) return null;

  return { number, title, lineIndex: index };
}

function isLikelyRealChapterTitle(title) {
  const value = String(title || '').trim();
  const normalized = normalizeText(value);
  if (normalized.length < 6) return false;
  // Question-bank entries and numbered exercise prompts are not chapter headings.
  if (/^(questions?|answers?|question bank|review questions?)\b/i.test(value)) return false;
  if (/^(what|which|when|where|who|how|why|according|refer|select|state|is|are|does|do|can|could|should|would)\b/i.test(value)) return false;
  if (/^\d{1,3}\s*[.)-]\s+/.test(value)) return false;
  if (/\b(question|questions|answers)\s*\d*\s*$/i.test(value)) return false;
  if (/(?:\.{2,}|…{2,})\s*\d+\s*$/.test(value)) return false;
  return true;
}

function findChapterStarts(pages) {
  const candidates = [];

  // CAE textbook chapter-opening layout:
  // [chapter title], [chapter number], [printed page number],
  // [chapter number], [same chapter title].
  // This pattern distinguishes real chapter openers from the table of contents.
  pages.forEach((page, pageIndex) => {
    const lines = page.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const title = lines[i];
      const normalizedTitle = normalizeText(title);
      if (!isLikelyRealChapterTitle(title) || /(?:\.{2,}|…{2,})/.test(title)) continue;
      if (/^(chapter|contents|introduction|questions|answers|index)$/i.test(title)) continue;

      // Third opener layout: title / printed page / chapter / title / chapter.
      if (/^\d{1,3}$/.test(lines[i + 1] || "")) {
        const chapterNumber = Number(lines[i + 2]);
        const repeatedTitle = normalizeText(lines[i + 3] || "");
        if (chapterNumber >= 1 && chapterNumber <= 99 &&
            (repeatedTitle === normalizedTitle || repeatedTitle.includes(normalizedTitle) || normalizedTitle.includes(repeatedTitle)) &&
            Number(lines[i + 4]) === chapterNumber) {
          candidates.push({
            number: chapterNumber, title, pageIndex, pageNumber: page.number,
            lineIndex: page.text.split(/\r?\n/).findIndex((line) => line.trim() === title),
            kind: "opener"
          });
          continue;
        }
      }

      for (let j = i + 1; j < Math.min(lines.length - 3, i + 4); j++) {
        if (!/^(?:[1-9]|[12]\d|3\d)$/.test(lines[j])) continue;
        const chapterNumber = Number(lines[j]);
        if (chapterNumber > 99 || !/^\d{1,3}$/.test(lines[j + 1])) continue;

        // Two observed layouts in the CAE PDF:
        // title / chapter / printed page / chapter / title
        // title / chapter / printed page / title / chapter
        const repeatedA = normalizeText(lines[j + 3] || "");
        const repeatedB = normalizeText(lines[j + 2] || "");
        const matchesTitle = (candidate) => candidate === normalizedTitle ||
          candidate.includes(normalizedTitle) || normalizedTitle.includes(candidate);
        const patternA = Number(lines[j + 2]) === chapterNumber && matchesTitle(repeatedA);
        const patternB = matchesTitle(repeatedB) && Number(lines[j + 3]) === chapterNumber;
        // Third layout: title / printed page / chapter / title / chapter.
        const patternC = /^\d{1,3}$/.test(lines[i + 1] || "") &&
          Number(lines[i + 2]) === chapterNumber &&
          matchesTitle(normalizeText(lines[i + 3] || "")) &&
          Number(lines[i + 4]) === chapterNumber;
        if (!patternA && !patternB && !patternC) continue;

        candidates.push({
          number: chapterNumber,
          title,
          pageIndex,
          pageNumber: page.number,
          lineIndex: page.text.split(/\r?\n/).findIndex((line) => line.trim() === title),
          kind: "opener"
        });
        break;
      }
    }
  });

  // Generic heading detection is retained for non-CAE PDFs and small test fixtures,
  // but real CAE opener sequences always take priority over loose numeric headings.
  if (candidates.length) {
    // A chapter number should map to one real chapter opener. The old code
    // accepted multiple different titles for the same chapter number, which
    // let question-bank entries appear as separate chapters in the UI.
    const unique = [];
    const seenNumbers = new Set();
    for (const candidate of candidates.sort((a, b) => a.pageIndex - b.pageIndex)) {
      if (seenNumbers.has(candidate.number)) continue;
      seenNumbers.add(candidate.number);
      unique.push(candidate);
    }
    return unique.sort((a, b) => a.pageIndex - b.pageIndex);
  }

  pages.forEach((page, pageIndex) => {
    const lines = page.text.split(/\r?\n/);
    lines.forEach((_, lineIndex) => {
      const heading = getHeadingCandidate(lines, lineIndex);
      if (heading && isLikelyRealChapterTitle(heading.title)) candidates.push({ ...heading, pageIndex, pageNumber: page.number, kind: "fallback" });
    });
  });

  const deduped = [];
  const seenNumbers = new Set();
  for (const candidate of candidates.sort((a, b) => a.pageIndex - b.pageIndex || a.lineIndex - b.lineIndex)) {
    if (seenNumbers.has(candidate.number)) continue;
    seenNumbers.add(candidate.number);
    deduped.push(candidate);
  }
  return deduped;
}

function isExcludedChapter(title) {
  const normalized = normalizeText(title);

  return (
    /^(revision questions?|index)$/.test(normalized)
  );
}



function parseContentsEntries(pages) {
  const entries = [];
  const seen = new Set();

  // Find the actual Contents section near the beginning of the book.
  const contentsIndex = pages.findIndex((page, index) => {
    if (index > 40) return false;

    return page.text
      .split(/\r?\n/)
      .some((line) => /^\s*(table of )?contents\s*$/i.test(line));
  });

  if (contentsIndex === -1) {
    return [];
  }

  // A Contents row must have:
  // chapter number + title + dotted leader + printed page number.
  const rowPattern =
    /^\s*(\d{1,2})\s*[.)]\s+(.+?)\s+((?:\.\s*){3,}|…{2,})\s*(\d{1,4})\s*$/;

  // Read only the contiguous Contents pages.
  // Stop as soon as the next page no longer contains chapter entries.
  for (let p = contentsIndex; p < Math.min(pages.length, contentsIndex + 10); p++) {
    const pageEntries = [];

    for (const line of pages[p].text.split(/\r?\n/)) {
      const match = line.match(rowPattern);
      if (!match) continue;

      const number = Number(match[1]);
      const title = match[2].trim();
      const startPage = Number(match[4]);
      const normalizedTitle = normalizeText(title);

      if (!number || !title || !startPage) continue;

      if (/^(revision questions?|index)$/.test(normalizedTitle)) {
        continue;
      }

      pageEntries.push({ number, title, startPage });
    }

    // The first Contents page can have a heading above its entries.
    // Subsequent pages must continue to look like Contents pages.
    if (pageEntries.length === 0) {
      if (p === contentsIndex) continue;
      break;
    }

    for (const entry of pageEntries) {
      const key = `${entry.number}:${normalizeText(entry.title)}`;

      if (seen.has(key)) continue;

      seen.add(key);
      entries.push(entry);
    }
  }

  return entries.sort((a, b) => a.number - b.number);
}

function detectChapters(sourceText) {
  if (typeof sourceText !== "string" || !sourceText.trim()) {
    return [];
  }

  const pages = splitIntoPages(sourceText);

  // Contents only. Never scan body headings or Index pages as a fallback.
  return parseContentsEntries(pages);
}


// function detectChapters(sourceText) {
//   if (typeof sourceText !== "string" || !sourceText.trim()) {
//     return [];
//   }

//   const pages = splitIntoPages(sourceText);

//   // The Contents entries are the source of truth.
//   const contentsEntries = parseContentsEntries(pages);

//   if (contentsEntries.length > 0) {
//     return contentsEntries;
//   }

//   // Fallback for documents that do not contain a parseable Contents section.
//   const starts = findChapterStarts(pages);
//   const seen = new Set();

//   return starts
//     .filter((chapter) => {
//       if (/^(revision questions?|index)$/i.test(chapter.title.trim())) {
//         return false;
//       }

//       const key = `${chapter.number}:${normalizeText(chapter.title)}`;

//       if (seen.has(key)) return false;
//       seen.add(key);
//       return true;
//     })
//     .map(({ number, title, pageNumber }) => ({
//       number,
//       title,
//       startPage: pageNumber,
//     }));
// }

function selectChapter(sourceText, requested) {
  if (typeof sourceText !== "string" || !sourceText.trim()) throw new Error("Please provide readable document text.");
  const request = requested && typeof requested === "object" ? requested : { chapter: requested };
  const chapterInput = String(request.chapter ?? "").trim();
  const titleInput = String(request.title ?? "").trim();
  if (!chapterInput && !titleInput) throw new Error("Specify a chapter number or title.");

  const pages = splitIntoPages(sourceText);
  const headings = findChapterStarts(pages);
  let start;

  if (/^\d+$/.test(chapterInput)) {
    const n = Number(chapterInput);
    const candidates = headings.filter((h) => h.number === n);
    start = candidates[0] || null;
    // A numbered title may recur as a running header; prefer a candidate with real content after it.
    if (candidates.length > 1) {
      start = candidates.find((h) => {
        const nextHigher = headings.find((x) => x.number > n && x.pageIndex > h.pageIndex);
        return !nextHigher || nextHigher.pageIndex - h.pageIndex > 1;
      }) || candidates[0];
    }
    if (start && titleInput && normalizeText(start.title) !== normalizeText(titleInput)) {
      const matching = candidates.find((h) => normalizeText(h.title).includes(normalizeText(titleInput)));
      if (matching) start = matching;
    }
  } else {
    const target = normalizeText(titleInput || chapterInput);
    const matches = headings.filter((h) => normalizeText(h.title) === target || normalizeText(h.title).includes(target));
    if (matches.length > 1) throw new Error(`The title "${titleInput || chapterInput}" is ambiguous. Select a chapter number.`);
    start = matches[0] || null;
  }

  if (!start) throw new Error(`Chapter ${chapterInput || titleInput} was not found. The PDF may use an unsupported heading layout.`);
  const next = headings.find((h) => h.number > start.number &&
    (h.pageIndex > start.pageIndex || (h.pageIndex === start.pageIndex && h.lineIndex > start.lineIndex)));
  let boundaryPageIndex = next ? next.pageIndex : pages.length;
  if (next && next.kind === "opener" && next.pageIndex > start.pageIndex) {
    const previousPageIndex = next.pageIndex - 1;
    const previousText = pages[previousPageIndex].text;
    const normalizedPrevious = normalizeText(previousText);
    const nextTitle = normalizeText(next.title);
    const looksLikeChapterToc = normalizedPrevious.includes(nextTitle) &&
      (/chapter/i.test(previousText) || /\.{2,}|…{2,}/.test(previousText));
    if (looksLikeChapterToc) boundaryPageIndex = previousPageIndex;
  }

  const chunks = [];
  for (let p = start.pageIndex; p < pages.length; p++) {
    if (p >= boundaryPageIndex) break;
    const lines = pages[p].text.split(/\r?\n/);
    if (p === start.pageIndex) lines.splice(0, start.lineIndex);
    const content = lines.join("\n").trim();
    if (content) chunks.push({ number: pages[p].number, text: content });
  }

  const text = chunks.map((p) => p.text).join("\n\n").trim();
  if (text.length < 500) throw new Error(`Chapter ${chapterInput || titleInput} was detected, but only ${text.length} characters were extracted. Generation stopped to prevent bad questions.`);
  return {
    chapter: start.number, heading: `Chapter ${start.number}`, title: start.title,
    startPage: pages[start.pageIndex].number,
    endPage: chunks[chunks.length - 1].number,
    text
  };
}

module.exports = { splitIntoPages, findChapterStarts, detectChapters, selectChapter };
