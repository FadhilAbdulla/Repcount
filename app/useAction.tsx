"use client";

/* Runs a server action and shows its result as a dismissible notice. Use it instead of repeating useTransition + notice state. */
import {useState, useTransition} from "react";
import {Icon} from "./Media";

export type ActionResult = {ok?: string; error?: string};
export type Run = (action: () => Promise<ActionResult>, after?: (result: ActionResult) => void) => void;

export function useAction() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run: Run = (action, after) => startTransition(async () => {
    const r = await action();
    setResult(r.ok || r.error ? r : null);
    after?.(r);
  });
  const notice = result && <div className={result.error ? "notice notice-error" : "notice"} role={result.error ? "alert" : "status"}>
    {result.error ?? result.ok}
    <button type="button" onClick={() => setResult(null)} aria-label="Dismiss notification"><Icon name="close" size={18}/></button>
  </div>;
  return {pending, run, notice};
}
