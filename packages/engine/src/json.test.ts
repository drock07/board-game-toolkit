import { assert, test } from "vitest";
import { isPlainJson, jsonEqual, stableStringify } from "./json.js";

test("jsonEqual ignores key order and treats a missing key as undefined", () => {
  assert.ok(jsonEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }));
  assert.ok(jsonEqual({ a: 1, r: undefined }, { a: 1 }));
  assert.ok(jsonEqual({ a: 1 }, { a: 1, r: undefined }));
  assert.ok(!jsonEqual({ a: 1 }, { a: 1, b: null }));
  assert.ok(!jsonEqual([1, 2], [2, 1]));
  assert.ok(!jsonEqual({ 0: "x" }, ["x"]));
  assert.ok(!jsonEqual({ a: { b: 1 } }, { a: { b: 2 } }));
});

test("isPlainJson accepts what survives a round trip and nothing else", () => {
  assert.ok(isPlainJson({ a: [1, "x", true, null, { b: undefined }] }));
  const bad = [NaN, Infinity, [undefined], new Date(0), new Map(), () => 1, 1n];
  bad.forEach((v, i) => assert.ok(!isPlainJson({ v }), `case ${i}`));
});

test("stableStringify sorts keys at every depth", () => {
  assert.strictEqual(
    stableStringify({ b: { d: 1, c: 2 }, a: 0 }),
    '{"a":0,"b":{"c":2,"d":1}}',
  );
});
