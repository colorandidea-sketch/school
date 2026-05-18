import { Router } from 'express';
import Joi from 'joi';
import { PrismaClient, JournalEntryStatus, JournalEntryType, SourceType } from '@prisma/client';
import { asyncHandler, validateRequest, AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Validation schema
const journalEntrySchema = Joi.object({
  entry_date: Joi.date().required(),
  entry_type: Joi.string().valid(...Object.values(JournalEntryType)).default('STANDARD'),
  source_type: Joi.string().valid(...Object.values(SourceType)).default('MANUAL'),
  source_id: Joi.string().uuid().nullable(),
  reference_number: Joi.string().optional(),
  description_ar: Joi.string().optional(),
  description_en: Joi.string().optional(),
  currency_code: Joi.string().length(3).default('SAR'),
  exchange_rate: Joi.number().precision(6).default(1),
  lines: Joi.array().items(
    Joi.object({
      account_id: Joi.string().uuid().required(),
      debit_amount: Joi.number().precision(2).min(0).default(0),
      credit_amount: Joi.number().precision(2).min(0).default(0),
      description_ar: Joi.string().optional(),
      description_en: Joi.string().optional(),
      cost_center_id: Joi.string().uuid().nullable(),
    })
  ).min(2).required(),
});

// Get all journal entries
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const {
      page = 1,
      pageSize = 50,
      search,
      status,
      entry_type,
      source_type,
      from_date,
      to_date,
    } = req.query;

    const where: any = {
      school_id: req.user!.schoolId,
      deleted_at: null,
    };

    if (search) {
      where.OR = [
        { entry_number: { contains: search as string, mode: 'insensitive' } },
        { description_ar: { contains: search as string, mode: 'insensitive' } },
        { description_en: { contains: search as string, mode: 'insensitive' } },
        { reference_number: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (entry_type) {
      where.entry_type = entry_type;
    }

    if (source_type) {
      where.source_type = source_type;
    }

    if (from_date || to_date) {
      where.entry_date = {};
      if (from_date) where.entry_date.gte = new Date(from_date as string);
      if (to_date) where.entry_date.lte = new Date(to_date as string);
    }

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: {
          fiscal_year: { select: { year_name: true } },
          fiscal_period: { select: { period_name_ar: true, period_name_en: true } },
          created_by: { select: { id: true, name_ar: true, name_en: true } },
          posted_by: { select: { id: true, name_ar: true, name_en: true } },
          _count: { select: { lines: true } },
        },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        orderBy: { entry_date: 'desc' },
      }),
      prisma.journalEntry.count({ where }),
    ]);

    res.json({
      success: true,
      data: entries,
      meta: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    });
  })
);

// Get single journal entry
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: req.params.id, school_id: req.user!.schoolId },
      include: {
        fiscal_year: true,
        fiscal_period: true,
        created_by: { select: { id: true, name_ar: true, name_en: true } },
        approved_by: { select: { id: true, name_ar: true, name_en: true } },
        posted_by: { select: { id: true, name_ar: true, name_en: true } },
        lines: {
          include: {
            account: {
              select: { id: true, account_code: true, account_name_ar: true, account_name_en: true },
            },
            cost_center: {
              select: { id: true, code: true, name_ar: true, name_en: true },
            },
          },
          orderBy: { line_number: 'asc' },
        },
      },
    });

    if (!entry) {
      throw new AppError('Journal entry not found', 404);
    }

    res.json({
      success: true,
      data: entry,
    });
  })
);

// Create journal entry
router.post(
  '/',
  authenticate,
  validateRequest(journalEntrySchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const data = req.body;
    const authReq = req as AuthRequest;

    // Get fiscal year and period
    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: { school_id: authReq.user!.schoolId, is_current: true },
    });

    if (!fiscalYear) {
      throw new AppError('No active fiscal year found', 400);
    }

    const entryDate = new Date(data.entry_date);
    const period = await prisma.fiscalPeriod.findFirst({
      where: {
        fiscal_year_id: fiscalYear.id,
        start_date: { lte: entryDate },
        end_date: { gte: entryDate },
        status: 'OPEN',
      },
    });

    if (!period) {
      throw new AppError('No open fiscal period found for this date', 400);
    }

    // Validate lines balance
    const totalDebit = data.lines.reduce((sum: number, line: any) => sum + (line.debit_amount || 0), 0);
    const totalCredit = data.lines.reduce((sum: number, line: any) => sum + (line.credit_amount || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new AppError('Journal entry must balance. Total debits must equal total credits.', 400);
    }

    // Get next sequence number
    const lastEntry = await prisma.journalEntry.findFirst({
      where: { school_id: authReq.user!.schoolId },
      orderBy: { created_at: 'desc' },
    });

    const sequence = lastEntry ? parseInt(lastEntry.entry_number.split('-').pop() || '0') + 1 : 1;
    const entryNumber = `JE-${fiscalYear.year_name}-${String(sequence).padStart(6, '0')}`;

    // Verify all accounts are postable
    const accountIds = data.lines.map((l: any) => l.account_id);
    const accounts = await prisma.chartOfAccount.findMany({
      where: { id: { in: accountIds }, school_id: authReq.user!.schoolId },
    });

    const nonPostable = accounts.filter(a => !a.is_postable);
    if (nonPostable.length > 0) {
      throw new AppError(`Accounts ${nonPostable.map(a => a.account_code).join(', ')} are not postable`, 400);
    }

    const entry = await prisma.journalEntry.create({
      data: {
        entry_number: entryNumber,
        entry_date: data.entry_date,
        hijri_date: toHijriDate(new Date(data.entry_date)),
        fiscal_year_id: fiscalYear.id,
        fiscal_period_id: period.id,
        entry_type: data.entry_type,
        source_type: data.source_type,
        source_id: data.source_id,
        reference_number: data.reference_number,
        description_ar: data.description_ar,
        description_en: data.description_en,
        total_debit: totalDebit,
        total_credit: totalCredit,
        currency_code: data.currency_code,
        exchange_rate: data.exchange_rate,
        status: 'DRAFT',
        school_id: authReq.user!.schoolId,
        created_by_id: authReq.user!.id,
        lines: {
          create: data.lines.map((line: any, index: number) => ({
            line_number: index + 1,
            account_id: line.account_id,
            debit_amount: line.debit_amount || 0,
            credit_amount: line.credit_amount || 0,
            description_ar: line.description_ar,
            description_en: line.description_en,
            cost_center_id: line.cost_center_id,
            base_currency_debit: (line.debit_amount || 0) * data.exchange_rate,
            base_currency_credit: (line.credit_amount || 0) * data.exchange_rate,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: {
              select: { id: true, account_code: true, account_name_ar: true, account_name_en: true },
            },
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: entry,
      message: 'Journal entry created successfully',
    });
  })
);

// Update journal entry (draft only)
router.put(
  '/:id',
  authenticate,
  validateRequest(journalEntrySchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const data = req.body;
    const authReq = req as AuthRequest;

    const existing = await prisma.journalEntry.findFirst({
      where: { id, school_id: authReq.user!.schoolId },
    });

    if (!existing) {
      throw new AppError('Journal entry not found', 404);
    }

    if (existing.status !== 'DRAFT') {
      throw new AppError('Only draft entries can be edited', 400);
    }

    // Validate lines balance
    const totalDebit = data.lines.reduce((sum: number, line: any) => sum + (line.debit_amount || 0), 0);
    const totalCredit = data.lines.reduce((sum: number, line: any) => sum + (line.credit_amount || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new AppError('Journal entry must balance', 400);
    }

    // Delete existing lines and recreate
    await prisma.journalEntryLine.deleteMany({ where: { journal_entry_id: id } });

    const entry = await prisma.journalEntry.update({
      where: { id },
      data: {
        entry_date: data.entry_date,
        entry_type: data.entry_type,
        source_type: data.source_type,
        source_id: data.source_id,
        reference_number: data.reference_number,
        description_ar: data.description_ar,
        description_en: data.description_en,
        total_debit: totalDebit,
        total_credit: totalCredit,
        updated_at: new Date(),
        lines: {
          create: data.lines.map((line: any, index: number) => ({
            line_number: index + 1,
            account_id: line.account_id,
            debit_amount: line.debit_amount || 0,
            credit_amount: line.credit_amount || 0,
            description_ar: line.description_ar,
            description_en: line.description_en,
            cost_center_id: line.cost_center_id,
            base_currency_debit: (line.debit_amount || 0) * data.exchange_rate,
            base_currency_credit: (line.credit_amount || 0) * data.exchange_rate,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: {
              select: { id: true, account_code: true, account_name_ar: true, account_name_en: true },
            },
          },
        },
      },
    });

    res.json({
      success: true,
      data: entry,
      message: 'Journal entry updated successfully',
    });
  })
);

// Approve journal entry
router.post(
  '/:id/approve',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const authReq = req as AuthRequest;

    const entry = await prisma.journalEntry.findFirst({
      where: { id, school_id: authReq.user!.schoolId },
    });

    if (!entry) {
      throw new AppError('Journal entry not found', 404);
    }

    if (entry.status !== 'DRAFT') {
      throw new AppError('Entry must be in draft status to approve', 400);
    }

    const updated = await prisma.journalEntry.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approved_by_id: authReq.user!.id,
        approved_at: new Date(),
      },
    });

    res.json({
      success: true,
      data: updated,
      message: 'Journal entry approved successfully',
    });
  })
);

