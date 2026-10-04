---
"@drock07/board-game-toolkit-engine": minor
---

Zone families: a zone def's `count` creates N instances (`factory:0`, …), alone or combined with `perPlayer` (`patternLine:p1:0`, …). `count` is a number or a `{ ref }` to the new `impl.zoneCounts`, run once at `init` with the seating and options. Zones carry an `index`, `zonesOf(def, player?)` on readers and transactions lists a family in order, zone ids are typed per family, and `count` expressions accept `$item`.
