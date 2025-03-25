import express from "express";
import { findSeatByRollNumber } from "../controllers/studentController.js";

const router = express.Router();

router.route("/find-seat")
    .post(findSeatByRollNumber);

export default router;
