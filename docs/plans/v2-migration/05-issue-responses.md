# 0.10.0 issue sweep — per-issue disposition and draft replies

**Prerequisite reading:** `04-issue-triage.md` (the analysis this operationalizes).
**Status:** not yet posted. Nothing here has been sent to GitHub.

All 50 issues open at triage time, with the action to take and the text to post. Grouped
by action so the sweep can be worked group by group.

## Before posting

- [ ] **Wait until 0.10.0 is actually on PyPI.** Every draft below says "fixed in 0.10.0"
      in the present tense. Posting before `just publish` sends people to a version they
      cannot install.
- [ ] Groups A, B and E close on posting. Groups C, D and F stay open — post the
      comment, leave the issue.
- [ ] `$LINK` in the drafts = the 0.10.0 release URL, once it exists. `$REPO` = the repo
      URL, for the FAQ link.

Counts: A 19 · B 9 · C 2 · D 8 · E 9 · F 3 — **50 total.**

---

## Group A — close, fixed by the migration (19)

No code was written for these in the 0.10.0 cycle. The architecture change fixed them.

### A1. Background image (7): #93, #142, #133, #129, #119, #70, #143

> Fixed in 0.10.0 ($LINK).
>
> The root cause was shared by all of these: 0.9.x resolved `background_image` to a
> Streamlit media-endpoint URL, and the frontend then fetched it **from inside an
> iframe**. Any deployment that rewrote, scoped or proxied that URL — Streamlit Cloud, a
> `--server.baseUrlPath`, GCP, a multipage app — broke the fetch, and the canvas came up
> blank.
>
> 0.10.0 resolves the image to a `data:` URI entirely on the Python side, and Components
> v2 removes the iframe. There is no fetch left to fail. `background_image` also now
> accepts anything `st.image` does: a URL, a `data:` URI, a local path, raw bytes, or a
> PIL Image.
>
> Note that 0.10.0 requires Streamlit >= 1.53 and Python >= 3.10.

For **#143** specifically, add:

> Your intermittent-404 diagnosis was right, and thanks for the fork. The loader now also
> carries a generation guard, so a superseded image can't land on top of a newer one, and
> a failed load is un-memoized so the next rerun retries.

### A2. Private Streamlit API (1): #157

> Fixed in 0.10.0 ($LINK). `image_to_url` was a private Streamlit API that moved and
> changed signature; 0.10.0 calls no Streamlit internals to resolve images. Duplicate of
> #156.

### A3. Toolbar theming (2): #104, #63

> Fixed in 0.10.0 ($LINK). Toolbar icons are now inline SVG drawn with `currentColor`
> bound to Streamlit's `--st-text-color`, so they follow the active theme, dark mode
> included. This replaces the old PNGs and the `filter: invert(...)` recolour hack.

**#63 is only partly addressed** — it also asked to change the *symbols*, which is still
unsupported. Either close citing the colour fix, or add:

> The colour half is fixed. Swapping the icons themselves for custom symbols isn't
> supported and isn't currently planned — happy to leave this open if that's the part you
> need.

### A4. Build toolchain (2): #135, #101

> Fixed in 0.10.0 ($LINK). The React 16 / `react-scripts@4` frontend is gone, replaced by
> Vite 8 on Node 24 — no `--openssl-legacy-provider`, no Node 16 pin, and no dev-server
> handshake for the component to fail. Node 24+ is now the documented requirement.

### A5. Lifecycle / iframe (6): #137, #95, #84, #138, #141, #77

> Fixed in 0.10.0 ($LINK).
>
> These all traced to the v1 architecture: the component lived in an iframe whose height
> was negotiated with the host, and React remounted the canvas on every rerun. That
> produced the blinking, the disappearing canvas, the self-clearing results and the
> reload loops.
>
> In 0.10.0 there is no iframe, and the canvas instance is held outside the render path,
> so it survives unrelated reruns intact — including its undo history. Covered by
> regression tests in `e2e_playwright/canvas_isolation_test.py`.

For **#141**, add — it makes a specific claim worth answering directly:

> Specifically tested: a canvas under the 300px height you identified, with a
> `session_state` key set before it and read back after. The key survives, both on first
> load and across an unrelated rerun.

### A6. Stale (1): #10

