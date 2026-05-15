import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { AdminDashboardPage } from "../../pages/admin-dashboard-page";
import { renderWithProviders } from "../../test/test-utils";
import { server } from "../../test/msw/server";

vi.mock("../../state/auth-context", () => ({
  useAuth: () => ({
    token: "test-token",
    user: {
      id: "11111111-1111-1111-1111-111111111111",
      email: "admin@test.com",
      role: "admin" as const,
      full_name: "Test Admin",
    },
    isAuthenticated: true,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUserDisplay: vi.fn(),
  }),
}));

beforeEach(() => {
  server.use(
    http.get(/\/admin\/stats$/, () =>
      HttpResponse.json({
        total_users: 10,
        active_trainers_nutritionists: 42,
        total_bookings: 3,
        open_support_tickets: 1,
      }),
    ),
    http.get(/\/admin\/verification-requests$/, () => HttpResponse.json([])),
    http.get(/\/admin\/trainers$/, () => HttpResponse.json([])),
    http.get(/\/admin\/review-timeline$/, () => HttpResponse.json({ items: [] })),
  );
});

describe("AdminDashboardPage (data)", () => {
  it("renders KPI values from the API", async () => {
    renderWithProviders(<AdminDashboardPage />, { withAuth: false });

    expect(await screen.findByRole("heading", { name: /welcome back, test admin/i })).toBeInTheDocument();

    const trainersCard = screen.getByText("Active trainers / nutritionists").closest("article");
    expect(trainersCard).toBeTruthy();
    expect(await within(trainersCard as HTMLElement).findByText("42")).toBeInTheDocument();
  });
});
