# herdr-md-review

Review the Markdown files your agents write (plans, drafts, specs) in a herdr
panel, and hand your edits back to the agent.

- The agent runs `md-review plan.md` in the background. The file opens in
  herdr's markdown panel.
- You read it and type comments or changes straight into the file.
- You click **Done**. `md-review` exits and prints your changes as a diff,
  which the agent reads as your review.

`alt-m` opens the panel yourself. It lists, first, the Markdown files the
focused terminal is talking about: a copied path, paths shown on its screen,
and the scratchpad of a Claude Code session in it. Then the files in the
pane's folder. Escape leaves the block you are editing, or closes the panel.
`md-review --no-wait <file>` only opens the file.

## Install

```sh
git clone <this repo> ~/git/herdr-md-review
~/git/herdr-md-review/install.sh
```

It copies the mod into `~/.config/herdr-app/mods/`, links `md-review` into
`~/.local/bin` and binds `alt-m`. It tells the agents about `md-review`:

- Claude Code: a SessionStart hook in `~/.claude/settings.json` runs
  `md-review --rule`, which prints the rule only inside herdr (herdr
  terminals set `HC_TERMINAL_ID`). Outside herdr, Claude never hears of it.
- opencode: the rule goes in `~/.config/opencode/AGENTS.md`, because its
  commands may run in a server without herdr's environment. Outside herdr,
  `md-review` exits with "not running inside herdr" and the agent asks in
  chat instead.

Re-run it after `git pull`; it is safe to run twice. Needs `python3`.

## Notes

- `mods/md-review/` is the markdown panel from
  [herdr-kanso](https://github.com/jlopezlira/herdr-kanso) by jlopezlira
  (Apache-2.0), renamed so both can be installed, without its macOS file
  handler. The added parts are marked "local addition" in `main.js`: the
  Done button, the Escape binding and the "From this terminal" list
  (`recent.sh`). `RECIPE.md` describes the whole mod for herdr.dev/mods.
- Closing the panel with × is not Done: the agent keeps waiting.
- Files on SSH machines open read-only and have no Done button.
