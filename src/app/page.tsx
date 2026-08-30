"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createReceipt } from "@/lib/firestore";
import { defaultCurrencyFromLocale } from "@/lib/currency";
import { buildInitialPeople, resolveInitialTip } from "@/lib/setup";
import { initialTip } from "@/types";
import { ReceiptTape } from "@/components/receipt/ReceiptTape";
import { ScanSection, ScanResult } from "@/components/receipt/ScanSection";
import { SetupSection } from "@/components/receipt/SetupSection";
import { useRecentReceipts } from "@/hooks/useRecentReceipts";
import { RecentSection } from "@/components/receipt/RecentSection";

type Step = "idle" | "setup" | "creating";

const SCAN_FAILED_MESSAGE = "Couldn't read that receipt. Try another photo.";

export default function LandingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSettled, setScanSettled] = useState(false);
  const { recents, remove: removeRecent } = useRecentReceipts();

  // Held rather than awaited: the scan runs while the user fills the setup
  // step, so the 5-10s wait is spent on a form they have to fill anyway. Null
  // on the manual path, where there is nothing to wait for.
  const scanPromise = useRef<Promise<ScanResult | null> | null>(null);

  const [names, setNames] = useState<string[]>([""]);
  const [tipEnabled, setTipEnabled] = useState(false);
  const [tipPercent, setTipPercent] = useState(initialTip.percent);

  function handleScanStarted(promise: Promise<ScanResult | null>) {
    setScanSettled(false);
    setScanError(null);
    scanPromise.current = promise;
    setStep("setup");

    promise
      .then((result) => {
        if (!result) setScanError(SCAN_FAILED_MESSAGE);
      })
      .catch(() => setScanError(SCAN_FAILED_MESSAGE))
      .finally(() => setScanSettled(true));
  }

  function handleSkip() {
    scanPromise.current = null;
    setScanError(null);
    setScanSettled(true);
    setStep("setup");
  }

  function handleRetake() {
    scanPromise.current = null;
    setScanError(null);
    setScanSettled(false);
    setStep("idle");
  }

  async function handleContinue() {
    setStep("creating");
    setError(null);

    try {
      const scan = scanPromise.current ? await scanPromise.current : null;

      // The scan may have failed while the form was being filled. The setup
      // step shows the failure instead of Continue, so this is belt and braces.
      if (scanPromise.current && !scan) {
        setScanError(SCAN_FAILED_MESSAGE);
        setStep("setup");
        return;
      }

      const people = buildInitialPeople(names);
      const tip = resolveInitialTip(
        { enabled: tipEnabled, percent: tipPercent },
        scan?.parsedTipCents ?? null
      );

      const id = await createReceipt({
        people,
        tip,
        ...(scan
          ? {
              items: scan.items,
              restaurantName: scan.restaurantName,
              ocrText: scan.ocrText,
              currency: scan.currency,
              charges: scan.charges,
            }
          : {
              currency: defaultCurrencyFromLocale(navigator.language),
              items: [
                {
                  id: `item-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 6)}`,
                  name: "New Item",
                  quantity: 1,
                  priceCents: 0,
                  assignedTo: [],
                },
              ],
            }),
      });

      router.push(`/receipt/${id}`);
    } catch {
      setError("Failed to create receipt. Check your connection and try again.");
      setStep("setup");
    }
  }

  return (
    <ReceiptTape>
      <div className="py-8 text-center">
        <h1 className="font-receipt text-5xl uppercase tracking-[0.15em] text-ink">
          Shplit
        </h1>
        <p className="mt-1 font-receipt text-base text-ink-muted">
          for when you can&apos;t split evenly
        </p>
      </div>

      {error && (
        <p className="py-2 text-center font-receipt text-base text-accent">{error}</p>
      )}

      {step === "creating" ? (
        <div className="py-8 text-center font-receipt text-base text-ink-muted">
          creating receipt...
        </div>
      ) : step === "setup" ? (
        <div className="no-print">
          <SetupSection
            names={names}
            onChangeNames={setNames}
            tipEnabled={tipEnabled}
            onToggleTip={setTipEnabled}
            tipPercent={tipPercent}
            onChangeTipPercent={setTipPercent}
            onContinue={handleContinue}
            isBusy={!scanSettled}
            scanError={scanError}
            onRetake={handleRetake}
          />
        </div>
      ) : (
        <div className="no-print">
          <ScanSection onScanStarted={handleScanStarted} onSkip={handleSkip} />
        </div>
      )}

      {step === "idle" && recents.length > 0 && (
        <div className="receipt-separator text-sm select-none" aria-hidden="true">
          ================================
        </div>
      )}
      {step === "idle" && (
        <RecentSection recents={recents} onRemove={removeRecent} />
      )}
    </ReceiptTape>
  );
}
