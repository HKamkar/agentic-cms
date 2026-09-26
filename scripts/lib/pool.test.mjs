import assert from "node:assert/strict";
import { test } from "node:test";
import { inPool } from "./pool.mjs";

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

test("every item is worked once, by at most `slots` workers at a time, each opened once and closed", async () => {
  const opened = [], closed = [], done = [];
  let busy = 0, peak = 0;
  await inPool([1, 2, 3, 4, 5, 6, 7], {
    slots: 3,
    open: async (index) => { opened.push(index); return { index, close: async () => closed.push(index) }; },
    work: async (item, slot) => { busy++; peak = Math.max(peak, busy); await tick(); done.push([item, slot.index]); busy--; },
  });
  assert.deepEqual(done.map(([item]) => item).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(peak, 3);
  assert.deepEqual(opened, [0, 1, 2]);
  assert.deepEqual(closed.sort(), [0, 1, 2]);
});

test("no more workers than items, at least one; none for no items", async () => {
  const opened = [];
  const open = async (index) => { opened.push(index); return { close: async () => {} }; };
  await inPool(["a"], { slots: 4, open, work: async () => {} });
  assert.deepEqual(opened, [0]);
  await inPool(["a", "b"], { slots: 0, open, work: async () => {} });
  assert.deepEqual(opened, [0, 0], "slots below one means one");
  await inPool([], { slots: 4, open, work: async () => {} });
  assert.deepEqual(opened, [0, 0]);
});

test("a worker that throws stops the queue, every worker is still closed, and the error comes out", async () => {
  const closed = [], done = [];
  await assert.rejects(inPool([1, 2, 3, 4, 5, 6], {
    slots: 2,
    open: async (index) => ({ close: async () => closed.push(index) }),
    work: async (item) => { await tick(); if (item === 2) throw new Error("stalled twice"); done.push(item); },
  }), /stalled twice/);
  assert.deepEqual(closed.sort(), [0, 1]);
  assert.ok(done.length < 5, `the queue stopped (${done})`);
});
