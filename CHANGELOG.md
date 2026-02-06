# Changelog

All notable changes to the Work Log plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-02-06

### Fixed
- **Multi-line description bug**: `formatMultiLineDescription` used `indexOf` instead of the filter callback index, causing incorrect blank line handling
- **Regex escaping bug**: `buildDatePattern` only escaped the first `#` in heading levels like `###` — now uses proper full-string escaping
- **Modal data loss**: Modal closed immediately without waiting for the async file write to complete — errors were silently swallowed and form input lost. Now awaits the write and keeps the modal open on failure so the user can retry
- **Related note info text**: Hardcoded `## Notes → ### [[date]]` instead of reflecting the user's configured heading settings
- **Settings migration**: `loadSettings()` shallow merge carried orphaned properties (e.g., old `dateFormat`) and had no migration path for new category fields
- **Auto-linker partial linking**: If a note name was already linked once as `[[Name]]`, all other plain-text occurrences were skipped. Now protects existing links via placeholders and links remaining occurrences

### Added
- **Submit button loading state**: Button disables and shows "Adding..." during write, prevents double-submission
- **Keyboard shortcut hint**: Submit button shows `⌘↵` (Mac) or `Ctrl+↵` (Windows/Linux)
- **Description validation message**: Shows "Description is required" text with `aria-invalid` attribute instead of only a shake animation
- **Related note existence indicator**: Shows "Note found", "Note will be created", or "Note not found" as you type
- **Success notice with View link**: After adding an entry, the notice includes a clickable "View" link to open the log file
- **Settings debounced save**: Text input settings (file path, folder, section heading) now debounce saves (300ms) instead of saving on every keystroke

### Changed
- **Form field order**: Reordered modal fields to Date → Category → Description → Related note (optional field last, most-used fields first)
- **Category description placement**: Now uses `Setting.setDesc()` instead of a fragile sibling div with negative margins
- **Settings label disambiguation**: "Date heading level" renamed to "Work log date heading level" and "Related note date heading level"
- **Textarea font**: Changed from monospace to `var(--font-text)` for prose-oriented entries
- **Friday button label**: Shows "Friday" instead of "Last Friday" on weekends for clarity
- **Category placeholder field**: Uses textarea instead of single-line input in settings edit form

### Performance
- **AutoLinker debouncing**: `rebuildSortedList()` is now debounced (150ms) to coalesce rapid file create/delete/rename events during vault sync
- **Indexed note lookup**: `findNoteByName()` uses `metadataCache.getFirstLinkpathDest()` for O(1) lookup instead of linear scan
- **Cached next-heading regex**: The heading regex in `insertEntryToLog` is now cached instead of being recreated on each call

---

## [1.1.1] - 2026-02-05

### Performance
- **AutoLinker**: Pre-compile per-note regexes once during index rebuild instead of recompiling on every entry submission — significant improvement for large vaults
- **LogManager**: Cache date-heading regex patterns, invalidate only on settings change
- **NoteSuggest**: Partition suggestions into starts-with/contains buckets to avoid sorting all matches on every keystroke

### Fixed
- **Delete confirmation**: Deleting a category now shows an inline confirmation prompt instead of removing immediately
- **Edit form safety**: Editing a category now works on a copy — Cancel cleanly discards changes
- **ID field sanitization**: Add Category ID field now reflects the sanitized value in real-time (e.g., "My Category" → "my-category")
- **Modal focus**: Description textarea is now focused on open instead of the Related Note field, matching the most common workflow

### Removed
- **`dateFormat` setting**: Removed the unused Date Format setting — dates are always `YYYY-MM-DD` internally
- Dead CSS for the old category reference UI

### Changed
- Simplified `formatLogEntry` from 8-branch if/else to incremental part-building

---

## [1.1.0] - 2026-02-05

### Added
- **Configurable Categories**: Categories are now fully customizable via Settings → Categories
  - Add new categories with custom ID, label, description, and placeholder
  - Edit existing category labels, descriptions, and placeholders
  - Reorder categories with up/down buttons (controls dropdown order)
  - Delete categories (minimum one required)
  - Set any category as the default
- **Dynamic Quick-Add Commands**: Quick-add commands in the command palette automatically update when categories are added, removed, or renamed
- **Category Migration**: Existing installations seamlessly migrate to the new configurable system with the same five default categories

### Changed
- Categories are now stored in plugin settings as an ordered array instead of hardcoded constants
- The `Category` type is now a `string` instead of a fixed union type, enabling user-defined categories

---

## [1.0.2] - 2026-02-05

### Fixed
- **URL Auto-Linking Bug**: URLs in descriptions are no longer incorrectly converted to wiki links

### Changed
- **Wider Modal**: Increased modal width to 900px for more comfortable text entry
- **Compact Layout**: Reduced padding, margins, and font sizes throughout for better space efficiency
- **Monospace Textarea**: Description field now uses monospace font for better markdown editing
- **Multi-Line Support**: Descriptions with multiple lines containing list items (starting with `-` or `*`) are now properly indented as nested items in the output

---

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

- [x] Custom categories configuration
- [ ] Template support for entry formats
- [ ] Weekly/monthly summary generation
- [ ] Export to various formats
- [ ] Integration with daily notes plugin
- [ ] Tags support
- [ ] Search and filter within work log
