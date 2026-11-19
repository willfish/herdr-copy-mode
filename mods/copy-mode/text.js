// hc's plain-text read joins soft wraps and drops trailing empty rows.
const separators = "!\"#$%&'()*+,-./:;<=>?@[\\]^`{|}~";
const space = /^\p{White_Space}$/u;
const mark = /^\p{Mark}$/u;
const emoji = /^\p{Emoji_Presentation}$/u;

function width(ch) {
  const n = ch.codePointAt(0);
  return emoji.test(ch) || (n >= 0x1100 && (
    n <= 0x115f || n === 0x2329 || n === 0x232a ||
    (n >= 0x2e80 && n <= 0xa4cf && n !== 0x303f) ||
    (n >= 0xac00 && n <= 0xd7a3) || (n >= 0xf900 && n <= 0xfaff) ||
    (n >= 0xfe10 && n <= 0xfe19) || (n >= 0xfe30 && n <= 0xfe6f) ||
    (n >= 0xff01 && n <= 0xff60) || (n >= 0xffe0 && n <= 0xffe6) ||
    (n >= 0x20000 && n <= 0x3fffd)
  )) ? 2 : 1;
}

function cells(text) {
  const result = [];
  let join = false;
  let regional = false;
  for (const ch of text) {
    const n = ch.codePointAt(0);
    const flag = n >= 0x1f1e6 && n <= 0x1f1ff;
    const prev = result.at(-1);
    if (prev && (join || mark.test(ch) || ch === "\u200d" ||
        (n >= 0x1f3fb && n <= 0x1f3ff) || (n >= 0xe0020 && n <= 0xe007f) ||
        (regional && flag))) {
      if (join || ch === "\ufe0f" || ch === "\u20e3") prev.width = Math.max(prev.width, width(ch), 2);
      join = ch === "\u200d";
      regional = false;
      continue;
    }
    result.push({ width: width(ch), kind: space.test(ch) ? 0 : separators.includes(ch) ? 1 : 2 });
    join = false;
    regional = flag;
  }
  return result;
}

export function terminalText(text, cols, total, bounds) {
  const rows = [];
  const streams = [];
  for (const line of text.split("\n")) {
    const stream = [];
    streams.push(stream);
    let row = [];
    rows.push(row);
    let col = 0;
    for (const cell of cells(line)) {
      if (col + cell.width > cols) {
        row = [];
        rows.push(row);
        col = 0;
      }
      const point = { row: rows.length - 1, col, ...cell };
      row.push(point);
      stream.push(point);
      col += cell.width;
    }
  }
  const first = bounds.first ?? bounds.last + 1 - rows.length;
  const physicalRow = (row) => row < Math.max(0, first) || row >= total ? null
    : rows[row - first] ?? [];

  function spans(big) {
    const result = [];
    for (const stream of streams) {
      let run;
      for (const cell of stream) {
        const kind = big && cell.kind ? 1 : cell.kind;
        if (!kind) {
          run = null;
          continue;
        }
        const point = { row: cell.row + first, col: cell.col };
        if (run?.kind !== kind) {
          run = { kind, start: point, end: point };
          result.push(run);
        } else {
          run.end = point;
        }
      }
    }
    return result.filter(({ start }) => start.row >= 0);
  }

  const words = spans(false);
  const bigWords = spans(true);
  return {
    row: physicalRow,
    motion(at, key) {
      const row = physicalRow(at.row);
      if (!row) return null;
      if (key === "^") return { row: at.row, col: row.find(({ kind }) => kind)?.col ?? 0 };
      if (key === "$") return { row: at.row, col: row.at(-1)?.col ?? 0 };
      if (key === "{" || key === "}") {
        const step = key === "{" ? -1 : 1;
        for (let i = 1; i < 1000; i++) {
          const next = physicalRow(at.row + i * step);
          if (!next) break;
          if (next.every(({ kind }) => !kind)) return { row: at.row + i * step, col: 0 };
        }
        return null;
      }

      const rank = (point) => point.row * cols + point.col;
      const current = row.find(({ col, width }) => at.col >= col && at.col < col + width);
      const pos = rank(current ? { row: at.row, col: current.col } : at);
      const word = key === key.toUpperCase() ? bigWords : words;
      switch (key.toLowerCase()) {
        case "w":
          return word.find(({ start }) => rank(start) > pos)?.start ?? null;
        case "b":
          return word.findLast(({ start }) => rank(start) < pos)?.start ?? null;
        case "e":
          // A wide cell ends at its lead column for motion purposes.
          return word.find(({ end }) => rank(end) > pos)?.end ?? null;
      }
    },
  };
}
