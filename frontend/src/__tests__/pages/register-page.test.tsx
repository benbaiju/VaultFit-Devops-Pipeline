import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { RegisterPage } from "../../pages/register-page";
import { renderWithProviders } from "../../test/test-utils";
import { server } from "../../test/msw/server";

describe("RegisterPage", () => {
  it("shows an error message when registration is rejected", async () => {
    server.use(
      http.post(/\/auth\/register$/, () =>
        HttpResponse.json({ message: "Email already registered" }, { status: 400 }),
      ),
    );

    const { user } = renderWithProviders(<RegisterPage />);

    await user.type(screen.getByLabelText(/^name$/i), "Test User");
    await user.type(screen.getByLabelText(/^email$/i), "taken@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password12");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/email already registered/i)).toBeInTheDocument();
  });
});
