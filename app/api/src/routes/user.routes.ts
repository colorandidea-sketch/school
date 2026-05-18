import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { page = 1, pageSize = 50, search, role_id, is_active } = req.query;
  
  const where: any = { school_id: req.user!.schoolId };
  if (search) {
    where.OR = [
      { username: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } },
      { name_ar: { contains: search as string, mode: 'insensitive' } },
      { name_en: { contains: search as string, mode: 'insensitive' } },
    ];
  }
  if (role_id) where.role_id = role_id;
  if (is_active !== undefined) where.is_active = is_active === 'true';

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, username: true, email: true, name_ar: true, name_en: true,
        phone: true, is_active: true, last_login: true, language_preference: true,
        role: { select: { id: true, role_name_ar: true, role_name_en: true } },
      },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      orderBy: { name_ar: 'asc' },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ success: true, data: users, meta: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) } });
}));

router.get('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const user = await prisma.user.findFirst({
    where: { id: req.params.id, school_id: req.user!.schoolId },
    select: {
      id: true, username: true, email: true, name_ar: true, name_en: true,
      phone: true, is_active: true, last_login: true, language_preference: true,
      two_factor_enabled: true, role: true,
    },
  });
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, data: user });
}));

router.put('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const authReq = req as AuthRequest;

  if (id !== authReq.user!.id && !authReq.user!.permissions.includes('*')) {
    throw new AppError('Cannot update other users', 403);
  }

  const { password_hash, ...updateData } = req.body;

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, username: true, email: true, name_ar: true, name_en: true, role: true },
  });

  res.json({ success: true, data: user, message: 'User updated successfully' });
}));

router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const authReq = req as AuthRequest;
  if (!authReq.user!.permissions.includes('*')) {
    throw new AppError('Only super admin can delete users', 403);
  }

  await prisma.user.update({
    where: { id: req.params.id },
    data: { is_active: false, deleted_at: new Date() },
  });

  res.json({ success: true, message: 'User deactivated successfully' });
}));

// Roles
router.get('/roles/list', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const roles = await prisma.role.findMany({
    orderBy: { role_name_ar: 'asc' },
  });
  res.json({ success: true, data: roles });
}));

// Audit Logs
router.get('/audit-logs', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { page = 1, pageSize = 50, user_id, action, entity_type, from_date, to_date } = req.query;
  
  const where: any = {};
  if (user_id) where.user_id = user_id;
  if (action) where.action = action;
  if (entity_type) where.entity_type = entity_type;
  if (from_date || to_date) {
    where.created_at = {};
    if (from_date) where.created_at.gte = new Date(from_date as string);
    if (to_date) where.created_at.lte = new Date(to_date as string);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name_ar: true, name_en: true } } },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      orderBy: { created_at: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ success: true, data: logs, meta: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) } });
}));

export default router;