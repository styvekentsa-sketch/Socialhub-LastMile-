import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

export const avatarsDirectory = fileURLToPath(
  new URL('../../public/uploads/avatars/', import.meta.url)
);

mkdirSync(avatarsDirectory, { recursive: true });

const allowedImageTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

const storage = multer.diskStorage({
  destination: avatarsDirectory,
  filename: (req, file, callback) => {
    callback(null, `${randomUUID()}${allowedImageTypes.get(file.mimetype)}`);
  }
});

const avatarUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, callback) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      const error = new Error('Format invalide. Utilisez une image JPEG, PNG ou WebP.');
      error.statusCode = 400;
      return callback(error);
    }

    return callback(null, true);
  }
});

export const uploadAvatar = (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (!error.statusCode) {
      error.statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    }

    return next(error);
  });
};
