import { Inputs, Model, MonthRow, YearRow } from "./types";

type AmortRow = {
  month: number;
  interest: number;
  principal: number;
  payment: number;
  balance: number;
};

const MONTHS_IN_YEAR = 12;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const normalizeSeasonality = (seasonality: number[]): number[] => {
  if (!Array.isArray(seasonality) || seasonality.length !== MONTHS_IN_YEAR) {
    return new Array(MONTHS_IN_YEAR).fill(1);
  }
  const safe = seasonality.map((v) => (Number.isFinite(v) ? v : 1));
  const mean =
    safe.reduce((acc, value) => acc + value, 0) / Math.max(safe.length, 1);
  if (mean === 0) {
    return new Array(MONTHS_IN_YEAR).fill(1);
  }
  return safe.map((value) => value / mean);
};

export const amortSchedule = (
  principal: number,
  rateAPR: number,
  termMonths: number,
  ioMonths: number
): AmortRow[] => {
  if (principal <= 0 || termMonths <= 0) {
    return [];
  }
  const schedule: AmortRow[] = [];
  const monthlyRate = rateAPR / MONTHS_IN_YEAR;
  const safeIOMonths = clamp(Math.floor(ioMonths), 0, termMonths);
  const amortMonths = termMonths - safeIOMonths;
  let balance = principal;
  const amortPayment = (() => {
    if (amortMonths <= 0) {
      return 0;
    }
    if (Math.abs(monthlyRate) < 1e-9) {
      return principal / amortMonths;
    }
    const factor = Math.pow(1 + monthlyRate, amortMonths);
    return (principal * monthlyRate * factor) / (factor - 1);
  })();

  for (let m = 1; m <= termMonths; m += 1) {
    const isIO = m <= safeIOMonths;
    const interest = balance * monthlyRate;
    let principalPayment = 0;
    let payment = interest;

    if (!isIO) {
      if (amortMonths === 0) {
        principalPayment = balance;
      } else if (Math.abs(monthlyRate) < 1e-9) {
        principalPayment = Math.min(balance, amortPayment);
      } else {
        principalPayment = Math.min(balance, amortPayment - interest);
      }
      payment = principalPayment + interest;
    }

    balance = Math.max(0, balance - principalPayment);
    schedule.push({
      month: m,
      interest,
      principal: principalPayment,
      payment,
      balance
    });
  }

  return schedule;
};

const computeNPV = (cashflows: number[], rate: number) => {
  return cashflows.reduce((acc, cf, idx) => {
    const factor = Math.pow(1 + rate, idx);
    return acc + cf / factor;
  }, 0);
};

export const irrBisection = (
  cashflows: number[],
  low = -0.9,
  high = 3.0,
  tolerance = 1e-6,
  maxIter = 200
): number | null => {
  if (cashflows.length === 0) {
    return null;
  }
  let lo = low;
  let hi = high;
  let npvLo = computeNPV(cashflows, lo);
  let npvHi = computeNPV(cashflows, hi);

  if (!Number.isFinite(npvLo) || !Number.isFinite(npvHi) || npvLo * npvHi > 0) {
    return null;
  }

  for (let iter = 0; iter < maxIter; iter += 1) {
    const mid = (lo + hi) / 2;
    const npvMid = computeNPV(cashflows, mid);
    if (Math.abs(npvMid) < tolerance) {
      return mid;
    }
    if (npvMid * npvLo < 0) {
      hi = mid;
      npvHi = npvMid;
    } else {
      lo = mid;
      npvLo = npvMid;
    }
  }

  return (lo + hi) / 2;
};

const safeNumber = (value: number) => (Number.isFinite(value) ? value : 0);

