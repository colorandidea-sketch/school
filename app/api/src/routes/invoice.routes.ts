import { Router } from 'express';
import Joi from 'joi';
import { PrismaClient, InvoiceStatus, DiscountType, PaymentMethod } from '@prisma/client';
import { asyncHandler, validateRequest, AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { calculateVAT, generateInvoiceNumber, generateZATCAUUID } from '../utils/helpers';
import * as QRCode from 'qrcode';

const router = Router();
const prisma = new PrismaClient();

const invoiceSchema = Joi.object({
  student_account_id: Joi.string().uuid().required(),
  invoice_date: Joi.date().required(),
  due_date: Joi.date().required(),
  academic_year_id: Joi.string().uuid().required(),
  term_id: Joi.string().uuid().nullable(),
  discount_type: Joi.string().valid(...Object.values(DiscountType)).nullable(),
  discount_amount: Joi.number().precision(2).min(0).default(0),
  discount_reason_ar: Joi.string().nullable(),
  discount_reason_en: Joi.string().nullable(),
  notes_ar: Joi.string().nullable(),
  notes_en: Joi.string().nullable(),
  lines: Joi.array().items(
    Joi.object({
      fee_structure_id: Joi.string().uuid().nullable(),
      description_ar: Joi.string().required(),
      description_en: Joi.string().required(),
      quantity: Joi.number().integer().min(1).default(1),
      unit_price: Joi.number().precision(2).required(),
      discount_amount: Joi.number().precision(2).min(0).default(0),
      vat_rate: Joi.number().precision(2).default(15),
      account_id: Joi.string().uuid().required(),
      cost_center_id: Joi.string().uuid().nullable(),
    })
  ).min(1).required(),
});

const bulkInvoiceSchema = Joi.object({
  academic_year_id: Joi.string().uuid().required(),
  term_id: Joi.string().uuid().nullable(),
  grade_level: Joi.string().required(),
  invoice_date: Joi.date().required(),
  due_date: Joi.date().required(),
  generate_all_students: Joi.boolean().default(false),
  student_ids: Joi.array().items(Joi.string().uuid()).when('generate_all_students', {
    is: false,
    then: Joi.required(),
  }),
});

// Get all invoices
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const {
      page = 1,
      pageSize = 50,
      search,
      status,
      from_date,
      to_date,
      academic_year_id,
      grade_level,
    } = req.query;

    const where: any = {
      school_id: req.user!.schoolId,
    };

    if (search) {
      where.OR = [
        { invoice_number: { contains: search as string, mode: 'insensitive' } },
        { student_account: { student_name_ar: { contains: search as string, mode: 'insensitive' } } },
        { student_account: { student_name_en: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (from_date || to_date) {
      where.invoice_date = {};
      if (from_date) where.invoice_date.gte = new Date(from_date as string);
      if (to_date) where.invoice_date.lte = new Date(to_date as string);
    }

    if (academic_year_id) {
      where.academic_year_id = academic_year_id;
    }

    if (grade_level) {
      where.student_account = { ...where.student_account, grade_level };
    }

    const [invoices, total] = await Promise.all([
      prisma.studentInvoice.findMany({
        where,
        include: {
          student_account: {
            select: {
              id: true,
              student_number: true,
              student_name_ar: true,
              student_name_en: true,
              grade_level: true,
              guardian_phone: true,
            },
          },
          academic_year: { select: { id: true, year_name_ar: true, year_name_en: true } },
          term: { select: { id: true, term_name_ar: true, term_name_en: true } },
        },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        orderBy: { invoice_date: 'desc' },
      }),
      prisma.studentInvoice.count({ where }),
    ]);

    res.json({
      success: true,
      data: invoices,
      meta: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    });
  })
);

// Get single invoice
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const invoice = await prisma.studentInvoice.findFirst({
      where: { id: req.params.id, school_id: req.user!.schoolId },
      include: {
        student_account: {
          include: {
            academic_year: true,
          },
        },
        academic_year: true,
        term: true,
        lines: {
          include: {
            fee_structure: true,
            account: {
              select: { id: true, account_code: true, account_name_ar: true, account_name_en: true },
            },
          },
          orderBy: { line_number: 'asc' },
        },
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    res.json({
      success: true,
      data: invoice,
    });
  })
);

// Create invoice
router.post(
  '/',
  authenticate,
  validateRequest(invoiceSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const data = req.body;
    const authReq = req as AuthRequest;

    const student = await prisma.studentAccount.findFirst({
      where: { id: data.student_account_id, school_id: authReq.user!.schoolId },
    });

    if (!student) {
      throw new AppError('Student not found', 400);
    }

    // Get school settings for invoice numbering
    const school = await prisma.school.findUnique({
      where: { id: authReq.user!.schoolId },
    });

    // Generate invoice number
    const year = new Date().getFullYear();
    const lastInvoice = await prisma.studentInvoice.findFirst({
      where: { school_id: authReq.user!.schoolId },
      orderBy: { created_at: 'desc' },
    });

    const sequence = lastInvoice
      ? parseInt(lastInvoice.invoice_number.split('-').pop() || '0') + 1
      : 1;
    const invoiceNumber = generateInvoiceNumber(year, sequence);

    // Calculate totals
    let subtotal = 0;
    const linesWithCalculations = data.lines.map((line: any, index: number) => {
      const lineSubtotal = line.unit_price * line.quantity;
      const lineDiscount = line.discount_amount || 0;
      const taxableAmount = lineSubtotal - lineDiscount;
      const vatAmount = Math.round(taxableAmount * line.vat_rate) / 100;
      const totalAmount = Math.round((taxableAmount + vatAmount) * 100) / 100;

      subtotal += taxableAmount;

      return {
        line_number: index + 1,
        fee_structure_id: line.fee_structure_id,
        description_ar: line.description_ar,
        description_en: line.description_en,
        quantity: line.quantity || 1,
        unit_price: line.unit_price,
        discount_amount: lineDiscount,
        taxable_amount: Math.round(taxableAmount * 100) / 100,
        vat_rate: line.vat_rate,
        vat_amount: Math.round(vatAmount * 100) / 100,
        total_amount: totalAmount,
        account_id: line.account_id,
        cost_center_id: line.cost_center_id,
      };
    });

    const discountAmount = data.discount_amount || 0;
    const taxableAmount = Math.round((subtotal - discountAmount) * 100) / 100;
    const vatAmount = Math.round(taxableAmount * 15) / 100;
    const totalAmount = Math.round((taxableAmount + vatAmount) * 100) / 100;

    // Generate ZATCA UUID and QR
    const zatcaUuid = generateZATCAUUID();
    const qrData = generateQRData(school!, invoiceNumber, totalAmount, vatAmount);
    const qrCode = await QRCode.toDataURL(qrData);

    // Create invoice
    const invoice = await prisma.studentInvoice.create({
      data: {
        invoice_number: invoiceNumber,
        student_account_id: data.student_account_id,
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        hijri_invoice_date: toHijriDate(new Date(data.invoice_date)),
        academic_year_id: data.academic_year_id,
        term_id: data.term_id,
        subtotal,
        discount_amount: discountAmount,
        discount_type: data.discount_type,
        discount_reason_ar: data.discount_reason_ar,
        discount_reason_en: data.discount_reason_en,
        taxable_amount: taxableAmount,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        balance_due: totalAmount,
        status: 'DRAFT',
        zatca_uuid: zatcaUuid,
        zatca_qr_code: qrCode,
        school_id: authReq.user!.schoolId,
        notes_ar: data.notes_ar,
        notes_en: data.notes_en,
        lines: {
          create: linesWithCalculations,
        },
      },
      include: {
        student_account: true,
        lines: { include: { account: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: invoice,
      message: 'Invoice created successfully',
    });
  })
);

// Issue invoice
router.post(
  '/:id/issue',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const authReq = req as AuthRequest;

    const invoice = await prisma.studentInvoice.findFirst({
      where: { id, school_id: authReq.user!.schoolId },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    if (invoice.status !== 'DRAFT') {
      throw new AppError('Only draft invoices can be issued', 400);
    }

    const updated = await prisma.studentInvoice.update({
      where: { id },
      data: {
        status: 'ISSUED',
        zatca_submission_status: 'PENDING',
      },
    });

    // Update student account totals
    await prisma.studentAccount.update({
      where: { id: invoice.student_account_id },
      data: {
        total_fees: { increment: Number(invoice.total_amount) },
        total_balance: { increment: Number(invoice.total_amount) },
      },
    });

    res.json({
      success: true,
      data: updated,
      message: 'Invoice issued successfully',
    });
  })
);

// Bulk create invoices
router.post(
  '/bulk',
  authenticate,
  validateRequest(bulkInvoiceSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const data = req.body;
    const authReq = req as AuthRequest;

    // Get students
    let whereClause: any = {
      school_id: authReq.user!.schoolId,
      academic_year_id: data.academic_year_id,
      grade_level: data.grade_level,
      status: 'ACTIVE',
      deleted_at: null,
    };

    if (!data.generate_all_students && data.student_ids) {
      whereClause.id = { in: data.student_ids };
    }

    const students = await prisma.studentAccount.findMany({
      where: whereClause,
    });

    if (students.length === 0) {
      throw new AppError('No students found matching criteria', 400);
    }

    // Get fee structures for this academic year and grade
    const feeStructures = await prisma.feeStructure.findMany({
      where: {
        school_id: authReq.user!.schoolId,
        academic_year_id: data.academic_year_id,
        grade_level: data.grade_level,
        is_active: true,
      },
    });

    if (feeStructures.length === 0) {
      throw new AppError('No fee structures found for this grade', 400);
    }

    // Get school and invoice sequence
    const school = await prisma.school.findUnique({
      where: { id: authReq.user!.schoolId },
    });

    const year = new Date().getFullYear();
    let sequence = 1;
    const lastInvoice = await prisma.studentInvoice.findFirst({
      where: { school_id: authReq.user!.schoolId },
      orderBy: { created_at: 'desc' },
    });
    if (lastInvoice) {
      sequence = parseInt(lastInvoice.invoice_number.split('-').pop() || '0') + 1;
    }

    const results = {
      created: 0,
      failed: 0,
      errors: [] as { student_id: string; error: string }[],
    };

    for (const student of students) {
      try {
        const invoiceNumber = generateInvoiceNumber(year, sequence++);

        // Build lines from fee structures
        let subtotal = 0;
        const lines = feeStructures.map((fee, index) => {
          const taxableAmount = Number(fee.amount);
          const vatAmount = fee.vat_applicable ? Math.round(taxableAmount * 15) / 100 : 0;
          const totalAmount = Math.round((taxableAmount + vatAmount) * 100) / 100;
          subtotal += taxableAmount;

          return {
            line_number: index + 1,
            fee_structure_id: fee.id,
            description_ar: fee.name_ar,
            description_en: fee.name_en,
            quantity: 1,
            unit_price: Number(fee.amount),
            discount_amount: 0,
            taxable_amount: Math.round(taxableAmount * 100) / 100,
            vat_rate: fee.vat_applicable ? 15 : 0,
            vat_amount: Math.round(vatAmount * 100) / 100,
            total_amount: totalAmount,
            account_id: fee.id, // Use fee structure as account
            cost_center_id: null,
          };
        });

        const taxableAmount = subtotal;
        const vatAmount = Math.round(taxableAmount * 15) / 100;
        const totalAmount = Math.round((taxableAmount + vatAmount) * 100) / 100;

        const invoice = await prisma.studentInvoice.create({
          data: {
            invoice_number: invoiceNumber,
            student_account_id: student.id,
            invoice_date: data.invoice_date,
            due_date: data.due_date,
            hijri_invoice_date: toHijriDate(new Date(data.invoice_date)),
            academic_year_id: data.academic_year_id,
            term_id: data.term_id,
            subtotal,
            taxable_amount: taxableAmount,
            vat_amount: vatAmount,
            total_amount: totalAmount,
            balance_due: totalAmount,
            status: 'DRAFT',
            school_id: authReq.user!.schoolId,
            lines: { create: lines },
          },
        });

        // Update student totals
        await prisma.studentAccount.update({
          where: { id: student.id },
          data: {
            total_fees: { increment: totalAmount },
            total_balance: { increment: totalAmount },
          },
        });

        results.created++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          student_id: student.id,
          error: (error as Error).message,
        });
      }
    }

    res.status(201).json({
      success: true,
      data: results,
      message: `Created: ${results.created}, Failed: ${results.failed}`,
    });
  })
);

// Cancel invoice
router.post(
  '/:id/cancel',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { reason_ar, reason_en } = req.body;
    const authReq = req as AuthRequest;

    const invoice = await prisma.studentInvoice.findFirst({
      where: { id, school_id: authReq.user!.schoolId },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    if (['CANCELLED', 'REFUNDED'].includes(invoice.status)) {
      throw new AppError('Invoice is already cancelled or refunded', 400);
    }

    if (Number(invoice.amount_paid) > 0) {
      throw new AppError('Cannot cancel invoice with payments. Use refund instead.', 400);
    }

    const updated = await prisma.studentInvoice.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes_ar: invoice.notes_ar + (reason_ar ? `\n[ملغي: ${reason_ar}]` : '\n[ملغي]'),
        notes_en: invoice.notes_en + (reason_en ? `\n[Cancelled: ${reason_en}]` : '\n[Cancelled]'),
      },
    });

    // Reverse student account totals
    await prisma.studentAccount.update({
      where: { id: invoice.student_account_id },
      data: {
        total_fees: { decrement: Number(invoice.total_amount) },
        total_balance: { decrement: Number(invoice.balance_due) },
      },
    });

    res.json({
      success: true,
      data: updated,
      message: 'Invoice cancelled successfully',
    });
  })
);

