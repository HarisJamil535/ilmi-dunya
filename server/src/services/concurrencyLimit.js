// Allows at most `max` jobs at once; the rest wait their turn. Keeps memory and CPU bounded when many
// visitors ask for something expensive (a PDF, an Excel file) in the same moment.
function createConcurrencyLimit(max) {
    let active = 0;
    const waiting = [];
    const next = () => {
        if (active >= max || !waiting.length) return;
        active += 1;
        const { job, resolve, reject } = waiting.shift();
        Promise.resolve().then(job).then(resolve, reject).finally(() => { active -= 1; next(); });
    };
    const run = job => new Promise((resolve, reject) => { waiting.push({ job, resolve, reject }); next(); });
    run.stats = () => ({ active, waiting: waiting.length });
    return run;
}

module.exports = { createConcurrencyLimit };
