---
"@drock07/board-game-toolkit-engine": minor
---

Type games with one bundle instead of a vars type. `TypesFor<typeof spec, { vars, entities, locals }>` reads zone names from the spec, so misspelled zones, wrong entity props and unknown vars fields are compile errors, entities narrow on `type`, and `tx.local("node")` is typed. Vars, entity props and locals may be interfaces as well as type aliases; they're checked with `JsonCompatible`, which rejects Date, Map, Set, functions and required `undefined` values.
