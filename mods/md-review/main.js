// Markdown panel, by jlopezlira (https://github.com/jlopezlira/herdr-kanso). Apache-2.0.
// Modified for md-review (https://github.com/h0ru5/herdr-md-review): see "local addition".
// md-review (bin/md-review) leaves .md paths to open in data/md-review-open; watchOpens picks them up.
// doc.js and blocks.js are synced copies of kanso-panel's; edit those.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { appHome, exec, watchFolder, focused, spaces, props, closeOverlay, theme, home } from "herdr";
import { MarkdownDoc, tildePath } from "./doc.js";

const ICONS = "mods/md-review/icons";
const isMarkdown = (path) => /\.(md|markdown|mdx)$/i.test(path);
const folderOf = (path) => path.replace(/[\\/][^\\/]*$/, "") || "/";
const nameOf = (path) => path.split(/[\\/]/).at(-1);
const REMOTE_READ_MS = 3000;

// Reads and removes the paths waiting in the inbox; returns the newest.
export async function takeOpens(dir) {
  const r = await exec("sh", ["-c", 'for f in "$1"/*.path; do [ -f "$f" ] || continue; cat "$f"; printf "\\0"; rm -f "$f"; done', "sh", dir]);
  const paths = (r.stdout ?? "").split("\0").map((p) => p.trim()).filter((p) => p.startsWith("/"));
  return paths.at(-1) ?? null;
}

export function markdownIn(listing) {
  return listing.split("\n").map((l) => l.trim()).filter((l) => /\.(md|markdown|mdx)$/i.test(l))
    .toSorted((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b)).slice(0, 40);
}

// The focused pane's machine (null: this one) and folder. A pane on an SSH
// machine has a folder on that machine, so its files are listed and read there.
export function placeOf(focus, list, localHome) {
  const space = list.find((s) => s.id === focus?.space);
  const on = space?.machine ?? null;
  return { on, folder: focus?.cwd || space?.folder || (on ? "" : localHome) };
}

export default class MarkdownPanel extends View {
  init(_props, cx) {
    this.doc = null; this.files = null;
    const { on, folder } = placeOf(focused(), spaces(), home());
    this.on = on; this.folder = folder;
    this.handle = cx.focus_handle();
    // Escape (local addition): leaves the block being edited, else closes the panel.
    // A binding, not on_key_down, because a focused Textarea takes Escape first.
    cx.bind_keys(["MdReview", "MdReview > Input"].map((context) => ({ keystroke: "escape", action: "md_review_escape", context })));
    this.recent = [];
    this.watchOpens(cx);
    this.list(cx);
    this.findRecent(focused()?.terminal, cx);
  }

