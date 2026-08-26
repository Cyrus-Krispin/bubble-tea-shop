import { useId } from "react";
import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";

type ProblemStateProps = {
  actionLabel?: string;
  message: string;
  onRetry?: () => void;
  title: string;
};

export function ProblemState({
  actionLabel = "Try again",
  message,
  onRetry,
  title,
}: ProblemStateProps) {
  const titleId = useId();

  return (
    <Alert aria-labelledby={titleId} className="max-w-2xl" variant="destructive">
      <TriangleAlert aria-hidden="true" />
      <h2 className="font-medium group-has-[>svg]/alert:col-start-2" id={titleId}>{title}</h2>
      <AlertDescription>{message}</AlertDescription>
      {onRetry === undefined ? null : (
        <Button className="mt-3 w-fit" onClick={onRetry} variant="outline">{actionLabel}</Button>
      )}
    </Alert>
  );
}
