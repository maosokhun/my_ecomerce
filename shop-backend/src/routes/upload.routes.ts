import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { uploadImage } from '../lib/cloudinary';
import { saveLocalProductImage } from '../lib/localImageUpload';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const tmpUploadDir = path.join(os.tmpdir(), 'shophub-uploads');
fs.mkdirSync(tmpUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tmpUploadDir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim()
  );
}

router.post(
  '/image',
  authenticate,
  upload.single('image'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError('No image file provided', 400);

      const folder = String(req.body.folder || 'shop').replace(/[^a-zA-Z0-9_-]/g, '') || 'shop';
      const isAvatarUpload = folder === 'avatars';
      if (!isAvatarUpload && req.user?.role !== 'ADMIN') {
        throw new AppError('Admin access required for this upload folder', 403);
      }

      if (isCloudinaryConfigured()) {
        const result = await uploadImage(req.file.path, folder);
        await fsp.unlink(req.file.path).catch(() => {});
        res.json({ success: true, data: result });
        return;
      }

      const result = await saveLocalProductImage(req.file.path, req.file.originalname, folder);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
