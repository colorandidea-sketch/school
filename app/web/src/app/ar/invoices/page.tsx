'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Filter, Download, Eye, Send, Printer, X, CheckCircle } from 'lucide-react';
import { Button } from '@edufinance/ui';
import { cn } from '@edufinance/ui';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@edufinance/ui';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@edufinance/ui';
import { Badge } from '@edufinance/ui';

const mockInvoices = [
  { id: '1', invoice_number: 'INV-2024-000156', student: 'أحمد محمد', grade: 'الصف الثالث', invoice_date: '2024-01-15', due_date: '2024-02-15', total_amount: 38500, paid_amount: 0, balance_due: 38500, status: 'ISSUED', zatca_status: 'ACCEPTED' },
  { id: '2', invoice_number: 'INV-2024-000155', student: 'سارة أحمد', grade: 'الصف الأول', invoice_date: '2024-01-14', due_date: '2024-02-14', total_amount: 28500, paid_amount: 28500, balance_due: 0, status: 'PAID', zatca_status: 'ACCEPTED' },
  { id: '3', invoice_number: 'INV-2024-000154', student: 'محمد علي', grade: 'الصف الخامس', invoice_date: '2024-01-13', due_date: '2024-02-13', total_amount: 42000, paid_amount: 20000, balance_due: 22000, status: 'PARTIALLY_PAID', zatca_status: 'ACCEPTED' },
  { id: '4', invoice_number: 'INV-2024-000153', student: 'فاطمة خالد', grade: 'الصف الثاني', invoice_date: '2024-01-10', due_date: '2024-02-10', total_amount: 35000, paid_amount: 0, balance_due: 35000, status: 'OVERDUE', zatca_status: 'ACCEPTED' },
  { id: '5', invoice_number: 'INV-2024-000152', student: 'عبدالله سعيد', grade: 'الصف الرابع', invoice_date: '2024-01-08', due_date: '2024-02-08', total_amount: 40000, paid_amount: 0, balance_due: 40000, status: 'DRAFT', zatca_status: 'PENDING' },
];

const statusConfig: Record<string, { label: string; variant: 'draft' | 'pending' | 'approved' | 'posted' | 'success' | 'warning' | 'error' }> = {
  DRAFT: { label: 'مسودة', variant: 'draft' },
  ISSUED: { label: 'صدرت', variant: 'pending' },
  PARTIALLY_PAID: { label: 'مدفوعة جزئياً', variant: 'warning' },
  PAID: { label: 'مدفوعة', variant: 'success' },
  OVERDUE: { label: 'متأخرة', variant: 'error' },
  CANCELLED: { label: 'ملغاة', variant: 'error' },
};

const zatcaStatusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'قيد الانتظار', color: 'text-warning' },
  SUBMITTED: { label: 'تم الإرسال', color: 'text-info' },
  ACCEPTED: { label: 'مقبول', color: 'text-success' },
  REJECTED: { label: 'مرفوض', color: 'text-error' },
};

export default function InvoicesPage() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filteredInvoices = mockInvoices.filter((inv) => {
    if (searchTerm && !inv.invoice_number.includes(searchTerm) && !inv.student.includes(searchTerm)) {
      return false;
    }
    if (statusFilter && inv.status !== statusFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('invoices.student_invoices')}</h1>
          <p className="text-muted-foreground mt-1">إنشاء وإدارة فواتير الطلاب</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Download className="w-4 h-4 ms-2" />
            تصدير
          </Button>
          <Button variant="outline">
            <Plus className="w-4 h-4 ms-2" />
            إنشاء فاتورة
          </Button>
          <Button>
            <Plus className="w-4 h-4 ms-2" />
            إنشاء جماعي
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">إجمالي الفواتير</p>
            <p className="text-2xl font-bold">184,000 ر.س</p>
          </CardContent>
        </Card>
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">المحصل</p>
            <p className="text-2xl font-bold text-success">48,500 ر.س</p>
          </CardContent>
        </Card>
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">مستحق</p>
            <p className="text-2xl font-bold text-warning">135,500 ر.س</p>
          </CardContent>
        </Card>
        <Card className="bg-error/5 border-error/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">متأخر</p>
            <p className="text-2xl font-bold text-error">35,000 ر.س</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="بحث برقم الفاتورة أو اسم الطالب..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 ps-10 pe-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-4 rounded-lg border border-input bg-background text-sm"
            >
              <option value="">كل الحالات</option>
              <option value="DRAFT">مسودة</option>
              <option value="ISSUED">صدرت</option>
              <option value="PARTIALLY_PAID">مدفوعة جزئياً</option>
              <option value="PAID">مدفوعة</option>
              <option value="OVERDUE">متأخرة</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('invoices.invoice_number')}</TableHead>
                <TableHead>الطالب</TableHead>
                <TableHead>المرحلة</TableHead>
                <TableHead>{t('invoices.invoice_date')}</TableHead>
                <TableHead>{t('invoices.due_date')}</TableHead>
                <TableHead className="text-end">{t('invoices.total_amount')}</TableHead>
                <TableHead className="text-end">المدفوع</TableHead>
                <TableHead className="text-end">المستحق</TableHead>
                <TableHead>{t('invoices.status')}</TableHead>
                <TableHead>زاتكا</TableHead>
                <TableHead className="text-end">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono font-medium">{inv.invoice_number}</TableCell>
                  <TableCell className="font-medium">{inv.student}</TableCell>
                  <TableCell>{inv.grade}</TableCell>
                  <TableCell className="numeric">{inv.invoice_date}</TableCell>
                  <TableCell className="numeric">{inv.due_date}</TableCell>
                  <TableCell className="text-end numeric font-mono">
                    {inv.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-end numeric font-mono text-success">
                    {inv.paid_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className={cn('text-end numeric font-mono', inv.balance_due > 0 && 'text-warning font-semibold')}>
                    {inv.balance_due.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[inv.status].variant}>
                      {statusConfig[inv.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {inv.zatca_status === 'ACCEPTED' && <CheckCircle className="w-4 h-4 text-success" />}
                      <span className={cn('text-xs', zatcaStatusConfig[inv.zatca_status].color)}>
                        {zatcaStatusConfig[inv.zatca_status].label}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" title="عرض">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title="طباعة">
                        <Printer className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title="إرسال">
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          عرض 1-{filteredInvoices.length} من {filteredInvoices.length} سجل
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>السابق</Button>
          <Button variant="outline" size="sm">التالي</Button>
        </div>
      </div>
    </div>
  );
}