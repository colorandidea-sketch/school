import { Router } from 'express';
import { PrismaClient, BudgetStatus, BudgetType } from '@prisma/client';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { fiscal_year_id, status } = req.query;
  
  const where: any = { school_id: req.user!.schoolId };
  if (fiscal_year_id) where.fiscal_year_id = fiscal_year_id;
  if (status) where.status = status;

  const budgets = await prisma.budget.findMany({
    where,
    include: {
      fiscal_year: { select: { year_name: true } },
      lines: { include: { account: { select: { account_code: true, account_name_ar: true } } } },
    },
    orderBy: { created_at: 'desc' },
  });

  res.json({ success: true, data: budgets });
}));

router.get('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const budget = await prisma.budget.findFirst({
    where: { id: req.params.id, school_id: req.user!.schoolId },
    include: {
      fiscal_year: true,
      lines: {
        include: {
          account: true,
          cost_center: true,
        },
      },
    },
  });
  if (!budget) throw new AppError('Budget not found', 404);
  res.json({ success: true, data: budget });
}));

router.get('/:id/variance', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const budget = await prisma.budget.findFirst({
    where: { id: req.params.id, school_id: req.user!.schoolId },
    include: {
      lines: { include: { account: true } },
    },
  });
  if (!budget) throw new AppError('Budget not found', 404);

  // Calculate actual amounts from posted journal entries
  for (const line of budget.lines) {
    const result = await prisma.journalEntryLine.aggregate({
      where: {
        account_id: line.account_id,
        journal_entry: {
          status: 'POSTED',
          fiscal_year_id: budget.fiscal_year_id,
        },
      },
      _sum: { debit_amount: true, credit_amount: true },
    });

    const actualAmount = line.account.account_type === 'EXPENSE'
      ? Number(result._sum.credit_amount) || 0
      : Number(result._sum.debit_amount) || 0;

    const variance = Number(line.annual_amount) - actualAmount;
    const variancePct = Number(line.annual_amount) !== 0 
      ? (variance / Number(line.annual_amount)) * 100 
      : 0;

    await prisma.budgetLine.update({
      where: { id: line.id },
      data: { actual_amount: actualAmount, variance, variance_pct: variancePct },
    });
  }

  const updated = await prisma.budget.findUnique({
    where: { id: req.params.id },
    include: { lines: { include: { account: true, cost_center: true } } },
  });

  res.json({ success: true, data: updated });
}));

router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { budget_name_ar, budget_name_en, fiscal_year_id, budget_type, lines } = req.body;
  const authReq = req as AuthRequest;

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: fiscal_year_id, school_id: authReq.user!.schoolId },
  });
  if (!fiscalYear) throw new AppError('Fiscal year not found', 404);

  const totalRevenue = lines.filter((l: any) => l.account_type === 'REVENUE').reduce((s: number, l: any) => s + l.annual_amount, 0);
  const totalExpense = lines.filter((l: any) => l.account_type === 'EXPENSE').reduce((s: number, l: any) => s + l.annual_amount, 0);

  const budget = await prisma.budget.create({
    data: {
      budget_name_ar,
      budget_name_en,
      fiscal_year_id,
      budget_type: budget_type || 'ANNUAL',
      status: 'DRAFT',
      total_revenue: totalRevenue,
      total_expense: totalExpense,
      school_id: authReq.user!.schoolId,
      lines: {
        create: lines.map((line: any) => ({
          account_id: line.account_id,
          cost_center_id: line.cost_center_id,
          annual_amount: line.annual_amount,
          monthly_amounts: line.monthly_amounts,
        })),
      },
    },
    include: { lines: true },
  });

  res.status(201).json({ success: true, data: budget, message: 'Budget created successfully' });
}));

router.post('/:id/approve', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const budget = await prisma.budget.findFirst({ where: { id: req.params.id, school_id: (req as AuthRequest).user!.schoolId } });
  if (!budget) throw new AppError('Budget not found', 404);
  if (budget.status !== 'DRAFT' && budget.status !== 'SUBMITTED') throw new AppError('Budget cannot be approved in current status', 400);

  const updated = await prisma.budget.update({
    where: { id: req.params.id },
    data: { status: 'APPROVED', approved_by_id: (req as AuthRequest).user!.id, approved_at: new Date() },
  });

  res.json({ success: true, data: updated, message: 'Budget approved successfully' });
}));

export default router;