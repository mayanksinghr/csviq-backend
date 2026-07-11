import { Router } from "express";
import { uploadCsv } from "../middleware/uploadValidator";
import {
  previewCsv,
  startImport,
  streamImportProgress,
  cancelImport,
} from "../controllers/import.controller";

const router = Router();

router.post("/upload", uploadCsv, previewCsv);
router.post("/", uploadCsv, startImport);
router.get("/:jobId/progress", streamImportProgress);
router.post("/:jobId/cancel", cancelImport);

export default router;