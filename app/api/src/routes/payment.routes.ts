import { Router } from 'express';
import Joi from 'joi';
import { PrismaClient, PaymentMethod, PaymentStatus } from '@prisma/client';
import { asyncHandler, validateRequest, AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateReceiptNumber } from '../utils/helpers';

const router = Router();
const prisma = new PrismaClient();

const paymentSchema = Joi.object({
  student_account_id: Joi.string().uuid().required(),
  receipt_date: Joi.date().required(),
  total_amount: Joi.number().precision(2).required(),
  payment_method: Joi.string().valid(...Object.values(PaymentMethod)).required(),
  bank_account_id: Joi.string().uuid().nullable(),
  cheque_number: Joi.string().nullable(),
  cheque_date: Joi.date().nullable(),
  cheque_bank: Joi.string().nullable(),
  transaction_reference: Joi.string().nullable(),
  sadad_bill_number: Joi.string().nullable(),
  mada_reference: Joi.string().nullable(),
  allocated_invoices: Joi.array().items(
    Joi.object({
      invoice_id: Joi.string().uuid().required(),
      amount_allocated: Joi.number().precision(2).required(),
    })
  ).optional(),
  notes_ar: Joi.string().nullable(),
  notes_en: Joi.string().nullable(),
});

// Get all payments
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const {
      page = 1,
      pageSize = 50,
      search,
      status,
      payment_method,
      from_date,
      to_date,
    } = req.query;

    const where: any = {
      school_id: req.user!.schoolId,
      deleted_at: null,
    };

    if (search) {
      where.OR = [
        { receipt_number: { contains: search as string, mode: 'insensitive' } },
        { transaction_reference: { contains: search as string, mode: 'insensitive' } },
        { student_account: { student_name_ar: { contains: search as string, mode: 'insensitive' } } },
        { student_account: { student_name_en: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (payment_method) {
      where.payment_method = payment_method;
    }

    if (from_date || to_date) {
      where.receipt_date = {};
      if (from_date) where.receipt_date.gte = new Date(from_date as string);
      if (to_date) where.receipt_date.lte = new Date(to_date as string);
    }

    const [payments, total] = await Promise.all([
      prisma.paymentReceipt.findMany({
        where,
        include: {
          student_account: {
            select: {
              id: true,
              student_number: true,
              student_name_ar: true,
              student_name_en: true,
              grade_level: true,
            },
          },
          bank_account: {
            select: { id: true, account_name_ar: true, account_name_en: true, bank_name: true },
          },
          collected_by: {
            select: { id: true, name_ar: true, name_en: true },
          },
        },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        orderBy: { receipt_date: 'desc' },
      }),
      prisma.paymentReceipt.count({ where }),
    ]);

    res.json({
      success: true,
      data: payments,
      meta: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    });
  })
);

// Get single payment
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const payment = await prisma.paymentReceipt.findFirst({
      where: { id: req.params.id, school_id: req.user!.schoolId },
      include: {
        student_account: {
          include: { academic_year: true },
        },
        bank_account: true,
        collected_by: true,
      },
    });

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    res.json({
      success: true,
      data: payment,
    });
  })
);

