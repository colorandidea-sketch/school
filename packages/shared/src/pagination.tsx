import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from './utils';
import { Button } from './button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const Pagination = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & PaginationProps>(
  ({ className, currentPage, totalPages, onPageChange, ...props }, ref) => {
    const getPages = () => {
      const pages: (number | 'ellipsis')[] = [];
      const showPages = 5;
      const halfShowPages = Math.floor(showPages / 2);

      if (totalPages <= showPages) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        if (currentPage <= halfShowPages + 1) {
          for (let i = 1; i <= showPages - 2; i++) {
            pages.push(i);
          }
          pages.push('ellipsis');
          pages.push(totalPages);
        } else if (currentPage >= totalPages - halfShowPages) {
          pages.push(1);
          pages.push('ellipsis');
          for (let i = totalPages - showPages + 3; i <= totalPages; i++) {
            pages.push(i);
          }
        } else {
          pages.push(1);
          pages.push('ellipsis');
          for (let i = currentPage - 1; i <= currentPage + 1; i++) {
            pages.push(i);
          }
          pages.push('ellipsis');
          pages.push(totalPages);
        }
      }

      return pages;
    };

    return (
      <nav ref={ref} className={cn('flex items-center gap-1', className)} {...props}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Previous</span>
        </Button>

        {getPages().map((page, index) =>
          page === 'ellipsis' ? (
            <Button key={`ellipsis-${index}`} variant="ghost" size="sm" disabled>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              key={page}
              variant={currentPage === page ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Next</span>
        </Button>
      </nav>
    );
  }
);
Pagination.displayName = 'Pagination';

export { Pagination };