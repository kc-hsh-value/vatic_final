// src/components/WithdrawDialog.tsx
"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { isAddress } from "viem";
import { withdrawUsdce } from "../actions/withdraw-usdce";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  walletId: string | undefined;
  fromAddress: `0x${string}` | undefined;
  availableUSDC: number | undefined; // from your store: wallet.balanceUSDC
  eoaAddress?: `0x${string}`;
};

export default function WithdrawDialog({ open, onOpenChange, walletId, fromAddress, availableUSDC, eoaAddress }: Props) {
  const [to, setTo] = useState("");
  const [pct, setPct] = useState<number>(50);
  const [loading, setLoading] = useState(false);

  const est = useMemo(() => {
    const amt = (availableUSDC ?? 0) * (pct / 100);
    const fee = amt * 0.005;
    const net = Math.max(amt - fee, 0);
    return { amt, fee, net };
  }, [pct, availableUSDC]);

  const onSubmit = async () => {
    if (!walletId || !fromAddress) return toast.error("Wallet not ready");
    if (!isAddress(to as `0x${string}`)) return toast.error("Invalid destination address");
    if ((availableUSDC ?? 0) <= 0) return toast.error("No USDC.e available");

    setLoading(true);
    try {
      const res = await withdrawUsdce({
        walletId,
        fromAddress,
        toAddress: to as `0x${string}`,
        percent: pct,
        eoaAddress
      });
      if ((res as any)?.ok) {
        toast.success("Withdrawal sent");
        onOpenChange(false);
        // force a refresh after a moment
        setTimeout(() => window.dispatchEvent(new CustomEvent("vatic:force-refresh")), 1200);
      } else {
        toast.error("Withdrawal failed");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw USDC.e</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Destination address</Label>
            <Input
              placeholder="0x..."
              value={to}
              onChange={(e) => setTo(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Percentage</Label>
              <span className="text-sm text-white/70">{pct}%</span>
            </div>
            <Slider
              value={[pct]}
              onValueChange={([v]) => setPct(v)}
              min={1}
              max={100}
              step={1}
              className="mt-2"
            />
            <div className="mt-2 text-xs text-white/70">
              <div>Available: {(availableUSDC ?? 0).toFixed(2)} USDC.e</div>
              <div>Est. fee (0.5%): {est.fee.toFixed(2)} USDC.e</div>
              <div>Est. net: {est.net.toFixed(2)} USDC.e</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={loading || !availableUSDC}>
            {loading ? "Sending…" : "Withdraw"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}