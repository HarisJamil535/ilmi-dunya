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
    for (const model of Object.values(mongoose.models)) {
        await model.createIndexes();
        process.stdout.write(`${model.modelName}: indexes checked\n`);
    }
}
main().catch(error => {
    process.stderr.write(`Index creation failed (${error.code || error.name}). Resolve conflicting records before retrying.\n`);
    process.exitCode = 1;
}).finally(() => mongoose.disconnect());
