import { View, div } from "gpui-kit";
import { closeOverlay, focused, nextCommand, panes, props, run, terminals } from "herdr";
import { transitions } from "./transitions.js";

const MAX_LINE_ROWS = 1000;
let session = 0;

function keyName({ key, key_char, modifiers }) {
  if (modifiers.alt || modifiers.platform) return null;
  if (modifiers.control) return modifiers.shift ? null : `ctrl-${key}`;
  if (key === "space" || key_char === " ") return "space";
  return key_char || (modifiers.shift && key.length === 1 ? key.toUpperCase() : key);
}

function sameCell(a, b) {
  return a.row === b.row && a.col === b.col;
}

export default class CopyMode extends View {
  init(_props, cx) {
    const overlay = props()?.overlay;
    if (!overlay) return; // `herdr-app check` loads without an overlay.
    this.overlay = overlay;
    this.mode = "move";
    const { terminal, pane, shown } = focused() ?? {};
    if (!terminal || !pane || shown || !terminals().some((t) => t.address === terminal && t.state === "live")) {
      closeOverlay(overlay);
      return;
    }

    this.terminal = terminal;
    this.pane = pane;
    this.queue = [];
    this.syncKey = `selection-sync-${++session}`;
    cx.spawn(async () => {
      while (!this.finished) {
        if (await nextCommand() === this.syncKey && !this.finished) {
          const acknowledge = this.acknowledge;
          this.acknowledge = null;
          acknowledge?.();
        }
      }
    });
    const scroll = this.scroll();
    this.entryOffset = scroll?.from_bottom;
    this.handle = cx.focus_handle();
    this.handle.focus();
    // The program cursor may not be visible in an already scrolled pane.
    const at = scroll?.from_bottom ? { row: scroll.offset + scroll.len - 1, col: 0 } : "cursor";
    this.select(at);
    this.ready = this.flush();
  }

  flush() {
    // On Desktop 0.1.16, run() posts to the window's FIFO. A command routed
    // back to this copy arrives after earlier edits publish their endpoints.
    return new Promise((resolve) => {
      this.acknowledge = resolve;
      run(`copy-mode.${this.syncKey}`);
    });
  }

  target() {
    if (this.finished) return null;
    const current = focused();
    return current?.pane === this.pane && current.terminal === this.terminal && !current.shown
      ? current
      : null;
  }

  selection() {
    return this.target()?.selection;
  }

  scroll() {
    const pane = panes().find((p) => p.pane === this.pane);
    return pane?.terminal === this.terminal ? pane.scroll : null;
  }

  select(at, mode = "cell") {
    run("terminal.select", { terminal: this.terminal, at, mode });
  }

  adjust(direction) {
    run("terminal.adjust_selection", { terminal: this.terminal, direction });
  }

  cleanup() {
    if (!this.terminal || this.finished) return;
    this.finished = true;
    this.acknowledge?.();
    run("terminal.clear_selection", { terminal: this.terminal });
    // Restore from a known origin, even if Esc closed the popup with a native
    // edit still in flight. The desktop runs both requests after prior edits.
    if (this.entryOffset != null) {
      run("terminal.scroll", { terminal: this.terminal, to: "bottom" });
      if (this.entryOffset > 0) {
        run("terminal.scroll", { terminal: this.terminal, lines: -this.entryOffset });
      }
    }
  }

  async close() {
    this.cleanup();
  }

  key(event, cx) {
    cx.stop_propagation();
    if (this.finished) return;
    const key = keyName(event);
    if (key == null || !Object.values(transitions).some((table) => Object.hasOwn(table, key))) return;
    this.queue.push(key);
    if (this.draining) return;
    this.draining = true;
    cx.spawn(async () => {
      try {
        await this.ready;
        while (!this.finished && this.queue.length) await this.apply(this.queue.shift());
      } finally {
        this.draining = false;
      }
    });
  }

