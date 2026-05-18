import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, validateRequest, AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name_ar: Joi.string().required(),
  name_en: Joi.string().required(),
  school_id: Joi.string().uuid().required(),
  role_id: Joi.string().uuid().required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  school_id: Joi.string().uuid(),
});

// Register
router.post(
  '/register',
  validateRequest(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, name_ar, name_en, school_id, role_id } = req.body;

    const existingUser = await prisma.user.findFirst({
      where: { email, school_id },
    });

    if (existingUser) {
      throw new AppError('User already exists in this school', 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    
    const user = await prisma.user.create({
      data: {
        email,
        username: email.split('@')[0],
        password_hash: passwordHash,
        name_ar,
        name_en,
        school_id,
        role_id,
      },
      include: { role: true },
    });

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        schoolId: user.school_id,
        roleId: user.role_id,
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
    );

    const refreshToken = uuidv4();
    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token: refreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name_ar: user.name_ar,
          name_en: user.name_en,
          role: user.role,
        },
        token,
        refreshToken,
      },
      message: 'Registration successful',
    });
  })
);

// Login
router.post(
  '/login',
  validateRequest(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password, school_id } = req.body;

    const whereClause = school_id ? { email, school_id } : { email };
    
    const user = await prisma.user.findFirst({
      where: whereClause,
      include: { role: true, school: true },
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    if (!user.is_active) {
      throw new AppError('Account is inactive', 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        schoolId: user.school_id,
        roleId: user.role_id,
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
    );

    const refreshToken = uuidv4();
    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token: refreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name_ar: user.name_ar,
          name_en: user.name_en,
          role: user.role,
          school: {
            id: user.school.id,
            name_ar: user.school.school_name_ar,
            name_en: user.school.school_name_en,
          },
        },
        token,
        refreshToken,
      },
      message: 'Login successful',
    });
  })
);

// Refresh Token
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token required', 400);
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { /* User not needed */ },
    });

    if (!storedToken || storedToken.revoked_at) {
      throw new AppError('Invalid refresh token', 401);
    }

    if (storedToken.expires_at < new Date()) {
      throw new AppError('Refresh token expired', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: storedToken.user_id },
      include: { role: true },
    });

    if (!user || !user.is_active) {
      throw new AppError('User not found or inactive', 401);
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked_at: new Date() },
    });

    // Create new tokens
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        schoolId: user.school_id,
        roleId: user.role_id,
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
    );

    const newRefreshToken = uuidv4();
    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token: newRefreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({
      success: true,
      data: { token, refreshToken: newRefreshToken },
    });
  })
);

// Logout
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { refreshToken } = req.body;
    const authReq = req as AuthRequest;

    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: {
          token: refreshToken,
          user_id: authReq.user!.id,
        },
        data: { revoked_at: new Date() },
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  })
);

// Forgot Password
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await prisma.user.findFirst({ where: { email } });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If the email exists, a reset link will be sent',
      });
    }

    // In production, send email with reset link
    res.json({
      success: true,
      message: 'If the email exists, a reset link will be sent',
    });
  })
);

// Change Password
router.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { currentPassword, newPassword } = req.body;
    const authReq = req as AuthRequest;

    const user = await prisma.user.findUnique({
      where: { id: authReq.user!.id },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash: newHash },
    });

    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: { user_id: user.id },
      data: { revoked_at: new Date() },
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  })
);

// Get Current User
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const authReq = req as AuthRequest;

    const user = await prisma.user.findUnique({
      where: { id: authReq.user!.id },
      include: {
        role: true,
        school: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name_ar: user.name_ar,
        name_en: user.name_en,
        phone: user.phone,
        language_preference: user.language_preference,
        role: user.role,
        school: {
          id: user.school.id,
          name_ar: user.school.school_name_ar,
          name_en: user.school.school_name_en,
          vat_number: user.school.vat_number,
          cr_number: user.school.cr_number,
        },
      },
    });
  })
);

export default router;