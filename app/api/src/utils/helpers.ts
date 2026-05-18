import { Decimal } from '@prisma/client/runtime/library';

export const formatCurrency = (amount: number | Decimal, currency = 'SAR'): string => {
  const num = typeof amount === 'number' ? amount : Number(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const toHijriDate = (date: Date): string => {
  // Simplified Hijri conversion - in production, use a proper library
  const adjustment = -1;
  const year = date.getFullYear() - 622 + adjustment;
  const month = Math.floor((date.getMonth() + 1 - 1) * 12 / 29.5) + 1;
  const day = Math.floor((date.getDate() - 1) * 30 / 29.5) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const validateIBAN = (iban: string): boolean => {
  // Basic IBAN validation for Saudi Arabia (SA)
  if (!iban) return false;
  const cleanIBAN = iban.replace(/\s/g, '').toUpperCase();
  if (!cleanIBAN.startsWith('SA')) return false;
  if (cleanIBAN.length !== 24) return false;
  // Add proper IBAN checksum validation here
  return true;
};

export const validateNationalId = (id: string): boolean => {
  // Saudi National ID validation (10 digits)
  if (!id || !/^\d{10}$/.test(id)) return false;
  return true;
};

export const validateVATNumber = (vatNumber: string): boolean => {
  // Saudi VAT number format: 3XXXXXXXXXXXX
  if (!vatNumber || !/^3\d{12}$/.test(vatNumber)) return false;
  return true;
};

export const calculateVAT = (amount: number, rate: number = 15): {
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
} => {
  const taxableAmount = amount;
  const vatAmount = Math.round(taxableAmount * rate) / 100;
  const totalAmount = taxableAmount + vatAmount;
  return {
    taxableAmount: Math.round(taxableAmount * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
};

export const calculateGOSI = (
  basicSalary: number,
  housingAllowance: number,
  isSaudi: boolean
): {
  employeeShare: number;
  employerShare: number;
  total: number;
} => {
  const gosiBase = Math.min(basicSalary + housingAllowance, 45000);
  
  if (isSaudi) {
    // Saudi employee: 9.75% employee, 11.75% employer (Pension + SANED)
    return {
      employeeShare: Math.round(gosiBase * 0.0975 * 100) / 100,
      employerShare: Math.round(gosiBase * 0.1175 * 100) / 100,
      total: Math.round(gosiBase * 0.215 * 100) / 100,
    };
  } else {
    // Non-Saudi employee: 2% employee, 2% employer (Occupational Hazards)
    return {
      employeeShare: Math.round(gosiBase * 0.02 * 100) / 100,
      employerShare: Math.round(gosiBase * 0.02 * 100) / 100,
      total: Math.round(gosiBase * 0.04 * 100) / 100,
    };
  }
};

export const calculateEndOfService = (
  basicSalary: number,
  yearsOfService: number
): number => {
  // Saudi Labor Law: 
  // First 5 years: 0.5 month salary per year
  // After 5 years: 1 month salary per year
  if (yearsOfService <= 5) {
    return Math.round((basicSalary * 0.5 * yearsOfService) * 100) / 100;
  } else {
    const first5Years = basicSalary * 0.5 * 5;
    const remainingYears = basicSalary * 1 * (yearsOfService - 5);
    return Math.round((first5Years + remainingYears) * 100) / 100;
  }
};

export const calculateDepreciation = (
  purchasePrice: number,
  residualValue: number,
  usefulLifeYears: number,
  method: 'STRAIGHT_LINE' | 'DECLINING_BALANCE' = 'STRAIGHT_LINE',
  currentYear = 1
): {
  annualDepreciation: number;
  accumulatedDepreciation: number;
  netBookValue: number;
} => {
  const depreciableAmount = purchasePrice - residualValue;
  
  if (method === 'STRAIGHT_LINE') {
    const annualDepreciation = depreciableAmount / usefulLifeYears;
    const accumulatedDepreciation = annualDepreciation * currentYear;
    const netBookValue = purchasePrice - accumulatedDepreciation;
    return {
      annualDepreciation: Math.round(annualDepreciation * 100) / 100,
      accumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
      netBookValue: Math.round(netBookValue * 100) / 100,
    };
  } else {
    // Declining Balance
    const rate = 2 / usefulLifeYears;
    let accumulatedDepreciation = 0;
    let bookValue = purchasePrice;
    
    for (let i = 1; i <= currentYear; i++) {
      const depreciation = bookValue * rate;
      accumulatedDepreciation += depreciation;
      bookValue -= depreciation;
      if (bookValue < residualValue) {
        bookValue = residualValue;
      }
    }
    
    return {
      annualDepreciation: Math.round(depreciableAmount * rate * 100) / 100,
      accumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
      netBookValue: Math.round(bookValue * 100) / 100,
    };
  }
};

export const roundToTwoDecimals = (num: number): number => {
  return Math.round(num * 100) / 100;
};

export const paginate = <T>(data: T[], page: number, pageSize: number) => {
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  return {
    data: data.slice(startIndex, endIndex),
    meta: {
      total: data.length,
      page,
      pageSize,
      totalPages: Math.ceil(data.length / pageSize),
    },
  };
};

export const buildFilterQuery = (filters: Record<string, unknown>): string => {
  const conditions: string[] = [];
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'string') {
        conditions.push(`${key} ILIKE '%${value}%'`);
      } else {
        conditions.push(`${key} = ${value}`);
      }
    }
  }
  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
};

export const generateEntryNumber = (year: number, sequence: number): string => {
  return `JE-${year}-${String(sequence).padStart(6, '0')}`;
};

export const generateInvoiceNumber = (year: number, sequence: number): string => {
  return `INV-${year}-${String(sequence).padStart(6, '0')}`;
};

export const generateReceiptNumber = (year: number, sequence: number): string => {
  return `RCP-${year}-${String(sequence).padStart(6, '0')}`;
};

export const generateZATCAUUID = (): string => {
  return generateUUID().toUpperCase();
};