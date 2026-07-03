// FILE: src/controllers/authController.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import UserModel from '../models/userModel.js';

const ALLOWED_REGISTRATION_ROLES = new Set(['merchant', 'driver', 'client']);

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  avatar: user.avatar || null,
  shop_slug: user.shop_slug || null
});

export const register = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (
      !isNonEmptyString(name)
      || !isNonEmptyString(email)
      || !isNonEmptyString(password)
      || !isNonEmptyString(phone)
      || !isNonEmptyString(role)
    ) {
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();
    const normalizedRole = role.trim();

    if (!ALLOWED_REGISTRATION_ROLES.has(normalizedRole)) {
      return res.status(400).json({ message: 'Role invalide.' });
    }

    const existingUser = await UserModel.findByEmail(normalizedEmail);

    if (existingUser) {
      return res.status(409).json({ message: 'Cet email est deja utilise.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = await UserModel.create(
      normalizedName,
      normalizedEmail,
      hashedPassword,
      normalizedPhone,
      normalizedRole
    );
    const createdUser = await UserModel.findById(userId);

    return res.status(201).json({
      message: 'Utilisateur cree avec succes.',
      user: sanitizeUser(createdUser)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ message: 'Email et mot de passe requis.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await UserModel.findByEmail(normalizedEmail);

    if (!user) {
      return res.status(401).json({ message: 'Identifiants invalides.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Identifiants invalides.' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Configuration JWT manquante.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Erreur serveur.' });
  }
};

export const getCurrentUser = async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user.id);

    if (!user) {
      const error = new Error('Utilisateur introuvable.');
      error.statusCode = 404;
      throw error;
    }

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
};
