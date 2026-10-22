// Runs in a worker thread so a large Excel export never freezes the website for other visitors.
const { parentPort, workerData } = require("node:worker_threads");
const { buildWorkbook } = require("./schoolResultsWorkbook");

buildWorkbook(workerData.scope, workerData.report, new Date(workerData.generatedAt))
    .then(buffer => parentPort.postMessage({ buffer }))
    .catch(error => parentPort.postMessage({ error: error.message }));
