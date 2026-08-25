import { useId } from "react";

import { Button } from "./button";

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
    <section aria-labelledby={titleId} className="ui-problem" role="alert">
      <h2 id={titleId}>{title}</h2>
      <p>{message}</p>
      {onRetry === undefined ? null : (
        <Button onClick={onRetry} variant="secondary">{actionLabel}</Button>
      )}
    </section>
  );
}
