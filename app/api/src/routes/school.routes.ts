import { Router } from 'express';
import { PrismaClient, SchoolType, Curriculum, SubscriptionStatus } from '@prisma/client';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  // For super admin - list all schools, otherwise just current school
  const authReq = req as AuthRequest;
  const isSuperAdmin = authReq.user!.permissions.includes('*');

  if (isSuperAdmin) {
    const schools = await prisma.school.findMany({
      where: { is_active: true },
      orderBy: { school_name_ar: 'asc' },
    });
    return res.json({ success: true, data: schools });
  }

  const school = await prisma.school.findUnique({
    where: { id: authReq.user!.schoolId },
  });
  res.json({ success: true, data: school });
}));

router.get('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const authReq = req as AuthRequest;
  const isSuperAdmin = authReq.user!.permissions.includes('*');
  
  if (!isSuperAdmin && req.params.id !== authReq.user!.schoolId) {
    throw new AppError('Access denied', 403);
  }

  const school = await prisma.school.findUnique({ where: { id: req.params.id } });
  if (!school) throw new AppError('School not found', 404);
  res.json({ success: true, data: school });
}));

router.put('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const authReq = req as AuthRequest;
  const isSuperAdmin = authReq.user!.permissions.includes('*');
  
  if (!isSuperAdmin && req.params.id !== authReq.user!.schoolId) {
    throw new AppError('Access denied', 403);
  }

  const school = await prisma.school.update({
    where: { id: req.params.id },
    data: req.body,
  });

  res.json({ success: true, data: school, message: 'School updated successfully' });
}));

// Fiscal Years
router.get('/:schoolId/fiscal-years', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const years = await prisma.fiscalYear.findMany({
    where: { school_id: req.params.schoolId },
    include: { periods: { orderBy: { period_number: 'asc' } } },
    orderBy: { start_date: 'desc' },
  });
  res.json({ success: true, data: years });
}));

router.post('/:schoolId/fiscal-years', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { year_name, start_date, end_date, is_current } = req.body;

  if (is_current) {
    await prisma.fiscalYear.updateMany({
      where: { school_id: req.params.schoolId },
      data: { is_current: false },
    });
  }

  const year = await prisma.fiscalYear.create({
    data: {
      year_name,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      is_current: is_current || false,
      status: 'OPEN',
      school_id: req.params.schoolId,
    },
  });

  // Create 12 monthly periods
  const start = new Date(start_date);
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const periods = months.map((name, i) => ({
    fiscal_year_id: year.id,
    period_number: i + 1,
    period_name_ar: name,
    period_name_en: monthNamesEn[i],
    start_date: new Date(start.getFullYear(), start.getMonth() + i, 1),
    end_date: new Date(start.getFullYear(), start.getMonth() + i + 1, 0),
    status: 'OPEN' as const,
  }));

  await prisma.fiscalPeriod.createMany({ data: periods });

  res.status(201).json({ success: true, data: year, message: 'Fiscal year created successfully' });
}));

// Academic Years
router.get('/:schoolId/academic-years', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const years = await prisma.academicYear.findMany({
    where: { school_id: req.params.schoolId },
    include: { terms: true },
    orderBy: { start_date: 'desc' },
  });
  res.json({ success: true, data: years });
}));

router.post('/:schoolId/academic-years', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { year_name_ar, year_name_en, start_date, end_date, terms } = req.body;

  if (req.body.is_current) {
    await prisma.academicYear.updateMany({
      where: { school_id: req.params.schoolId },
      data: { is_current: false },
    });
  }

  const year = await prisma.academicYear.create({
    data: {
      year_name_ar,
      year_name_en,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      is_current: req.body.is_current || false,
      school_id: req.params.schoolId,
      terms: terms ? { create: terms } : undefined,
    },
    include: { terms: true },
  });

  res.status(201).json({ success: true, data: year });
}));

export default router;