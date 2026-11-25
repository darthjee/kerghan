#!/bin/sh
# Follows the tent and kerghan container logs into rotating files under /logs
# (tent.log, kerghan.log; 10 MB each, 5 rotated copies). POSIX sh (busybox).
# Idle unless KERGHAN_FILE_LOGS=true.

if [ "$KERGHAN_FILE_LOGS" != "true" ]; then
  while true; do sleep 86400; done
fi

umask 077
LOG_DIR=/logs
MAX_BYTES=10485760
UID_GID="${KERGHAN_HOST_UID:-0}:${KERGHAN_HOST_GID:-0}"

# The client creates (and, when it did, chmods 700) the host directory; the
# collector never changes the ownership or mode of $LOG_DIR itself.
[ -d "$LOG_DIR" ] || mkdir -p "$LOG_DIR" || echo "logs: cannot create $LOG_DIR" >&2

project=$(docker inspect "$HOSTNAME" --format '{{index .Config.Labels "com.docker.compose.project"}}')

# Appends stdin to $1, rotating at MAX_BYTES.
writer() {
  file="$1"
  size=0
  [ -f "$file" ] && size=$(wc -c < "$file")
  while IFS= read -r line; do
    if [ "$size" -ge "$MAX_BYTES" ]; then
      i=4
      while [ "$i" -ge 1 ]; do
        [ -f "$file.$i" ] && mv "$file.$i" "$file.$((i + 1))"
        i=$((i - 1))
      done
      [ -f "$file" ] && mv "$file" "$file.1"
      size=0
    fi
    if [ ! -f "$file" ]; then
      : > "$file"
      chown "$UID_GID" "$file" 2>/dev/null
      chmod 600 "$file" 2>/dev/null
    fi
    printf '%s\n' "$line" >> "$file"
    size=$((size + ${#line} + 1))
    # Persist the last timestamp (first field) to resume without duplicates.
    # Only an RFC 3339 timestamp is stored (never arbitrary log text).
    ts="${line%% *}"
    case "$ts" in
      [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]*Z)
        case "$ts" in
          *[!0-9TZ:.-]*) ;;
          *)
            printf '%s\n' "$ts" > "$since_file"
            chown "$UID_GID" "$since_file" 2>/dev/null
            ;;
        esac
        ;;
    esac
  done
}

follow() {
  svc="$1"
  since_file="$LOG_DIR/.$svc.since"
  while true; do
    id=$(docker ps -q \
      --filter "label=com.docker.compose.service=$svc" \
      --filter "label=com.docker.compose.project=$project" | head -n 1)
    if [ -n "$id" ]; then
      since=""
      if [ -s "$since_file" ]; then
        ts=$(head -n 1 "$since_file")
        case "$ts" in
          [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*Z)
            case "$ts" in
              *[!0-9TZ:.-]*) ;;
              *) since="--since=$ts" ;;
            esac
            ;;
        esac
      fi
      # 2>&1: the container's own stderr is part of its log; the writer only
      # persists a validated timestamp, so stray text cannot reach --since.
      docker logs -f -t ${since:+"$since"} "$id" 2>&1 | writer "$LOG_DIR/$svc.log"
    fi
    sleep 2
  done
}

follow tent &
follow kerghan &
wait
