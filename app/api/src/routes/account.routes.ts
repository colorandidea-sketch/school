import { Router } from 'express';
import Joi from 'joi';
import { PrismaClient, AccountType, NormalBalance } from '@prisma/client';
import { asyncHandler, validateRequest, AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Validation schema
const accountSchema = Joi.object({
  account_code: Joi.string().required(),
  account_name_ar: Joi.string().required(),
  account_name_en: Joi.string().required(),
  account_type: Joi.string().valid(...Object.values(AccountType)).required(),
  account_category: Joi.string().optional(),
  parent_account_id: Joi.string().uuid().nullable(),
  level: Joi.number().integer().min(0).default(0),
  is_active: Joi.boolean().default(true),
  is_postable: Joi.boolean().default(true),
  normal_balance: Joi.string().valid(...Object.values(NormalBalance)).required(),
  opening_balance: Joi.number().precision(2).default(0),
  currency_code: Joi.string().length(3).default('SAR'),
  cost_center_id: Joi.string().uuid().nullable(),
  notes_ar: Joi.string().optional(),
  notes_en: Joi.string().optional(),
});

// Get all accounts (tree view)
router.get(
  '/tree',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const accounts = await prisma.chartOfAccount.findMany({
      where: {
        school_id: req.user!.schoolId,
        is_active: true,
        deleted_at: null,
      },
      include: {
        parent_account: {
          select: {
            id: true,
            account_code: true,
            account_name_ar: true,
            account_name_en: true,
          },
        },
        _count: {
          select: { child_accounts: true },
        },
      },
      orderBy: { account_code: 'asc' },
    });

    // Build tree structure
    const tree = buildAccountTree(accounts);

    res.json({
      success: true,
      data: tree,
    });
  })
);

// Get all accounts (flat list)
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const {
      page = 1,
      pageSize = 50,
      search,
      account_type,
      is_active,
      parent_id,
    } = req.query;

    const where: any = {
      school_id: req.user!.schoolId,
      deleted_at: null,
    };

    if (search) {
      where.OR = [
        { account_code: { contains: search as string, mode: 'insensitive' } },
        { account_name_ar: { contains: search as string, mode: 'insensitive' } },
        { account_name_en: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (account_type) {
      where.account_type = account_type;
    }

    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }

    if (parent_id) {
      where.parent_account_id = parent_id;
    }

    const [accounts, total] = await Promise.all([
      prisma.chartOfAccount.findMany({
        where,
        include: {
          parent_account: {
            select: {
              id: true,
              account_code: true,
              account_name_ar: true,
              account_name_en: true,
            },
          },
          cost_center: {
            select: {
              id: true,
              code: true,
              name_ar: true,
              name_en: true,
            },
          },
        },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        orderBy: { account_code: 'asc' },
      }),
      prisma.chartOfAccount.count({ where }),
    ]);

    res.json({
      success: true,
      data: accounts,
      meta: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    });
  })
);

// Get single account
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const account = await prisma.chartOfAccount.findFirst({
      where: {
        id: req.params.id,
        school_id: req.user!.schoolId,
      },
      include: {
        parent_account: true,
        child_accounts: {
          where: { is_active: true },
          select: {
            id: true,
            account_code: true,
            account_name_ar: true,
            account_name_en: true,
            current_balance: true,
          },
        },
        cost_center: true,
      },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    res.json({
      success: true,
      data: account,
    });
  })
);

// Create account
router.post(
  '/',
  authenticate,
  validateRequest(accountSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const data = req.body;

    // Check if code already exists
    const existing = await prisma.chartOfAccount.findUnique({
      where: { account_code: data.account_code },
    });

    if (existing) {
      throw new AppError('Account code already exists', 400);
    }

    // Validate parent account
    if (data.parent_account_id) {
      const parent = await prisma.chartOfAccount.findUnique({
        where: { id: data.parent_account_id },
      });

      if (!parent) {
        throw new AppError('Parent account not found', 400);
      }

      // If parent is not postable, child should not be postable
      if (!parent.is_postable) {
        data.is_postable = false;
      }
      data.level = parent.level + 1;
    }

    const account = await prisma.chartOfAccount.create({
      data: {
        ...data,
        school_id: req.user!.schoolId,
        current_balance: data.opening_balance || 0,
        created_by_id: req.user!.id,
      },
      include: {
        parent_account: {
          select: {
            id: true,
            account_code: true,
            account_name_ar: true,
            account_name_en: true,
          },
        },
      },
    });

    // If opening balance, create journal entry
    if (data.opening_balance && data.opening_balance !== 0) {
      const fiscalYear = await prisma.fiscalYear.findFirst({
        where: {
          school_id: req.user!.schoolId,
          is_current: true,
        },
      });

      if (fiscalYear) {
        const period = await prisma.fiscalPeriod.findFirst({
          where: {
            fiscal_year_id: fiscalYear.id,
            status: 'OPEN',
          },
        });

        if (period) {
          await createOpeningBalanceEntry(
            account,
            data.opening_balance,
            fiscalYear,
            period,
            req.user!.id,
            req.user!.schoolId
          );
        }
      }
    }

    res.status(201).json({
      success: true,
      data: account,
      message: 'Account created successfully',
    });
  })
);

