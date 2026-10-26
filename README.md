# Work Log

An Obsidian plugin for tracking daily work activities, achievements, and contributions. Perfect for performance reviews, maintaining a work journal, or keeping a record of your professional accomplishments.

## Features

### Core Functionality

- **Dual Logging**: Log entries to both a central work log file AND related notes (people, projects, organizations)
- **Smart Date Handling**: Quick buttons for Today, Yesterday, and Friday/Last Friday (label adjusts on weekends), plus a full date picker for retrospective entries
- **Chronological Organization**: Entries are automatically sorted in ascending order (oldest first) for natural reading
- **Auto-Linking**: Automatically converts note names in your entries to `[[wiki links]]`
- **Note Creation**: Optionally create new notes on-the-fly if they don't exist

### Entry Modal

Access via the ribbon icon or Command Palette (`Work Log: Add work log entry`):

- **Date Selection**: Today (default), Yesterday, Friday/Last Friday, or pick any date
- **Category Selection**: Categorize your work with fully customizable categories
- **Description**: Free-form text with automatic wiki-link detection
- **Related Note Field**: Autocomplete search for existing notes with real-time existence indicator
- **Keyboard Shortcuts**: `Cmd/Ctrl+Enter` to submit (hint shown on button), `Escape` to cancel
- **Error Handling**: Validation messages, loading state during save, modal stays open on failure

### Review suggestions from Codex

The bundled `work-log-review` skill researches work, updates, and concrete interactions across available Gmail, Slack, Index, and local notes. It stages Markdown drafts in `Work Log Inbox`; the plugin handles review and submission.

1. Copy `skills/work-log-review` into your Codex skills directory (`~/.codex/skills` by default).
2. Add `local.json` inside the installed skill with your vault context:

   ```json
   {"vault": "/absolute/path/to/your/vault", "timezone": "Europe/Berlin", "owner": "Your name"}
   ```

3. Invoke `$work-log-review review today` (or a date range) in Codex. Source access uses the connectors available in that session; the report identifies unavailable or partial sources.
4. In Obsidian, click the **Work Log: N to review** status item, the review ribbon icon, or run **Work Log: Review suggestions**.
5. Edit text, date, category, and related destinations. Inspect source links, dismiss unwanted suggestions, and select the entries to include. Draft edits save automatically.
6. Click **Submit selected entries**. Entries go into the central log and the selected existing reference pages using your configured dated sections.

Only the selected entries are locked while submitting. You can keep editing or dismissing other drafts, or close the window while approved writes finish. Rapid edits are combined while a save is in progress. Related-note links show the note name; a path is retained behind an alias when needed to distinguish duplicate names.

Pending entries require explicit submission. Previously applied/dismissed drafts remain in the inbox as history and are excluded from the pending queue. Failed submissions stay available to retry; successful destination writes are not duplicated. Once submission starts, the approved text is locked so retries finish the same entry everywhere. Keep the invisible `work-log:suggestion` markers in final notes for retry protection.

**Settings → Review inbox folder** controls where drafts are discovered. The helper reads this setting and your categories. The skill uses Python 3.9+ and no Python dependencies. See its [handoff contract](skills/work-log-review/references/handoff.md) for the batch format. Editing an applied note manually does not synchronize later edits across copies.

### Categories

Fully configurable via Settings → Categories. Add, edit, reorder, or remove categories to match your workflow. Default categories tailored for Sales Engineering:

| Category | Description |
|----------|-------------|
| **Demo** | Customer demos, presentations, workshops |
| **Customer** | Calls, support, follow-ups, relationships |
| **Technical** | POCs, integrations, troubleshooting, documentation |
| **Collaboration** | Helping teammates, internal meetings, cross-team work |
| **Win** | Deals closed, achievements, milestones, metrics |

Each category has a label, description, and placeholder text that you can customize. Reorder categories to control the dropdown order in the entry modal. Quick-add commands automatically update when you modify categories.

### Task Management

Create tasks with Eisenhower Matrix prioritization, due dates, and related note integration. Tasks are written as Obsidian Tasks-compatible markdown using Dataview inline field format.

Access via the ribbon icon (check-square) or Command Palette (`Work Log: Create task`):

