const test = require("node:test");
const assert = require("node:assert/strict");
const { selectChapter, detectChapters } = require("../src/services/chapter.service");

const fixture = [
  "-- 1 of 5 --", "Contents", "Chapter 1 ........ 2", "Chapter 2 ........ 4", "Chapter 3 ........ 5",
  "-- 2 of 5 --", "Chapter 1", "Introduction to Aviation", "Chapter one sample material. ".repeat(30),
  "-- 3 of 5 --", "Chapter 2", "Principles of Flight", "Chapter two sample material. ".repeat(30),
  "-- 4 of 5 --", "More Chapter 2 sample material. ".repeat(30),
  "-- 5 of 5 --", "Chapter 3", "Aircraft Systems", "Chapter three sample material. ".repeat(30)
].join("\n");

test("detects chapters from page-marked fixture", () => {
  const chapters = detectChapters(fixture);
  assert.ok(chapters.some((c) => c.number === 2 && c.title === "Principles of Flight"));
});

test("selects chapter 2 and excludes chapter 3", () => {
  const result = selectChapter(fixture, 2);
  assert.equal(result.chapter, 2);
  assert.equal(result.startPage, 3);
  assert.equal(result.endPage, 4);
  assert.match(result.text, /Principles of Flight/);
  assert.doesNotMatch(result.text, /Aircraft Systems/);
});

test("rejects missing chapter", () => {
  assert.throws(() => selectChapter(fixture, 9), /was not found/);
});


test("handles aviation textbook opener layout and excludes next chapter", () => {
  const aviationPdfFixture = [
    "-- 1 of 4 --",
    "Contents",
    "2. Airworthiness of Aircraft ........ 53",
    "3. Aircraft Nationality and Registration Marks ........ 59",
    "-- 2 of 4 --",
    "53",
    "2 Airworthiness of Aircraft",
    "2",
    "Airworthiness of Aircraft",
    "-- 3 of 4 --",
    "Airworthiness of Aircraft",
    "2",
    "Introduction",
    "2.1 Background. The Chicago Convention established requirements. ".repeat(25),
    "-- 4 of 4 --",
    "59",
    "3 Aircraft Nationality and Registration Marks",
    "3",
    "Aircraft Nationality and Registration Marks",
    "Aircraft registration details. ".repeat(25)
  ].join("\n");

  const result = selectChapter(aviationPdfFixture, 2);
  assert.equal(result.title, "Airworthiness of Aircraft");
  assert.equal(result.startPage, 2);
  assert.equal(result.endPage, 3);
  assert.match(result.text, /2\.1 Background/);
  assert.doesNotMatch(result.text, /Aircraft registration details/);
});
