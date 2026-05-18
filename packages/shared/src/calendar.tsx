import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './utils';
import { Button } from './button';

export interface CalendarProps {
  selected?: Date;
  onSelect?: (date: Date) => void;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

const Calendar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & CalendarProps>(
  ({ className, selected, onSelect, disabled, minDate, maxDate, ...props }, ref) => {
    const [currentMonth, setCurrentMonth] = React.useState(selected || new Date());
    const [viewMode, setViewMode] = React.useState<'gregorian' | 'hijri'>('gregorian');

    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDay = firstDay.getDay();

      const daysArray = [];
      for (let i = 0; i < startingDay; i++) {
        daysArray.push(null);
      }
      for (let i = 1; i <= daysInMonth; i++) {
        daysArray.push(new Date(year, month, i));
      }
      return daysArray;
    };

    const isDisabled = (date: Date) => {
      if (disabled) return true;
      if (minDate && date < minDate) return true;
      if (maxDate && date > maxDate) return true;
      return false;
    };

    const isSelected = (date: Date) => {
      return selected && date.toDateString() === selected.toDateString();
    };

    const isToday = (date: Date) => {
      return date.toDateString() === new Date().toDateString();
    };

    const previousMonth = () => {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const daysArray = getDaysInMonth(currentMonth);

    return (
      <div ref={ref} className={cn('p-3', className)} {...props}>
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={previousMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <span className="text-lg font-medium">
              {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-end mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'gregorian' ? 'hijri' : 'gregorian')}
          >
            {viewMode === 'gregorian' ? 'التقويم الهجري' : 'التقويم الميلادي'}
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
          {daysArray.map((date, index) => (
            <div key={index} className="aspect-square">
              {date && (
                <Button
                  variant={isSelected(date) ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'w-full h-full',
                    isToday(date) && !isSelected(date) && 'border border-primary',
                    isDisabled(date) && 'opacity-50 cursor-not-allowed'
                  )}
                  disabled={isDisabled(date)}
                  onClick={() => onSelect?.(date)}
                >
                  {date.getDate()}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
);
Calendar.displayName = 'Calendar';

export { Calendar };