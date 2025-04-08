import express from "express";
import { downloadSeatAllocation } from "../controllers/uploadController.js";

const router = express.Router();

router.route("/download")
    .get(downloadSeatAllocation);

export default router;
