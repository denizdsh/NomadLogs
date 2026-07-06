import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import {
  R2_BUCKET as BUCKET_NAME,
  R2_ACCOUNT_ID as ACCOUNT_ID,
  R2_ACCESS_KEY_ID as ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY as SECRET_ACCESS_KEY,
  R2_PUBLIC_URL as PUBLIC_URL,
  IS_R2_CONFIGURED as isR2Configured,
} from "../config/constants.js";

const s3Client = isR2Configured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
      },
    })
  : null;

/**
 * Optimize image and upload to Cloudflare R2 or local filesystem fallback.
 *
 * Steps:
 * 1. Convert to WebP format
 * 2. Resize to maximum width of 1600px (retains aspect ratio)
 * 3. Compress to 80% quality
 * 4. Upload to configured storage
 */
export async function optimizeAndUpload(
  fileBuffer: Buffer,
  originalFilename: string
): Promise<string> {
  // Generate a secure random filename to prevent clashes
  const fileHash = crypto.randomBytes(16).toString("hex");
  const filename = `${fileHash}.webp`;

  // Optimize using sharp
  const optimizedBuffer = await sharp(fileBuffer)
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  if (s3Client && isR2Configured) {
    // Cloudflare R2 Upload
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filename,
      Body: optimizedBuffer,
      ContentType: "image/webp",
    });

    await s3Client.send(command);

    // Return the public URL
    const baseUrl = PUBLIC_URL.replace(/\/$/, "");
    return `${baseUrl}/${filename}`;
  } else {
    // Local filesystem fallback
    const uploadsDir = path.join(process.cwd(), "public", "uploads");

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(filePath, optimizedBuffer);

    // Return relative URL that Express can serve statically
    return `/uploads/${filename}`;
  }
}