export const computeModel = (inputs: Inputs): Model => {
  const months = Math.max(1, Math.round(inputs.T * MONTHS_IN_YEAR));
  const seasonality = normalizeSeasonality(inputs.seasonality);
  const rampMonths = Math.max(1, Math.round(inputs.rampMonths));
  const eventsRampMonths = Math.max(1, Math.round(inputs.eventsRampMonths));
  const overheadM =
    inputs.insuranceM +
    inputs.licensesM +
    inputs.utilitiesM +
    inputs.linenM +
    inputs.repairsM;
  const fixedLaborM = inputs.fixedSalariesAnnual / MONTHS_IN_YEAR;

  const amort = amortSchedule(
    inputs.loanAmt,
    inputs.rateAPR,
    Math.max(0, Math.floor(inputs.termMonths)),
    Math.max(0, Math.floor(inputs.ioMonths))
  );
  const interestSchedule = new Array(months).fill(0);
  const principalSchedule = new Array(months).fill(0);
  for (let i = 0; i < Math.min(months, amort.length); i += 1) {
    interestSchedule[i] = amort[i].interest;
    principalSchedule[i] = amort[i].principal;
  }

  const core: number[] = new Array(months).fill(0);
  const events: number[] = new Array(months).fill(0);
  const subs: number[] = new Array(months).fill(0);

  const rampFactor = (index: number, ramp: number) => {
    if (index >= ramp) {
      return 1;
    }
    const progress = (index + 1) / ramp;
    return 0.5 + 0.5 * progress;
  };

  for (let m = 0; m < months; m += 1) {
    const yearIdx = Math.floor(m / MONTHS_IN_YEAR);
    const monthIdx = m % MONTHS_IN_YEAR;
    const steadyAnnual = inputs.R1 * Math.pow(1 + inputs.g, yearIdx);
    const baseMonthly = (steadyAnnual / MONTHS_IN_YEAR) * seasonality[monthIdx];
    const ramp = rampFactor(m, rampMonths);
    const capacity = inputs.capacityCap ?? Number.POSITIVE_INFINITY;
    core[m] = Math.min(baseMonthly * ramp, capacity);

    const baseEvents = inputs.eventsAnnual / MONTHS_IN_YEAR;
    const eventRamp = rampFactor(m, eventsRampMonths);
    events[m] = baseEvents * eventRamp;
  }

  if (inputs.subsMode === "mechanistic") {
    let active = inputs.subsInit;
    for (let m = 0; m < months; m += 1) {
      const acquisitions = inputs.CAC > 0 ? inputs.subsSpendM / inputs.CAC : 0;
      active = active * (1 - inputs.churnM) + acquisitions;
      const effective = active * (1 - inputs.pauseRate);
      subs[m] =
        effective * inputs.subsPriceW * inputs.weeksPerMonth;
    }
  } else {
    const manualCounts = inputs.manualSubsCounts ?? [];
    for (let m = 0; m < months; m += 1) {
      const count = manualCounts[m] ?? 0;
      subs[m] = count * inputs.subsPriceW * inputs.weeksPerMonth;
    }
  }

  const rows: MonthRow[] = [];
  const nwc: number[] = new Array(months).fill(0);
  let cashBalance = inputs.startingCash + safeNumber(inputs.loanAmt);

  const cogsPctTotal = inputs.cogsPct + inputs.packagingPct + inputs.wastePct;

  for (let m = 0; m < months; m += 1) {
    const revenue = core[m] + events[m] + subs[m];
    const cogs = revenue * cogsPctTotal;
    const varLabor = revenue * inputs.varLaborPct;
    const procFees = revenue * inputs.procFeesPct * inputs.cardMixPct;
    const grossProfit = revenue - cogs;
    const contribution = grossProfit - varLabor - procFees;
    const occupancy =
      m < inputs.holidayM
        ? 0
        : (inputs.baseRentM + inputs.nnnM) *
          Math.pow(1 + inputs.esc, Math.floor(m / MONTHS_IN_YEAR));
    const EBITDA = contribution - fixedLaborM - overheadM - occupancy;

    const interest = interestSchedule[m] ?? 0;
    const principal = principalSchedule[m] ?? 0;
    const debtService = interest + principal;

    const preTax = EBITDA - interest;
    const incomeTax = preTax > 0 ? preTax * inputs.entityTaxRate : 0;
    const salesTax = revenue * inputs.salesTaxRate;

    const AR = revenue * (inputs.ARdays / 30);
    const INV = cogs * (inputs.InvDays / 30);
    const AP = cogs * (inputs.APdays / 30);
    nwc[m] = AR + INV - AP;
    const deltaNWC = m === 0 ? nwc[m] : nwc[m] - nwc[m - 1];
    const OCF = EBITDA - incomeTax - deltaNWC;

    const cashBeforeDist = cashBalance + OCF - interest - principal - salesTax;
    const distributable = Math.max(0, cashBeforeDist - inputs.minCash);
    const dscr = debtService > 0 ? EBITDA / debtService : Number.POSITIVE_INFINITY;
    const gatesPass =
      (dscr === Number.POSITIVE_INFINITY || dscr >= inputs.dscrGate) &&
      cashBeforeDist > inputs.minCash;
    const distTotal = gatesPass ? inputs.payout * distributable : 0;
    const cashEnd = cashBeforeDist - distTotal;
    cashBalance = cashEnd;

    rows.push({
      m: m + 1,
      core: core[m],
      events: events[m],
      subs: subs[m],
      revenue,
      cogs,
      varLabor,
      procFees,
      grossProfit,
      contribution,
      fixedLaborM,
      overheadM,
      occupancy,
      EBITDA,
      interest,
      principal,
      preTax,
      incomeTax,
      salesTax,
      deltaNWC,
      OCF,
      debtService,
      DSCR: dscr,
      distTotal,
      distF: 0,
      distK: 0,
      cash: cashEnd
    });
  }

  const in_kind_F = inputs.assetsF + inputs.holidayM * (inputs.baseRentM + inputs.nnnM);
  const eq_F = inputs.PM === 0 ? 0 : clamp(in_kind_F / inputs.PM, 0, 1);
  const eq_K = 1 - eq_F;

  rows.forEach((row) => {
    row.distF = row.distTotal * eq_F;
    row.distK = row.distTotal * eq_K;
  });

  const last12 = rows.slice(-Math.min(12, rows.length));
  const ttmPreTax = last12.reduce((acc, row) => acc + row.preTax, 0);
  const ttmEBITDA = last12.reduce((acc, row) => acc + row.EBITDA, 0);
  const exitValue = Math.max(0, ttmPreTax) * inputs.exitMult;
  const exitF = exitValue * eq_F;
  const exitK = exitValue * eq_K;

  if (rows.length > 0 && exitValue !== 0) {
    const lastRow = rows[rows.length - 1];
    lastRow.distTotal += exitValue;
    lastRow.distF += exitF;
    lastRow.distK += exitK;
  }

  const cashflowsF = [-in_kind_F, ...rows.map((row) => row.distF)];

  const irrMonthly = irrBisection(cashflowsF);
  const IRR_annual =
    irrMonthly === null ? null : Math.pow(1 + irrMonthly, MONTHS_IN_YEAR) - 1;

  const valueEBITDA = Math.max(0, ttmEBITDA) * inputs.ebitdaMultiple;
  const heuristicValue = exitValue;

  const yearly: YearRow[] = [];
  for (let y = 0; y < Math.ceil(months / MONTHS_IN_YEAR); y += 1) {
    const start = y * MONTHS_IN_YEAR;
    const end = Math.min((y + 1) * MONTHS_IN_YEAR, rows.length);
    if (start >= end) {
      break;
    }
    const slice = rows.slice(start, end);
    yearly.push({
      year: y + 1,
      revenue: slice.reduce((acc, row) => acc + row.revenue, 0),
      EBITDA: slice.reduce((acc, row) => acc + row.EBITDA, 0),
      preTax: slice.reduce((acc, row) => acc + row.preTax, 0),
      distributions: slice.reduce((acc, row) => acc + row.distTotal, 0),
      cash: slice[slice.length - 1].cash
    });
  }

  return {
    eq_F,
    eq_K,
    in_kind_F,
    rows,
    yearly,
    exitValue,
    exitF,
    exitK,
    IRR_annual,
    valueEBITDA,
    heuristicValue
  };
};

export type { AmortRow };