> Polygon mode shipped in 0.8.0 and is still present in 0.10.0 as
> `drawing_mode="polygon"`. Closing as done — sorry this sat open so long.

---

## Group B — close, implemented in 0.10.0 (9)

### B1. `json_data` documentation (6): #96, #150, #82, #121, #100, #151

Answered by the new `FAQ.md`. Post the shared line plus the issue-specific answer.

> 0.10.0 ($LINK) adds [FAQ.md]($REPO/blob/main/FAQ.md), a reference for the `json_data`
> structure and the behaviours that most often trip people up.

| Issue | Add |
|---|---|
| #96 | Exactly what you asked for — including the `scaleX`/`scaleY`-after-transform trap from #36 that cost you the time. |
| #150 | Freedraw points are already in the payload, as `Path.path` — an array of SVG segments. Note that Fabric *smooths* the stroke, so these are quadratic curves rather than your raw pointer samples. The FAQ shows how to extract a point list, and suggests `drawing_mode="point"` if you need exact coordinates. |
| #82 | Use `drawing_mode="point"` and read each object's `left`/`top`. |
| #121 | Canvas coordinates are in canvas pixels and are never rescaled to your source image. The FAQ has the conversion. |
| #100 | The cause is that an *unchanged* `initial_drawing` is deliberately not reloaded (it would wipe a drawing in progress), so never passing one means nothing ever clears. Key the widget on the uploaded file — example in the FAQ. |
| #151 | Deleting: switch to `transform` mode and double-click the shape. Now documented. **Naming/labelling shapes is not supported** — that half is tracked separately, see group D. |

### B2. `disabled` (1): #140

> Implemented in 0.10.0 ($LINK) as `st_canvas(..., disabled=True)`.
>
> The canvas renders read-only: drawing, selection and transforms are all inert, and
> nothing is sent back to Streamlit. `initial_drawing` still renders, so this is exactly
> your case — showing reviewed work back to a student without letting them edit it.
>
> One thing to know: the toolbar is hidden when `disabled=True`, regardless of
> `display_toolbar`. Undo, redo and reset would otherwise let a viewer mutate a canvas
> that is meant to be read-only.

### B3. `background_image_fit` (2): #103, #120

> Implemented in 0.10.0 ($LINK) as `st_canvas(..., background_image_fit="contain")`.
>
> The background image was previously stretched to fill the canvas on both axes.
> `"contain"` scales it uniformly and centres it, so a canvas larger than its image gets
> margins instead of a distorted image. `"stretch"` remains the default, so nothing
> changes unless you ask for it.
>
> #103: this replaces the pad-the-image-then-unpad workaround. #120: this is the
> aspect-ratio preservation you implemented by hand.
>
> With `"contain"` the coordinate mapping back to source-image pixels gains an offset —
> the FAQ has the arithmetic.

---

## Group C — keep open, post without claiming a fix (2): #144, #105

Mobile touch is *likely* fixed for free (Fabric 7 uses Pointer Events and sets
`touch-action: none` itself), but the verification attempt was inconclusive — the test
failed and it was never established whether that was the component or the test harness.
Partial work is preserved in `git stash`; see `04-issue-triage.md` F4.

**Decided 2026-09-03: F4 is dropped for 0.10.0.** Mobile isn't a priority for this
release, and it was already broken in 0.9.x, so shipping without it regresses nothing.

Post this — do **not** claim a fix:

> 0.10.0 ($LINK) replaces the entire frontend, including Fabric.js 4 → 7, which moves to
> Pointer Events and should address the mouse/touch split behind this. I haven't been able
> to verify it on real hardware, so I'd rather not claim it fixed. If you're still using
> this, could you retest on 0.10.0 and report back? Leaving open until someone confirms.

Note on **#105**: **polygon mode still needs a right-click to close a shape**,
so polygons remain unusable on touch regardless of the above. That's group D / #109.

---

## Group D — keep open, deferred past 0.10.0 (8)

Post to set expectations. Do not close.

