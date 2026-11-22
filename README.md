# Open Threads

Open Threads is an Obsidian plugin that helps you remember what's still open with each person: things you asked for, things you're waiting on, and when you meant to check in again.

- Each thread is a normal note with properties (`type: thread`, `with`, `status`, `due`, `follow_up`…), so search and Bases can see it.
- People are your own notes: any note with `type: person` is a person. Nothing about people is stored in the plugin.
- A `threads` block in a person's note lists what's open with them, with what's past its date and what needs a check-in.
- Checking in keeps a one-line note in the thread's `## Log` and sets the next follow-up date.

It requires Obsidian 1.13 or later, and works on desktop and mobile.

## Use

1. Add `type: person` to the properties of each person's note. Add `active: false` to hide someone from the pickers; their threads stay listed.
2. Run **Open Threads: New thread** (bind it to a hotkey). Type what it's about, pick who it's with (already filled in when you run it from that person's note), and optionally a priority, a due date, a follow-up date and details. Press ⌘Enter (Ctrl+Enter) to save.
3. In each person's note, add a block once:
   ````
   ```threads
   ```
   ````
   It lists what's open with that person. The header counts what's open, past its due date, due for a check-in, or has no follow-up planned. Each row has a **Check in** button.
4. For an overview across everyone, put a block in a home or weekly review note:
   ````
   ```threads
   with: all
   view: followups
   ```
   ````

### Block options

One `key: value` per line, both optional:

| Option | Values | Default |
|---|---|---|
| `with` | `[[Name]]` or `all` | the note's person in a `type: person` note, else `all` |
| `view` | `open`, `overdue`, `followups` (follow-up due or none planned), `done` (done or cancelled in the last 30 days) | `open` |

For example, everything past its due date:

````
```threads
with: all
view: overdue
```
````

Rows are sorted with past-due first, then those due for a check-in, then by due date and priority.

### Dates

The date picker offers tomorrow, in 3 days, in 1 week, in 10 days and in 2 weeks. A choice that lands on a weekend moves to Monday. Below them, a month calendar lets you click any day (‹ and › change month). You can also type `2026-11-20`, `11-20`, `today`, `tomorrow`, `+3d`, `+1w`, a weekday (`fri`), or `none` to clear the date.

## The note

New threads go in the folder set in Settings → Open Threads (`Threads` by default). Threads are found by their `type` property, so you can move them anywhere.

```markdown
---
type: thread
with: "[[Marc]]"
status: todo
priority: normal
due: 2026-12-04
follow_up: 2026-11-27
created: 2026-11-22
---
Rate limiting on the public API. https://gitlab.com/acme/api/-/issues/12

## Log
- 2026-11-22 · created · with Marc
- 2026-11-25 · check-in · Waiting on infra · next 2026-11-28
- 2026-11-28 · status in_progress → blocked
```

- `status` is `todo`, `in_progress`, `blocked`, `done` or `cancelled`. Done and cancelled threads leave the lists (see `view: done`).
- `priority` is `low`, `normal`, `high` or `critical`.
- Renaming a person's note updates `with` in their threads, as Obsidian does for every link.
- The commands add a line to `## Log` for each change. Editing the properties by hand works too, but isn't logged.

## Commands

Run them from the command palette (⌘P on macOS, Ctrl+P elsewhere). They have no default hotkeys: bind them in Settings → Hotkeys. All but **New thread** are available only when the open note is a thread.

| Command | What it does |
|---|---|
| **New thread** | Opens the window to create a thread. |
| **Check in** | Asks for an optional one-line note, then the next follow-up date (or none). Logs the check-in. |
| **Set status** | Picks one of the five statuses. |
| **Set priority** | Picks one of the four priorities. |
| **Change person** | Picks who the thread is with. |
| **Set due date** | Opens the date picker. |
| **Set follow-up date** | Opens the date picker. |

## Development

It needs Node 24 or newer.

```sh
npm install
npm run check     # type-check against the Obsidian API
npm test          # unit tests (node --test, TypeScript run directly)
npm run build     # bundle src/main.ts to main.js (npm run dev adds a source map)
npm run verify    # all three
```

The layout:

- `src/core/` is pure logic with no `obsidian` import, tested in Node.
- `src/actions.ts` holds the writes, behind a small `Store` interface, and is tested with an in-memory fake.
- The rest of `src/` is the Obsidian side: type-checked here, and checked by hand in Obsidian.

To try changes in a local vault, build and copy the plugin in one step. `OBSIDIAN_VAULT` is the path to your vault (the folder that contains `.obsidian`):

```sh
export OBSIDIAN_VAULT="$HOME/Documents/MyVault"
npm run deploy-locally
```

It copies `manifest.json`, `main.js` and `styles.css` into `$OBSIDIAN_VAULT/.obsidian/plugins/open-threads/`, creating the folder if needed, and leaves `data.json` (the settings) alone. Then turn the plugin off and on in Obsidian.

## Installing

Build, then copy only the three files Obsidian loads:

```sh
npm run build
mkdir -p "<vault>/.obsidian/plugins/open-threads"
cp manifest.json main.js styles.css "<vault>/.obsidian/plugins/open-threads/"
```

## Releasing

Releases are GitHub releases whose tag is the bare version (`0.1.0`, not `v0.1.0`), with `main.js`, `manifest.json` and `styles.css` attached. That is what Obsidian and BRAT install from.

The first time:

1. Create the GitHub repository `obsidian-open-threads` and add it as `origin`.
2. Push `main` and the first tag: `git tag 0.1.0 && git push -u origin main --follow-tags`.
3. Check again that no plugin in [community-plugins.json](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json) uses the id `open-threads` or the name "Open Threads", then submit the plugin to [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases).

After that:

```sh
npm version patch   # or minor / major; 1.0.0-beta.1 style versions become pre-releases
git push --follow-tags
```

`npm version` updates the version in `package.json` and `manifest.json` and adds it to `versions.json`, with the `minAppVersion` it needs. It then commits the change and creates the tag. Pushing the tag runs `.github/workflows/release.yml`, which checks that the tag matches the manifest, runs `npm run verify`, and creates the release.

## License

MIT, see [LICENSE](LICENSE).
