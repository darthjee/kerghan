# Usage, header comment and `config.example`

Copy the verbatim texts from the spec's "Usage and `config.example`" section:

- **Header comment** at the top of `standalone/bin/kerghan`: the persistent settings list `(port, variant, runtime, stop-timeout, image-tag, auto-login, bind)` gains `restart-on-update`.
- **`usage`**: after the `bind=` line add
  `  restart-on-update=$DEFAULT_RESTART_ON_UPDATE  ask | always | never (overridden by update --[no-]restart)`
  (do not realign the other lines), and end the paragraph after the list with the sentence
  `A changed restart-on-update applies to the next 'kerghan update'.`
- **`standalone/config.example`**: after the `#bind=` entry, add the commented block from the spec ending in `#restart-on-update=ask`.

## Files to Change
- `standalone/bin/kerghan` — header comment and `usage`.
- `standalone/config.example` — new `restart-on-update` entry after `bind`.
