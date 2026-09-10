"use client";

import { useMemo, useState } from "react";
import Wallet from "@/components/Wallet";

type WalletStoreProps = {
  initialBalance?: number;
  currency?: string;
};

export default function WalletStore({ initialBalance = 0, currency = "GBP" }: WalletStoreProps) {
  const [balance, setBalance] = useState(initialBalance);

  const canAfford = useMemo(() => balance >= 5, [balance]);

  function spend(amount: number) {
    setBalance((prev) => Math.max(0, prev - amount));
  }

  function addFunds(amount: number) {
    setBalance((prev) => prev + amount);
  }

  return (
    <div className="space-y-4 rounded-[2rem] border border-emerald-200 bg-white p-6 shadow-sm">
      <Wallet balance={balance} currency={currency} label="Forest Wallet" accent="emerald" />

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => spend(5)}
          disabled={!canAfford}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
        >
          Spend £5
        </button>
        <button
          onClick={() => addFunds(10)}
          className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
        >
          Add £10
        </button>
      </div>

      <p className="text-sm text-emerald-700">
        {canAfford ? "You can afford another pull." : "You need more funds to open a pull."}
      </p>
    </div>
  );
}