// Update account
router.put(
  '/:id',
  authenticate,
  validateRequest(accountSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const data = req.body;

    const existing = await prisma.chartOfAccount.findFirst({
      where: { id, school_id: req.user!.schoolId },
    });

    if (!existing) {
      throw new AppError('Account not found', 404);
    }

    if (existing.is_system_account && existing.account_code !== data.account_code) {
      throw new AppError('Cannot change code of system account', 400);
    }

    const account = await prisma.chartOfAccount.update({
      where: { id },
      data: {
        ...data,
        updated_by_id: req.user!.id,
      },
    });

    res.json({
      success: true,
      data: account,
      message: 'Account updated successfully',
    });
  })
);

// Delete account (soft delete)
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;

    const account = await prisma.chartOfAccount.findFirst({
      where: { id, school_id: req.user!.schoolId },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    if (account.is_system_account) {
      throw new AppError('Cannot delete system account', 400);
    }

    // Check if has transactions
    const hasTransactions = await prisma.journalEntryLine.findFirst({
      where: { account_id: id },
    });

    if (hasTransactions) {
      // Soft delete by marking inactive
      await prisma.chartOfAccount.update({
        where: { id },
        data: {
          is_active: false,
          deleted_at: new Date(),
          updated_by_id: req.user!.id,
        },
      });
    } else {
      await prisma.chartOfAccount.delete({ where: { id } });
    }

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  })
);

// Get account transactions
router.get(
  '/:id/transactions',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    const { from_date, to_date, page = 1, pageSize = 50 } = req.query;

    const account = await prisma.chartOfAccount.findFirst({
      where: { id, school_id: req.user!.schoolId },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    const where: any = {
      account_id: id,
      journal_entry: {
        school_id: req.user!.schoolId,
        deleted_at: null,
      },
    };

    if (from_date) {
      where.journal_entry = {
        ...where.journal_entry,
        entry_date: { gte: new Date(from_date as string) },
      };
    }

    if (to_date) {
      where.journal_entry = {
        ...where.journal_entry,
        entry_date: { ...(where.journal_entry.entry_date || {}), lte: new Date(to_date as string) },
      };
    }

    const [transactions, total] = await Promise.all([
      prisma.journalEntryLine.findMany({
        where,
        include: {
          journal_entry: {
            select: {
              id: true,
              entry_number: true,
              entry_date: true,
              description_ar: true,
              description_en: true,
              status: true,
            },
          },
          cost_center: {
            select: {
              id: true,
              code: true,
              name_ar: true,
              name_en: true,
            },
          },
        },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        orderBy: { journal_entry: { entry_date: 'desc' } },
      }),
      prisma.journalEntryLine.count({ where }),
    ]);

    res.json({
      success: true,
      data: transactions,
      meta: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    });
  })
);

// Get account balance
router.get(
  '/:id/balance',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;

    const account = await prisma.chartOfAccount.findFirst({
      where: { id, school_id: req.user!.schoolId },
      include: {
        _count: {
          select: { child_accounts: { where: { is_active: true } } },
        },
      },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    // Calculate balance from transactions if needed
    const transactions = await prisma.journalEntryLine.aggregate({
      where: {
        account_id: id,
        journal_entry: {
          status: 'POSTED',
          school_id: req.user!.schoolId,
        },
      },
      _sum: {
        debit_amount: true,
        credit_amount: true,
      },
    });

    const totalDebit = Number(transactions._sum.debit_amount) || 0;
    const totalCredit = Number(transactions._sum.credit_amount) || 0;
    let currentBalance = Number(account.opening_balance) || 0;

    if (account.normal_balance === 'DEBIT') {
      currentBalance += totalDebit - totalCredit;
    } else {
      currentBalance += totalCredit - totalDebit;
    }

    res.json({
      success: true,
      data: {
        id: account.id,
        account_code: account.account_code,
        account_name_ar: account.account_name_ar,
        account_name_en: account.account_name_en,
        normal_balance: account.normal_balance,
        opening_balance: account.opening_balance,
        current_balance: currentBalance,
        total_debit: totalDebit,
        total_credit: totalCredit,
        has_children: account._count.child_accounts > 0,
      },
    });
  })
);