// Post journal entry
router.post(
  '/:id/post',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const authReq = req as AuthRequest;

    const entry = await prisma.journalEntry.findFirst({
      where: { id, school_id: authReq.user!.schoolId },
    });

    if (!entry) {
      throw new AppError('Journal entry not found', 404);
    }

    if (!['DRAFT', 'APPROVED'].includes(entry.status)) {
      throw new AppError('Entry must be in draft or approved status to post', 400);
    }

    // Re-validate balance
    if (Math.abs(Number(entry.total_debit) - Number(entry.total_credit)) > 0.01) {
      throw new AppError('Entry does not balance', 400);
    }

    const updated = await prisma.journalEntry.update({
      where: { id },
      data: {
        status: 'POSTED',
        posted_by_id: authReq.user!.id,
        posted_at: new Date(),
      },
    });

    // Update account balances
    const lines = await prisma.journalEntryLine.findMany({
      where: { journal_entry_id: id },
    });

    for (const line of lines) {
      const account = await prisma.chartOfAccount.findUnique({
        where: { id: line.account_id },
      });

      if (account) {
        let newBalance = Number(account.current_balance);
        if (account.normal_balance === 'DEBIT') {
          newBalance += Number(line.debit_amount) - Number(line.credit_amount);
        } else {
          newBalance += Number(line.credit_amount) - Number(line.debit_amount);
        }

        await prisma.chartOfAccount.update({
          where: { id: line.account_id },
          data: { current_balance: newBalance },
        });
      }
    }

    res.json({
      success: true,
      data: updated,
      message: 'Journal entry posted successfully',
    });
  })
);

