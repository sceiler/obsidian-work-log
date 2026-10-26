# Work Log inbox contract — version 1

## Batch input

The staging helper accepts JSON. All dates are inclusive ISO date strings in the user's timezone. Each source needs a descriptive `label` and a `target`: an HTTP(S) URL or an existing vault-relative Markdown path. Use real source links, never illustrative URLs in an actual batch.

```json
{
  "period": {"start": "2026-09-18", "end": "2026-09-18"},
  "coverage": {
    "gmail": {"status": "checked", "detail": "Read relevant sent and received threads; pagination exhausted."},
    "slack": {"status": "partial", "detail": "Authored messages checked; one thread was inaccessible."},
    "index": {"status": "checked", "detail": "Matched calls and checked attributed transcript passages."},
    "notes": {"status": "checked", "detail": "Read dated notes, existing log, related references, and inbox history."}
  },
  "entries": [{
    "event_key": "slack:CEXAMPLE:1234567890.000001:demo-preparation",
    "title": "Helped prepare the customer demo",
    "date": "2026-09-18",
    "category": "collaboration",
    "related_notes": ["References/Alex Example.md"],
    "sources": [{"label": "Demo preparation thread", "target": "https://example.com/thread"}],
    "description": "Helped [[Alex Example]] prepare the customer demo and clarified the deployment steps.\n- https://example.com/thread"
  }]
}
```

Coverage statuses: `checked`, `partial`, `unavailable`, `not_requested`. Record actual coverage even when no candidates are found. Never use “checked” for an attempted but failed search.

## Identity and files

- `event_key` identifies a concrete event/contribution, not its wording. Anchor it to a stable message/thread/call ID and a short action identifier. Prefer existing inbox keys for repeat research. Distinct contributions in the same thread may have different keys.
- The helper generates a UUIDv5 from the date and event key. The filename is `wl-<uuid>.md` under the configured inbox folder. Repeat staging skips that file; it does not reset its status or replace text.
- Sources and title are explanatory metadata. `description` is the exact proposed note content; the plugin does not append metadata sources or auto-link it on submission. Put intended wikilinks and primary source URL bullets into this body during drafting.
- `related_notes` contains exact existing vault paths ending in `.md`. Empty means log-only. Do not target the log itself or anything in the inbox, and do not create a stub for an unresolved person.
- The helper uses ordinary YAML frontmatter with JSON-quoted scalar and collection values. Obsidian reads these as standard properties. The plugin may reformat YAML when saving a draft.

## Source links in the entry

Append each selected source URL to `description` on its own line with `- ` and the bare URL. Use the user's exact supplied Slack message link when available, preserving its query parameters; otherwise use the verified permalink. Keep the same link in `sources` metadata. Supplementary research can remain metadata-only, and multiple URL forms for the same message need only one bullet.

The JSON example above uses `\n` for a real newline. The staged Markdown body is:

```markdown
Helped [[Alex Example]] prepare the customer demo and clarified the deployment steps.
- https://example.com/thread
```

The plugin already indents continuation bullets when submitting, matching the existing work-log layout:

```markdown
- **Collaboration** ([[Alex Example]]): Helped [[Alex Example]] prepare the customer demo and clarified the deployment steps.
  - https://example.com/thread
```

Related-note copies retain the source bullet too. Do not use a `Sources:` heading or replace the bare URL with a labeled Markdown link.

## Plugin-owned state

`pending` → `applying` → `applied`, or `pending` → `dismissed`.

Draft edits persist in the Markdown file. Starting submission stores a frozen `submission` with approved text and exact destinations. An interrupted entry stays `applying`; the review window offers a retry while keeping that approved text locked. Final log/page copies include an invisible `<!-- work-log:suggestion:ID -->` marker. The plugin checks each destination for this marker before writing, so a retry only adds missing copies.

Keep applied/dismissed inbox files as the review history. Keep their IDs, event keys, and final markers intact. Editing applied notes manually is supported, but inbox submission is not a general tool for synchronizing later edits across their copies.

## Research reports

Each staging run also creates `runs/<timestamp>-<random>.md` with the period, coverage, and created/skipped counts. It has `work_log_review_run: 1` instead of `work_log_suggestion: 1`, so it is not an entry to submit. Drafts stay separate from Lyra-managed meeting notes. The helper never changes graph settings, templates, meeting data, people metadata, or the log.
