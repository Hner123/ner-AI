export function TypingIndicator() {
  return (
    <span className="text-muted-foreground inline-flex gap-1">
      <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
      <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
      <span className="bg-muted-foreground/60 size-1.5 animate-bounce rounded-full" />
    </span>
  );
}
