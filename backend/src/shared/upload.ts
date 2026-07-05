import fs from "fs";
import path from "path";
import multer from "multer";

const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, "../../uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir);
  },
  filename: (_req, file, callback) => {
    const safeOriginalName = file.originalname.replace(/[^\w.-]/g, "_");
    const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    callback(null, `${uniquePrefix}-${safeOriginalName}`);
  },
});

export const reportUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(new Error("Only PDF and Word documents are allowed"));
    }

    callback(null, true);
  },
});

export { uploadDir };