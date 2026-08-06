import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { NewTransaction } from "./Home";

const categories = {
  Moradia: ["Aluguel"],
  Receitas: ["Salário"],
};

describe("NewTransaction", () => {
  it("permite apagar a quantidade e digitar 2 sem exibir 12", async () => {
    const user = userEvent.setup();
    render(<NewTransaction onAdd={vi.fn()} categoriesData={categories} payments={["Crédito", "Pix", "Débito", "Dinheiro"]} />);

    const responsible = screen.getByRole("combobox", { name: "Responsável" });
    expect(responsible).toHaveValue("João Paulo");
    expect(screen.getByRole("option", { name: "João Paulo" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Danieli" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Você" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Esposa" })).not.toBeInTheDocument();

    const payment = screen.getByRole("combobox", { name: "Forma de pagamento" });
    await user.selectOptions(payment, "Crédito");

    const installments = screen.getByRole("spinbutton", { name: "Quantidade de parcelas" });
    await user.clear(installments);
    await user.type(installments, "2");

    expect(installments).toHaveValue(2);
    expect(installments).not.toHaveValue(12);
  });
});
