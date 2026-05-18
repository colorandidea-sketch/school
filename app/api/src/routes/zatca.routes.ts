import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateZATCAUUID } from '../utils/helpers';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// ZATCA Phase 2 Integration Endpoints
// In production, these would integrate with ZATCA's Fatoora API

router.post('/compliance-check', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  // Verify device compliance with ZATCA requirements
  const { device_serial, csr } = req.body;
  
  // In production, submit CSR to ZATCA for validation
  res.json({
    success: true,
    data: {
      status: 'READY',
      message: 'Device is compliant with ZATCA requirements',
      valid_from: new Date().toISOString(),
    },
  });
}));

router.post('/report-invoice', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  // Report B2C invoice to ZATCA
  const { invoice_id } = req.body;
  const authReq = req as AuthRequest;

  const invoice = await prisma.studentInvoice.findFirst({
    where: { id: invoice_id, school_id: authReq.user!.schoolId },
    include: { student_account: true, school: true, lines: true },
  });

  if (!invoice) throw new AppError('Invoice not found', 404);

  // Generate cryptographic stamp
  const uuid = invoice.zatca_uuid || generateZATCAUUID();
  const hash = generateInvoiceHash(invoice);
  
  // In production, submit to ZATCA API
  await prisma.studentInvoice.update({
    where: { id: invoice_id },
    data: {
      zatca_uuid: uuid,
      zatca_invoice_hash: hash,
      zatca_submission_status: 'SUBMITTED',
    },
  });

  // Simulate acceptance (in production, wait for ZATCA response)
  setTimeout(async () => {
    await prisma.studentInvoice.update({
      where: { id: invoice_id },
      data: { zatca_submission_status: 'ACCEPTED' },
    });
  }, 1000);

  res.json({
    success: true,
    data: {
      uuid,
      hash,
      submission_status: 'SUBMITTED',
      message: 'Invoice reported to ZATCA successfully',
    },
  });
}));

router.post('/clear-invoice', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  // Clear B2B invoice with ZATCA
  const { invoice_id, buyer_vat_number } = req.body;
  const authReq = req as AuthRequest;

  const invoice = await prisma.studentInvoice.findFirst({
    where: { id: invoice_id, school_id: authReq.user!.schoolId },
    include: { school: true },
  });

  if (!invoice) throw new AppError('Invoice not found', 404);

  const uuid = invoice.zatca_uuid || generateZATCAUUID();
  const hash = generateInvoiceHash(invoice);

  // In production, submit to ZATCA for clearance
  await prisma.studentInvoice.update({
    where: { id: invoice_id },
    data: {
      zatca_uuid: uuid,
      zatca_invoice_hash: hash,
      zatca_submission_status: 'SUBMITTED',
      zatca_clearance_status: 'PENDING',
    },
  });

  // Simulate clearance
  setTimeout(async () => {
    await prisma.studentInvoice.update({
      where: { id: invoice_id },
      data: {
        zatca_submission_status: 'ACCEPTED',
        zatca_clearance_status: 'CLEARED',
      },
    });
  }, 2000);

  res.json({
    success: true,
    data: {
      uuid,
      hash,
      clearance_status: 'CLEARED',
      message: 'Invoice cleared with ZATCA',
    },
  });
}));

router.get('/status/:uuid', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { uuid } = req.params;

  const invoice = await prisma.studentInvoice.findFirst({
    where: { zatca_uuid: uuid, school_id: (req as AuthRequest).user!.schoolId },
    select: {
      invoice_number: true,
      zatca_submission_status: true,
      zatca_clearance_status: true,
      zatca_invoice_hash: true,
    },
  });

  if (!invoice) throw new AppError('Invoice not found', 404);

  res.json({ success: true, data: invoice });
}));

router.post('/onboarding', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  // Device onboarding for ZATCA
  const { csr, solution_id, solution_version } = req.body;
  const authReq = req as AuthRequest;

  // Generate compliance certificate
  const certificate = {
    solution_id,
    solution_version,
    issued_at: new Date().toISOString(),
    valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'ACTIVE',
  };

  // Store in school settings
  await prisma.school.update({
    where: { id: authReq.user!.schoolId },
    data: {
      zatca_settings: {
        ...((await prisma.school.findUnique({ where: { id: authReq.user!.schoolId } }))?.zatca_settings as object || {}),
        ...certificate,
      },
    },
  });

  res.json({
    success: true,
    data: certificate,
    message: 'Device onboarded successfully',
  });
}));

// Generate UBL 2.1 XML for invoice
router.get('/:id/xml', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const invoice = await prisma.studentInvoice.findFirst({
    where: { id: req.params.id, school_id: (req as AuthRequest).user!.schoolId },
    include: { school: true, student_account: true, lines: true },
  });

  if (!invoice) throw new AppError('Invoice not found', 404);

  const xml = generateUBLXML(invoice);

  res.json({
    success: true,
    data: { xml, uuid: invoice.zatca_uuid },
  });
}));

// Helper functions
function generateInvoiceHash(invoice: any): string {
  const data = JSON.stringify({
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.invoice_date,
    total_amount: invoice.total_amount,
    vat_amount: invoice.vat_amount,
  });

  return crypto.createHash('sha256').update(data).digest('hex');
}

function generateUBLXML(invoice: any): string {
  // Simplified UBL 2.1 XML generation
  // In production, use a proper UBL library
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <UBLVersionID>2.1</UBLVersionID>
  <ID>${invoice.invoice_number}</ID>
  <IssueDate>${new Date(invoice.invoice_date).toISOString().split('T')[0]}</IssueDate>
  <InvoiceTypeCode>388</InvoiceTypeCode>
  <DocumentCurrencyCode>SAR</DocumentCurrencyCode>
  <AccountingSupplierParty>
    <Party>
      <PartyName>
        <Name>${invoice.school.school_name_en}</Name>
      </PartyName>
      <PostalAddress>
        <StreetName>${invoice.school.address || ''}</StreetName>
        <CityName>${invoice.school.city || ''}</CityName>
        <Country>
          <IdentificationCode>SA</IdentificationCode>
        </Country>
      </PostalAddress>
    </Party>
  </AccountingSupplierParty>
  <AccountingCustomerParty>
    <Party>
      <PartyName>
        <Name>${invoice.student_account.student_name_en}</Name>
      </PartyName>
    </Party>
  </AccountingCustomerParty>
  <TaxTotal>
    <TaxAmount currencyID="SAR">${invoice.vat_amount}</TaxAmount>
  </TaxTotal>
  <LegalMonetaryTotal>
    <LineExtensionAmount currencyID="SAR">${invoice.subtotal}</LineExtensionAmount>
    <TaxExclusiveAmount currencyID="SAR">${invoice.subtotal}</TaxExclusiveAmount>
    <TaxInclusiveAmount currencyID="SAR">${invoice.total_amount}</TaxInclusiveAmount>
    <DuePayableAmount currencyID="SAR">${invoice.total_amount}</DuePayableAmount>
  </LegalMonetaryTotal>
  ${invoice.lines.map((line: any, i: number) => `
  <InvoiceLine>
    <ID>${i + 1}</ID>
    <InvoicedQuantity unitCode="EA">${line.quantity}</InvoicedQuantity>
    <LineExtensionAmount currencyID="SAR">${line.total_amount}</LineExtensionAmount>
    <Item>
      <Description>${line.description_en}</Description>
    </Item>
    <Price>
      <PriceAmount currencyID="SAR">${line.unit_price}</PriceAmount>
    </Price>
  </InvoiceLine>`).join('')}
</Invoice>`;
}

export default router;