// Create payment
router.post(
  '/',
  authenticate,
  validateRequest(paymentSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const data = req.body;
    const authReq = req as AuthRequest;

    const student = await prisma.studentAccount.findFirst({
      where: { id: data.student_account_id, school_id: authReq.user!.schoolId },
    });

    if (!student) {
      throw new AppError('Student not found', 400);
    }

    // Generate receipt number
    const year = new Date().getFullYear();
    const lastReceipt = await prisma.paymentReceipt.findFirst({
      where: { school_id: authReq.user!.schoolId },
      orderBy: { created_at: 'desc' },
    });

    const sequence = lastReceipt
      ? parseInt(lastReceipt.receipt_number.split('-').pop() || '0') + 1
      : 1;
    const receiptNumber = generateReceiptNumber(year, sequence);

    // Handle invoice allocation
    let allocations: any[] = [];
    let totalAllocated = 0;

    if (data.allocated_invoices && data.allocated_invoices.length > 0) {
      for (const allocation of data.allocated_invoices) {
        const invoice = await prisma.studentInvoice.findFirst({
          where: {
            id: allocation.invoice_id,
            student_account_id: data.student_account_id,
            school_id: authReq.user!.schoolId,
          },
        });

        if (!invoice) {
          throw new AppError(`Invoice ${allocation.invoice_id} not found`, 400);
        }

        if (Number(invoice.balance_due) < allocation.amount_allocated) {
          throw new AppError(
            `Payment amount exceeds invoice balance for invoice ${invoice.invoice_number}`,
            400
          );
        }

        allocations.push({
          invoice_id: allocation.invoice_id,
          amount_allocated: allocation.amount_allocated,
        });

        totalAllocated += allocation.amount_allocated;
      }
    }

    // Validate total allocation
    if (totalAllocated > data.total_amount) {
      throw new AppError('Allocated amount exceeds payment amount', 400);
    }

    // Create payment
    const payment = await prisma.paymentReceipt.create({
      data: {
        receipt_number: receiptNumber,
        student_account_id: data.student_account_id,
        receipt_date: data.receipt_date,
        hijri_receipt_date: toHijriDate(new Date(data.receipt_date)),
        total_amount: data.total_amount,
        payment_method: data.payment_method,
        bank_account_id: data.bank_account_id,
        cheque_number: data.cheque_number,
        cheque_date: data.cheque_date,
        cheque_bank: data.cheque_bank,
        transaction_reference: data.transaction_reference,
        sadad_bill_number: data.sadad_bill_number,
        mada_reference: data.mada_reference,
        allocated_invoices: allocations.length > 0 ? allocations : null,
        status: 'RECEIVED',
        collected_by_id: authReq.user!.id,
        notes_ar: data.notes_ar,
        notes_en: data.notes_en,
        school_id: authReq.user!.schoolId,
      },
      include: {
        student_account: true,
        bank_account: true,
      },
    });

    // Update allocated invoices
    for (const allocation of allocations) {
      const invoice = await prisma.studentInvoice.findFirst({
        where: { id: allocation.invoice_id },
      });

      if (invoice) {
        const newAmountPaid = Number(invoice.amount_paid) + allocation.amount_allocated;
        const newBalanceDue = Number(invoice.total_amount) - newAmountPaid;
        const newStatus = newBalanceDue <= 0 ? 'PAID' : newAmountPaid > 0 ? 'PARTIALLY_PAID' : 'ISSUED';

        await prisma.studentInvoice.update({
          where: { id: allocation.invoice_id },
          data: {
            amount_paid: newAmountPaid,
            balance_due: newBalanceDue,
            status: newStatus,
          },
        });
      }
    }

    // Update student account
    const updatedStudent = await prisma.studentAccount.update({
      where: { id: data.student_account_id },
      data: {
        total_paid: { increment: data.total_amount },
        total_balance: { decrement: data.total_amount },
      },
    });

    // Create journal entry for cash/bank receipt
    await createPaymentJournalEntry(
      payment,
      student,
      authReq.user!.schoolId,
      authReq.user!.id,
      data.bank_account_id
    );

    res.status(201).json({
      success: true,
      data: {
        payment,
        student_updated: {
          total_paid: updatedStudent.total_paid,
          total_balance: updatedStudent.total_balance,
        },
      },
      message: 'Payment recorded successfully',
    });
  })
);

// Void payment
router.post(
  '/:id/void',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { reason_ar, reason_en } = req.body;
    const authReq = req as AuthRequest;

    const payment = await prisma.paymentReceipt.findFirst({
      where: { id, school_id: authReq.user!.schoolId },
    });

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    if (payment.status === 'CANCELLED') {
      throw new AppError('Payment is already cancelled', 400);
    }

    if (payment.status === 'BOUNCED') {
      throw new AppError('Bounced payments cannot be voided', 400);
    }

    // Reverse invoice allocations
    if (payment.allocated_invoices) {
      for (const allocation of payment.allocated_invoices as any[]) {
        const invoice = await prisma.studentInvoice.findFirst({
          where: { id: allocation.invoice_id },
        });

        if (invoice) {
          const newAmountPaid = Number(invoice.amount_paid) - allocation.amount_allocated;
          const newBalanceDue = Number(invoice.total_amount) - newAmountPaid;
          const newStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

          await prisma.studentInvoice.update({
            where: { id: allocation.invoice_id },
            data: {
              amount_paid: Math.max(0, newAmountPaid),
              balance_due: Math.max(0, newBalanceDue),
              status: newStatus,
            },
          });
        }
      }
    }

    // Update payment status
    const updated = await prisma.paymentReceipt.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes_ar: (payment.notes_ar || '') + `\n[ملغي: ${reason_ar || 'نعم'}]`,
        notes_en: (payment.notes_en || '') + `\n[Voided: ${reason_en || 'Yes'}]`,
      },
    });

    // Reverse student account
    await prisma.studentAccount.update({
      where: { id: payment.student_account_id },
      data: {
        total_paid: { decrement: Number(payment.total_amount) },
        total_balance: { increment: Number(payment.total_amount) },
      },
    });

    res.json({
      success: true,
      data: updated,
      message: 'Payment voided successfully',
    });
  })
);

