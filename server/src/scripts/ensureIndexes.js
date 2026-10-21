require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

async function main() {
    await connectDB();
    const directory = path.join(__dirname, '../models');
    for (const file of fs.readdirSync(directory).filter(file => /^[A-Z].*\.js$/.test(file))) require(path.join(directory, file));
    // Add declared indexes without dropping existing indexes or rewriting records.
    // Keep going after a conflict so one model's duplicates do not block the others.
    const failed = [];
    for (const model of Object.values(mongoose.models)) {
        try {
            await model.createIndexes();
            process.stdout.write(`${model.modelName}: indexes checked\n`);
        } catch (error) {
            failed.push(model.modelName);
            process.stderr.write(`${model.modelName}: index creation failed (${error.code || error.name}). ${error.code === 11000 ? 'Resolve the duplicate records it names, then rerun.' : error.message}\n`);
        }
    }
    if (failed.length) throw Object.assign(new Error(`Indexes incomplete for ${failed.join(', ')}`), { code: 'INDEXES_INCOMPLETE' });
}
main().catch(error => {
    process.stderr.write(`Index creation failed (${error.code || error.name}). Resolve conflicting records before retrying.\n`);
    process.exitCode = 1;
}).finally(() => mongoose.disconnect());
