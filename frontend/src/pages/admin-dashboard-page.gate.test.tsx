import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { AdminDashboardPage } from "./admin-dashboard-page";
import { renderWithProviders } from "../test/test-utils";

vi.mock("../state/auth-context", () => ({
  useAuth: () => ({
    token: "",
    user: {
      id: "22222222-2222-2222-2222-222222222222",
      email: "client@test.com",
      role: "client" as const,
      full_name: "Client User",
    },
    isAuthenticated: true,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUserDisplay: vi.fn(),
  }),
}));

describe("AdminDashboardPage (access gate)", () => {
  it("shows a message when the user is not an admin", () => {
    renderWithProviders(<AdminDashboardPage />, { withAuth: false });
    expect(screen.getByText("Admin access required.")).toBeInTheDocument();
  });
});
