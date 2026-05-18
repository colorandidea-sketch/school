'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Filter, Download, Upload, Eye, Edit, Check, X, RefreshCw } from 'lucide-react';
import { Button } from '@edufinance/ui';
import { cn } from '@edufinance/ui';
import {
  Card,
  CardContent,
  CardDescription,
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
import { Badge, badgeVariants } from '@edufinance/ui';

const mockEntries = [
  { id: '1', entry_number: 'JE-2024-000156', entry_date: '2024-01-15', description: 'تحصيل رسوم طالب', total_debit: 15000, total_credit: 15000, status: 'POSTED', entry_type: 'STANDARD', source_type: 'RECEIPT' },
  { id: '2', entry_number: 'JE-2024-000155', entry_date: '2024-01-14', description: 'سداد مصروفات', total_debit: 8500, total_credit: 8500, status: 'POSTED', entry_type: 'STANDARD', source_type: 'PAYMENT' },
  { id: '3', entry_number: 'JE-2024-000154', entry_date: '2024-01-13', description: 'ترحيل رواتب', total_debit: 450000, total_credit: 450000, status: 'APPROVED', entry_type: 'PAYROLL', source_type: 'PAYROLL' },
  { id: '4', entry_number: 'JE-2024-000153', entry_date: '2024-01-12', description: 'إهلاك الأصول', total_debit: 12500, total_credit: 12500, status: 'DRAFT', entry_type: 'ADJUSTING', source_type: 'DEPRECIATION' },
  { id: '5', entry_number: 'JE-2024-000152', entry_date: '2024-01-11', description: 'قيد افتتاحي', total_debit: 100000, total_credit: 100000, status: 'POSTED', entry_type: 'OPENING', source_type: 'AUTO' },
];

const statusColors: Record<string, 'draft' | 'pending' | 'approved' | 'posted' | 'cancelled'> = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending',
  APPROVED: 'approved',
  POSTED: 'posted',
  REVERSED: 'cancelled',
  VOID: 'cancelled',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'مسودة',
  PENDING_APPROVAL: 'في انتظار الموافقة',
  APPROVED: 'موافق عليه',
  POSTED: 'مرحل',
  REVERSED: 'معكوس',
  VOID: 'ملغى',
};

export default function JournalPage() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);

  const filteredEntries = mockEntries.filter((entry) => {
    if (searchTerm && !entry.entry_number.includes(searchTerm) && !entry.description.includes(searchTerm)) {
      return false;
    }
    if (statusFilter && entry.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedEntries((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedEntries.length === filteredEntries.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(filteredEntries.map((e) => e.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('journal.journal_entries')}</h1>
          <p className="text-muted-foreground mt-1">إدارة القيود اليومية وترحيلها</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Upload className="w-4 h-4 ms-2" />
            استيراد
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 ms-2" />
            تصدير
          </Button>
          <Button>
            <Plus className="w-4 h-4 ms-2" />
            {t('journal.create_entry')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="بحث برقم القيد أو الوصف..."
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
              <option value="PENDING_APPROVAL">في انتظار الموافقة</option>
              <option value="APPROVED">موافق عليه</option>
              <option value="POSTED">مرحل</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedEntries.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
          <span className="text-sm font-medium">{selectedEntries.length} محدد</span>
          <Button size="sm" variant="outline">
            <Check className="w-4 h-4 ms-2" />
            الموافقة
          </Button>
          <Button size="sm" variant="outline">
            <RefreshCw className="w-4 h-4 ms-2" />
            الترحيل
          </Button>
          <Button size="sm" variant="outline" className="text-error">
            <X className="w-4 h-4 ms-2" />
            إلغاء
          </Button>
        </div>
      )}

      {/* Entries Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedEntries.length === filteredEntries.length && filteredEntries.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                </TableHead>
                <TableHead>{t('journal.entry_number')}</TableHead>
                <TableHead>{t('journal.entry_date')}</TableHead>
                <TableHead>{t('journal.description')}</TableHead>
                <TableHead className="text-end">{t('journal.total_debit')}</TableHead>
                <TableHead className="text-end">{t('journal.total_credit')}</TableHead>
                <TableHead>{t('journal.status')}</TableHead>
                <TableHead>{t('journal.entry_type')}</TableHead>
                <TableHead className="text-end">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedEntries.includes(entry.id)}
                      onChange={() => toggleSelect(entry.id)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </TableCell>
                  <TableCell className="font-mono font-medium">{entry.entry_number}</TableCell>
                  <TableCell className="numeric">{entry.entry_date}</TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell className="text-end numeric font-mono">
                    {entry.total_debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-end numeric font-mono">
                    {entry.total_credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[entry.status]}>
                      {statusLabels[entry.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {entry.entry_type === 'STANDARD' ? 'قياسي' : entry.entry_type === 'PAYROLL' ? 'رواتب' : entry.entry_type}
                    </span>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {entry.status === 'DRAFT' && (
                        <Button size="sm" variant="ghost">
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      {entry.status === 'APPROVED' && (
                        <Button size="sm" variant="ghost" className="text-success">
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
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
          عرض 1-{filteredEntries.length} من {filteredEntries.length} سجل
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>السابق</Button>
          <Button variant="outline" size="sm">التالي</Button>
        </div>
      </div>
    </div>
  );
}