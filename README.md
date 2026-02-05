# Work Log

An Obsidian plugin for tracking daily work activities, achievements, and contributions. Perfect for performance reviews, maintaining a work journal, or keeping a record of your professional accomplishments.

## Features

### Core Functionality

- **Dual Logging**: Log entries to both a central work log file AND related notes (people, projects, organizations)
- **Smart Date Handling**: Quick buttons for Today, Yesterday, Last Friday, plus a full date picker for retrospective entries
- **Chronological Organization**: Entries are automatically sorted in ascending order (oldest first) for natural reading
- **Auto-Linking**: Automatically converts note names in your entries to `[[wiki links]]`
- **Note Creation**: Optionally create new notes on-the-fly if they don't exist

### Entry Modal

Access via the ribbon icon or Command Palette (`Work Log: Add work log entry`):

- **Related Note Field**: Autocomplete search for existing notes - type to find people, projects, or organizations
- **Date Selection**: Today (default), Yesterday, Last Friday, or pick any date
- **Category Selection**: Categorize your work (Demo, Customer, Technical, Collaboration, Win)
- **Description**: Free-form text with automatic wiki-link detection
- **Keyboard Shortcuts**: `Cmd/Ctrl+Enter` to submit, `Escape` to cancel

### Categories

Tailored for professional roles (especially Sales Engineering):

| Category | Description |
|----------|-------------|
| **Demo** | Customer demos, presentations, workshops |
| **Customer** | Calls, support, follow-ups, relationships |
| **Technical** | POCs, integrations, troubleshooting, documentation |
| **Collaboration** | Helping teammates, internal meetings, cross-team work |
| **Win** | Deals closed, achievements, milestones, metrics |

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
| Date format | `YYYY-MM-DD` | Date format (moment.js syntax) |

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
| Date heading level | `##` (H2) | Heading level for dates |
| Date as wiki link | `true` | Format as `[[2024-02-05]]` |

### Related Notes

| Setting | Default | Description |
|---------|---------|-------------|
| Create note if missing | `true` | Auto-create notes that don't exist |
| New note folder | `References` | Folder for newly created notes |
| Section heading | `## Notes` | Heading for notes section |
| Date heading level | `###` (H3) | Heading level for date subsections |

### Auto-Linking

| Setting | Default | Description |
|---------|---------|-------------|
| Enable auto-linking | `true` | Convert note names to `[[wiki links]]` |

## Commands

| Command | Description |
|---------|-------------|
| `Work Log: Add work log entry` | Open the entry modal |
| `Work Log: Open work log` | Open the work log file |
| `Work Log: Quick add: Demo` | Open modal with Demo pre-selected |
| `Work Log: Quick add: Customer` | Open modal with Customer pre-selected |
| `Work Log: Quick add: Technical` | Open modal with Technical pre-selected |
| `Work Log: Quick add: Collaboration` | Open modal with Collaboration pre-selected |
| `Work Log: Quick add: Win` | Open modal with Win pre-selected |

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
- Won't double-link existing `[[links]]`
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
npm run lint         # Run ESLint
```

### Project Structure

```
work-log/
├── src/
│   ├── main.ts           # Plugin entry point
│   ├── settings.ts       # Settings tab UI
│   ├── entry-modal.ts    # Entry modal with date picker
│   ├── log-manager.ts    # File operations
│   ├── auto-linker.ts    # Wiki-link detection
│   ├── note-suggest.ts   # Autocomplete component
│   └── types.ts          # TypeScript interfaces
├── main.js               # Compiled output
├── manifest.json         # Plugin metadata
├── styles.css            # Modal styling
└── package.json          # Dependencies
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
