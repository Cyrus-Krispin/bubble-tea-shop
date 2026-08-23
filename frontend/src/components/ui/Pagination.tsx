import { Button } from "./Button";

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
    <nav aria-label={label} className="ui-pagination">
      <Button
        aria-label="Previous page"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        size="compact"
        variant="secondary"
      >
        Previous
      </Button>
      <div className="ui-pagination__pages">
        {visiblePages(currentPage, totalPages).map((page, index) => page === "ellipsis" ? (
          <span aria-hidden="true" key={`ellipsis-${index}`}>…</span>
        ) : (
          <Button
            aria-current={page === currentPage ? "page" : undefined}
            aria-label={`Page ${page}`}
            key={page}
            onClick={() => onPageChange(page)}
            size="compact"
            variant={page === currentPage ? "primary" : "secondary"}
          >
            {page}
          </Button>
        ))}
      </div>
      <Button
        aria-label="Next page"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        size="compact"
        variant="secondary"
      >
        Next
      </Button>
    </nav>
  );
}
