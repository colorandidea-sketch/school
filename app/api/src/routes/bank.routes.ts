import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/accounts', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const accounts = await prisma.bankAccount.findMany({
    where: { school_id: req.user!.schoolId, is_active: true },
    include: { gl_account: { select: { account_code: true, account_name_ar: true, account_name_en: true } } },
    orderBy: { is_default: 'desc' },
  });
  res.json({ success: true, data: accounts });
}));

router.get('/accounts/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const account = await prisma.bankAccount.findFirst({
    where: { id: req.params.id, school_id: req.user!.schoolId },
    include: { gl_account: true },
  });
  if (!account) throw new AppError('Bank account not found', 404);
  res.json({ success: true, data: account });
}));

router.get('/accounts/:id/transactions', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { from_date, to_date, page = 1, pageSize = 50 } = req.query;
  const where: any = { bank_account_id: req.params.id };
  if (from_date) where.transaction_date = { gte: new Date(from_date as string) };
  if (to_date) where.transaction_date = { ...where.transaction_date, lte: new Date(to_date as string) };

  const [transactions, total] = await Promise.all([
    prisma.bankTransaction.findMany({
      where,
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      orderBy: { transaction_date: 'desc' },
    }),
    prisma.bankTransaction.count({ where }),
  ]);

  res.json({ success: true, data: transactions, meta: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) } });
}));

router.post('/accounts/:id/import', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { transactions } = req.body;
  const authReq = req as AuthRequest;

  if (!Array.isArray(transactions)) throw new AppError('Invalid transaction data', 400);

  const results = { imported: 0, failed: 0, errors: [] as string[] };

  for (const tx of transactions) {
    try {
      const balance = await prisma.bankTransaction.aggregate({
        where: { bank_account_id: req.params.id },
        _sum: { debit_amount: true, credit_amount: true },
      });

      const currentBalance = Number(balance._sum.debit_amount || 0) - Number(balance._sum.credit_amount || 0);
      const runningBalance = currentBalance + (tx.debit_amount || 0) - (tx.credit_amount || 0);

      await prisma.bankTransaction.create({
        data: {
          bank_account_id: req.params.id,
          transaction_date: tx.transaction_date,
          value_date: tx.value_date,
          transaction_type: tx.transaction_type,
          reference_number: tx.reference_number,
          description: tx.description,
          debit_amount: tx.debit_amount || 0,
          credit_amount: tx.credit_amount || 0,
          running_balance: runningBalance,
          import_batch_id: tx.import_batch_id,
          school_id: authReq.user!.schoolId,
        },
      });
      results.imported++;
    } catch (error) {
      results.failed++;
      results.errors.push(`Error: ${(error as Error).message}`);
    }
  }

  res.json({ success: true, data: results });
}));

// Bank Reconciliation
router.get('/reconciliations', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const reconciliations = await prisma.bankReconciliation.findMany({
    where: { bank_account: { school_id: req.user!.schoolId } },
    include: { bank_account: { select: { account_name_ar: true, account_name_en: true, bank_name: true } } },
    orderBy: { reconciliation_date: 'desc' },
  });
  res.json({ success: true, data: reconciliations });
}));

router.post('/reconciliations', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { bank_account_id, reconciliation_date, statement_balance } = req.body;
  const authReq = req as AuthRequest;

  const bankAccount = await prisma.bankAccount.findFirst({ where: { id: bank_account_id, school_id: authReq.user!.schoolId } });
  if (!bankAccount) throw new AppError('Bank account not found', 404);

  const unreconciled = await prisma.bankTransaction.findMany({
    where: { bank_account_id, reconciliation_status: 'UNRECONCILED' },
    orderBy: { transaction_date: 'asc' },
  });

  let glBalance = Number(bankAccount.current_balance);
  const totalUnreconciled = unreconciled.reduce((sum, tx) => sum + (Number(tx.debit_amount) - Number(tx.credit_amount)), 0);

  const diff = statement_balance - (glBalance + totalUnreconciled);

  const reconciliation = await prisma.bankReconciliation.create({
    data: {
      bank_account_id,
      reconciliation_date,
      statement_balance,
      gl_balance: glBalance,
      adjusted_statement_balance: statement_balance,
      adjusted_gl_balance: glBalance + totalUnreconciled,
      difference: diff,
      status: 'IN_PROGRESS',
      reconciled_by_id: authReq.user!.id,
    },
  });

  res.status(201).json({ success: true, data: reconciliation });
}));

export default router;