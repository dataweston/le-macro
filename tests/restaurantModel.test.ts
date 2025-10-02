import { describe, expect, it } from "vitest";
import { computeModel, irrBisection } from "@/src/lib/restaurantModel";
import { baselineInputs } from "@/src/lib/presets";
import { Inputs } from "@/src/lib/types";

const base = (): Inputs => ({
  ...baselineInputs,
  seasonality: [...baselineInputs.seasonality]
});

describe("restaurant model", () => {
  it("suppresses distributions when DSCR gate fails", () => {
    const inputs = base();
    inputs.loanAmt = 150000;
    inputs.rateAPR = 0.08;
    inputs.termMonths = 60;
    inputs.ioMonths = 0;
    inputs.dscrGate = 25; // extremely high gate
    const model = computeModel(inputs);
    const gatedRow = model.rows.find(
      (row) => row.debtService > 0 && row.DSCR !== Number.POSITIVE_INFINITY
    );
    expect(gatedRow).toBeDefined();
    expect(gatedRow!.DSCR).toBeLessThan(inputs.dscrGate);
    expect(gatedRow!.distTotal).toBe(0);
  });

  it("higher AP days increases early cash balances", () => {
    const inputsTight = base();
    inputsTight.APdays = 0;
    const inputsRelaxed = base();
    inputsRelaxed.APdays = 45;
    const modelTight = computeModel(inputsTight);
    const modelRelaxed = computeModel(inputsRelaxed);
    expect(modelRelaxed.rows[0].cash).toBeGreaterThan(modelTight.rows[0].cash);
  });

  it("exit value uses trailing twelve months pre-tax", () => {
    const inputs: Inputs = {
      ...base(),
      T: 2,
      R1: 1200000,
      g: 0,
      seasonality: new Array(12).fill(1),
      rampMonths: 1,
      eventsAnnual: 0,
      eventsRampMonths: 1,
      subsMode: "mechanistic",
      subsInit: 0,
      subsSpendM: 0,
      CAC: 1,
      churnM: 0,
      pauseRate: 0,
      subsPriceW: 0,
      weeksPerMonth: 4,
      cogsPct: 0,
      packagingPct: 0,
      wastePct: 0,
      varLaborPct: 0,
      procFeesPct: 0,
      cardMixPct: 0,
      fixedSalariesAnnual: 0,
      insuranceM: 0,
      licensesM: 0,
      utilitiesM: 0,
      linenM: 0,
      repairsM: 0,
      baseRentM: 0,
      nnnM: 0,
      esc: 0,
      holidayM: 0,
      loanAmt: 0,
      rateAPR: 0,
      termMonths: 0,
      ioMonths: 0,
      dscrGate: 1,
      salesTaxRate: 0,
      entityTaxRate: 0,
      ARdays: 0,
      APdays: 0,
      InvDays: 0,
      startingCash: 0,
      minCash: 0,
      payout: 0,
      assetsF: 0,
      PM: 1,
      exitMult: 3,
      ebitdaMultiple: 4,
      capacityCap: undefined
    };
    const model = computeModel(inputs);
    // trailing twelve months pre-tax = 1,200,000
    expect(model.exitValue).toBeCloseTo(3600000, -2);
  });

  it("returns null IRR when cashflows do not bracket a root", () => {
    expect(irrBisection([100, 50, 25])).toBeNull();
  });

  it("computes IRR for baseline inputs", () => {
    const model = computeModel(base());
    expect(model.IRR_annual).not.toBeNull();
  });

  it("normalizes seasonality arrays", () => {
    const inputs = base();
    inputs.seasonality = new Array(12).fill(2);
    const model = computeModel(inputs);
    const steadyMonthly = inputs.R1 / 12;
    const rampFactor = 0.5 + 0.5 * (1 / inputs.rampMonths);
    expect(model.rows[0].core).toBeCloseTo(steadyMonthly * rampFactor, 2);
  });
});
