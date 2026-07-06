import { Router } from "express";
import multer from "multer";
import { optimizeAndUpload } from "../utils/upload.js";
import { authenticate, requireAuth, type AuthenticatedRequest } from "../middlewares/auth.middleware.js";

const uploadRouter = Router();

// Multer memory storage configuration with 10MB size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * POST /api/upload
 * Optimizes and uploads an image (to R2 if configured, otherwise falls back to local storage)
 */
uploadRouter.post(
  "/api/upload",
  authenticate,
  requireAuth,
  upload.single("image"),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No image file provided." });
        return;
      }

      const imageUrl = await optimizeAndUpload(req.file.buffer, req.file.originalname);
      res.json({ url: imageUrl });
    } catch (error) {
      console.error("Image upload error:", error);
      res.status(500).json({ error: "Failed to upload image." });
    }
  }
);

export { uploadRouter };
