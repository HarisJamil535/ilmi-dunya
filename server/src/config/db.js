const mongoose = require('mongoose');
const dns = require('node:dns');
const { isIP } = require('node:net');

const connectDB = async () => {
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is not configured.");
    }

    // Atlas SRV lookups use Node's DNS resolver, which can differ from browser DNS.
    const dnsServers = (process.env.MONGO_DNS_SERVERS || '').split(',').map(value => value.trim()).filter(Boolean);
    if (dnsServers.length) {
        if (dnsServers.some(value => !isIP(value))) throw new Error('MONGO_DNS_SERVERS must contain comma-separated DNS server IP addresses.');
        dns.setServers(dnsServers);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 20,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            autoIndex: process.env.NODE_ENV !== "production",
        });
    } catch (error) {
        const message = ['querySrv', 'queryTxt'].includes(error.syscall)
            ? 'MongoDB Atlas DNS lookup failed. Check your DNS resolver or configure MONGO_DNS_SERVERS with reachable DNS server IP addresses.'
            : 'MongoDB connection failed. Check database availability, network access and MONGODB_URI.';
        throw Object.assign(new Error(message), { code: error.code || error.name });
    }
};

process.on("SIGINT", async () => {
    await mongoose.connection.close();
    process.exit(0);
});

module.exports = connectDB;
