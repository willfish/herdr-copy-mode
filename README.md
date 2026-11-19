# Herdr Copy Mode

Use Vim-style keys to select and copy text directly in a Herdr Desktop terminal pane, including its scrollback. The selection stays in the original pane.

![Native terminal selection in a synthetic Herdr Desktop session](preview.png)

Requires **Herdr Desktop 0.1.16 or later**, not the Herdr TUI. Verified on Linux. No runtime dependencies beyond Herdr and its core.

## Install

1. Copy `mods/copy-mode` into `~/.config/herdr-app/mods/` (or your `HERDR_APP_HOME`).
2. Merge the `terminal` entry from [`keys.json`](keys.json) into your existing keys. The default is `Ctrl+B`, then `[`. Do not replace your entire keys file. If you already use a prefix mod, add `[` to that mod's bindings to dispatch `mod.open:copy-mode` instead.
3. Run `herdr-app check ~/.config/herdr-app/mods/copy-mode`.

The standalone binding takes `Ctrl+B [` away from programs in the focused terminal. Choose another prefix if you need that exact sequence inside tmux.

## Keys

| Key | Action |
| --- | --- |
| `Ctrl+B`, then `[` | Enter copy mode in the active terminal pane |
| `h` `j` `k` `l` or arrows | Move left, down, up or right |
| `PageUp` / `PageDown` or `Ctrl+B` / `Ctrl+F` | Move by a page |
| `Ctrl+U` / `Ctrl+D` | Move by half a page |
| `0` / `Home`, `^`, `$` / `End` | Move to column zero, first nonblank, or last character of the display row |
| `g` / `G` | Move to the oldest or newest retained row |
| `w` / `b` / `e` | Next word start, previous word start, or next word end; separates punctuation like Herdr TUI |
| `W` / `B` / `E` | Same motions with whitespace as the only separator |
| `{` / `}` | Move to the previous or next blank row |
| `v` or `Space` | Anchor characterwise selection; movement now extends it |
| `V` | Select whole display rows; motions that change rows extend the range |
| `vil` | Select the non-space characters in the current line; wraps every display row of a soft-wrapped line |
| `val` | Select the full current line, including leading and trailing spaces; wraps every display row of a soft-wrapped line |
| `vau` | Select an HTTP(S) or `www.` URL, without surrounding sentence punctuation |
| `vaa` | Select an agent resume command line, including its harness-output label |
| `vii` | Select the indentation block at the cursor, including blank rows |
| `vi{` / `va{` | Select inside or around a balanced pair of braces |
| `y` or `Enter` | Copy the visual selection and quit; outside visual mode, just quit |
| `q` or `Esc` | Quit without yanking |
| `/` | Leave copy mode and open the same pane's built-in find bar |

The pane returns to its entry scroll offset when copy mode closes, as long as the history is still retained. Search uses Herdr's native find bar: type the query, navigate with `Enter` / `Shift+Enter`, and close with `Esc`. Search does not move the copy cursor or resume a visual selection. Start copy mode again after closing find.

Word motions can cross blank and wrapped rows, in move mode or with either visual selection. `V` counts wrapped rows separately. Selections span at most 1,000 display rows, including the anchor. `Ctrl+B` as a page key is unavailable if your configured prefix captures it; `PageUp` still works.

In visual mode, `al`, `il`, `au`, `aa`, `ii`, `i{` and `a{` replace the existing selection; they do nothing in move mode. `il` selects from the first to the last non-space cell; `al` selects all cells on it. Neither seeks to another line or span of wrapped output. URLs, agent commands and braces use the object at the cursor, or the next one in reading order. Agent commands recognize `claude --resume`, `agy --conversation=`, `pi --session`, `opencode -s`, `codex resume` and `omp --resume` anywhere in the row; their argument must still be a real ID or path-like token. A row prefixed by a label such as `Continue` selects the whole row. A soft-wrapped command selects all its display rows, but the native clipboard trims trailing spaces. Indentation counts spaces; from a blank row, the next nonblank row sets the indentation level. Braces are matched as terminal text, including braces inside strings and comments.

Text motions read fresh terminal text on demand, up to 1,000 history lines on the primary screen and none on the alternate screen. Desktop exposes a native selection but not the styled cell grid, so the mod maps plain text back to display rows and columns. Complex Unicode, reflow, and output that changes during a motion can make this mapping approximate. Navigation and yank still use the live pane.

The native selection starts at the program cursor, or the bottom-left of the viewport if you already scrolled up. This mod is for normal terminal panes, not terminal peeks, swapped-in terminals or layout terminal blocks. Unlike Herdr TUI, this mod doesn't offer in-mode search or `n` / `N`. On Linux, Herdr may update the PRIMARY selection while moving; only an explicit yank writes the regular clipboard.

## Development

Rust defines the key policy and generates `mods/copy-mode/transitions.js`; `main.js` adapts it to Desktop's focus and terminal commands. `scripts/check` also uses Node.js 22.15 or later to test the text motions and objects. A user installing the mod needs neither toolchain.

```sh
cargo run --quiet > mods/copy-mode/transitions.js
./scripts/check
herdr-app check mods/copy-mode
```

MIT, like the companion Rust plugins. The key behavior follows [Herdr TUI 0.9.5](https://github.com/herdrdev/herdr/tree/v0.9.5/src/client/shell) where the Desktop API allows it.
