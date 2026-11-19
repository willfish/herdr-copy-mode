import assert from "node:assert/strict";
import test from "node:test";
import { terminalText } from "../mods/copy-mode/text.js";

const at = (row, col) => ({ row, col });
const range = (row, col, row2, col2) => ({ start: at(row, col), end: at(row2, col2) });
const text = (value, cols = 80) => terminalText(value, cols, 40, { first: 0 });

test("URL objects seek forward or contain the cursor, excluding sentence punctuation", () => {
  const first = "https://example.test/a(bar)?x=2";
  const second = "www.example.test/link";
  const model = text(`中 (${first}), then\n<${second}>!`);
  const a = range(0, 4, 0, 3 + first.length);
  const b = range(1, 1, 1, second.length);
  for (const col of [0, 4, 12, 3 + first.length]) assert.deepEqual(model.object(at(0, col), "au"), a);
  assert.deepEqual(model.object(at(0, 4 + first.length), "au"), b);
  assert.equal(model.object(at(1, second.length + 1), "au"), null);
  assert.equal(text("me@www.example.test, ftp://example.test, https://!").object(at(0, 0), "au"), null);
});

test("URL endpoints follow soft wraps but URLs never join hard lines", () => {
  const url = "https://example.test/path";
  const soft = text(`say ${url}.`, 16);
  assert.deepEqual(soft.object(at(1, 2), "au"), range(0, 4, 1, 4 + url.length - 17));
  assert.equal(text("https://\nexample.test").object(at(0, 0), "au"), null);
});

test("agent commands select whole rows including prompts, padding and soft wraps", () => {
  const commands = [
    "claude --resume synthetic-0001",
    "agy --conversation=synthetic-0002",
    "pi --session synthetic-0003",
    "opencode -s ses_synthetic0004",
    "codex resume <SESSION_ID>",
    "omp --resume './sessions/synthetic-0006'",
  ];
  const model = text(commands.map((line) => `  user@host:~$ ${line}  `).join("\n"));
  for (let row = 0; row < commands.length; row++) {
    assert.deepEqual(model.object(at(row, 78), "aa"), range(row, 0, row, 79));
  }
  const soft = text(`❯ ${commands[0]}\nNext row`, 16);
  assert.deepEqual(soft.object(at(1, 10), "aa"), range(0, 0, 1, 15));
});

test("labelled session output selects the command row, with spaces and alignment", () => {
  const model = text("Session   Jibbery origin question\nContinue   opencode -s ses_e0be9f7cdffeRa2XPiv4cNF9Cn\nfutile text");
  assert.deepEqual(model.object(at(1, 9), "aa"), range(1, 0, 1, 79));
  assert.deepEqual(model.object(at(1, 13), "aa"), range(1, 0, 1, 79));
});

test("agent detection skips prose, unknown flags and short IDs", () => {
  const model = text("please resume work\nclaude --resume short\nopencode -s --unrelated\n  omp --resume /some/path");
  assert.deepEqual(model.object(at(0, 0), "aa"), range(3, 0, 3, 79));
  assert.equal(model.object(at(4, 0), "aa"), null);
});

test("line objects select the current line only, with and without explicit padding", () => {
  const model = text("  alpha beta  \nnext\n  \ntrailing", 16);
  assert.deepEqual(model.object(at(0, 0), "al"), range(0, 0, 0, 15));
  assert.deepEqual(model.object(at(0, 5), "il"), range(0, 2, 0, 11));
  assert.equal(model.object(at(1, 0), "il").end.col > at(1, 0).col, true);
  assert.equal(model.object(at(2, 0), "il"), null);
  assert.deepEqual(model.object(at(2, 0), "al"), range(2, 0, 2, 15));
  assert.equal(model.object(at(0, 0), "il")?.end.row, 0);
});

test("soft-wrapped line objects span every physical row of the logical line", () => {
  const model = text("  a long wrapped line that is longer than sixteen cells here", 16);
  assert.deepEqual(model.object(at(0, 0), "il"), range(0, 2, 3, 11));
  assert.deepEqual(model.object(at(0, 0), "al"), range(0, 0, 3, 15));
});

test("loose indentation includes blank rows and inherits the logical indent on wraps", () => {
  const model = text("top\n  parent\n    nested here wraps\n\n    sibling\n  next\nout", 16);
  assert.deepEqual(model.object(at(1, 5), "ii"), range(1, 0, 6, 15));
  assert.deepEqual(model.object(at(3, 0), "ii"), range(2, 0, 5, 15));
  assert.deepEqual(model.object(at(4, 0), "ii"), range(2, 0, 5, 15));
  assert.equal(model.object(at(8, 0), "ii"), null);
});

test("brace objects choose the innermost enclosing pair or next opener", () => {
  const model = text("before {a {\n  b\n} c} after {}");
  assert.deepEqual(model.object(at(0, 0), "a{"), range(0, 7, 2, 3));
  assert.deepEqual(model.object(at(1, 2), "a{"), range(0, 10, 2, 0));
  assert.deepEqual(model.object(at(1, 2), "i{"), range(1, 0, 1, 2));
  assert.equal(model.object(at(2, 8), "i{"), null);
});
