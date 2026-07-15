"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import {
  buildInvoicePdfHtml,
  invoicePdfTitle,
  printInvoiceHtml,
  type InvoicePdfOpts,
} from "@/lib/invoices/download-pdf";
import { Btn } from "@/components/design-system";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function InvoicePdfPreviewDialog({
  open,
  onOpenChange,
  opts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opts: InvoicePdfOpts | null;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);

  const html = useMemo(() => {
    if (!opts) return "";
    return buildInvoicePdfHtml({ ...opts, hidePrintHint: true });
  }, [opts]);

  const title = opts ? invoicePdfTitle(opts) : "Fatura";

  const blobUrl = useMemo(() => {
    if (!html || !open) return null;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [html, open]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  function onSaveOrPrint() {
    setError(null);
    try {
      const frameWin = iframeRef.current?.contentWindow;
      if (frameWin) {
        frameWin.focus();
        frameWin.print();
        return;
      }
      if (!opts) return;
      printInvoiceHtml(
        buildInvoicePdfHtml({ ...opts, hidePrintHint: false }),
        title
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível abrir a impressão"
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="flex max-h-[min(96dvh,100%)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <div className="shrink-0 border-b border-[var(--color-line)]">
          <div className="flex justify-center pb-1 pt-2.5 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-[var(--color-mist)]" />
          </div>
          <div className="relative flex items-start justify-between gap-3 px-4 pb-3.5 pt-1 sm:px-5 sm:pt-5">
            <DialogHeader className="min-w-0 space-y-1 pr-10">
              <DialogTitle>Prévia da fatura</DialogTitle>
              <DialogDescription className="truncate">
                {opts
                  ? `${opts.cardName} · ${opts.cycleLabel}`
                  : "Visualize antes de salvar ou imprimir"}
              </DialogDescription>
            </DialogHeader>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-chip)] text-[var(--color-text-2)] transition-colors hover:text-[var(--color-text)] sm:right-4 sm:top-4"
              aria-label="Fechar"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-[var(--color-pearl)] p-3 sm:p-4">
          <div className="overflow-hidden rounded-[14px] border border-[var(--color-line)] bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]">
            {blobUrl ? (
              <iframe
                ref={iframeRef}
                title={title}
                src={blobUrl}
                className="h-[min(58dvh,520px)] w-full border-0 bg-white sm:h-[min(62dvh,640px)]"
              />
            ) : (
              <div className="flex h-[50dvh] items-center justify-center text-sm text-[var(--color-text-2)]">
                Nada para pré-visualizar
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="px-4 text-sm text-[var(--color-expense)] sm:px-5">
            {error}
          </p>
        )}

        <div className="shrink-0 space-y-2 border-t border-[var(--color-line)] bg-[var(--color-modal)] px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] sm:px-5">
          <p className="text-center text-[11px] leading-relaxed text-[var(--color-text-3)] sm:text-left">
            Confira a fatura acima. Depois escolha{" "}
            <span className="font-medium text-[var(--color-text-2)]">
              Salvar como PDF
            </span>{" "}
            ou a impressora.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
            <Btn
              variant="primary"
              fullWidth
              size="lg"
              disabled={!html}
              onClick={onSaveOrPrint}
              icon={<Download className="h-4 w-4" />}
              className="sm:w-auto sm:min-w-[12rem]"
            >
              Salvar PDF / Imprimir
            </Btn>
            <Btn
              variant="secondary"
              fullWidth
              size="lg"
              onClick={() => onOpenChange(false)}
              className="sm:w-auto"
            >
              Fechar
            </Btn>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
