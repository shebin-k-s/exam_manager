import express from 'express';
import { uploadExcel } from '../controllers/uploadController.js';
import { upload } from '../config/multerConfig.js';
import { verifyToken } from '../middleware/authMiddleware.js';


const router = express.Router();

router.post("/", verifyToken, upload.single("file"), uploadExcel);

export default router;
