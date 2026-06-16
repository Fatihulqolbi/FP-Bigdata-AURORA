import { Router } from "express";
import * as pipelineCtrl from "./pipeline.controller.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

router.get("/status", requireAuth, pipelineCtrl.getStatus);
router.get("/stats", requireAuth, pipelineCtrl.getStats);
router.get("/events", requireAuth, pipelineCtrl.getEvents);
router.get("/hdfs", requireAuth, pipelineCtrl.getHDFSFiles);

export default router;
