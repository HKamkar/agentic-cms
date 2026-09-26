// A fixed number of workers over a list: each worker is set up once (a
// browser, for the harness), takes the next item until none is left, and is
// closed when it runs out. Items are started in order; a worker that throws
// empties the queue, so the others finish what they hold and stop, and the
// error comes out once every worker is closed.

/** Runs work(item, slot) over `items` with at most `slots` workers; open(index) sets a worker's slot up, slot.close() ends it. */
export async function inPool(items, { slots, open, work }) {
  const queue = [...items];
  const worker = async (index) => {
    const slot = await open(index);
    try {
      while (queue.length) await work(queue.shift(), slot);
    } catch (error) {
      queue.length = 0;
      throw error;
    } finally { await slot.close(); }
  };
  // every worker is closed (its browser gone) before the first error, if any, comes out
  const results = await Promise.allSettled(Array.from({ length: Math.min(Math.max(1, slots), queue.length) }, (_, index) => worker(index)));
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
}
