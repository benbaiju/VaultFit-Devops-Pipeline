import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { LoginPage } from "./login-page";
import { renderWithProviders } from "../test/test-utils";
import { server } from "../test/msw/server";

describe("LoginPage", () => {
  it("shows an error message when the API rejects credentials", async () => {
    server.use(
      http.post(/\/auth\/login$/, () =>
        HttpResponse.json({ message: "Invalid email or password" }, { status: 401 }),
      ),
    );

    const { user } = renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/^email$/i), "wrong@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "badpassword");
    await user.click(screen.getByRole("button", { name: /^log in$/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });
});
