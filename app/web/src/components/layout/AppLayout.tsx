'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Users,
  Receipt,
  CreditCard,
  Building2,
  Wallet,
  PiggyBank,
  Settings,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Bell,
  Search,
  Menu,
} from 'lucide-react';
import { cn } from '@edufinance/ui';
import { useRTL } from './RTLProvider';

interface MenuItem {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: React.ReactNode;
  href: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    labelAr: 'لوحة التحكم',
    labelEn: 'Dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    href: '/ar/dashboard',
  },
  {
    id: 'accounts',
    labelAr: 'خطة الحسابات',
    labelEn: 'Chart of Accounts',
    icon: <BookOpen className="w-5 h-5" />,
    href: '/ar/accounts',
  },
  {
    id: 'journal',
    labelAr: 'القيود اليومية',
    labelEn: 'Journal Entries',
    icon: <FileText className="w-5 h-5" />,
    href: '/ar/journal',
  },
  {
    id: 'students',
    labelAr: 'إدارة الطلاب',
    labelEn: 'Student Management',
    icon: <Users className="w-5 h-5" />,
    href: '/ar/students',
    children: [
      { id: 'students-list', labelAr: 'قائمة الطلاب', labelEn: 'Students List', icon: null, href: '/ar/students' },
      { id: 'invoices', labelAr: 'الفواتير', labelEn: 'Invoices', icon: null, href: '/ar/invoices' },
      { id: 'payments', labelAr: 'المدفوعات', labelEn: 'Payments', icon: null, href: '/ar/payments' },
    ],
  },
  {
    id: 'payroll',
    labelAr: 'الرواتب',
    labelEn: 'Payroll',
    icon: <CreditCard className="w-5 h-5" />,
    href: '/ar/payroll',
    children: [
      { id: 'employees', labelAr: 'الموظفين', labelEn: 'Employees', icon: null, href: '/ar/payroll/employees' },
      { id: 'runs', labelAr: 'كشوف الرواتب', labelEn: 'Payroll Runs', icon: null, href: '/ar/payroll/runs' },
    ],
  },
  {
    id: 'banking',
    labelAr: 'الخدمات المصرفية',
    labelEn: 'Banking',
    icon: <Building2 className="w-5 h-5" />,
    href: '/ar/banking',
  },
  {
    id: 'assets',
    labelAr: 'الأصول الثابتة',
    labelEn: 'Fixed Assets',
    icon: <Wallet className="w-5 h-5" />,
    href: '/ar/assets',
  },
  {
    id: 'budget',
    labelAr: 'الميزانية',
    labelEn: 'Budget',
    icon: <PiggyBank className="w-5 h-5" />,
    href: '/ar/budget',
  },
  {
    id: 'reports',
    labelAr: 'التقارير',
    labelEn: 'Reports',
    icon: <FileText className="w-5 h-5" />,
    href: '/ar/reports',
  },
  {
    id: 'settings',
    labelAr: 'الإعدادات',
    labelEn: 'Settings',
    icon: <Settings className="w-5 h-5" />,
    href: '/ar/settings',
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['students', 'payroll']);
  const pathname = usePathname();
  const { t, i18n } = useTranslation();
  const { isRTL, toggleDirection } = useRTL();
  const isArabic = i18n.language === 'ar';

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-e border-border bg-card transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-border">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">EF</span>
              </div>
              <span className="font-semibold text-foreground">EduFinance</span>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
              <span className="text-primary-foreground font-bold text-sm">EF</span>
            </div>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {menuItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                  onClick={(e) => {
                    if (item.children) {
                      e.preventDefault();
                      toggleExpanded(item.id);
                    }
                  }}
                >
                  {item.icon}
                  {!collapsed && (
                    <span className="flex-1">{isArabic ? item.labelAr : item.labelEn}</span>
                  )}
                  {!collapsed && item.children && (
                    <ChevronRight
                      className={cn(
                        'w-4 h-4 transition-transform',
                        expandedItems.includes(item.id) && 'rotate-90'
                      )}
                    />
                  )}
                </Link>

                {/* Submenu */}
                {!collapsed && item.children && expandedItems.includes(item.id) && (
                  <ul className="mt-1 ms-8 space-y-1">
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={child.href}
                          className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                            isActive(child.href)
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          )}
                        >
                          {isArabic ? child.labelAr : child.labelEn}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Collapse Button */}
        <div className="p-4 border-t border-border">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            {collapsed ? (
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between h-16 px-6 border-b border-border bg-card">
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-lg hover:bg-muted/50 lg:hidden">
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative hidden md:block">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('common.search')}
                className="w-64 h-10 ps-10 pe-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-muted/50">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1 end-1 w-2 h-2 bg-error rounded-full" />
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => i18n.changeLanguage(isArabic ? 'en' : 'ar')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 text-sm font-medium"
            >
              <span>{isArabic ? 'EN' : 'عربي'}</span>
            </button>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              <div className="text-end">
                <p className="text-sm font-medium">أحمد محمد</p>
                <p className="text-xs text-muted-foreground">مدير النظام</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-semibold">أ</span>
              </div>
            </div>

            {/* Logout */}
            <button className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>

        {/* Footer */}
        <footer className="px-6 py-3 border-t border-border bg-card">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>© 2024 EduFinance KSA - {t('common.all', { context: 'rights' })}</span>
            <span>{t('common.version')} 1.0.0</span>
          </div>
        </footer>
      </div>
    </div>
  );
}