// Get payment receipt
router.get(
  '/:id/receipt',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const payment = await prisma.paymentReceipt.findFirst({
      where: { id: req.params.id, school_id: req.user!.schoolId },
      include: {
        student_account: {
          include: { academic_year: true },
        },
        school: true,
        bank_account: true,
        collected_by: true,
      },
    });

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    // Get allocated invoice details
    let invoiceDetails: any[] = [];
    if (payment.allocated_invoices) {
      for (const allocation of payment.allocated_invoices as any[]) {
        const invoice = await prisma.studentInvoice.findFirst({
          where: { id: allocation.invoice_id },
          select: {
            invoice_number: true,
            invoice_date: true,
            total_amount: true,
            balance_due: true,
          },
        });
        if (invoice) {
          invoiceDetails.push({
            ...invoice,
            amount_allocated: allocation.amount_allocated,
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        ...payment,
        invoice_details: invoiceDetails,
      },
    });
  })
);

// Helper function
async function createPaymentJournalEntry(
  payment: any,
  student: any,
  schoolId: string,
  userId: string,
  bankAccountId: string | null
) {
  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { school_id: schoolId, is_current: true },
  });

  if (!fiscalYear) return;

  const period = await prisma.fiscalPeriod.findFirst({
    where: { fiscal_year_id: fiscalYear.id, status: 'OPEN' },
  });

  if (!period) return;

  // Get cash/bank account
  let cashBankAccountId = null;
  if (bankAccountId) {
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
    });
    cashBankAccountId = bankAccount?.gl_account_id || null;
  }

  // If no bank account, use default cash account
  if (!cashBankAccountId) {
    const cashAccount = await prisma.chartOfAccount.findFirst({
      where: {
        school_id: schoolId,
        account_code: '1112', // Cash at Bank
      },
    });
    cashBankAccountId = cashAccount?.id;
  }

  // Get student fees receivable account
  const receivableAccount = await prisma.chartOfAccount.findFirst({
    where: {
      school_id: schoolId,
      account_code: '1121', // Student Fees Receivable
    },
  });

  if (!cashBankAccountId || !receivableAccount) return;

  // Create journal entry
  const lastEntry = await prisma.journalEntry.findFirst({
    where: { school_id: schoolId },
    orderBy: { created_at: 'desc' },
  });

  const sequence = lastEntry
    ? parseInt(lastEntry.entry_number.split('-').pop() || '0') + 1
    : 1;
  const entryNumber = `JE-${fiscalYear.year_name}-${String(sequence).padStart(6, '0')}`;

  await prisma.journalEntry.create({
    data: {
      entry_number: entryNumber,
      entry_date: payment.receipt_date,
      hijri_date: toHijriDate(new Date(payment.receipt_date)),
      entry_type: 'STANDARD',
      source_type: 'RECEIPT',
      source_id: payment.id,
      reference_number: payment.receipt_number,
      description_ar: `تحصيل من ${student.student_name_ar} - إيصال ${payment.receipt_number}`,
      description_en: `Receipt from ${student.student_name_en} - Receipt ${payment.receipt_number}`,
      total_debit: payment.total_amount,
      total_credit: payment.total_amount,
      status: 'POSTED',
      fiscal_year_id: fiscalYear.id,
      fiscal_period_id: period.id,
      school_id: schoolId,
      created_by_id: userId,
      posted_by_id: userId,
      posted_at: new Date(),
      lines: {
        create: [
          {
            line_number: 1,
            account_id: cashBankAccountId,
            debit_amount: payment.total_amount,
            credit_amount: 0,
            description_ar: `شبكة / نقدي - ${payment.receipt_number}`,
            description_en: `Bank/Cash - ${payment.receipt_number}`,
          },
          {
            line_number: 2,
            account_id: receivableAccount.id,
            debit_amount: 0,
            credit_amount: payment.total_amount,
            description_ar: `تحصيل رسوم ${student.student_name_ar}`,
            description_en: `Fee collection from ${student.student_name_en}`,
          },
        ],
      },
    },
  });

  // Update bank account balance if applicable
  if (bankAccountId) {
    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        current_balance: { increment: Number(payment.total_amount) },
      },
    });
  }
}

function toHijriDate(date: Date): string {
  const adjustment = -1;
  const year = date.getFullYear() - 622 + adjustment;
  const month = Math.floor((date.getMonth() + 1 - 1) * 12 / 29.5) + 1;
  const day = Math.floor((date.getDate() - 1) * 30 / 29.5) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default router;