  async anchorLine(at) {
    this.select({ row: at.row, col: 0 });
    this.adjust("line_end");
    await this.flush();
    const selected = this.selection();
    if (selected) {
      this.line = { anchor: at.row, row: at.row, lastCol: selected.end.col };
    }
  }

  async moveLine(direction) {
    const { anchor, row, lastCol } = this.line;
    const scroll = this.scroll();
    const visibleRows = scroll?.len ?? terminals().find((t) => t.address === this.terminal)?.rows;
    if (!visibleRows) return;
    const last = (scroll?.total ?? visibleRows) - 1;
    const target = {
      up: row - 1,
      down: row + 1,
      page_up: row - visibleRows,
      page_down: row + visibleRows,
      home: 0,
      end: last,
    }[direction];
    const next = Math.max(0, anchor - MAX_LINE_ROWS + 1, Math.min(last, anchor + MAX_LINE_ROWS - 1, target));
    if (next === row) return;

    // Ghostty's down skips blank rows. Build the range from the last cell
    // upward instead, so both edges are whole physical rows in either direction.
    const low = Math.min(anchor, next);
    const high = Math.max(anchor, next);
    this.select({ row: high, col: lastCol });
    let distance = high - low;
    for (; scroll && distance >= visibleRows; distance -= visibleRows) this.adjust("page_up");
    for (; distance > 0; distance--) this.adjust("up");
    this.adjust("line_start");
    await this.flush();
    if (!this.selection()) return;
    this.line.row = next;

    // A bottom-to-top native range follows its upper edge. When extending
    // downward, follow the actual copy cursor instead.
    const view = this.scroll();
    if (view && (next < view.offset || next >= view.offset + view.len)) {
      const lines = next < view.offset ? next - view.offset : next - (view.offset + view.len - 1);
      run("terminal.scroll", { terminal: this.terminal, lines });
      await this.flush();
    }
  }

  async moveWord(at, motion) {
    const previous = motion === "previous_start";
    this.select(at, "word");
    await this.flush();
    if (!this.target()) return;
    const word = this.selection();
    const edge = previous ? word?.start : word?.end;
    let target = edge ?? at;

    if (motion === "next_start" || !edge || sameCell(edge, at)) {
      this.select(target);
      this.adjust(previous ? "left" : "right");
      await this.flush();
      if (!this.target()) return;
      target = this.selection()?.end ?? at;
      if (motion !== "next_start" && !sameCell(target, at)) {
        this.select(target, "word");
        await this.flush();
        if (!this.target()) return;
        const next = this.selection();
        target = (previous ? next?.start : next?.end) ?? target;
      }
    }
    this.select(target);
    await this.flush();
  }

  async apply(key) {
    const selection = this.selection();
    if (!selection) {
      this.finish("cancel");
      return;
    }
    const table = transitions[this.mode];
    if (!Object.hasOwn(table, key)) return;
    const [mode, action, direction] = table[key];
    // A line's native end is its upper edge, not necessarily its moving row.
    const cursor = this.mode === "line" && this.line
      ? { row: this.line.row, col: 0 }
      : selection.end;
    this.mode = mode;
    switch (action) {
      case "anchor":
        this.select(cursor);
        await this.flush();
        break;
      case "anchor_line":
        await this.anchorLine(cursor);
        break;
      case "line":
        if (this.line) await this.moveLine(direction);
        break;
      case "word":
        await this.moveWord(cursor, direction);
        break;
      case "move":
      case "extend":
        this.adjust(direction);
        await this.flush();
        if (action === "move") {
          const moved = this.selection();
          if (moved && !sameCell(moved.start, moved.end)) {
            this.select(moved.end);
            await this.flush();
          }
        }
        break;
      default:
        this.finish(action);
    }
  }

  finish(action) {
    if (action === "yank") run("terminal.copy");
    this.cleanup();
    closeOverlay(this.overlay);
    if (action === "search") run("terminal.search");
  }

  render() {
    const root = div().id("copy-mode").w(0).h(0);
    return this.handle
      ? root.track_focus(this.handle).on_key_down((event, cx) => this.key(event, cx))
      : root;
  }
}
