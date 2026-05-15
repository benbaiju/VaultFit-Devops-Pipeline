import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { HomePage } from "../../pages/home-page";
import { renderWithProviders } from "../../test/test-utils";
import { server } from "../../test/msw/server";
import { sampleTrainersList } from "../fixtures/trainers";

beforeEach(() => {
  server.use(http.get(/\/trainers$/, () => HttpResponse.json(sampleTrainersList)));
});

describe("HomePage", () => {
  it("lists trainers and nutritionists from GET /trainers", async () => {
    renderWithProviders(<HomePage />);

    expect(await screen.findByRole("heading", { name: /find professionals/i })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Alex Trainer" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nina Nutritionist" })).toBeInTheDocument();
  });
});