  list(cx) {
    const on = this.on;
    cx.spawn(async (cx) => {
      // A machine's home when its pane told no folder: where its commands start.
      const folder = this.folder || (await exec("pwd", [], { on }).catch(() => null))?.stdout.trim() || "";
      this.folder = folder;
      const where = { cwd: folder || undefined, on };
      const git = await exec("git", ["ls-files", "--", "*.md", "*.markdown", "*.mdx"], where).catch(() => null);
      const out = git?.code === 0 && git.stdout.trim() ? git.stdout
        : (await exec("find", [".", "-maxdepth", "3", "-name", "node_modules", "-prune", "-o", "-type", "f", "(", "-iname", "*.md", "-o", "-iname", "*.mdx", ")", "-print"], where).catch(() => null))?.stdout ?? "";
      this.files = markdownIn(out.replace(/^\.\//gm, ""));
      cx.notify();
    });
  }

  // From this terminal (local addition): Markdown the focused terminal is talking
  // about (clipboard, paths on screen, its Claude scratchpad), from recent.sh.
  findRecent(terminal, cx) {
    if (this.on) return;
    cx.spawn(async (cx) => {
      const r = await exec("sh", [`${appHome()}/mods/md-review/recent.sh`, terminal ?? ""]).catch(() => null);
      this.recent = (r?.stdout ?? "").split("\n").filter((p) => p.startsWith("/"));
      cx.notify();
    });
  }

  watchOpens(cx) {
    const dir = `${appHome()}/data/md-review-open`;
    cx.spawn(async (cx) => {
      try {
        await exec("mkdir", ["-p", dir]);
        for (;;) {
          const path = await takeOpens(dir);
          if (path && isMarkdown(path)) this.open(path, cx);
          await watchFolder(dir);
        }
      } catch { /* no inbox: nothing opens from outside */ }
    });
  }

  // Saves what you typed in the file shown before, then shows this one.
  // on: the machine the file is on (null: this one); paths opened from outside are here.
  open(path, cx, on = null) {
    const before = this.doc;
    cx.spawn(async (cx) => {
      if (before && !(await before.flush())) { cx.notify(); return; }
      before?.release();
      this.doc = new MarkdownDoc(path, on, (to) => { if (isMarkdown(to)) this.open(to, cx, on); }, ICONS);
      this.doc.load(cx);
      this.watch(path, cx);
      cx.notify();
    });
  }

  // Another machine's folder can't be watched from here: read it every few seconds.
  watch(path, cx) {
    const doc = this.doc, dir = folderOf(path);
    const next = () => (doc.on ? cx.sleep(REMOTE_READ_MS) : watchFolder(dir));
    cx.spawn(async (cx) => {
      try { while (this.doc === doc) { await next(); if (this.doc === doc) doc.load(cx); } } catch {}
    });
  }

  close(cx) {
    const doc = this.doc, id = props()?.overlay;
    const done = () => { if (id) closeOverlay(id); };
    if (!doc) { done(); return; }
    cx.spawn(async (cx) => {
      if (!(await doc.flush())) { cx.notify(); return; }
      doc.release(); this.doc = null;
      done();
    });
  }

  // Done (local addition): saves, tells `md-review` the review is finished, closes.
  done(cx) {
    const doc = this.doc;
    if (!doc) return;
    cx.spawn(async (cx) => {
      if (!(await doc.flush())) { cx.notify(); return; }
      const dir = `${appHome()}/data/review-done`;
      await exec("sh", ["-c", 'mkdir -p "$1" && printf %s "$2" > "$1/$(date +%s)-$$.path"', "sh", dir, doc.path]);
      this.close(cx);
    });
  }

  back(cx) {
    const doc = this.doc;
    if (!doc) return;
    cx.spawn(async (cx) => {
      if (!(await doc.flush())) { cx.notify(); return; }
      doc.release(); this.doc = null;
      cx.notify();
    });
  }

  render() {
    const t = theme();
    const doc = this.doc;
    const button = (id, icon, tip, action) => div().id(id).p(4).rounded(6).cursor_pointer().text_color(t.muted).tooltip(tip)
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click((_e, cx) => action(cx))
      .child(svg(`${ICONS}/${icon}.svg`).size(14));
    return v_flex().id("md-review").key_context("MdReview").track_focus(this.handle)
      .on_action("md_review_escape", (_e, cx) => {
        if (doc && doc.active !== null) { doc.close(); cx.notify(); } else this.close(cx);
      }).size_full().min_h(0).bg(t.background).text_color(t.foreground).text_size(13)
      .on_key_down((e, cx) => doc?.key(e, cx))
      .child(h_flex().h(42).flex_none().px(10).gap(6).items_center().border_b(1).border_color(t.border)
        .when(Boolean(doc), (el) => el.child(button("md-back", "chevron-left", "Markdown in this folder", (cx) => this.back(cx))))
        .child(v_flex().flex_1().min_w(0).pl(doc ? 0 : 4)
          .child(div().truncate().font_semibold().child(doc ? nameOf(doc.path) : "Markdown"))
          .child(div().truncate().text_size(11).text_color(t.dim).child(tildePath(doc ? folderOf(doc.path) : this.folder, doc ? doc.on : this.on))))
        .children(doc ? doc.controls(t, "md") : [])
        .when(Boolean(doc) && !doc.editing, (el) => el.child(button("md-refresh", "refresh", "Read again", (cx) => doc.load(cx))))
        .when(Boolean(doc) && !doc.on, (el) => el.child(div().id("md-done").px(8).py(3).rounded(6).cursor_pointer().text_size(12)
          .bg(t.raised).border_1().border_color(t.border).tooltip("Review done: tell the agent").hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => this.done(cx)).child("Done")))
        .child(button("md-close", "close", "Close", (cx) => this.close(cx))))
      .child(doc ? doc.body(t, "md-doc") : this.listView(t));
  }

  listView(t) {
    const files = this.files ?? [], recent = this.recent;
    const row = (id, name, sub, open) => h_flex().id(id).flex_none().h(30).px(10).gap(8).items_center().rounded(6).cursor_pointer()
      .hover((s) => s.bg(t.hover)).on_click((_e, cx) => open(cx))
      .child(div().flex_none().truncate().child(name))
      .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(sub));
    const heading = (text) => div().px(10).pt(8).pb(2).text_size(11).text_color(t.dim).child(text);
    const empty = this.files === null ? "Looking for Markdown…" : "No Markdown files in this folder.";
    return div().id("md-files").flex_1().min_h(0).overflow_y_scrollbar().p(6)
      .when(recent.length > 0, (el) => el.child(heading("From this terminal"))
        .children(recent.map((p, i) => row(`md-recent-${i}`, nameOf(p), tildePath(folderOf(p), null), (cx) => this.open(p, cx)))))
      .when(recent.length > 0, (el) => el.child(heading("In this folder")))
      .when(!files.length, (el) => el.child(div().px(10).py(6).text_size(12.5).text_color(t.dim).child(empty)))
      .children(files.map((f, i) => row(`md-file-${i}`, nameOf(f), f.includes("/") ? folderOf(f) : "", (cx) => this.open(`${this.folder}/${f}`, cx, this.on))));
  }
}
