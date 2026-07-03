import { open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { avatarsDirectory } from '../config/avatarUpload.js';
import UserModel from '../models/userModel.js';

const AVATAR_PUBLIC_PREFIX = '/uploads/avatars/';

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const imageSignatures = {
  'image/jpeg': (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/png': (buffer) => buffer.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ),
  'image/webp': (buffer) => buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
};

const hasValidImageSignature = async (file) => {
  const fileHandle = await open(file.path, 'r');

  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, 0);
    return bytesRead >= 12 && imageSignatures[file.mimetype]?.(buffer) === true;
  } finally {
    await fileHandle.close();
  }
};

const removeFile = async (filePath) => {
  try {
    await unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Impossible de supprimer un avatar :', error.message);
    }
  }
};

const removeStoredAvatar = async (avatarPath) => {
  if (!avatarPath?.startsWith(AVATAR_PUBLIC_PREFIX)) {
    return;
  }

  const storedFilename = avatarPath.slice(AVATAR_PUBLIC_PREFIX.length);

  if (!storedFilename || path.basename(storedFilename) !== storedFilename) {
    return;
  }

  await removeFile(path.join(avatarsDirectory, storedFilename));
};

export const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      const error = new Error('Une image est requise dans le champ avatar.');
      error.statusCode = 400;
      throw error;
    }

    if (!await hasValidImageSignature(req.file)) {
      const error = new Error('Le contenu du fichier ne correspond pas a une image valide.');
      error.statusCode = 400;
      throw error;
    }

    const user = await UserModel.findById(req.user.id);

    if (!user) {
      await removeFile(req.file.path);
      const error = new Error('Utilisateur introuvable.');
      error.statusCode = 404;
      throw error;
    }

    const avatarPath = `${AVATAR_PUBLIC_PREFIX}${req.file.filename}`;
    await UserModel.updateAvatar(req.user.id, avatarPath);
    await removeStoredAvatar(user.avatar);

    const avatarUrl = `${req.protocol}://${req.get('host')}${avatarPath}`;

    return res.status(200).json({ success: true, avatarUrl });
  } catch (error) {
    if (req.file?.path) {
      await removeFile(req.file.path);
    }

    return next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;

    if (!isNonEmptyString(name) || !isNonEmptyString(phone)) {
      const error = new Error('Le nom et le telephone sont requis.');
      error.statusCode = 400;
      throw error;
    }

    const affectedRows = await UserModel.updateProfile(
      req.user.id,
      name.trim(),
      phone.trim()
    );

    if (!affectedRows) {
      const error = new Error('Utilisateur introuvable.');
      error.statusCode = 404;
      throw error;
    }

    const user = await UserModel.findById(req.user.id);
    return res.status(200).json({ success: true, user });
  } catch (error) {
    return next(error);
  }
};

export const getUserDetails = async (req, res, next) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      const error = new Error('Identifiant utilisateur invalide.');
      error.statusCode = 400;
      throw error;
    }

    const user = await UserModel.findDetailsById(userId);

    if (!user) {
      const error = new Error('Utilisateur introuvable.');
      error.statusCode = 404;
      throw error;
    }

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        created_at: user.created_at,
        account_status: 'active',
        metrics: {
          orders_created: Number(user.orders_created),
          deliveries_assigned: Number(user.deliveries_assigned),
          deliveries_completed: Number(user.deliveries_completed)
        }
      }
    });
  } catch (error) {
    return next(error);
  }
};
