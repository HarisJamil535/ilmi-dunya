// Runs jobs that share a key one after another, so two identical requests (a double click, a retry)
// cannot both pass a check and then both create a record. Jobs with different keys run in parallel.
const tails = new Map();

async function withLock(key, job) {
    const previous = tails.get(key) || Promise.resolve();
    let release;
    const mine = new Promise(resolve => { release = resolve; });
    const tail = previous.then(() => mine);
    tails.set(key, tail);
    await previous;
    try {
        return await job();
    } finally {
        release();
        if (tails.get(key) === tail) tails.delete(key);
    }
}

module.exports = { withLock, pendingLocks: () => tails.size };
