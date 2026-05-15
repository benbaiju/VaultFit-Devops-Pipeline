import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement, ReactNode } from "react";
import { AuthProvider } from "../state/auth-context";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

type RenderWithProvidersOptions = {
  route?: string;
  /** When false, render children without AuthProvider (e.g. when `useAuth` is mocked). */
  withAuth?: boolean;
  client?: QueryClient;
};

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", withAuth = true, client }: RenderWithProvidersOptions = {},
) {
  const queryClient = client ?? createTestQueryClient();
  const wrap = (node: ReactNode) =>
    withAuth ? <AuthProvider>{node}</AuthProvider> : <>{node}</>;

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{wrap(ui)}</MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}