- **Description**: Free-form text with automatic wiki-link detection
- **Priority**: Toggle `Important` and `Urgent` independently — the Eisenhower quadrant label updates in real time
- **Related Note**: Autocomplete search — tasks are written to this note under `## Tasks`. Without a related note, tasks go to the daily journal note
- **Due Date**: Natural language input (e.g., "this friday", "next week", "in 3 days") plus quick buttons (Today, Tomorrow, Day after, remaining weekdays, 1 week) and a date picker. Due dates within the urgency threshold automatically toggle `Urgent`
- **Keyboard Shortcuts**: `Cmd/Ctrl+Enter` to submit, `Escape` to cancel

#### Eisenhower Priority Mapping

| Quadrant | Urgent | Important | Dataview Field | Tasks Filter |
|----------|--------|-----------|----------------|-------------|
| Do First | yes | yes | `[priority:: highest]` | `priority is highest` |
| Delegate | yes | no | `[priority:: high]` | `priority is high` |
| Schedule | no | yes | `[priority:: low]` | `priority is low` |
| Low Priority | no | no | *(none)* | `priority is none` |

#### Task Output Format

```markdown
- [ ] Review demo repo [priority:: high] [due:: 2026-02-13] [created:: 2026-02-10]
```

#### Journal Notes

Tasks without a related note are written to a daily journal note (e.g., `2026-02-10 Journal.md`). Journal notes are auto-created with Obsidian Tasks query blocks for old/new tasks. A Tasks MOC (`Tasks.md`) is also auto-created on first use, grouping tasks by Eisenhower quadrant.

### Output Format

**work-log.md** (main log):
```markdown
## [[2024-02-05]]

- **Customer** ([[John Doe]]): Helped troubleshoot deployment issue

- **Demo** ([[Acme Corp]]): Delivered Next.js migration presentation

## [[2024-02-06]]

- **Win** ([[Big Client]]): Closed enterprise deal - $100k ARR

- **Technical** ([[Project Alpha]]): Completed API integration
  - Implemented OAuth2 flow
  - Added rate limiting
```

**Multi-line entries**: When you include list items (starting with `-`) in your description, they become properly nested sub-items.

**Related Note** (e.g., `John Doe.md`):
```markdown
## Notes

### [[2024-02-05]]
Helped troubleshoot deployment issue

### [[2024-02-10]]
Follow-up call about new feature request
```

## Installation

### From Obsidian Community Plugins (Coming Soon)

1. Open Settings → Community plugins
2. Search for "Work Log"
3. Install and enable

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/sceiler/obsidian-work-log/releases)
2. Create folder: `<vault>/.obsidian/plugins/work-log/`
3. Copy the downloaded files into the folder
4. Reload Obsidian
5. Enable "Work Log" in Settings → Community plugins

### Development Installation

```bash
git clone https://github.com/sceiler/obsidian-work-log.git
cd work-log
npm install
npm run build
```

Then symlink or copy to your vault's plugins folder.

## Configuration

Access settings via Settings → Work Log.

### File Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Log file path | `work-log.md` | Path to your main work log file |

### Entry Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Default category | `Customer` | Pre-selected category in modal |
| Show timestamps | `false` | Include HH:mm in entries |
| Show category in work log | `true` | Show **Category** prefix in work log |
| Show category in related notes | `false` | Show **Category** in linked notes |
| Separate entries with blank line | `true` | Add blank line between entries |

### Work Log Formatting

| Setting | Default | Description |
|---------|---------|-------------|
| Work log date heading level | `##` (H2) | Heading level for dates |
| Date as wiki link | `true` | Format as `[[2024-02-05]]` |

### Related Notes

| Setting | Default | Description |
|---------|---------|-------------|
| Create note if missing | `true` | Auto-create notes that don't exist |
| New note folder | `References` | Folder for newly created notes |
| Section heading | `## Notes` | Heading for notes section |
| Related note date heading level | `###` (H3) | Heading level for date subsections |

### Auto-Linking

| Setting | Default | Description |
|---------|---------|-------------|
| Enable auto-linking | `true` | Convert note names to `[[wiki links]]` |

### Tasks

| Setting | Default | Description |
|---------|---------|-------------|
| Journal note folder | *(empty)* | Folder where journal notes are created |
| Journal note suffix | ` Journal` | Appended to date for journal filenames |
| Tasks MOC path | `Tasks.md` | Path to the Tasks index note |
| Urgency threshold (days) | `3` | Tasks due within this many days auto-toggle urgent |
| Task section heading (related notes) | `## Tasks` | Heading for tasks in related notes |
| Task section heading (journal notes) | `## Tasks` | Heading for tasks in journal notes |

