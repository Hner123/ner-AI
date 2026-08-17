#!/bin/sh
# Periodic pg_dump with rotation, run from its own container in the compose
# stack rather than host cron — nothing to install on the host, and it comes
# back on its own after a reboot along with everything else.
set -eu

DIR=/backups
KEEP="${BACKUP_KEEP_DAYS:-7}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
# A failed attempt shouldn't cost a whole cycle: if the database was briefly
# down or the disk was full, come back in minutes rather than tomorrow.
RETRY="${BACKUP_RETRY_SECONDS:-900}"

export PGPASSWORD="$POSTGRES_PASSWORD"

log() {
  echo "[backup] $(date -u '+%Y-%m-%d %H:%M:%SZ') $*"
}

take_backup() {
  ts=$(date -u '+%Y%m%d-%H%M%S')
  # Written under dot-names first: a crash or a full disk mid-dump would
  # otherwise leave a truncated file sitting there looking like a good backup.
  raw="$DIR/.in-progress-$ts.sql"
  tmp="$DIR/.in-progress-$ts.sql.gz"
  out="$DIR/nerkyot-$ts.sql.gz"

  # Dumped and compressed as two steps, deliberately. In `pg_dump | gzip` the
  # pipeline reports GZIP's status, so a dump that died halfway still looks
  # like a success — and a truncated dump is the one failure that passes every
  # integrity check below while restoring an incomplete database.
  if ! pg_dump -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" >"$raw" 2>"$DIR/.pgerr"; then
    log "FAILED: pg_dump errored — $(tail -1 "$DIR/.pgerr" 2>/dev/null)"
    rm -f "$raw" "$DIR/.pgerr"
    return 1
  fi
  rm -f "$DIR/.pgerr"

  if ! gzip -c "$raw" >"$tmp"; then
    log "FAILED: could not compress dump"
    rm -f "$raw" "$tmp"
    return 1
  fi
  rm -f "$raw"

  # An unverified backup isn't a backup. Check the archive is intact and that
  # it actually contains schema — a dump of nothing compresses just fine.
  if ! gzip -t "$tmp" 2>/dev/null; then
    log "FAILED: archive is corrupt"
    rm -f "$tmp"
    return 1
  fi
  if ! gzip -dc "$tmp" | grep -q 'CREATE TABLE'; then
    log "FAILED: dump contains no tables"
    rm -f "$tmp"
    return 1
  fi

  mv "$tmp" "$out"
  log "wrote $(basename "$out") ($(du -h "$out" | cut -f1))"

  pruned=$(find "$DIR" -maxdepth 1 -name 'nerkyot-*.sql.gz' -mtime "+$KEEP" -print -delete | wc -l)
  if [ "$pruned" -gt 0 ]; then
    log "pruned $pruned backup(s) older than ${KEEP}d"
  fi
  # Clear any half-written files left by an earlier crash.
  find "$DIR" -maxdepth 1 -name '.in-progress-*' -mmin +60 -delete 2>/dev/null || true
  find "$DIR" -maxdepth 1 -name '.pgerr' -mmin +60 -delete 2>/dev/null || true
  return 0
}

log "started — every ${INTERVAL}s, keeping ${KEEP}d, writing to $DIR"

while true; do
  # One immediately on boot, so a broken setup shows up at deploy time rather
  # than at 3am tomorrow — but skipped if a recent dump already exists, or
  # every redeploy would leave another copy behind.
  recent=$(find "$DIR" -maxdepth 1 -name 'nerkyot-*.sql.gz' -mmin -60 | head -1)
  if [ -n "$recent" ]; then
    log "skipping — $(basename "$recent") is less than an hour old"
    sleep "$INTERVAL"
    continue
  fi

  if take_backup; then
    sleep "$INTERVAL"
  else
    log "attempt failed — retrying in ${RETRY}s"
    sleep "$RETRY"
  fi
done
