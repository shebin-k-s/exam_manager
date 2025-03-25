import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { adminAuthRoutes, studentRoutes, uploadRoutes } from './routes/index.js';

import path from 'path';
import { fileURLToPath } from 'url';
import { ensureUploadDirectory } from './utils/fileUtils.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


ensureUploadDirectory;


dotenv.config();

const app = express();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.use("/api/v1/auth", adminAuthRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/student', studentRoutes);

ensureUploadDirectory();


const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.CONNECTION_URL)
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running at ${PORT}`);
        });
    })
    .catch((error) => {
        console.log(error);
    });
