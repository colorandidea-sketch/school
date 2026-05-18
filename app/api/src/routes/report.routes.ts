import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/trial-balance', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { fiscal_year_id, period_id } = req.query;
  const authReq = req as AuthRequest;

  let where: any = { school_id: authReq.user!.schoolId, is_postable: true, deleted_at: null };
  if (fiscal_year_id) {
    const entries = await prisma.journalEntry.findMany({
      where: { school_id: authReq.user!.schoolId, fiscal_year_id: fiscal_year_id as string, status: 'POSTED' },
      include: { lines: true },
    });

    const accountBalances: Record<string, { code: string; name_ar: string; name_en: string; normal: string; debit: number; credit: number; balance: number }> = {};

    for (const entry of entries) {
      for (const line of entry.lines) {
        const account = await prisma.chartOfAccount.findUnique({ where: { id: line.account_id } });
        if (!account || !account.is_postable) continue;

        if (!accountBalances[line.account_id]) {
          accountBalances[line.account_id] = {
            code: account.account_code,
            name_ar: account.account_name_ar,
            name_en: account.account_name_en,
            normal: account.normal_balance,
            debit: 0,
            credit: 0,
            balance: Number(account.opening_balance),
          };
        }

        accountBalances[line.account_id].debit += Number(line.debit_amount);
        accountBalances[line.account_id].credit += Number(line.credit_amount);

        if (account.normal_balance === 'DEBIT') {
          accountBalances[line.account_id].balance += Number(line.debit_amount) - Number(line.credit_amount);
        } else {
          accountBalances[line.account_id].balance += Number(line.credit_amount) - Number(line.debit_amount);
        }
      }
    }

    const accounts = Object.values(accountBalances).sort((a, b) => a.code.localeCompare(b.code));

    res.json({ success: true, data: { accounts, totals: { totalDebit: accounts.reduce((s, a) => s + a.debit, 0), totalCredit: accounts.reduce((s, a) => s + a.credit, 0) } } });
  } else {
    const accounts = await prisma.chartOfAccount.findMany({
      where,
      select: { id: true, account_code: true, account_name_ar: true, account_name_en: true, normal_balance: true, opening_balance: true, current_balance: true },
      orderBy: { account_code: 'asc' },
    });

    res.json({ success: true, data: accounts });
  }
}));

router.get('/balance-sheet', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { fiscal_year_id } = req.query;
  const authReq = req as AuthRequest;

  const schoolId = authReq.user!.schoolId;

  const getAccountSum = async (codePattern: string, normalBalance: string) => {
    const accounts = await prisma.chartOfAccount.findMany({
      where: { school_id: schoolId, account_code: { startsWith: codePattern }, is_postable: true },
    });

    let total = accounts.reduce((sum, acc) => sum + Number(acc.current_balance), 0);
    if (normalBalance === 'CREDIT') total = -total;
    return total;
  };

  const assets = await getAccountSum('1', 'DEBIT');
  const liabilities = await getAccountSum('2', 'CREDIT');
  const equity = await getAccountSum('3', 'CREDIT');
  const revenue = await getAccountSum('4', 'CREDIT');
  const expenses = await getAccountSum('5', 'DEBIT');

  const netIncome = revenue - expenses;

  res.json({
    success: true,
    data: {
      assets: { value: assets, accounts: [] },
      liabilities: { value: liabilities, accounts: [] },
      equity: { value: equity + netIncome, accounts: [] },
      net_income: netIncome,
    },
  });
}));

router.get('/income-statement', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { fiscal_year_id, from_date, to_date } = req.query;
  const authReq = req as AuthRequest;

  const where: any = { school_id: authReq.user!.schoolId, account_code: { startsWith: '4' }, is_postable: true };
  
  if (fiscal_year_id) {
    where.journal_entry = { fiscal_year_id: fiscal_year_id as string, status: 'POSTED' };
  }

  const revenue = await prisma.chartOfAccount.findMany({
    where: { school_id: authReq.user!.schoolId, account_code: { startsWith: '4' }, is_postable: true },
  });

  const expenses = await prisma.chartOfAccount.findMany({
    where: { school_id: authReq.user!.schoolId, account_code: { startsWith: '5' }, is_postable: true },
  });

  res.json({
    success: true,
    data: {
      revenue: revenue.map(a => ({ ...a, balance: Number(a.current_balance) })),
      expenses: expenses.map(a => ({ ...a, balance: Number(a.current_balance) })),
      totals: {
        total_revenue: revenue.reduce((s, a) => s + Number(a.current_balance), 0),
        total_expenses: expenses.reduce((s, a) => s + Number(a.current_balance), 0),
        net_income: revenue.reduce((s, a) => s + Number(a.current_balance), 0) - expenses.reduce((s, a) => s + Number(a.current_balance), 0),
      },
    },
  });
}));

