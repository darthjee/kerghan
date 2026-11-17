# Future

Topics that were consciously deferred during issue discussions: known gaps or follow-ups that are
**not** part of the current design, recorded so they are not lost. Each entry says what was
deferred, why, and where it came from. Move an entry into the permanent docs (and delete it here)
once it is decided and implemented.

## Persistence of background jobs

- **What:** the backend's background workers ([deku-swarm](external/HOW_TO_USE_DEKU_SWARM.md),
  running in-process) keep their queues in memory only. A job that is queued or running when the
  process restarts or deploys is lost. Whether to persist pending jobs (for example in a DB table
  re-enqueued at boot) or keep relying on idempotent re-triggering is undecided.
- **Why deferred:** the first worker issue (#479) is infrastructure only; no real job exists yet,
  so there is nothing to lose. The answer depends on the real jobs (GitHub status sync, data
  import, syncing with other Kerghan instances), so it is decided when the first of them lands.
- **Related:** the repositories sync already survives restarts through its own lease and
  heartbeat (`modules/repositories/sync.md#restart-recovery`) and is not affected.
- **Source:** issue #479.

## Scheduling of periodic background jobs

- **What:** there is no way to run background jobs on a schedule. `deku-swarm` has no scheduler, so
  something would have to enqueue periodic jobs on a timer (for example keeping GitHub issue
  status fresh, or syncing with other Kerghan instances on an interval).
- **Why deferred:** the first worker issue (#479) only adds the in-process worker infrastructure,
  and its jobs are started by HTTP requests. No periodic job exists yet. Production runs a single
  instance, so de-duplicating a scheduled enqueue across instances is not a concern today, but it
  becomes one if the backend is ever scaled out.
- **Related:** [Persistence of background jobs](#persistence-of-background-jobs), since a
  scheduler and a restart-safe queue are likely designed together.
- **Source:** issue #479.

## Bounded retention of finished and dead background jobs

- **What:** `deku-swarm` keeps every `finished` and `dead` job in memory for the life of the
  process, and `clearQueues()` cannot prune them without also dropping pending work. A long-lived
  backend would grow without bound once real jobs run.
- **Why deferred:** the first worker issue (#479) ships no job, so there is nothing to retain yet.
  A pruning API is requested upstream (darthjee/navi#1006); it should be handled with the
  first real job, either through that API or a Kerghan-side workaround.
- **Source:** issue #479.
