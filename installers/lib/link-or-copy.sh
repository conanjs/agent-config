#!/usr/bin/env bash
# Core "place this repo file at that destination path" primitives.
# Sourced by scripts/install-*.sh. Requires REPO_ROOT to be set by the caller.

trim() { local s="$1"; s="${s#"${s%%[![:space:]]*}"}"; s="${s%"${s##*[![:space:]]}"}"; echo "$s"; }

expand_target() {
  # Only handles a leading ~/ — every target in mapping.yaml uses that form.
  local t="$1"
  if [[ "$t" == "~/"* ]]; then
    echo "$HOME/${t#\~/}"
  else
    echo "$t"
  fi
}

# All backups from one install run land under one timestamped folder, mirroring
# each entry's mapping.yaml `source` path — e.g. a symlink at ~/.claude/CLAUDE.md
# gets backed up to $BACKUP_ROOT/claude/CLAUDE.md, not a scattered sibling
# ~/.claude/CLAUDE.md.backup-<ts>. BACKUP_ROOT is created lazily — only the
# first actual backup in a run creates the folder, so a clean run creates nothing.
#
# IMPORTANT: the lazy-init below must run in THIS shell, not a subshell — never
# wrap it (or anything that sets BACKUP_ROOT) in $(...) or a pipe, or the
# assignment vanishes when the subshell exits and every entry ends up with its
# own separate backup folder instead of sharing one. (Found by testing: a
# earlier version called this via $(backup_root) and silently broke exactly
# this way.)
BACKUP_ROOT=""

backup_existing() {
  local target="$1" expected_source="$2" source_rel="$3"
  if [ -e "$target" ] || [ -L "$target" ]; then
    if [ -L "$target" ] && [ "$(readlink "$target")" = "$expected_source" ]; then
      return 1 # already symlinked to the right place, nothing to do
    fi
    if [ -z "$BACKUP_ROOT" ]; then
      BACKUP_ROOT="$HOME/.agent-config-backups/$(date +%Y%m%d%H%M%S)"
    fi
    local dest="$BACKUP_ROOT/$source_rel"
    # One source can map to several targets (e.g. skills -> ~/.claude/skills
    # and ~/.agents/skills); never let a second backup land on the first.
    local n=2
    while [ -e "$dest" ] || [ -L "$dest" ]; do
      dest="$BACKUP_ROOT/$source_rel.$n"; n=$((n + 1))
    done
    mkdir -p "$(dirname "$dest")"
    echo "  existing content at $target -> backing up to $dest"
    mv "$target" "$dest"
  fi
  return 0
}

apply_symlink() {
  local source_rel="$1" target_raw="$2"
  local target; target="$(expand_target "$target_raw")"
  local source_abs="$REPO_ROOT/$source_rel"
  mkdir -p "$(dirname "$target")"
  if backup_existing "$target" "$source_abs" "$source_rel"; then
    ln -s "$source_abs" "$target"
    echo "  symlinked $target -> $source_abs"
  else
    echo "  $target already correctly symlinked, skipped"
  fi
}

apply_seed_once() {
  local source_rel="$1" target_raw="$2"
  local target; target="$(expand_target "$target_raw")"
  local source_abs="$REPO_ROOT/$source_rel"
  if [ -e "$target" ]; then
    echo "  $target already exists, leaving it alone (seed-once)"
    return
  fi
  mkdir -p "$(dirname "$target")"
  cp "$source_abs" "$target"
  echo "  seeded $target from $source_abs (will not be touched by future installs)"
}

apply_mapping() {
  local mapping_file="$1"
  while IFS= read -r line; do
    [[ "$line" == \#* || -z "$line" ]] && continue
    [[ "$line" != "- {"* ]] && continue
    local source target strategy
    source="$(echo "$line" | sed -E 's/.*source: *([^,]+),.*/\1/')"
    target="$(echo "$line" | sed -E 's/.*target: *([^,]+),.*/\1/')"
    strategy="$(echo "$line" | sed -E 's/.*strategy: *([^ }]+).*/\1/')"
    source="$(trim "$source")"; target="$(trim "$target")"; strategy="$(trim "$strategy")"
    echo "[$strategy] $source -> $target"
    case "$strategy" in
      symlink)   apply_symlink "$source" "$target" ;;
      seed-once) apply_seed_once "$source" "$target" ;;
      *) echo "  unknown strategy '$strategy', skipped" ;;
    esac
  done < "$mapping_file"
  if [ -n "$BACKUP_ROOT" ]; then
    echo "Backed up pre-existing content to: $BACKUP_ROOT"
  fi
}
