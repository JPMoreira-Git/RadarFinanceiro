import React from "react";
import { Input } from "@/components/ui/input";

type InstallmentFieldProps = {
  value: string;
  disabled: boolean;
  canUseInstallments: boolean;
  onChange: (value: string) => void;
};

export default function InstallmentField({ value, disabled, canUseInstallments, onChange }: InstallmentFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-[#71847a]">Quantidade de parcelas</span>
      <Input
        aria-label="Quantidade de parcelas"
        type="number"
        min="1"
        max="60"
        inputMode="numeric"
        placeholder="1"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-xl border-[#dfe9e2] bg-[#fbfcfb] text-[#31584b] disabled:cursor-not-allowed disabled:bg-[#f1f4f2] disabled:text-[#8b9c94]"
      />
      <span className="mt-1 block text-[11px] text-[#8b9c94]">
        {canUseInstallments ? "Use 1 para pagamento à vista; Crédito e Pix podem ser parcelados." : "Esta forma de pagamento é à vista e usa 1 parcela."}
      </span>
    </label>
  );
}
