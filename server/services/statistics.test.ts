import assert from "node:assert/strict";
import test from "node:test";
import { calculateSpeechStatistics } from "./statistics.js";

const fillers = (transcript: string) => calculateSpeechStatistics(transcript, 60).fillerWords;

test("counts filler 'like' and 'you know' but not 'I like'", () => {
  assert.deepEqual(fillers("i like pizza and you know it's like really good"), { like: 1, "you know": 1 });
});

test("counts phrases and words but not 'likely'", () => {
  assert.deepEqual(fillers("it was basically kind of likely to work"), { basically: 1, "kind of": 1 });
});

test("does not count 'feel like'", () => {
  assert.deepEqual(fillers("i mean i actually feel like it worked"), { "i mean": 1, actually: 1 });
});

test("ignores so, right, well, just, really and okay", () => {
  assert.deepEqual(fillers("so right well just really okay"), {});
});

test("does not count descriptive 'kind of'", () => {
  assert.deepEqual(fillers("what kind of car is it"), {});
});

test("does not count 'you know' in a question", () => {
  assert.deepEqual(fillers("do you know the answer"), {});
});

test("still counts um when it appears in the transcript", () => {
  assert.deepEqual(fillers("Um, hello there. Um yes"), { um: 2 });
});
