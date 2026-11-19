import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// Stub Desktop's imports; exercise the real overlay dispatch and text mapping.
const herdr = `
  export const hc = (...args) => globalThis.readScreen(...args);
  export let closeOverlay, focused, nextCommand, panes, props, run, terminals;
`;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    const source = { herdr, "gpui-kit": "export class View {}; export let div;" }[specifier];
    return source
      ? { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true }
      : next(specifier, context);
  },
});
const { default: CopyMode } = await import("../mods/copy-mode/main.js");
hooks.deregister();

async function screen(cursor, last, text) {
  const grid = { cols: 32, height: 12, total: 12, offset: 0, primary: false };
  globalThis.readScreen = async (args) => {
    assert.deepEqual(args, ["read", "t1", "--json", "--lines", "0"]);
    return { code: 0, stdout: JSON.stringify({ how: "screen", text }) };
  };
  const view = Object.assign(new CopyMode(), {
    terminal: "t1",
    mode: "move",
    entryGrid: grid,
    grid: () => grid,
    target: () => true,
    selection: () => ({ start: cursor, end: { row: last, col: 31 } }),
    flush() {},
    scrollTo() {},
    select() {},
    adjust() {},
    renderCursor() {},
  });
  await view.initializeCursor();
  return view;
}

test("word ends follow a repaint without a new copy-mode entry", async () => {
  for (const key of ["e", "E"]) {
    const cursor = { row: 1, col: 1 };
    const view = await screen(cursor, 1, "\nuninterruptedlongword");
    await view.apply(key);
    assert.deepEqual(view.cursor, { row: 1, col: 20 });

    // The pane keeps the same size; the redraw changes words and adds a row.
    globalThis.readScreen = async () => ({
      code: 0,
      stdout: JSON.stringify({ how: "screen", text: "\nsample row with words\nNEW_FOOTER" }),
    });
    view.cursor = cursor;
    await view.apply("v");
    await view.apply(key);
    assert.deepEqual(view.anchor, cursor);
    assert.deepEqual(view.cursor, { row: 1, col: 5 });
  }
});

test("screen rows stay aligned when the native grid counts trailing chrome as text", async () => {
  const cursor = { row: 4, col: 10 };
  const view = await screen(cursor, 8,
    `\nNORTH\n${"x".repeat(32)}wrapped\n│        alpha.one   beta   │\nSOUTH`);
  await view.apply("v");
  for (const col of [13, 14, 17, 24]) {
    await view.apply("e");
    assert.deepEqual(view.cursor, { row: 4, col });
  }
  view.cursor = cursor;
  for (const col of [17, 24]) {
    await view.apply("E");
    assert.deepEqual(view.cursor, { row: 4, col });
  }
  assert.deepEqual(view.anchor, cursor);
});