// Import accounts from CSV
router.post(
  '/import',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const { accounts } = req.body;

    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new AppError('Invalid import data', 400);
    }

    const results = {
      imported: 0,
      updated: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const acc of accounts) {
      try {
        const existing = await prisma.chartOfAccount.findUnique({
          where: { account_code: acc.account_code },
        });

        if (existing) {
          // Update
          await prisma.chartOfAccount.update({
            where: { id: existing.id },
            data: {
              account_name_ar: acc.account_name_ar,
              account_name_en: acc.account_name_en,
              account_type: acc.account_type,
              is_active: acc.is_active ?? true,
              updated_by_id: req.user!.id,
            },
          });
          results.updated++;
        } else {
          // Create
          await prisma.chartOfAccount.create({
            data: {
              account_code: acc.account_code,
              account_name_ar: acc.account_name_ar,
              account_name_en: acc.account_name_en,
              account_type: acc.account_type,
              account_category: acc.account_category,
              parent_account_id: acc.parent_account_id,
              level: acc.level || 0,
              is_active: acc.is_active ?? true,
              is_postable: acc.is_postable ?? true,
              normal_balance: acc.normal_balance || 'DEBIT',
              school_id: req.user!.schoolId,
              created_by_id: req.user!.id,
            },
          });
          results.imported++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Error processing account ${acc.account_code}: ${(error as Error).message}`);
      }
    }

    res.json({
      success: true,
      data: results,
      message: `Imported: ${results.imported}, Updated: ${results.updated}, Failed: ${results.failed}`,
    });
  })
);

// Helper function to build tree
function buildAccountTree(accounts: any[]): any[] {
  const map = new Map();
  const roots: any[] = [];

  accounts.forEach((account) => {
    map.set(account.id, { ...account, children: [] });
  });

  accounts.forEach((account) => {
    const node = map.get(account.id);
    if (account.parent_account_id && map.has(account.parent_account_id)) {
      map.get(account.parent_account_id).children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

// Helper function to create opening balance entry
async function createOpeningBalanceEntry(
  account: any,
  openingBalance: number,
  fiscalYear: any,
  period: any,
  userId: string,
  schoolId: string
) {
  // Get next sequence number
  const lastEntry = await prisma.journalEntry.findFirst({
    where: { school_id: schoolId },
    orderBy: { created_at: 'desc' },
  });

  const sequence = lastEntry ? parseInt(lastEntry.entry_number.split('-').pop() || '0') + 1 : 1;
  const entryNumber = `JE-${fiscalYear.year_name}-${String(sequence).padStart(6, '0')}`;

  // Determine debit/credit based on normal balance
  const debitAmount = account.normal_balance === 'DEBIT' ? openingBalance : 0;
  const creditAmount = account.normal_balance === 'CREDIT' ? openingBalance : 0;

  await prisma.journalEntry.create({
    data: {
      entry_number: entryNumber,
      entry_date: new Date(),
      hijri_date: toHijriDate(new Date()),
      entry_type: 'OPENING',
      source_type: 'MANUAL',
      description_ar: `قيد فتح حساب - ${account.account_name_ar}`,
      description_en: `Opening balance entry - ${account.account_name_en}`,
      total_debit: debitAmount,
      total_credit: creditAmount,
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
            account_id: account.id,
            debit_amount: debitAmount,
            credit_amount: 0,
            description_ar: `افتتاحي - ${account.account_name_ar}`,
          },
          {
            line_number: 2,
            account_id: account.id, // In production, use retained earnings account
            debit_amount: 0,
            credit_amount: creditAmount,
            description_ar: 'الرصيد الافتتاحي',
          },
        ],
      },
    },
  });
}

function toHijriDate(date: Date): string {
  const adjustment = -1;
  const year = date.getFullYear() - 622 + adjustment;
  const month = Math.floor((date.getMonth() + 1 - 1) * 12 / 29.5) + 1;
  const day = Math.floor((date.getDate() - 1) * 30 / 29.5) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default router;