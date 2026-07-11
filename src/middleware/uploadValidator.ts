import multer from "multer";
import { Request } from "express";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const storage = multer.memoryStorage();

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const isCsvMime =
    file.mimetype === "text/csv" ||
    file.mimetype === "application/vnd.ms-excel" ||
    file.mimetype === "application/csv";
  const isCsvExt = file.originalname.toLowerCase().endsWith(".csv");

  if (isCsvMime || isCsvExt) {
    cb(null, true);
  } else {
    cb(new Error("Only .csv files are allowed"));
  }
}

export const uploadCsv = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
}).single("file");