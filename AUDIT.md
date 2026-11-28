# PickHit system audit (Nov 28, 2026)

Every step from PrizePicks' board to the pick on screen was traced in code and checked with tests, not just by looking at the output.

## 1. How it works today (traced end to end)

**Data in**
- PrizePicks board (projections JSON) arrives one of four ways: the iPhone Shortcut posts it to the server (`/board/<league>`), the browser fetches it directly, it's fetched through the server, or it's pasted by hand.
- Game logs come from ESPN:
  - NBA: up to 5 seasons via ESPN's game log API.
  - Other sports: ESPN, SofaScore (tennis, soccer), UFC stats and golf.
- Context comes from the ESPN scoreboard (spread, total, game status), ESPN injuries, news headlines and PrizePicks' "times picked".
- There are no sportsbook prop odds. The "market" check compares a goblin or demon line with the same player's standard line on PrizePicks.

**Each pick's chance** (`analyze` → `finalize`)
1. **History model** (`scoreStats` / `scoreNFL`): the player's past games at this exact line, recent games weighted more, plus a normal approximation around a projection.
2. **Opportunity model** (`oppModel`; NBA, WNBA, college basketball, NHL): expected minutes × per-minute rate × opponent defense. It's blended 40/60 with history. Football has its own version (`footballModel`).
3. **Second opinion** for sports without the opportunity model: the full multi-season hit rate at the line.
4. **Tennis**: a serve/return match simulator (added Nov 22).
5. **NEW: long-run anchor** (`seasonBlend`, see section 3).
6. Calibration steps in `finalize`, in order:
   - learned correction from graded results
   - reality check
   - strong-pick lift
   - swingy-stat shrink
   - lopsided-stat (skew) correction
   - segment self-correction
   - market anchor
7. Red-flag checks (`godBlock`). The pick is kept out of Top picks and lineups if any applies:
   - too few games
   - all-or-nothing stat
   - unconfirmed scoring
   - injury tag or news
   - trap line
   - small role
   - a teammate change against the pick
   - shaky minutes or rookie (overs)
   - first-half foul trouble or blowout (2H/4Q pages)

**Ranking**
- **Top picks**: no red flags, both methods agree (the cautious figure is at least 58%), ranked by cautious chance × payout, at most 8 per board.
- **My call**: BET, LEAN, SAFE LEG, SMALL PLAY or PASS, from the same numbers.

**Lineups** (`bestForStyle`)
- Only picks with no red flags.
- The search tries the best chance, best value and biggest payout boosts, within each style's payout band.
- Finalists are re-checked with a correlation simulation (`corrSim`) that can only lower a lineup's chance.

**Accountability**
- Every rating is saved and graded after the games (`/track`).
- Daily pregame snapshots are kept on the server (`/snap`, 90 days).
- A walk-forward replay re-predicts each player's last 15 real games using only earlier games (`replayTest`, runs on the device).

## 2. Problems found

