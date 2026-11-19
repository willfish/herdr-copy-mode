import { View, div } from "gpui-kit";
import { closeOverlay, focused, panes, props, run, terminals } from "herdr";
import { transitions } from "./transitions.js";

function keyName({ key, key_char, modifiers }) {
  if (modifiers.alt || modifiers.platform) return null;
  if (modifiers.control) return modifiers.shift ? null : `ctrl-${key}`;
  if (key === "space" || key_char === " ") return "space";
  return key_char || (modifiers.shift && key.length === 1 ? key.toUpperCase() : key);
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
    const scroll = this.scroll();
    this.entryOffset = scroll?.from_bottom;
    this.handle = cx.focus_handle();
    this.handle.focus();
    // The program cursor may not be visible in an already scrolled pane.
    const at = scroll?.from_bottom ? { row: scroll.offset + scroll.len - 1, col: 0 } : "cursor";
    this.select(at);
  }

  scroll() {
    const pane = panes().find((p) => p.pane === this.pane);
    return pane?.terminal === this.terminal ? pane.scroll : null;
  }

  select(at) {
    run("terminal.select", { terminal: this.terminal, at });
  }

  cleanup() {
    if (!this.terminal || this.finished) return;
    this.finished = true;
    run("terminal.clear_selection", { terminal: this.terminal });
    const current = this.scroll()?.from_bottom;
    if (this.entryOffset != null && current != null && current !== this.entryOffset) {
      run("terminal.scroll", { terminal: this.terminal, lines: current - this.entryOffset });
    }
  }

  async close() {
    this.cleanup();
  }

  key(event, cx) {
    cx.stop_propagation();
    if (this.finished) return;
    const current = focused();
    if (current?.pane !== this.pane || current?.terminal !== this.terminal || !current.selection) {
      this.cleanup();
      closeOverlay(this.overlay);
      return;
    }
    const key = keyName(event);
    const table = transitions[this.mode];
    if (key == null || !Object.hasOwn(table, key)) return;
    const [mode, action, direction] = table[key];
    this.mode = mode;
    if (action === "anchor") {
      this.select(current.selection.end);
      return;
    }
    if (action === "move" || action === "extend") {
      run("terminal.adjust_selection", { terminal: this.terminal, direction });
      // Use Ghostty for cell geometry and scrolling, then collapse its range to a
      // one-cell cursor in move mode. Desktop publishes the updated end asynchronously.
      if (action === "move") {
        const token = {};
        this.motion = token;
        cx.timer.after(20, () => {
          const now = focused();
          if (this.motion === token && this.mode === "move" && !this.finished
            && now?.pane === this.pane && now.terminal === this.terminal && now.selection) {
            this.select(now.selection.end);
          }
        });
      }
      return;
    }
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
