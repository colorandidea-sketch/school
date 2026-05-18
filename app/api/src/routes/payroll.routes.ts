import { Router } from 'express';
import Joi from 'joi';
import { PrismaClient, EmploymentType, PayrollPaymentStatus } from '@prisma/client';
import { asyncHandler, validateRequest, AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { calculateGOSI, calculateEndOfService } from '../utils/helpers';

const router = Router();
const prisma = new PrismaClient();

const employeeSchema = Joi.object({
  employee_number: Joi.string().required(),
  name_ar: Joi.string().required(),
  name_en: Joi.string().required(),
  national_id: Joi.string().optional(),
  iqama_number: Joi.string().optional(),
  nationality: Joi.string().optional(),
  department_id: Joi.string().uuid().nullable(),
  position: Joi.string().optional(),
  employment_type: Joi.string().valid(...Object.values(EmploymentType)).default('FULL_TIME'),
  hire_date: Joi.date().required(),
  contract_end_date: Joi.date().nullable(),
  basic_salary: Joi.number().precision(2).required(),
  housing_allowance: Joi.number().precision(2).default(0),
  transportation_allowance: Joi.number().precision(2).default(0),
  other_allowances: Joi.object().optional(),
  gosi_registered: Joi.boolean().default(false),
  gosi_number: Joi.string().optional(),
  bank_name: Joi.string().optional(),
  iban: Joi.string().optional(),
  is_saudi: Joi.boolean().default(true),
});

// Get all employees
router.get('/employees', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { page = 1, pageSize = 50, search, department_id, is_active } = req.query;
  
  const where: any = { school_id: req.user!.schoolId, deleted_at: null };
  
  if (search) {
    where.OR = [
      { employee_number: { contains: search as string, mode: 'insensitive' } },
      { name_ar: { contains: search as string, mode: 'insensitive' } },
      { name_en: { contains: search as string, mode: 'insensitive' } },
    ];
  }
  if (department_id) where.department_id = department_id;
  if (is_active !== undefined) where.is_active = is_active === 'true';

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: { department: true },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      orderBy: { name_ar: 'asc' },
    }),
    prisma.employee.count({ where }),
  ]);

  res.json({ success: true, data: employees, meta: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) } });
}));

router.get('/employees/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const employee = await prisma.employee.findFirst({
    where: { id: req.params.id, school_id: req.user!.schoolId },
    include: { department: true, payroll_details: { orderBy: { created_at: 'desc' }, take: 12 } },
  });
  if (!employee) throw new AppError('Employee not found', 404);
  res.json({ success: true, data: employee });
}));

router.post('/employees', authenticate, validateRequest(employeeSchema), asyncHandler(async (req: AuthRequest, res) => {
  const existing = await prisma.employee.findFirst({ where: { employee_number: req.body.employee_number, school_id: req.user!.schoolId } });
  if (existing) throw new AppError('Employee number already exists', 400);
  
  const employee = await prisma.employee.create({
    data: { ...req.body, school_id: req.user!.schoolId },
    include: { department: true },
  });
  res.status(201).json({ success: true, data: employee, message: 'Employee created successfully' });
}));

router.put('/employees/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const employee = await prisma.employee.findFirst({ where: { id: req.params.id, school_id: req.user!.schoolId } });
  if (!employee) throw new AppError('Employee not found', 404);
  
  const updated = await prisma.employee.update({
    where: { id: req.params.id },
    data: req.body,
    include: { department: true },
  });
  res.json({ success: true, data: updated, message: 'Employee updated successfully' });
}));

// Payroll Runs
router.get('/runs', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { page = 1, pageSize = 20, status } = req.query;
  const where: any = { school_id: req.user!.schoolId };
  if (status) where.status = status;

  const [runs, total] = await Promise.all([
    prisma.payrollRun.findMany({
      where,
      orderBy: { run_date: 'desc' },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
    }),
    prisma.payrollRun.count({ where }),
  ]);

  res.json({ success: true, data: runs, meta: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) } });
}));

router.post('/calculate', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { payroll_period } = req.body;
  const authReq = req as AuthRequest;

  const existing = await prisma.payrollRun.findFirst({
    where: { payroll_period, school_id: authReq.user!.schoolId },
  });
  if (existing) throw new AppError('Payroll for this period already exists', 400);

  const employees = await prisma.employee.findMany({
    where: { school_id: authReq.user!.schoolId, is_active: true },
  });

  if (employees.length === 0) throw new AppError('No active employees found', 400);

  const details = [];
  let totalBasic = 0, totalAllowances = 0, totalDeductions = 0, totalGosiEmployee = 0, totalGosiEmployer = 0, totalNet = 0;

  for (const emp of employees) {
    const housingAllowance = Number(emp.housing_allowance) || Number(emp.basic_salary) * 0.25;
    const transportAllowance = Number(emp.transportation_allowance) || 1000;
    const otherAllowances = Number(emp.other_allowances) || 0;
    const totalEarnings = Number(emp.basic_salary) + housingAllowance + transportAllowance + otherAllowances;

    const gosi = calculateGOSI(Number(emp.basic_salary), housingAllowance, emp.is_saudi);

    const netSalary = totalEarnings - gosi.employeeShare;

    totalBasic += Number(emp.basic_salary);
    totalAllowances += housingAllowance + transportAllowance + otherAllowances;
    totalGosiEmployee += gosi.employeeShare;
    totalGosiEmployer += gosi.employerShare;
    totalNet += netSalary;

    details.push({
      employee_id: emp.id,
      basic_salary: Number(emp.basic_salary),
      housing_allowance: housingAllowance,
      transportation_allowance: transportAllowance,
      other_allowances: otherAllowances,
      total_earnings: totalEarnings,
      gosi_employee_share: gosi.employeeShare,
      gosi_employer_share: gosi.employerShare,
      total_deductions: gosi.employeeShare,
      net_salary: netSalary,
      payment_status: 'PENDING' as PayrollPaymentStatus,
    });
  }

  const run = await prisma.payrollRun.create({
    data: {
      payroll_period,
      run_date: new Date(),
      status: 'DRAFT',
      total_basic_salary: totalBasic,
      total_allowances: totalAllowances,
      total_deductions: totalGosiEmployee,
      total_gosi_employee: totalGosiEmployee,
      total_gosi_employer: totalGosiEmployer,
      total_net_salary: totalNet,
      employee_count: employees.length,
      school_id: authReq.user!.schoolId,
      details: { create: details },
    },
    include: { details: true },
  });

  res.status(201).json({ success: true, data: run, message: 'Payroll calculated successfully' });
}));

router.post('/runs/:id/approve', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const run = await prisma.payrollRun.findFirst({ where: { id: req.params.id, school_id: req.user!.schoolId } });
  if (!run) throw new AppError('Payroll run not found', 404);
  if (run.status !== 'DRAFT') throw new AppError('Only draft payroll can be approved', 400);

  const updated = await prisma.payrollRun.update({
    where: { id: req.params.id },
    data: { status: 'APPROVED', approved_by_id: (req as AuthRequest).user!.id, approved_at: new Date() },
  });
  res.json({ success: true, data: updated, message: 'Payroll approved successfully' });
}));

router.get('/runs/:id/payslips', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const run = await prisma.payrollRun.findFirst({
    where: { id: req.params.id, school_id: req.user!.schoolId },
    include: { details: { include: { employee: { include: { department: true } } } } },
  });
  if (!run) throw new AppError('Payroll run not found', 404);
  res.json({ success: true, data: run.details });
}));

export default router;