import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ProductModel from '../models/productModel.js';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const PRODUCT_IMAGE_PREFIX = '/uploads/products/';
const productsDirectory = fileURLToPath(new URL('../../public/uploads/products/', import.meta.url));
const IMAGE_TYPES = {
  'image/jpeg': {
    extension: 'jpg',
    validate: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  },
  'image/png': {
    extension: 'png',
    validate: (buffer) => buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  },
  'image/webp': {
    extension: 'webp',
    validate: (buffer) => buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  }
};

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseProductId = (value) => {
  const productId = Number(value);
  return Number.isInteger(productId) && productId > 0 ? productId : null;
};

const parseStock = (value) => {
  const stock = Number(value);
  return Number.isInteger(stock) && stock >= 0 && stock <= 1000000 ? stock : null;
};

const parsePrice = (value) => {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 && price <= 100000000
    ? Math.round(price * 100) / 100
    : null;
};

const decodeProductImage = (imageData) => {
  if (typeof imageData !== 'string') {
    throw createHttpError('Une image produit est requise.', 400);
  }

  const match = imageData.match(/^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/=\r\n]+)$/);

  if (!match) {
    throw createHttpError('Format d image invalide.', 400);
  }

  const [, mimeType, payload] = match;
  const imageType = IMAGE_TYPES[mimeType];
  const buffer = Buffer.from(payload, 'base64');

  if (buffer.length < 12 || buffer.length > MAX_IMAGE_SIZE || !imageType.validate(buffer)) {
    throw createHttpError('Le contenu de l image est invalide ou depasse 5 Mo.', 400);
  }

  return { buffer, extension: imageType.extension };
};

const removeStoredProductImage = async (imageUrl) => {
  if (!imageUrl?.startsWith(PRODUCT_IMAGE_PREFIX)) {
    return;
  }

  const filename = imageUrl.slice(PRODUCT_IMAGE_PREFIX.length);

  if (!filename || path.basename(filename) !== filename) {
    return;
  }

  try {
    await unlink(path.join(productsDirectory, filename));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Impossible de supprimer une image produit :', error.message);
    }
  }
};

export const getMerchantProducts = async (req, res, next) => {
  try {
    return res.status(200).json(await ProductModel.findByMerchantId(req.user.id));
  } catch (error) {
    return next(error);
  }
};

export const createProduct = async (req, res, next) => {
  let storedImagePath = null;

  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const price = parsePrice(req.body.price);
    const stock = parseStock(req.body.stock);

    if (!name || name.length > 255 || price === null || stock === null) {
      throw createHttpError('Nom, prix ou stock invalide.', 400);
    }

    const image = decodeProductImage(req.body.image_base64);
    const filename = `${randomUUID()}.${image.extension}`;
    storedImagePath = path.join(productsDirectory, filename);
    await mkdir(productsDirectory, { recursive: true });
    await writeFile(storedImagePath, image.buffer, { flag: 'wx' });

    const product = await ProductModel.create(
      req.user.id,
      name,
      price,
      `${PRODUCT_IMAGE_PREFIX}${filename}`,
      stock
    );

    return res.status(201).json({ success: true, product });
  } catch (error) {
    if (storedImagePath) {
      try {
        await unlink(storedImagePath);
      } catch (unlinkError) {
        if (unlinkError.code !== 'ENOENT') {
          console.error('Impossible de nettoyer l image produit :', unlinkError.message);
        }
      }
    }

    return next(error);
  }
};

export const updateProductStock = async (req, res, next) => {
  try {
    const productId = parseProductId(req.params.id);
    const stock = parseStock(req.body.stock);

    if (!productId || stock === null) {
      throw createHttpError('Produit ou stock invalide.', 400);
    }

    const product = await ProductModel.updateStock(productId, req.user.id, stock);

    if (!product) {
      throw createHttpError('Produit introuvable.', 404);
    }

    return res.status(200).json({ success: true, product });
  } catch (error) {
    return next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const productId = parseProductId(req.params.id);

    if (!productId) {
      throw createHttpError('Produit invalide.', 400);
    }

    const product = await ProductModel.remove(productId, req.user.id);

    if (!product) {
      throw createHttpError('Produit introuvable.', 404);
    }

    await removeStoredProductImage(product.image_url);
    return res.status(200).json({ success: true, productId });
  } catch (error) {
    return next(error);
  }
};
