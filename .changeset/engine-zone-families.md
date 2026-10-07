---
"@drock07/board-game-toolkit-engine": minor
---

Zone families: a zone's `count` creates numbered instances (`factory.at(2)`), alone or with `perPlayer` (`line.of("p1", 3)`). `count` is a number or a function of the player count. `s.zones(family, player?)` lists a family's instances in seat order, then index order.