router.get('/cash-flow', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { fiscal_year_id } = req.query;
  const authReq = req as AuthRequest;

  const cashAccounts = await prisma.chartOfAccount.findMany({
    where: { school_id: authReq.user!.schoolId, account_code: { in: ['1111', '1112'] }, is_postable: true },
  });

  const totalCash = cashAccounts.reduce((sum, acc) => sum + Number(acc.current_balance), 0);

  res.json({
    success: true,
    data: {
      beginning_cash: 0,
      operating_activities: 0,
      investing_activities: 0,
      financing_activities: 0,
      ending_cash: totalCash,
    },
  });
}));

router.get('/fee-collection', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { academic_year_id, grade_level, from_date, to_date } = req.query;
  const authReq = req as AuthRequest;

  const where: any = { school_id: authReq.user!.schoolId };
  if (academic_year_id) where.academic_year_id = academic_year_id;
  if (grade_level) where.student_account = { grade_level };

  const students = await prisma.studentAccount.findMany({
    where,
    select: {
      grade_level: true,
      total_fees: true,
      total_paid: true,
      total_balance: true,
    },
  });

  const byGrade = students.reduce((acc, s) => {
    if (!acc[s.grade_level]) {
      acc[s.grade_level] = { total_fees: 0, total_paid: 0, total_balance: 0, count: 0 };
    }
    acc[s.grade_level].total_fees += Number(s.total_fees);
    acc[s.grade_level].total_paid += Number(s.total_paid);
    acc[s.grade_level].total_balance += Number(s.total_balance);
    acc[s.grade_level].count++;
    return acc;
  }, {} as Record<string, any>);

  res.json({
    success: true,
    data: {
      by_grade: byGrade,
      totals: {
        total_fees: students.reduce((s, st) => s + Number(st.total_fees), 0),
        total_paid: students.reduce((s, st) => s + Number(st.total_paid), 0),
        total_balance: students.reduce((s, st) => s + Number(st.total_balance), 0),
        collection_rate: 0,
      },
    },
  });
}));

router.get('/aging-receivable', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { academic_year_id } = req.query;
  const authReq = req as AuthRequest;

  const invoices = await prisma.studentInvoice.findMany({
    where: {
      school_id: authReq.user!.schoolId,
      status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
      balance_due: { gt: 0 },
      ...(academic_year_id && { academic_year_id }),
    },
    include: { student_account: { select: { student_name_ar: true, student_name_en: true, grade_level: true } } },
    orderBy: { due_date: 'asc' },
  });

  const now = new Date();
  const aging = { current: 0, '30_days': 0, '60_days': 0, '90_days': 0, '120+_days': 0 };
  const agingDetails: any[] = [];

  for (const inv of invoices) {
    const daysPastDue = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
    const amount = Number(inv.balance_due);

    if (daysPastDue <= 0) aging.current += amount;
    else if (daysPastDue <= 30) aging['30_days'] += amount;
    else if (daysPastDue <= 60) aging['60_days'] += amount;
    else if (daysPastDue <= 90) aging['90_days'] += amount;
    else aging['120+_days'] += amount;

    agingDetails.push({ ...inv, days_past_due: daysPastDue });
  }

  res.json({ success: true, data: { aging, details: agingDetails } });
}));

router.get('/vat-return', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { from_date, to_date } = req.query;
  const authReq = req as AuthRequest;

  const where: any = { school_id: authReq.user!.schoolId };
  if (from_date && to_date) {
    where.invoice_date = { gte: new Date(from_date as string), lte: new Date(to_date as string) };
  }

  const invoices = await prisma.studentInvoice.findMany({
    where,
    select: { subtotal: true, vat_amount: true, total_amount: true },
  });

  const totalSales = invoices.reduce((s, i) => s + Number(i.subtotal), 0);
  const totalVAT = invoices.reduce((s, i) => s + Number(i.vat_amount), 0);

  res.json({
    success: true,
    data: {
      total_sales: totalSales,
      total_vat_collected: totalVAT,
      total_vat_payable: totalVAT, // Simplified - in production, calculate input VAT from purchases
    },
  });
}));

export default router;