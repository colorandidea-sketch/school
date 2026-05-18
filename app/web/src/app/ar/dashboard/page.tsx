'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  FileText,
  CreditCard,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@edufinance/ui';
import { cn } from '@edufinance/ui';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// Mock data
const revenueData = [
  { month: 'يناير', revenue: 450000, expenses: 320000 },
  { month: 'فبراير', revenue: 480000, expenses: 335000 },
  { month: 'مارس', revenue: 520000, expenses: 340000 },
  { month: 'أبريل', revenue: 490000, expenses: 330000 },
  { month: 'مايو', revenue: 550000, expenses: 345000 },
  { month: 'يونيو', revenue: 580000, expenses: 350000 },
  { month: 'يوليو', revenue: 420000, expenses: 310000 },
  { month: 'أغسطس', revenue: 380000, expenses: 300000 },
  { month: 'سبتمبر', revenue: 620000, expenses: 380000 },
  { month: 'أكتوبر', revenue: 650000, expenses: 390000 },
  { month: 'نوفمبر', revenue: 680000, expenses: 400000 },
  { month: 'ديسمبر', revenue: 700000, expenses: 420000 },
];

const expenseBreakdown = [
  { name: 'الرواتب', value: 45 },
  { name: 'الصيانة', value: 15 },
  { name: 'المرافق', value: 12 },
  { name: 'اللوازم', value: 10 },
  { name: 'التأمين', value: 8 },
  { name: 'أخرى', value: 10 },
];

const collectionData = [
  { grade: 'الروضة', collected: 92, outstanding: 8 },
  { grade: 'الابتدائي', collected: 88, outstanding: 12 },
  { grade: 'المتوسط', collected: 85, outstanding: 15 },
  { grade: 'الثانوي', collected: 90, outstanding: 10 },
];

const COLORS = ['#1E3A5F', '#2ECC71', '#F39C12', '#3498DB', '#9B59B6', '#E74C3C'];

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
}

