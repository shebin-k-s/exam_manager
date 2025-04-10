import express from "express";
import { downloadSeatAllocation, downloadSigningPageReport } from "../controllers/uploadController.js";

const router = express.Router();

router.route("/download")
    .get(downloadSeatAllocation);

router.route("/report")
    .get(downloadSigningPageReport)


export default router;