// Get invoice PDF (placeholder)
router.get(
  '/:id/pdf',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const invoice = await prisma.studentInvoice.findFirst({
      where: { id: req.params.id, school_id: req.user!.schoolId },
      include: {
        student_account: true,
        school: true,
        lines: { include: { account: true } },
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    // In production, generate PDF here
    res.json({
      success: true,
      message: 'PDF generation endpoint - integrate with PDF library',
      data: {
        invoice_number: invoice.invoice_number,
        qr_code_base64: invoice.zatca_qr_code,
      },
    });
  })
);

// Helper functions
function generateQRData(
  school: any,
  invoiceNumber: string,
  totalAmount: number,
  vatAmount: number
): string {
  const timestamp = new Date().toISOString();
  return `{
    "seller":"${school.school_name_en}",
    "vat_number":"${school.vat_number || ''}",
    "timestamp":"${timestamp}",
    "total":"${totalAmount.toFixed(2)}",
    "vat":"${vatAmount.toFixed(2)}"
  }`;
}

function toHijriDate(date: Date): string {
  const adjustment = -1;
  const year = date.getFullYear() - 622 + adjustment;
  const month = Math.floor((date.getMonth() + 1 - 1) * 12 / 29.5) + 1;
  const day = Math.floor((date.getDate() - 1) * 30 / 29.5) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default router;