### Categories

Manage your categories in Settings → Work Log → Categories:

- **Add**: Create new categories with a unique ID, label, description, and placeholder
- **Edit**: Modify label, description, and placeholder for any category
- **Reorder**: Move categories up/down to control dropdown order
- **Delete**: Remove categories (at least one must remain)
- **Set Default**: Mark any category as the default for new entries

## Commands

| Command | Description |
|---------|-------------|
| `Work Log: Add work log entry` | Open the entry modal |
| `Work Log: Open work log` | Open the work log file |
| `Work Log: Quick add: <Category>` | Open modal with a category pre-selected |
| `Work Log: Create task` | Open the task creation modal |
| `Work Log: Open today's journal` | Open (or create) today's journal note |
| `Work Log: Open tasks index` | Open (or create) the Tasks MOC |

A quick-add command is automatically registered for each configured category. When you add, remove, or rename categories in settings, the commands update accordingly.

## How It Works

### Dual Logging

When you select a related note (e.g., "John Doe"):

1. Entry is added to `work-log.md` with a backlink: `- **Customer** ([[John Doe]]): description`
2. Entry is added to `John Doe.md` under `## Notes` → `### [[date]]`

This creates bidirectional links:
- From work log → related note (via `[[John Doe]]`)
- From related note → work log (Obsidian backlinks show `work-log.md`)

### Chronological Ordering

Both files maintain **ascending order** (oldest first):
- Dates are sorted chronologically
- New entries for existing dates are appended to that date's section
- Past dates are inserted in the correct position

### Auto-Linking

The plugin indexes all markdown files in your vault. When you type:
```
Helped John Doe with deployment
```

If `John Doe.md` exists, it becomes:
```
Helped [[John Doe]] with deployment
```

- Case-insensitive matching
- Preserves original note name casing
- Protects existing `[[links]]` and URLs — won't double-link or corrupt them
- Links all unlinked occurrences of a name (not just the first)
- Minimum 3 characters to avoid false positives

## Use Cases

### Performance Reviews

Track your accomplishments throughout the year:
- Demos delivered
- Customers helped
- Technical work completed
- Team collaboration
- Wins and achievements

### CRM-Style People Notes

Maintain notes on contacts with automatic activity logging:
```markdown
# John Doe

## Notes

### [[2024-01-15]]
Initial call about migration project

### [[2024-02-05]]
Helped troubleshoot deployment issue

### [[2024-02-20]]
Demo of new features
```

### Project Documentation

Track work on specific projects:
```markdown
# Project Alpha

## Notes

### [[2024-02-01]]
Kicked off POC development

### [[2024-02-10]]
Completed integration testing

### [[2024-02-15]]
Delivered final presentation
```

## Development

### Prerequisites

- Node.js 24+
- npm

### Commands

```bash
npm install          # Install dependencies
npm run dev          # Development mode (watch)
npm run build        # Production build
npm run test:run     # Run unit tests
npm run test         # Run tests in watch mode
npm run lint         # Run ESLint
```

### Project Structure

```
work-log/
├── src/
│   ├── __mocks__/
│   │   └── obsidian.ts       # Minimal Obsidian API mock for tests
│   ├── __tests__/
│   │   ├── auto-linker.test.ts   # AutoLinker tests (21 tests)
│   │   ├── log-manager.test.ts   # LogManager tests (34 tests)
│   │   └── types.test.ts         # Type utility tests (6 tests)
│   ├── main.ts               # Plugin entry point
│   ├── settings.ts           # Settings tab UI
│   ├── entry-modal.ts        # Entry modal with date picker
│   ├── task-modal.ts         # Task modal with priority & due date
│   ├── log-manager.ts        # Work log file operations
│   ├── task-manager.ts       # Task file operations
│   ├── auto-linker.ts        # Wiki-link detection
│   ├── note-suggest.ts       # Autocomplete component
│   └── types.ts              # TypeScript interfaces
├── main.js                   # Compiled output
├── manifest.json             # Plugin metadata
├── styles.css                # Modal styling
├── vitest.config.ts          # Test configuration
└── package.json              # Dependencies
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- [Report issues](https://github.com/sceiler/obsidian-work-log/issues)
- [Request features](https://github.com/sceiler/obsidian-work-log/issues)

## Acknowledgments

Built with:
- [Obsidian Plugin API](https://docs.obsidian.md/)
- TypeScript + esbuild
