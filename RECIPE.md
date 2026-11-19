# Herdr Copy Mode

Select and yank terminal output with Vim keys in the pane where it appeared. The terminal stays visible; only its native selection changes.

![Herdr Copy Mode selecting text in a synthetic terminal pane](preview.png)

## What you see

The existing Herdr window, using its own theme, fonts and pane layout. The copy cursor is a one-cell native selection. When you extend a selection, the pane highlights the range in its usual selection color. `/` shows Herdr's find bar inside the terminal. There are no widgets for agent status and no new tab or visible popup.

## How it behaves

Bind `Ctrl+B`, then `[`, in the terminal context. Start at the program cursor, or the bottom-left visible cell when the pane is already scrolled back. Move with `hjkl` or arrows; use `PageUp`/`PageDown` or `Ctrl+B`/`Ctrl+F` for pages, `0`/`$` or `Home`/`End` for line edges, and `g`/`G` for the history boundaries.

`v` or `Space` anchors characterwise selection. `V` selects the entire rendered row, and vertical motions extend the range to whole rows in either direction. Before selecting, `w`, `b` and `e` move over Ghostty's native word boundaries. `y` or `Enter` yanks only in visual mode, then exits. `q` or `Esc` cancels. Leaving clears the selection and restores the entry scroll offset. `/` exits copy mode, hands focus to the native find field and lets Herdr handle the query and next/previous matches. No copy mode keys reach the PTY while the mod holds focus.

## Built from

- `mods/copy-mode/` is a Herdr Desktop JavaScript mod with `"place": "none"` and a `0×0` frameless popup. The popup holds a GPUI focus handle without drawing or dimming anything. It is not a terminal view.
- `keys.json` is a merge snippet, not a replacement keymap. The entry action is `mod.open:copy-mode`; a personal prefix mod can dispatch the same action on `[`.
- The Rust program in `src/main.rs` generates the checked-in transition table. No Rust binary ships with the mod. The JavaScript view reads `focused()`, `terminals()` and `panes()`, and calls `terminal.select`, `terminal.adjust_selection`, `terminal.clear_selection`, `terminal.copy`, `terminal.scroll` and `terminal.search`. A private `nextCommand()` acknowledgement waits for each batch of native edits before applying queued keys. It never reads terminal output, runs a program or makes a network request.
- `preview.png` is a screenshot of Herdr Desktop 0.1.16 with synthetic build output and an active keyboard selection.

## Watch out

- Require Herdr Desktop 0.1.16 or later for the terminal selection commands. Target a normal, live model pane only. Do not replace this with an `hc read` snapshot or a separate terminal view.
- Ghostty counts absolute rows from the oldest retained history. Its native selection end provides the moving cell; do not count Unicode codepoints as columns. In move mode collapse the range to the moving cell once Desktop publishes the new endpoint. Preserve the anchor in visual mode.
- Build whole-row ranges from the lower right edge to the upper left edge: Ghostty's native `down` adjustment skips blank rows. Limit the range to 1,000 display rows including the anchor. Soft-wrapped rows count separately.
- Word probes replace the native selection, so restrict them to movement before a visual anchor. Use the endpoints from `mode: "word"`; separator runs are tokens too. The search API opens find but does not expose match positions or a completion callback. Close copy mode before handing focus to search, without promising `n`/`N` or resuming the visual selection.
- Herdr can assign existing window shortcuts before raw key handling. Keep the person's other bindings and resolve any prefix collision. On Linux, native selections can set PRIMARY independently of clipboard yank.

## Done when

- `herdr-app check mods/copy-mode` succeeds.
- From a live synthetic terminal, press `Ctrl+B [` and move with `hjkl`. `v`, more movement and `y` copy the intended text without typing any of those keys into the program.
- `V` extends and contracts in both directions, including blank rows. Rapid movement followed immediately by `y` copies the final range.
- From the live screen, move into scrollback and press `Esc`. The original viewport returns and the regular clipboard is unchanged.
- `/` opens the same pane's find bar, an existing term is highlighted, and closing find returns ordinary keyboard input to the terminal.
- The gallery preview shows a real selection in an isolated app window displaying synthetic content.