| Issue | Comment |
|---|---|
| #17, #110 | Still wanted, and now the most likely next feature — Fabric's `IText` makes it tractable. Deliberately not in 0.10.0: that release is a full frontend rewrite, and adding a new `drawing_mode` on top of it would have made every rendering bug ambiguous. Tracking for 0.11.0. |
| #109 | Still open. A polygon closes only on right-click, which is undiscoverable and impossible on touch. The fix is to also close on clicking the start point, or on Escape — small, but it's the most stateful tool in the codebase, so it wants its own test pass rather than riding along with the rewrite. |
| #66 | Still open. Fabric removed its `EraserBrush` in v6+, so a true pixel eraser isn't available for free. A "delete the object under the cursor" mode is tractable and is what I'd build — flagging in case that isn't what you need. |
| #89 | Still open. Double-click-to-delete in transform mode is unconditional, which is the footgun you hit. Intended fix is to gate it behind a parameter and/or move deletion to the Delete key. Held back from 0.10.0 because the new FAQ documents double-click as *the* way to delete a shape (#151), so the two changes need to land together. |
| #87, #139 | Partly answered by 0.10.0's new FAQ: `left`/`top`/`width`/`height` describe the shape's path, not its painted extent, so a stroke straddles the reported box by roughly `strokeWidth / 2` on each side. That explains the spill-over. Whether the reported bounds should change is still open — it's the component's coordinate contract, so I don't want to change it casually. |
| #147 | Answered rather than fixed: right-click isn't recorded in `json_data`. In `point` mode only a left-click places a point; a right-click force-sends the current canvas. Now documented in the FAQ. Leaving open as a feature request if you need the distinction recorded. |

---

## Group E — close, out of scope (9)

Each cites the decision that rejected it, so the reply isn't just "no".

| Issue | Comment |
|---|---|
| #154, #39 | Closing as won't-do, with reasons. A responsive canvas was considered for 0.10.0 and deliberately rejected: Fabric's coordinates live in canvas pixel space, so a canvas that resizes with the viewport makes every saved drawing depend on the screen it was drawn on — `json_data` from one visitor wouldn't line up with another's. Decision P9 in `docs/plans/v2-migration/00-plan.md`. Set `width`/`height` explicitly and scale on your side. |
| #99, #92 | Closing. Zoom, pan and an infinite canvas all need a viewport transform, which makes every coordinate in `json_data` ambiguous unless the transform is exported alongside it — the same problem as the responsive canvas, one step larger. Not planned. **Check what #111 actually resolved before answering #99.** |
| #94 | Closing as not planned. Pressure-sensitive stroke width needs a custom Fabric brush. Self-contained, and a good PR if anyone wants it. |
| #11 | Closing as not planned — still a reasonable feature, just not one anyone is working on. Happy to reopen for a PR. |
| #19, #40 | Closing both. #40 (SVG import) is the prerequisite for #19 (icon drag-and-drop), and #19 also implies an asset-hosting story this component doesn't have. Not planned. |
| #123 | Closing. Per-object ids, labels and automatic distinct colours need custom-property serialization *and* a way to set those properties — which realistically means the text/annotation work in #17 landing first. Follow #17. |

---

## Group F — low-hanging, considered but not built (2)

These were on the 0.10.0 shortlist (`04-issue-triage.md`, F5–F6) and were deferred to
0.11.0 to land the release. Keep open. F7/#88 also sat here and is now fixed — it moves to
the §1 sweep-close list.

| Issue | Comment |
|---|---|
| #97 | Still open, and close to fixed. Transform mode currently promotes every object to selectable/evented, which clobbers `selectable: false` and the `lock*` flags you set in `initial_drawing` — Fabric supports exactly what you want, and this component overrides it. The fix is a few lines, but it changes existing behaviour, so it wants a changelog entry and a release of its own. |
| #8 | Still open. Bring-forward / send-backward in transform mode is a contained change (Fabric has `bringObjectForward` / `sendObjectBackwards`); it just needs key bindings chosen and documented. |

---

## After the sweep

- [ ] Update `04-issue-triage.md`'s counts if any disposition changed while posting
- [ ] #63 and #151 are **split** decisions — make sure the half you are not fixing is
      either called out in the comment or left behind as a narrowed open issue
- [ ] Consider adding the v4 → v7 `type` case change (`"rect"` → `"Rect"`) to the
      CHANGELOG's Breaking section. It is in the FAQ, but it silently breaks
      `obj["type"] == "rect"` checks and none of the issues above will surface it
