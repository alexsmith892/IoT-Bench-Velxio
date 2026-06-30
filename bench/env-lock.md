# bench — pinned environment lock

A graded benchmark result is only reproducible against a known toolchain, so the
exact versions that produce traces are recorded here and in [`env.ts`](env.ts)
(`PINNED_ENV`), which the runner prints on every run. Re-verify these before any
**scored** run (the pilot in Pass 11 and the freeze in Pass 17); a silent core or
avr8js bump can change compiled behaviour and break determinism
(`benchmark-design.md` §5, §8).

There are two tiers because they run in different processes:

| Tier | Component | Pinned version | Source of truth |
|---|---|---|---|
| Harness (sim) | `avr8js` | `0.21.0` | `bench/package.json` + `package-lock.json` |
| Harness (sim) | Node | `v22.22.3` | local runtime |
| Harness (sim) | TypeScript / tsx / vitest | `~5.9.3` / `^4.19.2` / `^4.0.18` | `bench/package.json` |
| Compile backend | `arduino-cli` | `1.5.1` | the Velxio compile backend host |
| Compile backend | `arduino:avr` core | `1.8.8` | the Velxio compile backend host |

Captured **2026-06-29**.

## How to re-capture

Harness side (from `bench/`):

```bash
node --version
npm ls avr8js          # exact installed avr8js
```

Compile-backend side (wherever `arduino-cli` runs — local or the velxio-dev
container that proxies `/api`):

```bash
arduino-cli version
arduino-cli core list   # the arduino:avr line
```

Update `PINNED_ENV` in `env.ts` and the table above together. The harness
version (`avr8js`) and the backend version (`arduino:avr`) are independent — a
result is only valid when **both** match what is recorded here.

> Verified 2026-06-29 against the running Docker compile backend (container
> `50df9a1a7747`, `/api` proxied on host port 3080): `arduino-cli 1.5.1` and
> `arduino:avr 1.8.8` inside the container **match** the values above, so a hex
> compiled by the scored backend is produced by the recorded toolchain. Re-verify
> inside the container (`docker exec <id> arduino-cli core list`) if the image is
> rebuilt.