| # | Problem | Impact | Status |
|---|---|---|---|
| 1 | **Same-player correlation capped at 0.6.** Two legs on one player (e.g. Pts+Rebs and PRA) really move together at about 0.95. | Lineup math treated stacked legs as far more independent than they are. A double miss on a Flex was about twice as likely as shown (33% vs 16%). | Fixed |
| 2 | **Lineup payouts assumed independence.** Expected return for Power and Flex used `dist()` (independent) even where links were known; only the Hit Picks chance used correlation. | Linked picks never showed up in the payout numbers. | Fixed: chance and both payouts take the lower of independent and linked |
| 3 | **Hit/miss correlation used raw (phi), not converted to the underlying stats.** | Every measured link was understated. | Fixed: sin(π/2·φ) conversion |
| 4 | **A season average beat the engine in real-game replays.** In walk-forward tests the recency-weighted mix scored worse than a plain season average (log loss 0.580 vs 0.572 in one league). | The engine chased recent form; lines already follow recent form, and players drift back toward their long-run level. | Fixed: 35% long-run anchor (`seasonBlend`), measured below |
| 5 | **Unders underrated, overs overrated** (lopsided stats). "50–55%" unders really hit 56%, overs 51%. | Under bets undersold, over bets oversold. | Fixed Nov 26 (skew correction) |
| 6 | **NFL: a missing ESPN column became 0.** Kickers scored "0 fantasy" every game, so the Under was called 100%. | Garbage NFL picks shown as locks. | Fixed Nov 26, plus a check across sports that treats an all-zero history as missing data |
| 7 | **Live games rated on lines PrizePicks had already pulled** (pregame line + live box score = 99%). | Fake 99% Top picks on live games. | Fixed Nov 24: live picks never in Top picks or lineups; pregame lines flagged |
| 8 | **2H/4Q boards unreachable** (`league_id=0`). | No second-half or 4th-quarter picks. | Fixed: board numbers learned from PrizePicks' league list |
| 9 | **Rookies / shaky minutes in Top picks** (the Wagler miss). | Overs that depend on a coach's whim were treated as safe. | Fixed Nov 23 |
| 10 | **Single pick couldn't exclude players or teams.** | Same names kept coming back. | Fixed: Skip player / Skip team, saved per sport |
| 11 | **Replay had no simple baselines and no over/under split.** | No way to tell whether the model beats a casual method. | Fixed: season-average, last-10 and coin-flip baselines; over/under and goblin/standard/demon calibration |
| 12 | **No real historical PrizePicks lines.** PrizePicks doesn't publish old lines. | Replays rebuild each line from the player's average at the time; real lines only exist from tracking (`/track`, `/snap`). | Can't be fixed from public data. The real track record is the ground truth and grows daily |
| 13 | **The simulated leagues were designed by me.** Calibration proven there depends on the simulation resembling the real NBA. | Results that only hold in the simulation can look real. | Mitigated: the real-game replay now reports PickHit vs baselines on the user's real logs, every load |
| 14 | **Seven calibration steps run in sequence.** | Hard to reason about; a risk of double correction. | Checked as a whole (calibration within 1–3 points in simulation). A single fitted calibrator is future work |
| 15 | **No sportsbook prop odds.** | The strongest independent check (the betting market) is missing. | Open: free Odds API key stored; integration not built |
| 16b | **Server snapshot step used an undefined variable.** Every board the Shortcut sent errored after saving; no daily snapshot was ever kept. | Shortcut could show failures; the "time machine" archive was empty. | Fixed |
| 16 | **NFL, MLB, soccer, golf and MMA engines barely tested** (no simulation like NBA's). | Lower confidence in those sports. | Partly addressed (second opinion, data-gap checks). Simulations for other sports are future work |

## 3. Measured results (this rebuild)

**Replay of real-style games, re-predicted using only earlier games** (7,200 predictions per league; prediction error, lower is better)

| | League A | League B |
|---|---|---|
| Coin flip | 0.693 | 0.693 |
| Last-10 hit rate | 0.608 | 0.613 |
| Season average | 0.583 | **0.572** |
| PickHit before | 0.586 | 0.580 |
| PickHit after (long-run anchor 50%, skew 0.5) | **0.581–0.585** | 0.575 |

PickHit now beats last-10 hit rates clearly. It roughly ties a season average: ahead in league A, slightly behind in league B. The same comparison now runs on the user's real game logs every time a sport loads (Track record → Replay), and warns if a simple method wins there.

**Full system on simulated leagues** (4 leagues × 4–5 days, scored against the true odds)

- **Top picks:** 8 a day. Engine says 60–62%, true 60–62%.
- **Over and Under calibration:** within about 1 point in the 50–65% range after the skew fix. Before, "50–55%" Unders really hit 56.4%.
- **Lineups:** Safe says 34%, true 35–40%. Balanced says 21%, true 19–24%. Bold says 12.5%, true 12.5–16%. Big swing says 6.5%, true 7.3–9%. Lineups slightly undersell themselves, never oversell.
- **Expected log loss:** unchanged by the anchor (0.6647 vs 0.6650).

**Tennis simulator** (synthetic tours with known odds): error vs truth 7.5 → 5.3 points.

**Feature tests:** all passed.
- Accounts and plans: 24 checks.
- Plan views: Guest, Free, Basic, Pro and Developer.
- 2H and 4Q pastes, All unders, Single pick skips, same-player links, kicker stats, board-number learning and snapshot saving.

See the final report in the conversation and `tests/` for the scripts:
`simrun.js`, `simgrade.js`, `side_cal.js`, `bt_test.js`, `tennis_app_test.js`, `plans_e2e.js`, `auth_test.mjs`.
