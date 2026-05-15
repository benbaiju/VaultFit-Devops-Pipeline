import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VaultFitLogo } from "./vaultfit-logo";

describe("VaultFitLogo", () => {
  it("exposes an accessible name", () => {
    render(<VaultFitLogo />);
    expect(screen.getByLabelText("VaultFit")).toBeInTheDocument();
  });
});
