const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

//--------------------------------------

require('dotenv').config(); 
const connectDB = require('./src/config/db');
const cors = require('cors');
const adminRoutes = require('./src/routes/adminRoutes');
const boardRoutes = require('./src/routes/boardRoutes');
const classRoutes = require("./src/routes/classRouter");
const groupRoutes = require("./src/routes/groupRoutes");
const subjectRoutes = require("./src/routes/subjectRoutes");
const chapterRoutes = require("./src/routes/chapterRoutes");
const topicRoutes = require("./src/routes/topicRoutes");
const express = require('express');

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use('/api/admin', adminRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/classes", classRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/chapters', chapterRoutes);
app.use("/api/topics", topicRoutes);

app.get('/', (req, res) => {
    res.send('Backend is running on port 5000');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running at port ${PORT}`);
});