function KPICard({ title, value, change, icon, trend }: KPICardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {trend === 'up' ? (
                  <TrendingUp className="w-4 h-4 text-success" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-error" />
                )}
                <span
                  className={cn(
                    'text-xs font-medium',
                    trend === 'up' ? 'text-success' : 'text-error'
                  )}
                >
                  {change > 0 ? '+' : ''}{change}%
                </span>
                <span className="text-xs text-muted-foreground">vs last month</span>
              </div>
            )}
          </div>
          <div className="p-3 rounded-lg bg-primary/10">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('dashboard.welcome')}</h1>
          <p className="text-muted-foreground mt-1">
            {new Date().toLocaleDateString('ar-SA', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <select className="px-4 py-2 rounded-lg border border-input bg-background text-sm">
            <option>هذا الشهر</option>
            <option>هذا الربع</option>
            <option>هذا العام</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title={t('dashboard.revenue')}
          value="5,250,000 ر.س"
          change={12.5}
          icon={<DollarSign className="w-6 h-6 text-primary" />}
          trend="up"
        />
        <KPICard
          title={t('dashboard.expenses')}
          value="4,020,000 ر.س"
          change={-3.2}
          icon={<CreditCard className="w-6 h-6 text-warning" />}
          trend="down"
        />
        <KPICard
          title={t('dashboard.cash_position')}
          value="1,230,000 ر.س"
          change={8.7}
          icon={<DollarSign className="w-6 h-6 text-success" />}
          trend="up"
        />
        <KPICard
          title={t('dashboard.outstanding_fees')}
          value="485,000 ر.س"
          change={-5.1}
          icon={<Clock className="w-6 h-6 text-error" />}
          trend="down"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.revenue')} و {t('dashboard.expenses')}</CardTitle>
            <CardDescription>آخر 12 شهر</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E1E8ED" />
                  <XAxis dataKey="month" stroke="#7F8C8D" fontSize={12} />
                  <YAxis stroke="#7F8C8D" fontSize={12} tickFormatter={(v) => `${v / 1000}K`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E1E8ED',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value.toLocaleString()} ر.س`, '']}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="الإيرادات" fill="#2ECC71" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="المصروفات" fill="#E74C3C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>توزيع المصروفات</CardTitle>
            <CardDescription>النسبة المئوية لكل فئة</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {expenseBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fee Collection by Grade */}
      <Card>
        <CardHeader>
          <CardTitle>نسبة تحصيل الرسوم حسب المرحلة</CardTitle>
          <CardDescription>هذا العام الأكاديمي</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={collectionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E1E8ED" />
                <XAxis type="number" domain={[0, 100]} stroke="#7F8C8D" />
                <YAxis dataKey="grade" type="category" stroke="#7F8C8D" width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #E1E8ED',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="collected" name="محصّل" fill="#2ECC71" stackId="a" />
                <Bar dataKey="outstanding" name="مستحق" fill="#F39C12" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.quick_actions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <QuickActionButton
                icon={<Plus className="w-6 h-6 text-primary" />}
                label={t('dashboard.create_invoice')}
                onClick={() => {}}
              />
              <QuickActionButton
                icon={<CreditCard className="w-6 h-6 text-success" />}
                label={t('dashboard.record_payment')}
                onClick={() => {}}
              />
              <QuickActionButton
                icon={<FileText className="w-6 h-6 text-warning" />}
                label={t('dashboard.create_journal_entry')}
                onClick={() => {}}
              />
              <QuickActionButton
                icon={<Users className="w-6 h-6 text-info" />}
                label="إضافة طالب"
                onClick={() => {}}
              />
              <QuickActionButton
                icon={<DollarSign className="w-6 h-6 text-secondary" />}
                label={t('dashboard.quick_expense')}
                onClick={() => {}}
              />
              <QuickActionButton
                icon={<FileText className="w-6 h-6 text-muted-foreground" />}
                label={t('dashboard.generate_report')}
                onClick={() => {}}
              />
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.recent_transactions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { desc: 'تحصيل رسوم - أحمد محمد', amount: '15,000 ر.س', type: 'payment', time: '10:30 ص' },
                { desc: 'فاتورة #INV-2024-00156', amount: '-12,500 ر.س', type: 'invoice', time: '09:15 ص' },
                { desc: 'رواتب شهر نوفمبر', amount: '-450,000 ر.س', type: 'payroll', time: 'أمس' },
                { desc: 'تحصيل رسوم - سارة أحمد', amount: '8,500 ر.س', type: 'payment', time: 'أمس' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center',
                        item.type === 'payment' ? 'bg-success/10' : item.type === 'invoice' ? 'bg-primary/10' : 'bg-warning/10'
                      )}
                    >
                      {item.type === 'payment' ? (
                        <DollarSign className="w-5 h-5 text-success" />
                      ) : item.type === 'invoice' ? (
                        <FileText className="w-5 h-5 text-primary" />
                      ) : (
                        <CreditCard className="w-5 h-5 text-warning" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.desc}</p>
                      <p className="text-xs text-muted-foreground">{item.time}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'font-semibold',
                      item.amount.startsWith('-') ? 'text-error' : 'text-success'
                    )}
                  >
                    {item.amount}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Fees Alert */}
      <Card className="border-warning/50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-warning/10">
              <AlertCircle className="w-6 h-6 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{t('dashboard.overdue_fees')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                يوجد 23 فاتورة متأخرة تجاوزت 60 يوم بدون دفع
              </p>
              <div className="flex items-center justify-between mt-4">
                <div className="flex gap-8">
                  <div>
                    <p className="text-2xl font-bold text-warning">23</p>
                    <p className="text-xs text-muted-foreground">فاتورة</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">125,000 ر.س</p>
                    <p className="text-xs text-muted-foreground">المبلغ الإجمالي</p>
                  </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-warning text-white rounded-lg hover:bg-warning/90 transition-colors">
                  {t('dashboard.view_overdue_fees')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}