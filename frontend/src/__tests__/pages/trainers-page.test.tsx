import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { TrainersPage } from "../../pages/trainers-page";
import { renderWithProviders } from "../../test/test-utils";
import { server } from "../../test/msw/server";
import { sampleTrainersList } from "../fixtures/trainers";

beforeEach(() => {
  server.use(http.get(/\/trainers$/, () => HttpResponse.json(sampleTrainersList)));
});

describe("TrainersPage", () => {
  it("shows only trainer-role professionals in the browse list", async () => {
    renderWithProviders(<TrainersPage />);

    expect(await screen.findByText(/showing 1 of 1 trainers/i)).toBeInTheDocument();
    expect(screen.getByText("Alex Trainer")).toBeInTheDocument();
    expect(screen.queryByText("Nina Nutritionist")).not.toBeInTheDocument();
  });
});
