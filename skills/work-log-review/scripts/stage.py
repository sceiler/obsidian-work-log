#!/usr/bin/env python3
"""Validate and exclusively create Work Log review drafts; Python standard library only."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import urlparse
import uuid


def safe_path(value):
    return (isinstance(value, str) and bool(value) and value.strip() == value
            and not re.search(r'[\\:#|\[\]\n\r\x00]', value)
            and all(part and part != '..' and not part.startswith('.') for part in value.split('/')))


def date(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ValueError('Dates must be YYYY-MM-DD strings')
    return dt.date.fromisoformat(value)


def in_vault(vault, relative):
    if not safe_path(relative):
        raise ValueError(f'Invalid vault path: {relative}')
    path = vault / relative
    if not path.resolve().is_relative_to(vault):
        raise ValueError(f'Path escapes the vault: {relative}')
    return path


def markdown(metadata, body):
    # JSON values are valid YAML and preserve dates, Unicode, links and multiline strings.
    header = '\n'.join(f'{key}: {json.dumps(value, ensure_ascii=False)}' for key, value in metadata.items())
    return f'---\n{header}\n---\n\n{body.strip()}\n'


def exclusive_write(path, content):
    """Publish a complete file atomically, without ever replacing a pre-existing path."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.work-log-', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            os.link(temporary, path)
            return True
        except FileExistsError:
            return False
    finally:
        os.unlink(temporary)


def prepare(vault, batch):
    if not isinstance(batch, dict):
        raise ValueError('Batch must be an object')
    settings_path = vault / '.obsidian/plugins/work-log/data.json'
    settings = json.loads(settings_path.read_text()) if settings_path.exists() else {}
    folder = settings.get('reviewInboxFolder', 'Work Log Inbox')
    inbox = in_vault(vault, folder)
    in_vault(vault, folder + '/runs')
    log_path = settings.get('logFilePath', 'work-log.md')
    in_vault(vault, log_path)
    if not log_path.endswith('.md') or log_path.startswith(folder + '/'):
        raise ValueError('Work log must be a Markdown file outside the inbox')
    default_categories = ['demo', 'customer', 'technical', 'collaboration', 'win']
    categories = {item['id'] for item in settings['categories']} if settings.get('categories') else set(default_categories)
    period = batch.get('period', {})
    start, end = date(period.get('start')), date(period.get('end'))
    if start > end:
        raise ValueError('Period starts after it ends')
    coverage = batch.get('coverage', {})
    for name in ['gmail', 'slack', 'index', 'notes']:
        item = coverage.get(name)
        if (not isinstance(item, dict) or item.get('status') not in ['checked', 'partial', 'unavailable', 'not_requested']
                or not isinstance(item.get('detail'), str) or not item['detail'].strip()):
            raise ValueError(f'Coverage for {name} needs a status and explanation')
    if not isinstance(batch.get('entries'), list):
        raise ValueError('entries must be a list')
    prepared, seen = [], set()
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    for entry in batch['entries']:
        if not isinstance(entry, dict):
            raise ValueError('Each entry must be an object')
        for key in ['event_key', 'title', 'description', 'category']:
            if not isinstance(entry.get(key), str) or not entry[key].strip():
                raise ValueError(f'Entry needs non-empty {key}')
        entry_date = date(entry.get('date'))
        if not start <= entry_date <= end:
            raise ValueError('Entry date is outside the review period')
        if entry['category'] not in categories:
            raise ValueError(f'Unknown category: {entry["category"]}')
        if '<!-- work-log:' in entry['description']:
            raise ValueError('Entry text contains a reserved Work Log marker')
        related = entry.get('related_notes')
        if not isinstance(related, list) or not all(isinstance(item, str) for item in related):
            raise ValueError('related_notes must be a list of existing vault paths')
        for relative in related:
            path = in_vault(vault, relative)
            if not relative.endswith('.md') or not path.is_file() or relative == log_path or relative.startswith(folder + '/'):
                raise ValueError(f'Invalid or missing related note: {relative}')
        sources = entry.get('sources')
        if not isinstance(sources, list) or not sources:
            raise ValueError('Each entry needs at least one source')
        for source in sources:
            if (not isinstance(source, dict) or not isinstance(source.get('label'), str) or not source['label'].strip()
                    or not isinstance(source.get('target'), str)):
                raise ValueError('Sources need a label and target')
            target = source['target']
            parsed = urlparse(target)
            if parsed.scheme in ['http', 'https'] and parsed.netloc:
                continue
            if not target.endswith('.md') or not in_vault(vault, target).is_file():
                raise ValueError(f'Invalid or missing source: {target}')
        event_key = entry['event_key'].strip()
        identity = f'work-log-review:v1:{entry["date"]}:{event_key}'
        entry_id = 'wl-' + uuid.uuid5(uuid.NAMESPACE_URL, identity).hex
        if entry_id in seen:
            raise ValueError(f'Duplicate event key in batch: {event_key}')
        seen.add(entry_id)
        metadata = {'work_log_suggestion': 1, 'id': entry_id, 'event_key': event_key,
                    'title': entry['title'].strip(), 'date': entry['date'], 'category': entry['category'],
                    'related_notes': list(dict.fromkeys(related)), 'sources': sources,
                    'status': 'pending', 'created_at': now}
        prepared.append((inbox / f'{entry_id}.md', markdown(metadata, entry['description'])))
    return inbox, prepared


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--vault', type=Path)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    config_file = Path(__file__).resolve().parents[1] / 'local.json'
    config = json.loads(config_file.read_text()) if config_file.exists() else {}
    location = args.vault or config.get('vault')
    if not location:
        raise ValueError('Pass --vault or configure vault in the installed skill local.json')
    vault = Path(location).expanduser().resolve()
    if not vault.is_dir() or not (vault / '.obsidian').is_dir():
        raise ValueError('Vault must be an existing Obsidian vault')
    batch = json.loads(args.input.read_text(encoding='utf-8'))
    inbox, prepared = prepare(vault, batch)  # Validate every entry before publishing any files.
    created, skipped = [], []
    for path, content in prepared:
        if path.exists() or path.is_symlink():
            skipped.append(str(path.relative_to(vault)))
        elif args.dry_run or exclusive_write(path, content):
            created.append(str(path.relative_to(vault)))
        else:
            skipped.append(str(path.relative_to(vault)))
    report = None
    if not args.dry_run:
        now = dt.datetime.now(dt.timezone.utc)
        report = inbox / 'runs' / f'{now.strftime("%Y%m%dT%H%M%S%fZ")}-{uuid.uuid4().hex[:8]}.md'
        # Check the report folder too, including pre-existing symlinks.
        in_vault(vault, str(report.relative_to(vault)))
        body = [f'# Work Log review: {batch["period"]["start"]} to {batch["period"]["end"]}',
                f'Created {len(created)} suggestions; skipped {len(skipped)} existing suggestions.', '', '## Source coverage']
        for source, detail in batch['coverage'].items():
            body.append(f'- **{source} — {detail["status"]}**: {detail["detail"]}')
        body += ['', '## Pending suggestions']
        body += [f'- [[{path.removesuffix(".md")}]]' for path in created]
        exclusive_write(report, markdown({'work_log_review_run': 1, 'created_at': now.isoformat(),
                                          'period': batch['period'], 'coverage': batch['coverage']}, '\n\n'.join(body)))
    print(json.dumps({'dry_run': args.dry_run, 'created': created, 'skipped': skipped,
                      'report': str(report.relative_to(vault)) if report else None}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(f'Cannot stage suggestions: {error}', file=sys.stderr)
        sys.exit(1)
