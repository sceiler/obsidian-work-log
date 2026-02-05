# Changelog

All notable changes to the Work Log plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-02-05

### Changed
- Updated to Node.js 24 (minimum required version)
- Updated all dependencies to latest versions:
  - @types/node ^24.0.0
  - esbuild ^0.27.0
  - eslint ^9.39.0
  - typescript ^5.8.0
  - typescript-eslint ^8.54.0
- Migrated to ESLint 9 flat config format

### Fixed
- Removed unused imports and variables flagged by updated linter

---

## [1.0.0] - 2026-02-05

### Added

#### Core Features
- **Dual Logging System**: Log entries to both a central work log file and related notes (people, projects, organizations)
- **Entry Modal**: Full-featured modal with date picker, category selection, related note autocomplete, and description field
- **Quick Date Buttons**: Today, Yesterday, and Last Friday buttons for fast date selection
- **Calendar Date Picker**: Native date input for selecting any past date (retrospective entries)
- **Chronological Ordering**: Entries sorted in ascending order (oldest first) in both work log and related notes

#### Categories
- Demo: Customer demos, presentations, workshops
- Customer: Calls, support, follow-ups, relationships
- Technical: POCs, integrations, troubleshooting, documentation
- Collaboration: Helping teammates, internal meetings, cross-team work
- Win: Deals closed, achievements, milestones, metrics

#### Auto-Linking
- Automatic detection and linking of note names in entry descriptions
- Efficient incremental indexing (builds once, updates on file changes)
- Case-insensitive matching with original case preservation
- Minimum 3-character threshold to avoid false positives

#### Related Notes Integration
- Autocomplete search for existing notes when selecting related note
- Automatic insertion under configurable section heading (default: `## Notes`)
- Date subsections with wiki-linked dates (e.g., `### [[2026-02-05]]`)
- Ascending chronological order within the notes section
- Blank line separation between entries for readability

#### Note Creation
- Option to automatically create notes that don't exist
- Configurable folder for new notes (default: `References`)
- New notes created with section heading and first entry

#### Commands
- `Add work log entry`: Open entry modal
- `Open work log`: Open the work log file
- `Quick add: Demo`: Pre-select Demo category
- `Quick add: Customer`: Pre-select Customer category
- `Quick add: Technical`: Pre-select Technical category
- `Quick add: Collaboration`: Pre-select Collaboration category
- `Quick add: Win`: Pre-select Win category

#### Configuration Options
- **File Settings**: Log file path, date format
- **Entry Settings**: Default category, timestamps, category display, entry separation
- **Work Log Formatting**: Date heading level (H2/H3), date as wiki link toggle
- **Related Notes**: Auto-create toggle, folder path, section heading, date heading level
- **Auto-Linking**: Enable/disable toggle

#### Keyboard Shortcuts
- `Cmd/Ctrl+Enter`: Submit entry from modal
- `Escape`: Close modal

#### UI/UX
- Ribbon icon for quick access
- Status notifications on entry creation
- Category descriptions shown in dropdown
- Dynamic placeholders based on selected category
- Active state highlighting on quick date buttons
- Error validation with visual feedback

### Technical
- TypeScript with full type safety
- esbuild for fast compilation
- Component-based architecture with proper lifecycle management
- Efficient file indexing using Obsidian's vault API
- Incremental updates (O(1)) instead of full rescans on file changes

---

## Future Plans

- [ ] Custom categories configuration
- [ ] Template support for entry formats
- [ ] Weekly/monthly summary generation
- [ ] Export to various formats
- [ ] Integration with daily notes plugin
- [ ] Tags support
- [ ] Search and filter within work log
