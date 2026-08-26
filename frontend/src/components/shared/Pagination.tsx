import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "../ui/button";
import {
  Pagination as PaginationRoot,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "../ui/pagination";

type PaginationProps = {
  currentPage: number;
  label?: string;
  onPageChange: (page: number) => void;
  totalPages: number;
};

function visiblePages(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push("ellipsis");
    result.push(page);
  });
  return result;
}

export function Pagination({
  currentPage,
  label = "Pagination",
  onPageChange,
  totalPages,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <PaginationRoot aria-label={label} className="justify-start">
      <PaginationContent className="flex-wrap">
        <PaginationItem>
          <Button
            aria-label="Previous page"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            size="compact"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" /> Previous
          </Button>
        </PaginationItem>
        {visiblePages(currentPage, totalPages).map((page, index) => page === "ellipsis" ? (
          <PaginationItem key={`ellipsis-${index}`}><PaginationEllipsis /></PaginationItem>
        ) : (
          <PaginationItem key={page}>
            <Button
              aria-current={page === currentPage ? "page" : undefined}
              aria-label={`Page ${page}`}
              onClick={() => onPageChange(page)}
              size="compact"
              variant={page === currentPage ? "default" : "outline"}
            >
              {page}
            </Button>
          </PaginationItem>
        ))}
        <PaginationItem>
          <Button
            aria-label="Next page"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            size="compact"
            variant="outline"
          >
            Next <ChevronRight aria-hidden="true" />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </PaginationRoot>
  );
}
