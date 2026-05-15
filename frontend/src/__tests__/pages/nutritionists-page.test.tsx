import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { NutritionistsPage } from "../../pages/nutritionists-page";
import { renderWithProviders } from "../../test/test-utils";
import { server } from "../../test/msw/server";
import { sampleTrainersList } from "../fixtures/trainers";

beforeEach(() => {
  server.use(http.get(/\/trainers$/, () => HttpResponse.json(sampleTrainersList)));
});

describe("NutritionistsPage", () => {
  it("shows nutritionist-role professionals in the browse list", async () => {
    renderWithProviders(<NutritionistsPage />);

    expect(await screen.findByText(/showing 1 of 1 nutritionists/i)).toBeInTheDocument();
    expect(screen.getByText("Nina Nutritionist")).toBeInTheDocument();
    expect(screen.queryByText("Alex Trainer")).not.toBeInTheDocument();
  });
});
