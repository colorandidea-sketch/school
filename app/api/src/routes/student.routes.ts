import { Router } from 'express';
import Joi from 'joi';
import { PrismaClient, StudentStatus } from '@prisma/client';
import { asyncHandler, validateRequest, AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const studentSchema = Joi.object({
  student_number: Joi.string().required(),
  student_name_ar: Joi.string().required(),
  student_name_en: Joi.string().required(),
  guardian_name_ar: Joi.string().optional(),
  guardian_name_en: Joi.string().optional(),
  guardian_phone: Joi.string().optional(),
  guardian_email: Joi.string().email().optional(),
  national_id: Joi.string().optional(),
  iqama_number: Joi.string().optional(),
  grade_level: Joi.string().required(),
  section: Joi.string().optional(),
  academic_year_id: Joi.string().uuid().required(),
  enrollment_date: Joi.date().required(),
  status: Joi.string().valid(...Object.values(StudentStatus)).default('ACTIVE'),
});

// Get all students
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const {
      page = 1,
      pageSize = 50,
      search,
      grade_level,
      status,
      academic_year_id,
    } = req.query;

    const where: any = {
      school_id: req.user!.schoolId,
      deleted_at: null,
    };

    if (search) {
      where.OR = [
        { student_number: { contains: search as string, mode: 'insensitive' } },
        { student_name_ar: { contains: search as string, mode: 'insensitive' } },
        { student_name_en: { contains: search as string, mode: 'insensitive' } },
        { guardian_phone: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (grade_level) {
      where.grade_level = grade_level;
    }

    if (status) {
      where.status = status;
    }

    if (academic_year_id) {
      where.academic_year_id = academic_year_id;
    }

    const [students, total] = await Promise.all([
      prisma.studentAccount.findMany({
        where,
        include: {
          academic_year: { select: { id: true, year_name_ar: true, year_name_en: true } },
          _count: {
            select: {
              student_invoices: true,
              payment_receipts: true,
            },
          },
        },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        orderBy: { student_name_ar: 'asc' },
      }),
      prisma.studentAccount.count({ where }),
    ]);

    res.json({
      success: true,
      data: students,
      meta: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    });
  })
);

// Get single student
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const student = await prisma.studentAccount.findFirst({
      where: { id: req.params.id, school_id: req.user!.schoolId },
      include: {
        academic_year: true,
        student_invoices: {
          orderBy: { invoice_date: 'desc' },
          take: 10,
          include: {
            lines: true,
          },
        },
        payment_receipts: {
          orderBy: { receipt_date: 'desc' },
          take: 10,
        },
      },
    });

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    res.json({
      success: true,
      data: student,
    });
  })
);

// Create student
router.post(
  '/',
  authenticate,
  validateRequest(studentSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const data = req.body;

    const existing = await prisma.studentAccount.findFirst({
      where: { student_number: data.student_number, school_id: req.user!.schoolId },
    });

    if (existing) {
      throw new AppError('Student number already exists', 400);
    }

    const student = await prisma.studentAccount.create({
      data: {
        ...data,
        school_id: req.user!.schoolId,
      },
      include: {
        academic_year: true,
      },
    });

    res.status(201).json({
      success: true,
      data: student,
      message: 'Student created successfully',
    });
  })
);

