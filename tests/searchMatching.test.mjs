import test from "node:test";
import assert from "node:assert/strict";
import {
  getSearchMatches,
  doesTextMatchSearch,
  findSearchMatchIndex,
} from "../src/components/log-viewer/searchMatching.js";

test("literal search is case-insensitive and finds repeated matches", () => {
  const matches = getSearchMatches("fatal FATAL notfatal", "fatal", false);
  assert.equal(matches.length, 3);
  assert.deepEqual(
    matches.map((match) => match.text),
    ["fatal", "FATAL", "fatal"],
  );
});

test("regex mode applies regex semantics", () => {
  const regexMatches = getSearchMatches("error1 error2 warn", "error\\d", true);
  assert.equal(regexMatches.length, 2);

  const literalMatches = getSearchMatches(
    "error1 error2 warn",
    "error\\d",
    false,
  );
  assert.equal(literalMatches.length, 0);
});

test("invalid regex returns no matches and never throws", () => {
  assert.equal(doesTextMatchSearch("fatal", "[", true), false);
  assert.deepEqual(getSearchMatches("fatal", "[", true), []);
});

test("next navigation wraps to start", () => {
  const messages = ["alpha", "fatal one", "beta", "fatal two"];
  const next = findSearchMatchIndex(messages, "fatal", false, 3, 1);
  assert.equal(next, 1);
});

test("previous navigation wraps to end", () => {
  const messages = ["alpha", "fatal one", "beta", "fatal two"];
  const previous = findSearchMatchIndex(messages, "fatal", false, 1, -1);
  assert.equal(previous, 3);
});

test("no matches returns -1", () => {
  const messages = ["alpha", "beta", "gamma"];
  assert.equal(findSearchMatchIndex(messages, "fatal", false, 0, 1), -1);
});

