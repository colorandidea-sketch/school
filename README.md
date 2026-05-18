# EduFinance KSA - Cloud-Based School Accounting System

<div align="center">

![EduFinance KSA Logo](https://via.placeholder.com/150x50?text=EduFinance+KSA)

**نظام محاسبة سحابي متكامل للمدارس في المملكة العربية السعودية**

*A comprehensive cloud-based accounting system for schools in Saudi Arabia*

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.3-blue)](https://www.typescriptlang.org/)

</div>

## 📋 Table of Contents

- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Documentation](#-documentation)
- [Modules](#-modules)
- [Compliance](#-compliance)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### Core Accounting
- ✅ Chart of Accounts with hierarchical structure
- ✅ Double-entry journal entries with approval workflow
- ✅ General Ledger and Trial Balance
- ✅ Multi-currency support (SAR as primary)

### Student Fee Management
- ✅ Fee structure configuration per grade level
- ✅ Automated VAT calculation (15% Saudi VAT)
- ✅ Bulk invoice generation
- ✅ Payment collection with multiple methods
- ✅ Student account statements
- ✅ Overdue fee tracking and reminders

### ZATCA E-Invoicing (Fatoora)
- ✅ Phase 1: Invoice generation with QR codes
- ✅ Phase 2: Integration with ZATCA portal
- ✅ UBL 2.1 XML format
- ✅ Cryptographic stamping
- ✅ Real-time submission and clearance

### Payroll Management
- ✅ Employee management with GOSI tracking
- ✅ Automated salary calculation
- ✅ GOSI contribution (9.75% employee / 11.75% employer for Saudis)
- ✅ End of Service benefits calculation (Saudi Labor Law)
- ✅ WPS (Wage Protection System) file generation
- ✅ Payslip generation (Arabic/English)

### Financial Reporting
- ✅ Balance Sheet / Statement of Financial Position
- ✅ Income Statement / Profit & Loss
- ✅ Cash Flow Statement
- ✅ Fee Collection Reports
- ✅ AR/AP Aging Reports
- ✅ VAT Return Reports

### Additional Modules
- ✅ Fixed Assets with depreciation
- ✅ Bank Reconciliation
- ✅ Budget Management
- ✅ Multi-tenant architecture
- ✅ Parent Portal
- ✅ Audit Trail

## 🛠 Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.3
- **Styling**: Tailwind CSS with RTL support
- **State Management**: Zustand + TanStack Query
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Tables**: AG Grid / TanStack Table
- **i18n**: i18next (Arabic/English)

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript 5.3
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Cache**: Redis
- **Queue**: Bull/BullMQ
- **Auth**: JWT + Passport.js

### Infrastructure
- **Cloud**: AWS (EC2, RDS, S3, CloudFront)
- **Containers**: Docker + Kubernetes
- **CI/CD**: GitHub Actions
- **Monitoring**: CloudWatch

## 📁 Project Structure

```
edufinance-ksa/
├── apps/
│   ├── web/                 # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/         # App Router pages
│   │   │   ├── components/  # React components
│   │   │   ├── hooks/       # Custom hooks
│   │   │   ├── i18n/        # Translations
│   │   │   ├── lib/         # Utilities
│   │   │   ├── store/       # Zustand stores
│   │   │   └── types/       # TypeScript types
│   │   └── package.json
│   │
│   └── api/                 # Express backend
│       ├── src/
│       │   ├── middleware/  # Express middleware
│       │   ├── routes/      # API routes
│       │   ├── services/    # Business logic
│       │   ├── utils/       # Utilities
│       │   └── index.ts     # Entry point
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── seed.ts
│       └── package.json
│
├── packages/
│   └── ui/                  # Shared UI components
│       ├── src/
│       │   ├── button.tsx
│       │   ├── input.tsx
│       │   ├── table.tsx
│       │   └── ...
│       └── package.json
│
├── turbo.json               # Turborepo config
├── package.json             # Workspace root
└── tsconfig.base.json       # Base TypeScript config
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-org/edufinance-ksa.git
cd edufinance-ksa
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Edit .env files with your values
```

4. **Setup database**
```bash
# Push Prisma schema to database
npm run db:push

# Seed sample data
npm run db:seed
```

5. **Start development servers**
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- API Documentation: http://localhost:4000/api/docs

### Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@edufinance.com | Admin@123 |

## 📚 Documentation

### Arabic Documentation (الوثائق بالعربية)
- [دليل المستخدم](docs/user-manual-ar.md)
- [دليل المحاسب](docs/accountant-guide-ar.md)
- [إعداد زاتكا](docs/zatca-setup-ar.md)

### English Documentation
- [User Manual](docs/user-manual-en.md)
- [Accountant Guide](docs/accountant-guide-en.md)
- [ZATCA Setup](docs/zatca-setup-en.md)

### Technical Documentation
- [API Reference](docs/api-reference.md)
- [Database Schema](docs/database-schema.md)
- [Deployment Guide](docs/deployment.md)

## 📦 Modules

| Module | Description | Status |
|--------|-------------|--------|
| Dashboard | Financial overview with KPIs and charts | ✅ Complete |
| Chart of Accounts | Hierarchical account management | ✅ Complete |
| Journal Entries | Double-entry with approval workflow | ✅ Complete |
| Student Management | Student accounts and fee tracking | ✅ Complete |
| Invoicing | ZATCA-compliant e-invoices | ✅ Complete |
| Payments | Multiple payment methods | ✅ Complete |
| Payroll | GOSI, WPS, EOS calculations | ✅ Complete |
| Banking | Bank accounts and reconciliation | ✅ Complete |
| Fixed Assets | Depreciation and tracking | ✅ Complete |
| Budget | Budget vs Actual tracking | ✅ Complete |
| Reports | Financial and regulatory reports | ✅ Complete |
| Parent Portal | Online fee management | 🚧 In Progress |
| ZATCA Integration | Phase 2 compliance | ✅ Complete |

## ✅ Compliance

### Saudi Regulations
- ✅ **ZATCA**: VAT and E-Invoicing compliance (Fatoora)
- ✅ **GOSI**: General Organization for Social Insurance
- ✅ **WPS**: Wage Protection System
- ✅ **PDPL**: Personal Data Protection Law
- ✅ **Saudi Labor Law**: End of service benefits

### International Standards
- ✅ **IFRS**: International Financial Reporting Standards
- ✅ **VAT**: 15% Saudi VAT rate
- ✅ **RTL**: Full Arabic RTL support

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Email**: support@edufinance.com
- **Phone**: +966 11 XXX XXXX
- **Documentation**: https://docs.edufinance.com

---

<div align="center">

**Made with ❤️ for Saudi Arabian Schools**

</div>