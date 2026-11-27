# Pending items for the make.fun submission

The game itself (`game/`) is complete and playable offline, and the
submission package around it is assembled. What is done and what is
still owed is listed honestly below — nothing has been faked.

## Done

- [x] **Official make.fun vendor kit** — `vendor/makefun-game.ts` copied
      exactly from the official starter kit. Verified 2026-11-27:
      sha256 `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129`,
      identical to the entry for `starter/vendor/makefun-game.ts`
      recorded in the kit's `kit.json`. Not modified.
- [x] **`main.ts`** — copied unchanged from the starter kit (sha256
      `98e7342e091d6f4a7f330386d1e401999881fd2a4538ed6b520cca0e8eef28c8`).
      It copies `game/` and `screenshots/` to the output dir and writes
      `dossier.json` via the vendor library. Also present from the kit,
      unchanged: `serve.ts` (local dev server, port 8080) and
      `shots.json` (the screenshot scene list).
- [x] **Deterministic screenshot mode** — `game/js/shots.js` stages
      `?shot=start|play|end&seed=N` scenes with the game's own modules
      (briefing / autopilot flight at a fixed step / touchdown judged by
      the real `judgeTouchdown`). Same seed → same frame: a re-capture
      of the `play` scene was byte-identical. Normal play without the
      query string is untouched.
- [x] **Real screenshots** — captured 2026-11-27 from actual renders of
      this game's code in headless Chromium (Muse Browser 157) at a
      1280×720 viewport, converted to JPEG:

      | File | Bytes | Dimensions |
      | --- | --- | --- |
      | `screenshots/1-start.jpg` | 129,947 | 1280×720 |
      | `screenshots/2-play.jpg` | 130,839 | 1280×720 |
      | `screenshots/3-end.jpg` | 112,428 | 1280×720 |

      All within the gates (long side ≤ 1280, short side ≥ 480,
      ≤ 256 KiB each). Capture note, for honesty: `node serve.ts` was
      run and served these exact files on port 8080 (HTTP 200), but
      this Chromium build blocks loopback HTTP captures with
      `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`, so the frames were
      captured loading the identical `game/` files via `file://` —
      the game's supported double-click route. Same code, same render.
- [x] **`main.ts` double-run test** — two runs with different
      `MAKEFUN_OUTPUT_DIR`s produced byte-identical outputs;
      `dossier.json` sha256
      `d746f5ca82ae8473174f4a0c161f9ab8c27263b89aaae70a86a5d63ecbcce705`
      in both. Rough gates pass: 11 files in `game/` (≤ 993),
      46,606 bytes total (≤ 48 MiB), each screenshot ≤ 256 KiB.

## Still pending

- [ ] **Public GitHub repo + push** — the repo still has to be created
      under the submitter's own GitHub account (**Badroesxero**,
      https://github.com/Badroesxero) and this folder pushed to it.
      The repo must be the one named at submission, at a specific commit.
- [ ] **Transcripts** — the AI coding-agent transcripts of the sessions
      that built the game. NOT part of the repo: they are attached at
      submission time. Two routes:
      (a) the kit CLI — `node cli/makefun.mjs bundle` — which captures the
          transcript files plus a run record into a `.tar.gz`, with secret
          redaction; or
      (b) loose transcripts: accepted formats are `.jsonl` / `.json`,
          `.md`, `.sse`, SQLite, `.jsonl.gz` / `.zst`, PLUS a mandatory
          `makefun-run.json` file of the form
          `{"format":"makefun-run/1","harness":...,"provider":...,"model":...}`.
      Transcript gate: at least 1 parsed session; timestamps inside the
      competition window; at least 30% of counted lines authored; at least
      5 assistant turns containing text; at least 2 file writes; each
      transcript file under 2,097,152 bytes.
      Not yet prepared — do not fabricate transcripts.
- [ ] **Signing at submission (user-only step)** — the submit CLI requires
      the user's Solana wallet keypair for signing. We will never ask for,
      hold, or handle that keypair / seed phrase / private key. Signing
      will be done by the user personally via the web flow when submitting.

## Deadline

Official deadline from the API: **entries close 2026-11-28T00:57:00Z**
(= Saturday 07:57 WIB, Asia/Jakarta).

## How the game was verified locally

- `node --check` passes for every file in `game/js/` (including the new
  `shots.js`); no network references anywhere in `game/`.
- A headless smoke test loads the world/physics/mission modules in Node
  with a `window` shim, steps the aircraft, checks terrain/runway queries,
  ring progression and landing-vs-crash judging.
- The screenshot scenes and normal (no-query) play were both loaded in
  headless Chromium with no page errors; the three submission
  screenshots above are those renders.