// Update student
router.put(
  '/:id',
  authenticate,
  validateRequest(studentSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const data = req.body;

    const existing = await prisma.studentAccount.findFirst({
      where: { id, school_id: req.user!.schoolId },
    });

    if (!existing) {
      throw new AppError('Student not found', 404);
    }

    // Check for duplicate student number if changing
    if (data.student_number !== existing.student_number) {
      const duplicate = await prisma.studentAccount.findFirst({
        where: {
          student_number: data.student_number,
          school_id: req.user!.schoolId,
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new AppError('Student number already exists', 400);
      }
    }

    const student = await prisma.studentAccount.update({
      where: { id },
      data,
      include: {
        academic_year: true,
      },
    });

    res.json({
      success: true,
      data: student,
      message: 'Student updated successfully',
    });
  })
);

// Get student statement
router.get(
  '/:id/statement',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { from_date, to_date } = req.query;

    const student = await prisma.studentAccount.findFirst({
      where: { id, school_id: req.user!.schoolId },
      include: {
        academic_year: true,
      },
    });

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    const where: any = { student_account_id: id };

    if (from_date) {
      (where as any).invoice_date = { gte: new Date(from_date as string) };
    }

    if (to_date) {
      if ((where as any).invoice_date) {
        (where as any).invoice_date.lte = new Date(to_date as string);
      } else {
        (where as any).invoice_date = { lte: new Date(to_date as string) };
      }
    }

    const invoices = await prisma.studentInvoice.findMany({
      where,
      include: {
        lines: {
          include: {
            fee_structure: true,
          },
        },
      },
      orderBy: { invoice_date: 'asc' },
    });

    const payments = await prisma.paymentReceipt.findMany({
      where: {
        student_account_id: id,
        status: { in: ['RECEIVED', 'DEPOSITED'] },
        ...(from_date && { receipt_date: { gte: new Date(from_date as string) } }),
        ...(to_date && { receipt_date: { lte: new Date(to_date as string) } }),
      },
      orderBy: { receipt_date: 'asc' },
    });

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          student_number: student.student_number,
          student_name_ar: student.student_name_ar,
          student_name_en: student.student_name_en,
          grade_level: student.grade_level,
          academic_year: student.academic_year,
        },
        invoices,
        payments,
        summary: {
          total_fees: student.total_fees,
          total_discounts: student.total_discounts,
          total_paid: student.total_paid,
          balance_due: student.total_balance,
        },
      },
    });
  })
);

// Get student invoices
router.get(
  '/:id/invoices',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { status } = req.query;

    const student = await prisma.studentAccount.findFirst({
      where: { id, school_id: req.user!.schoolId },
    });

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    const where: any = { student_account_id: id };
    if (status) {
      where.status = status;
    }

    const invoices = await prisma.studentInvoice.findMany({
      where,
      include: {
        lines: true,
        academic_year: true,
        term: true,
      },
      orderBy: { invoice_date: 'desc' },
    });

    res.json({
      success: true,
      data: invoices,
    });
  })
);

// Get student payments
router.get(
  '/:id/payments',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { status } = req.query;

    const student = await prisma.studentAccount.findFirst({
      where: { id, school_id: req.user!.schoolId },
    });

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    const where: any = { student_account_id: id };
    if (status) {
      where.status = status;
    }

    const payments = await prisma.paymentReceipt.findMany({
      where,
      orderBy: { receipt_date: 'desc' },
    });

    res.json({
      success: true,
      data: payments,
    });
  })
);

// Bulk create students
router.post(
  '/bulk',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { students } = req.body;
    const authReq = req as AuthRequest;

    if (!Array.isArray(students) || students.length === 0) {
      throw new AppError('Invalid student data', 400);
    }

    const results = {
      imported: 0,
      failed: 0,
      errors: [] as { row: number; error: string }[],
    };

    for (let i = 0; i < students.length; i++) {
      try {
        const s = students[i];
        const existing = await prisma.studentAccount.findFirst({
          where: { student_number: s.student_number, school_id: authReq.user!.schoolId },
        });

        if (existing) {
          results.failed++;
          results.errors.push({ row: i + 1, error: 'Student number already exists' });
          continue;
        }

        await prisma.studentAccount.create({
          data: {
            ...s,
            school_id: authReq.user!.schoolId,
          },
        });
        results.imported++;
      } catch (error) {
        results.failed++;
        results.errors.push({ row: i + 1, error: (error as Error).message });
      }
    }

    res.json({
      success: true,
      data: results,
      message: `Imported: ${results.imported}, Failed: ${results.failed}`,
    });
  })
);

export default router;