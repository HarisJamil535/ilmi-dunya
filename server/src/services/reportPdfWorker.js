// Lays out a result PDF on a worker thread so a large class report never freezes the website for others.
const { parentPort, workerData } = require("node:worker_threads");
const { renderSchoolPdf } = require("./schoolReportPdf");

renderSchoolPdf(workerData.meta, workerData.data)
    .then(buffer => parentPort.postMessage({ buffer }))
    .catch(error => parentPort.postMessage({ error: error.message }));
