import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create School
  const school = await prisma.school.upsert({
    where: { school_code: 'SCH001' },
    update: {},
    create: {
      school_code: 'SCH001',
      school_name_ar: 'مدرسة النور الخاصة',
      school_name_en: 'Al Noor Private School',
      cr_number: '1010123456',
      vat_number: '300000000000003',
      license_number: 'MOE-2024-001',
      address: 'شارع الأمير محمد بن عبد العزيز',
      city: 'الرياض',
      region: 'منطقة الرياض',
      phone: '+966 11 234 5678',
      email: 'info@alnoorschool.edu.sa',
      school_type: 'PRIVATE',
      curriculum: 'SAUDI',
      academic_levels: ['KG', 'Elementary', 'Middle', 'High'],
      subscription_status: 'ACTIVE',
      is_active: true,
    },
  });

  console.log('Created school:', school.school_name_ar);

  // Create Roles
  const superAdminRole = await prisma.role.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      role_name_ar: 'مدير النظام',
      role_name_en: 'Super Admin',
      permissions: ['*'],
      is_system: true,
    },
  });

  const accountantRole = await prisma.role.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      role_name_ar: 'محاسب',
      role_name_en: 'Accountant',
      permissions: [
        'accounts:read', 'accounts:write', 'accounts:post',
        'journal:read', 'journal:write', 'journal:approve', 'journal:post',
        'invoices:read', 'invoices:write', 'invoices:issue',
        'payments:read', 'payments:write',
        'reports:read', 'reports:generate',
      ],
      is_system: true,
    },
  });

  const financeManagerRole = await prisma.role.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      role_name_ar: 'مدير المالية',
      role_name_en: 'Finance Manager',
      permissions: [
        'accounts:*', 'journal:*', 'invoices:*', 'payments:*',
        'payroll:*', 'banking:*', 'assets:*', 'budget:*', 'reports:*',
      ],
      is_system: true,
    },
  });

  console.log('Created roles');

  // Create Users
  const passwordHash = await bcrypt.hash('Admin@123', 12);

  await prisma.user.upsert({
    where: { email: 'admin@edufinance.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@edufinance.com',
      password_hash: passwordHash,
      name_ar: 'أحمد محمد',
      name_en: 'Ahmed Mohammed',
      phone: '+966501234567',
      role_id: superAdminRole.id,
      school_id: school.id,
      language_preference: 'AR',
      is_active: true,
    },
  });

  console.log('Created users');

  // Create Fiscal Year
  const fiscalYear = await prisma.fiscalYear.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      year_name: '2024',
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-12-31'),
      status: 'OPEN',
      is_current: true,
      school_id: school.id,
    },
  });

  // Create Fiscal Periods (12 months)
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  for (let i = 0; i < 12; i++) {
    const startDate = new Date(2024, i, 1);
    const endDate = new Date(2024, i + 1, 0);

    await prisma.fiscalPeriod.upsert({
      where: { id: `00000000-0000-0000-0000-00000000001${i}` },
      update: {},
      create: {
        id: `00000000-0000-0000-0000-00000000001${i}`,
        fiscal_year_id: fiscalYear.id,
        period_number: i + 1,
        period_name_ar: months[i],
        period_name_en: monthNamesEn[i],
        start_date: startDate,
        end_date: endDate,
        status: 'OPEN',
        is_adjustment_period: false,
      },
    });
  }

  console.log('Created fiscal year and periods');

  // Create Academic Year
  const academicYear = await prisma.academicYear.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      year_name_ar: '2024 - 2025',
      year_name_en: '2024 - 2025',
      start_date: new Date('2024-08-01'),
      end_date: new Date('2025-06-30'),
      is_current: true,
      school_id: school.id,
    },
  });

  // Create Terms
  const terms = [
    { name_ar: 'الاول', name_en: 'First', start: new Date('2024-08-01'), end: new Date('2024-12-31') },
    { name_ar: 'الثاني', name_en: 'Second', start: new Date('2025-01-01'), end: new Date('2025-03-31') },
    { name_ar: 'الثالث', name_en: 'Third', start: new Date('2025-04-01'), end: new Date('2025-06-30') },
  ];

  for (let i = 0; i < terms.length; i++) {
    await prisma.academicTerm.upsert({
      where: { id: `00000000-0000-0000-0000-00000000002${i}` },
      update: {},
      create: {
        id: `00000000-0000-0000-0000-00000000002${i}`,
        academic_year_id: academicYear.id,
        term_name_ar: terms[i].name_ar,
        term_name_en: terms[i].name_en,
        start_date: terms[i].start,
        end_date: terms[i].end,
        is_current: i === 0,
      },
    });
  }

  console.log('Created academic year and terms');

  // Create Chart of Accounts
  const chartOfAccounts = [
    // Assets
    { code: '1000', name_ar: 'الأصول', name_en: 'Assets', type: 'ASSET', category: null, normal: 'DEBIT', postable: false, level: 0 },
    { code: '1100', name_ar: 'الأصول المتداولة', name_en: 'Current Assets', type: 'ASSET', category: 'CURRENT_ASSET', normal: 'DEBIT', postable: false, level: 1 },
    { code: '1110', name_ar: 'النقد وما يعادله', name_en: 'Cash and Cash Equivalents', type: 'ASSET', category: 'CURRENT_ASSET', normal: 'DEBIT', postable: false, level: 2 },
    { code: '1111', name_ar: 'الصندوق النثري', name_en: 'Petty Cash', type: 'ASSET', category: 'CURRENT_ASSET', normal: 'DEBIT', postable: true, level: 3 },
    { code: '1112', name_ar: 'النقد في البنك', name_en: 'Cash at Bank', type: 'ASSET', category: 'CURRENT_ASSET', normal: 'DEBIT', postable: true, level: 3 },
    { code: '1120', name_ar: 'الذمم المدينة', name_en: 'Accounts Receivable', type: 'ASSET', category: 'CURRENT_ASSET', normal: 'DEBIT', postable: false, level: 2 },
    { code: '1121', name_ar: 'رسوم الطلاب المستحقة', name_en: 'Student Fees Receivable', type: 'ASSET', category: 'CURRENT_ASSET', normal: 'DEBIT', postable: true, level: 3 },
    { code: '1125', name_ar: 'مخصص الديون المشكوك فيها', name_en: 'Allowance for Doubtful Accounts', type: 'CONTRA', category: 'CURRENT_ASSET', normal: 'CREDIT', postable: true, level: 3 },
    { code: '1140', name_ar: 'ضريبة القيمة المضافة - مدخلات', name_en: 'VAT Input', type: 'ASSET', category: 'CURRENT_ASSET', normal: 'DEBIT', postable: true, level: 3 },
    { code: '1200', name_ar: 'الأصول غير المتداولة', name_en: 'Non-Current Assets', type: 'ASSET', category: 'FIXED_ASSET', normal: 'DEBIT', postable: false, level: 1 },
    { code: '1210', name_ar: 'العقارات والمباني', name_en: 'Property and Buildings', type: 'ASSET', category: 'FIXED_ASSET', normal: 'DEBIT', postable: true, level: 2 },
    { code: '1250', name_ar: 'مجمع الإهلاك', name_en: 'Accumulated Depreciation', type: 'CONTRA', category: 'FIXED_ASSET', normal: 'CREDIT', postable: true, level: 2 },

    // Liabilities
    { code: '2000', name_ar: 'الالتزامات', name_en: 'Liabilities', type: 'LIABILITY', category: null, normal: 'CREDIT', postable: false, level: 0 },
    { code: '2100', name_ar: 'الالتزامات المتداولة', name_en: 'Current Liabilities', type: 'LIABILITY', category: 'CURRENT_LIABILITY', normal: 'CREDIT', postable: false, level: 1 },
    { code: '2110', name_ar: 'الدائنون', name_en: 'Accounts Payable', type: 'LIABILITY', category: 'CURRENT_LIABILITY', normal: 'CREDIT', postable: true, level: 2 },
    { code: '2130', name_ar: 'ضريبة القيمة المضافة - مخرجات', name_en: 'VAT Output', type: 'LIABILITY', category: 'CURRENT_LIABILITY', normal: 'CREDIT', postable: true, level: 2 },
    { code: '2140', name_ar: 'ضريبة القيمة المضافة المستحقة', name_en: 'VAT Payable', type: 'LIABILITY', category: 'CURRENT_LIABILITY', normal: 'CREDIT', postable: true, level: 2 },
    { code: '2150', name_ar: 'الرواتب المستحقة', name_en: 'Salaries Payable', type: 'LIABILITY', category: 'CURRENT_LIABILITY', normal: 'CREDIT', postable: true, level: 2 },
    { code: '2160', name_ar: 'التأمينات الاجتماعية المستحقة', name_en: 'GOSI Payable', type: 'LIABILITY', category: 'CURRENT_LIABILITY', normal: 'CREDIT', postable: true, level: 2 },
    { code: '2170', name_ar: 'رسوم محصلة مقدماً', name_en: 'Advance Fee Collections', type: 'LIABILITY', category: 'CURRENT_LIABILITY', normal: 'CREDIT', postable: true, level: 2 },

    // Equity
    { code: '3000', name_ar: 'حقوق الملكية', name_en: 'Equity', type: 'EQUITY', category: null, normal: 'CREDIT', postable: false, level: 0 },
    { code: '3100', name_ar: 'رأس المال', name_en: 'Capital', type: 'EQUITY', category: 'EQUITY', normal: 'CREDIT', postable: true, level: 1 },
    { code: '3200', name_ar: 'الأرباح المبقاة', name_en: 'Retained Earnings', type: 'EQUITY', category: 'EQUITY', normal: 'CREDIT', postable: true, level: 1 },

    // Revenue
    { code: '4000', name_ar: 'الإيرادات', name_en: 'Revenue', type: 'REVENUE', category: null, normal: 'CREDIT', postable: false, level: 0 },
    { code: '4100', name_ar: 'الرسوم الدراسية', name_en: 'Tuition Fees', type: 'REVENUE', category: 'OPERATING_REVENUE', normal: 'CREDIT', postable: false, level: 1 },
    { code: '4110', name_ar: 'رسوم الروضة', name_en: 'KG Tuition', type: 'REVENUE', category: 'OPERATING_REVENUE', normal: 'CREDIT', postable: true, level: 2 },
    { code: '4120', name_ar: 'رسوم المرحلة الابتدائية', name_en: 'Elementary Tuition', type: 'REVENUE', category: 'OPERATING_REVENUE', normal: 'CREDIT', postable: true, level: 2 },
    { code: '4200', name_ar: 'رسوم التسجيل', name_en: 'Registration Fees', type: 'REVENUE', category: 'OPERATING_REVENUE', normal: 'CREDIT', postable: true, level: 2 },
    { code: '4300', name_ar: 'رسوم النقل', name_en: 'Transportation Fees', type: 'REVENUE', category: 'OPERATING_REVENUE', normal: 'CREDIT', postable: true, level: 2 },
    { code: '4800', name_ar: 'الخصم المسموح به', name_en: 'Discount Allowed', type: 'REVENUE', category: 'OPERATING_REVENUE', normal: 'DEBIT', postable: true, level: 2 },

    // Expenses
    { code: '5000', name_ar: 'المصروفات', name_en: 'Expenses', type: 'EXPENSE', category: null, normal: 'DEBIT', postable: false, level: 0 },
    { code: '5100', name_ar: 'الرواتب والأجور', name_en: 'Salaries and Wages', type: 'EXPENSE', category: 'OPERATING_EXPENSE', normal: 'DEBIT', postable: false, level: 1 },
    { code: '5110', name_ar: 'رواتب الهيئة التعليمية', name_en: 'Teaching Staff Salaries', type: 'EXPENSE', category: 'OPERATING_EXPENSE', normal: 'DEBIT', postable: true, level: 2 },
    { code: '5120', name_ar: 'رواتب الموظفين الإداريين', name_en: 'Administrative Staff Salaries', type: 'EXPENSE', category: 'OPERATING_EXPENSE', normal: 'DEBIT', postable: true, level: 2 },
    { code: '5200', name_ar: 'حصة صاحب العمل في التأمينات', name_en: 'GOSI Employer Contribution', type: 'EXPENSE', category: 'OPERATING_EXPENSE', normal: 'DEBIT', postable: true, level: 2 },
    { code: '5400', name_ar: 'إيجار', name_en: 'Rent Expense', type: 'EXPENSE', category: 'OPERATING_EXPENSE', normal: 'DEBIT', postable: true, level: 2 },
    { code: '5500', name_ar: 'المرافق', name_en: 'Utilities', type: 'EXPENSE', category: 'OPERATING_EXPENSE', normal: 'DEBIT', postable: true, level: 2 },
    { code: '5600', name_ar: 'الصيانة والإصلاحات', name_en: 'Maintenance and Repairs', type: 'EXPENSE', category: 'OPERATING_EXPENSE', normal: 'DEBIT', postable: true, level: 2 },
    { code: '5700', name_ar: 'المستلزمات التعليمية', name_en: 'Educational Supplies', type: 'EXPENSE', category: 'OPERATING_EXPENSE', normal: 'DEBIT', postable: true, level: 2 },
    { code: '5800', name_ar: 'مصروف الإهلاك', name_en: 'Depreciation Expense', type: 'EXPENSE', category: 'OPERATING_EXPENSE', normal: 'DEBIT', postable: true, level: 2 },
    { code: '5950', name_ar: 'رسوم بنكية', name_en: 'Bank Charges', type: 'EXPENSE', category: 'NON_OPERATING_EXPENSE', normal: 'DEBIT', postable: true, level: 2 },
  ];

  for (const acc of chartOfAccounts) {
    // Find parent
    let parentId = null;
    if (acc.code.length > 4) {
      const parentCode = acc.code.slice(0, -1) + '0'.repeat(acc.code.length - 4);
      const parent = chartOfAccounts.find(a => a.code === parentCode);
      if (parent) {
        const parentRecord = await prisma.chartOfAccount.findFirst({
          where: { account_code: parentCode, school_id: school.id }
        });
        parentId = parentRecord?.id;
      }
    }

    await prisma.chartOfAccount.upsert({
      where: { account_code: acc.code },
      update: {},
      create: {
        account_code: acc.code,
        account_name_ar: acc.name_ar,
        account_name_en: acc.name_en,
        account_type: acc.type as any,
        account_category: acc.category as any,
        parent_account_id: parentId,
        level: acc.level,
        is_postable: acc.postable,
        normal_balance: acc.normal as any,
        school_id: school.id,
        is_active: true,
        is_system_account: acc.level <= 1,
      },
    });
  }

  console.log('Created chart of accounts');

  // Create some sample students
  const students = [
    { number: 'STU001', name_ar: 'أحمد محمد', name_en: 'Ahmed Mohammed', grade: 'الصف الثالث', guardian_phone: '+966501234567' },
    { number: 'STU002', name_ar: 'سارة أحمد', name_en: 'Sarah Ahmed', grade: 'الصف الأول', guardian_phone: '+966502345678' },
    { number: 'STU003', name_ar: 'محمد علي', name_en: 'Mohamed Ali', grade: 'الصف الخامس', guardian_phone: '+966503456789' },
    { number: 'STU004', name_ar: 'فاطمة خالد', name_en: 'Fatima Khalid', grade: 'الصف الثاني', guardian_phone: '+966504567890' },
    { number: 'STU005', name_ar: 'عبدالله سعيد', name_en: 'Abdullah Saeed', grade: 'الصف الرابع', guardian_phone: '+966505678901' },
  ];

  for (const student of students) {
    await prisma.studentAccount.upsert({
      where: { student_number: student.number },
      update: {},
      create: {
        student_number: student.number,
        student_name_ar: student.name_ar,
        student_name_en: student.name_en,
        guardian_name_ar: 'ولي الأمر',
        guardian_name_en: 'Guardian',
        guardian_phone: student.guardian_phone,
        guardian_email: `${student.number.toLowerCase()}@parent.com`,
        grade_level: student.grade,
        section: 'A',
        academic_year_id: academicYear.id,
        enrollment_date: new Date('2024-01-01'),
        status: 'ACTIVE',
        total_fees: 35000,
        total_paid: 0,
        total_balance: 35000,
        school_id: school.id,
      },
    });
  }

  console.log('Created sample students');

  // Create some sample employees
  const employees = [
    { number: 'EMP001', name_ar: 'خالد العمري', name_en: 'Khaled Al-Amri', position: 'مدير المدرسة', basic_salary: 15000, is_saudi: true },
    { number: 'EMP002', name_ar: 'نورة السعيد', name_en: 'Noura Al-Saeed', position: 'محاسبة', basic_salary: 8000, is_saudi: true },
    { number: 'EMP003', name_ar: 'يوسف الحسن', name_en: 'Yousef Al-Hassan', position: 'معلم', basic_salary: 10000, is_saudi: true },
    { number: 'EMP004', name_ar: 'مرام العتيبي', name_en: 'Maram Al-Otaibi', position: 'معلمة', basic_salary: 9000, is_saudi: true },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { employee_number: emp.number },
      update: {},
      create: {
        employee_number: emp.number,
        name_ar: emp.name_ar,
        name_en: emp.name_en,
        position: emp.position,
        basic_salary: emp.basic_salary,
        housing_allowance: emp.basic_salary * 0.25,
        transportation_allowance: 1000,
        employment_type: 'FULL_TIME',
        hire_date: new Date('2023-01-01'),
        is_saudi: emp.is_saudi,
        gosi_registered: emp.is_saudi,
        bank_name: 'الراجحي',
        iban: 'SA12 3456 7890 1234 5678 9012',
        nationality: emp.is_saudi ? 'سعودي' : 'مصري',
        school_id: school.id,
        is_active: true,
      },
    });
  }

  console.log('Created sample employees');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });