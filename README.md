# herdr-md-review

Review the Markdown files your agents write (plans, drafts, specs) in a herdr
panel, and hand your edits back to the agent.

- The agent runs `md-review plan.md` in the background. The file opens in
  herdr's markdown panel.
- You read it and type comments or changes straight into the file.
- You click **Done**. `md-review` exits and prints your changes as a diff,
  which the agent reads as your review.

`alt-m` opens the panel yourself, with the Markdown files of the focused
pane's folder. `md-review --no-wait <file>` only opens the file.

## Install

```sh
git clone <this repo> ~/git/herdr-md-review
~/git/herdr-md-review/install.sh
```

It copies the mod into `~/.config/herdr-app/mods/`, links `md-review` into
`~/.local/bin`, binds `alt-m`, and adds the agent rule to
`~/.claude/CLAUDE.md` and `~/.config/opencode/AGENTS.md` (if those folders
exist). Re-run it after `git pull`; it is safe to run twice. Needs `python3`.

## Notes

- `markdown-panel/` is the
  [herdr-kanso](https://github.com/jlopezlira/herdr-kanso) markdown panel by
  jlopezlira (Apache-2.0), without its macOS file handler, plus a Done
  button in `main.js` (look for `done(cx)`).
- Closing the panel with × is not Done: the agent keeps waiting.
- Files on SSH machines open read-only and have no Done button.
