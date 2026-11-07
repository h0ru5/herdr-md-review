#!/bin/sh
# Installs md-review: the herdr markdown-panel mod (with a Done button),
# the md-review command, the alt-m key, and the agent rule for Claude Code
# and opencode. Re-run after `git pull` to update. Safe to re-run.
set -e
repo=$(cd "$(dirname "$0")" && pwd)
home=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
bin=${BIN_DIR:-$HOME/.local/bin}

mkdir -p "$home/mods" "$bin"
mod=$home/mods/markdown-panel
# A copy, not a link: herdr loads no icons from outside its home.
rm -rf "$mod" && cp -R "$repo/markdown-panel" "$mod"
ln -sf "$repo/bin/md-review" "$bin/md-review"

# alt-m opens the panel, unless alt-m is already taken.
python3 - "$home/keys.json" <<'EOF'
import json, os, sys
p = sys.argv[1]
k = json.load(open(p)) if os.path.exists(p) else {}
g = k.setdefault("global", {})
if g.get("alt-m", "mod.open:markdown-panel") != "mod.open:markdown-panel":
    print(f"alt-m is bound to {g['alt-m']}; not changed. Bind mod.open:markdown-panel in {p}.")
else:
    g["alt-m"] = "mod.open:markdown-panel"
    with open(p, "w") as f: json.dump(k, f, indent=2); f.write("\n")
EOF

# Claude Code: a SessionStart hook adds the rule, only in herdr terminals.
[ -d "$HOME/.claude" ] && python3 - "$HOME/.claude/settings.json" <<'EOF'
import json, os, sys
p = sys.argv[1]
s = json.load(open(p)) if os.path.exists(p) else {}
starts = s.setdefault("hooks", {}).setdefault("SessionStart", [])
cmd = "md-review --rule"
if not any(h.get("command") == cmd for e in starts for h in e.get("hooks", [])):
    starts.append({"hooks": [{"type": "command", "command": cmd}]})
    with open(p, "w") as f: json.dump(s, f, indent=2); f.write("\n")
    print(f"SessionStart hook added to {p}")
EOF

# The rule as a file block, between markers so a re-run replaces it.
drop_rule() { [ -f "$1" ] && sed -i.bak '/<!-- md-review-begin -->/,/<!-- md-review-end -->/d' "$1" && rm -f "$1.bak"; return 0; }
add_rule() {
  [ -d "$(dirname "$1")" ] || return 0
  touch "$1"; drop_rule "$1"
  { printf '\n<!-- md-review-begin -->\n'; cat "$repo/rule.md"; printf '<!-- md-review-end -->\n'; } >> "$1"
  echo "rule added to $1"
}
drop_rule "$HOME/.claude/CLAUDE.md"  # older installs put it there; the hook replaces it
# opencode: a global rule. Its commands may run in a server without herdr's
# environment, so md-review itself tells the agent when to use chat instead.
add_rule "$HOME/.config/opencode/AGENTS.md"

command -v herdr-app >/dev/null && herdr-app check "$mod" || echo "herdr-app not found: install herdr, then run: herdr-app check $mod"
case ":$PATH:" in *":$bin:"*) ;; *) echo "add $bin to PATH";; esac
