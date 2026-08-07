import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import React, { useState } from "react";
import InstallmentField from "./InstallmentField";

function Harness() {
  const [value, setValue] = useState("1");
  return <InstallmentField value={value} disabled={false} canUseInstallments onChange={setValue} />;
}

describe("InstallmentField", () => {
  it("permite apagar o campo e digitar 2 sem concatenar com 1", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Quantidade de parcelas" });

    expect(input).toHaveValue("1");
    await user.click(input);
    expect(input).toHaveValue("");
    await user.type(input, "2");

    expect(input).toHaveValue("2");
    expect(input).not.toHaveValue("12");
  });
});
