# Herdr Copy Mode

Vim-style keyboard selection for Herdr Desktop, like `prefix+[` in tmux or the Herdr TUI. You move and select in the pane itself, including scrollback, then yank to the clipboard. No popup, pager or extra terminal.

![Native terminal selection in a synthetic Herdr Desktop session](preview.png)

Requires **Herdr Desktop 0.1.16 or later**. Verified on Linux.

## Install

1. Copy `mods/copy-mode` into `~/.config/herdr-app/mods/`.
2. Add the binding from [`keys.json`](keys.json) to the `terminal` section of your own `keys.json`. Merge it; don't replace the file.
3. Check it loads: `herdr-app check ~/.config/herdr-app/mods/copy-mode`

The default binding is `Ctrl+B`, then `[`. Pick another if a program in the pane, such as tmux, needs that sequence.

## Quick start

| You want to | Press |
| --- | --- |
| Copy a word | `Ctrl+B [`, move onto it, `v e y` |
| Copy a whole line | `Ctrl+B [`, move onto it, `V y` |
| Copy a URL | `Ctrl+B [`, `v a u y` |
| Copy an agent's resume command | `Ctrl+B [`, `v a a y` |
| Leave without copying | `q` or `Esc` |

## Keys

### Move

| Key | Moves to |
| --- | --- |
| `h` `j` `k` `l`, arrows | Left, down, up, right |
| `w` `b` `e` | Next word start, previous word start, word end. Punctuation counts as its own word |
| `W` `B` `E` | Same, but only whitespace separates words, so `src/main.rs` is one word |
| `0` `^` `$` | Start of row, first non-blank, last character |
| `{` `}` | Previous or next blank row |
| `Ctrl+U` `Ctrl+D` | Half a page up or down |
| `PageUp` `PageDown` | A page up or down (`Ctrl+B` / `Ctrl+F` too, unless `Ctrl+B` is your prefix) |
| `g` `G` | Oldest or newest line in the scrollback |

### Select and copy

| Key | Does |
| --- | --- |
| `v` or `Space` | Start a character selection. Movement extends it |
| `V` | Select whole rows. Up and down extend it |
| `y` or `Enter` | Copy the selection and leave |
| `q` or `Esc` | Leave without copying |
| `/` | Leave and open Herdr's find bar in the same pane |

### Text objects

Press `v` first, then the object. Each one replaces the current selection.

| Keys | Selects | Example: cursor anywhere on… | …selects |
| --- | --- | --- | --- |
| `vil` | The line, without leading or trailing spaces | `␣␣npm run build␣␣` | `npm run build` |
| `val` | The whole line, spaces included | `␣␣npm run build␣␣` | `␣␣npm run build␣␣` |
| `vau` | A URL, without trailing punctuation | `see (https://example.com/x).` | `https://example.com/x` |
| `vaa` | An agent's resume command | `Continue   opencode -s ses_e0be…` | `opencode -s ses_e0be…` |
| `vii` | The block at the cursor's indentation, blank lines included | an indented function body | the whole body |
| `vi{` `va{` | Inside or around the nearest `{…}` | `{a {b} c}` with the cursor on `b` | `b` or `{b}` |

`vau`, `vaa` and the brace objects jump forward to the next match if the cursor isn't on one, so you can grab the next URL without moving there first. `vil`, `val` and `vii` only act on where the cursor is.

`vaa` recognises these resume commands, wherever they appear in a row:

```text
claude --resume <id>        agy --conversation=<id>     pi --session <id>
opencode -s <id>            codex resume <id>           omp --resume <id-or-path>
```

## Good to know

- Copy mode starts at the program's cursor, or the bottom-left of the screen if you've scrolled up. When you leave, the pane scrolls back to where it was.
- Only `y` writes the clipboard. On Linux, Herdr may update the PRIMARY selection as you move.
- Search hands off to Herdr's native find bar. It can't move the copy cursor to a match, and there's no `n` / `N`.
- Motions and text objects read up to 1,000 lines of scrollback, or just the visible screen in full-screen apps such as editors.
- The mod maps plain terminal text back to screen cells. Complex Unicode, or output that changes mid-motion, can occasionally land a cell off.
- Brace objects match raw text, so braces inside strings and comments count. Indentation counts spaces, not tabs.
- Works in normal terminal panes, not terminal peeks or layout terminal blocks.

## Development

Rust defines the key policy and generates `mods/copy-mode/transitions.js`; `main.js` adapts it to Herdr Desktop. Installing the mod needs neither Rust nor Node.

```sh
cargo run --quiet > mods/copy-mode/transitions.js
./scripts/check          # Rust checks plus Node 22.15+ tests
herdr-app check mods/copy-mode
```

MIT. Motions follow [Herdr TUI 0.9.5](https://github.com/herdrdev/herdr/tree/v0.9.5/src/client/shell) where the Desktop API allows.