// Reverse journal entry
router.post(
  '/:id/reverse',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { reason_ar, reason_en } = req.body;
    const authReq = req as AuthRequest;

    const entry = await prisma.journalEntry.findFirst({
      where: { id, school_id: authReq.user!.schoolId },
    });

    if (!entry) {
      throw new AppError('Journal entry not found', 404);
    }

    if (entry.status !== 'POSTED') {
      throw new AppError('Only posted entries can be reversed', 400);
    }

    if (entry.reversed_by_id) {
      throw new AppError('Entry has already been reversed', 400);
    }

    // Create reversing entry
    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: { id: entry.fiscal_year_id },
    });

    const lastEntry = await prisma.journalEntry.findFirst({
      where: { school_id: authReq.user!.schoolId },
      orderBy: { created_at: 'desc' },
    });

    const sequence = lastEntry ? parseInt(lastEntry.entry_number.split('-').pop() || '0') + 1 : 1;
    const entryNumber = `JE-${fiscalYear?.year_name}-${String(sequence).padStart(6, '0')}`;

    const originalLines = await prisma.journalEntryLine.findMany({
      where: { journal_entry_id: id },
      orderBy: { line_number: 'asc' },
    });

    const reversedEntry = await prisma.journalEntry.create({
      data: {
        entry_number: entryNumber,
        entry_date: new Date(),
        hijri_date: toHijriDate(new Date()),
        entry_type: 'REVERSING',
        source_type: 'MANUAL',
        reference_number: `Reversal of ${entry.entry_number}`,
        description_ar: reason_ar || `عكس القيد ${entry.entry_number}`,
        description_en: reason_en || `Reversal of entry ${entry.entry_number}`,
        total_debit: entry.total_credit,
        total_credit: entry.total_debit,
        status: 'POSTED',
        fiscal_year_id: entry.fiscal_year_id,
        fiscal_period_id: entry.fiscal_period_id,
        school_id: authReq.user!.schoolId,
        created_by_id: authReq.user!.id,
        posted_by_id: authReq.user!.id,
        posted_at: new Date(),
        reversal_of_id: id,
        lines: {
          create: originalLines.map((line, index) => ({
            line_number: index + 1,
            account_id: line.account_id,
            debit_amount: line.credit_amount,
            credit_amount: line.debit_amount,
            description_ar: `عكس - ${line.description_ar || ''}`,
            description_en: `Reversal - ${line.description_en || ''}`,
            cost_center_id: line.cost_center_id,
          })),
        },
      },
    });

    // Update original entry
    await prisma.journalEntry.update({
      where: { id },
      data: {
        status: 'REVERSED',
        reversed_by_id: reversedEntry.id,
      },
    });

    // Update account balances
    for (const line of originalLines) {
      const account = await prisma.chartOfAccount.findUnique({
        where: { id: line.account_id },
      });

      if (account) {
        let newBalance = Number(account.current_balance);
        if (account.normal_balance === 'DEBIT') {
          newBalance += Number(line.credit_amount) - Number(line.debit_amount);
        } else {
          newBalance += Number(line.debit_amount) - Number(line.credit_amount);
        }

        await prisma.chartOfAccount.update({
          where: { id: line.account_id },
          data: { current_balance: newBalance },
        });
      }
    }

    res.status(201).json({
      success: true,
      data: reversedEntry,
      message: 'Journal entry reversed successfully',
    });
  })
);

// Void journal entry
router.post(
  '/:id/void',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { reason_ar, reason_en } = req.body;
    const authReq = req as AuthRequest;

    const entry = await prisma.journalEntry.findFirst({
      where: { id, school_id: authReq.user!.schoolId },
    });

    if (!entry) {
      throw new AppError('Journal entry not found', 404);
    }

    if (['VOID', 'REVERSED'].includes(entry.status)) {
      throw new AppError('Entry is already void or reversed', 400);
    }

    const updated = await prisma.journalEntry.update({
      where: { id },
      data: {
        status: 'VOID',
        description_ar: entry.description_ar + (reason_ar ? ` [ملغى: ${reason_ar}]` : ' [ملغى]'),
        description_en: entry.description_en + (reason_en ? ` [Void: ${reason_en}]` : ' [Void]'),
      },
    });

    // If was posted, reverse account balances
    if (entry.status === 'POSTED') {
      const lines = await prisma.journalEntryLine.findMany({
        where: { journal_entry_id: id },
      });

      for (const line of lines) {
        const account = await prisma.chartOfAccount.findUnique({
          where: { id: line.account_id },
        });

        if (account) {
          let newBalance = Number(account.current_balance);
          if (account.normal_balance === 'DEBIT') {
            newBalance -= Number(line.debit_amount) - Number(line.credit_amount);
          } else {
            newBalance -= Number(line.credit_amount) - Number(line.debit_amount);
          }

          await prisma.chartOfAccount.update({
            where: { id: line.account_id },
            data: { current_balance: newBalance },
          });
        }
      }
    }

    res.json({
      success: true,
      data: updated,
      message: 'Journal entry voided successfully',
    });
  })
);

function toHijriDate(date: Date): string {
  const adjustment = -1;
  const year = date.getFullYear() - 622 + adjustment;
  const month = Math.floor((date.getMonth() + 1 - 1) * 12 / 29.5) + 1;
  const day = Math.floor((date.getDate() - 1) * 30 / 29.5) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default router;