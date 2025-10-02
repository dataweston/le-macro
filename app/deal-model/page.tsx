"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { unparse } from "papaparse";
import { baselineInputs } from "@/src/lib/presets";
import { computeModel } from "@/src/lib/restaurantModel";
import { Inputs } from "@/src/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);

const formatPercent = (value: number) =>
  `${(value * 100).toFixed(1)}%`;

const parseManualCounts = (raw: string): number[] => {
  if (!raw.trim()) {
    return [];
  }
  return raw
    .split(/[,\n\r\t\s]+/)
    .map((token) => Number.parseFloat(token))
    .filter((value) => Number.isFinite(value));
};

const toNumber = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sectionClass = "grid gap-4";

export default function DealModelPage() {
  const [inputs, setInputs] = React.useState<Inputs>({
    ...baselineInputs,
    seasonality: [...baselineInputs.seasonality]
  });
  const [manualCSV, setManualCSV] = React.useState<string>("");

  const parsedManualCounts = React.useMemo(
    () => parseManualCounts(manualCSV),
    [manualCSV]
  );

  const model = React.useMemo(
    () => computeModel({ ...inputs, manualSubsCounts: parsedManualCounts }),
    [inputs, parsedManualCounts]
  );

  const updateInput = <K extends keyof Inputs>(key: K, value: Inputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const updateSeasonality = (index: number, value: number) => {
    setInputs((prev) => {
      const nextSeasonality = [...prev.seasonality];
      nextSeasonality[index] = value;
      return { ...prev, seasonality: nextSeasonality };
    });
  };

  const handleExportCsv = () => {
    const csv = unparse([
      [
        "Month",
        "Core",
        "Events",
        "Subs",
        "Revenue",
        "COGS",
        "VarLabor",
        "ProcFees",
        "Contribution",
        "EBITDA",
        "Interest",
        "Principal",
        "PreTax",
        "IncomeTax",
        "SalesTax",
        "DeltaNWC",
        "DistTotal",
        "Cash",
        "DSCR"
      ],
      ...model.rows.map((row) => [
        row.m,
        row.core,
        row.events,
        row.subs,
        row.revenue,
        row.cogs,
        row.varLabor,
        row.procFees,
        row.contribution,
        row.EBITDA,
        row.interest,
        row.principal,
        row.preTax,
        row.incomeTax,
        row.salesTax,
        row.deltaNWC,
        row.distTotal,
        row.cash,
        row.DSCR === Number.POSITIVE_INFINITY ? "∞" : row.DSCR
      ])
    ]);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "restaurant-model-monthly.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const chartData = model.rows.map((row) => ({
    month: row.m,
    label: `${MONTH_LABELS[(row.m - 1) % 12]} ${Math.floor((row.m - 1) / 12) + 1}`,
    revenue: row.revenue,
    ebitda: row.EBITDA,
    cash: row.cash,
    dscr: row.DSCR === Number.POSITIVE_INFINITY ? 6 : Math.min(row.DSCR, 6)
  }));

  const summaryCards = [
    {
      label: "F Equity %",
      value: formatPercent(model.eq_F)
    },
    {
      label: "K Equity %",
      value: formatPercent(model.eq_K)
    },
    {
      label: "In-kind (F)",
      value: formatCurrency(model.in_kind_F)
    },
    {
      label: "Exit Value",
      value: formatCurrency(model.exitValue)
    },
    {
      label: "EBITDA Multiple Value",
      value: formatCurrency(model.valueEBITDA)
    },
    {
      label: "IRR (F)",
      value: model.IRR_annual !== null ? formatPercent(model.IRR_annual) : "n/a"
    }
  ];

  const renderNumberInput = (
    key: keyof Inputs,
    label: string,
    step = "any"
  ) => (
    <div className="grid gap-1">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key as string}
        type="number"
        step={step}
        value={inputs[key] as number}
        onChange={(event) => updateInput(key, toNumber(event.target.value) as any)}
      />
    </div>
  );

  const renderSeasonalityGrid = () => (
    <div className="grid grid-cols-3 gap-2">
      {MONTH_LABELS.map((label, idx) => (
        <div key={label} className="grid gap-1">
          <Label htmlFor={`seasonality-${idx}`}>{label}</Label>
          <Input
            id={`seasonality-${idx}`}
            type="number"
            step="0.01"
            value={inputs.seasonality[idx] ?? 1}
            onChange={(event) =>
              updateSeasonality(idx, toNumber(event.target.value))
            }
          />
        </div>
      ))}
    </div>
  );

  const manualMode = inputs.subsMode === "manual";

  return (
    <main className="grid gap-6 p-6 lg:grid-cols-[minmax(26rem,_40vw)_minmax(0,1fr)] 2xl:grid-cols-[minmax(30rem,_45vw)_minmax(0,1fr)]">
      <ScrollArea className="h-[calc(100vh-3rem)] w-full rounded-lg border border-border bg-background p-4 lg:max-w-none lg:min-w-[26rem] 2xl:min-w-[30rem]">
        <div className="space-y-6">
          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">Timing</h2>
            {renderNumberInput("T", "Term (years)")}
            {renderNumberInput("rampMonths", "Ramp months")}
            <div className="grid gap-2">
              <Label>Seasonality (normalized)</Label>
              {renderSeasonalityGrid()}
            </div>
          </section>

          <Separator />

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">Core & Events</h2>
            {renderNumberInput("R1", "Year 1 core (annual)")}
            {renderNumberInput("g", "Annual growth", "0.01")}
            {renderNumberInput("eventsAnnual", "Events revenue (annual)")}
            {renderNumberInput("eventsRampMonths", "Events ramp months")}
            {renderNumberInput("capacityCap", "Capacity cap (monthly)")}
          </section>

          <Separator />

          <section className={sectionClass}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Subscriptions</h2>
              <div className="flex items-center gap-2 text-sm">
                Mechanistic
                <Switch
                  checked={manualMode}
                  onChange={(event) =>
                    updateInput("subsMode", event.target.checked ? "manual" : "mechanistic")
                  }
                />
                Manual CSV
              </div>
            </div>
            {!manualMode && (
              <>
                {renderNumberInput("subsInit", "Starting active subs")}
                {renderNumberInput("subsSpendM", "Acquisition spend / month")}
                {renderNumberInput("CAC", "CAC")}
                {renderNumberInput("churnM", "Monthly churn", "0.01")}
                {renderNumberInput("pauseRate", "Pause rate", "0.01")}
              </>
            )}
            {manualMode && (
              <div className="grid gap-1">
                <Label htmlFor="manual-csv">Monthly counts CSV</Label>
                <textarea
                  id="manual-csv"
                  className="min-h-[120px] rounded-md border border-border bg-background p-2 text-sm"
                  value={manualCSV}
                  onChange={(event) => setManualCSV(event.target.value)}
                  placeholder="e.g. 10,12,14,15"
                />
                <p className="text-xs text-muted-foreground">
                  Parsed months: {parsedManualCounts.length}
                </p>
              </div>
            )}
            {renderNumberInput("subsPriceW", "Subscription price / week")}
            {renderNumberInput("weeksPerMonth", "Weeks per month")}
          </section>

          <Separator />

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">Cost stack</h2>
            {renderNumberInput("cogsPct", "COGS %", "0.01")}
            {renderNumberInput("packagingPct", "Packaging %", "0.01")}
            {renderNumberInput("wastePct", "Waste %", "0.01")}
            {renderNumberInput("varLaborPct", "Variable labor %", "0.01")}
            {renderNumberInput("procFeesPct", "Processing fees %", "0.01")}
            {renderNumberInput("cardMixPct", "Card mix %", "0.01")}
            {renderNumberInput("fixedSalariesAnnual", "Fixed salaries (annual)")}
          </section>

          <Separator />

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">Overhead</h2>
            {renderNumberInput("insuranceM", "Insurance / month")}
            {renderNumberInput("licensesM", "Licenses / month")}
            {renderNumberInput("utilitiesM", "Utilities / month")}
            {renderNumberInput("linenM", "Linen / month")}
            {renderNumberInput("repairsM", "Repairs / month")}
          </section>

          <Separator />

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">Occupancy</h2>
            {renderNumberInput("baseRentM", "Base rent / month")}
            {renderNumberInput("nnnM", "NNN / month")}
            {renderNumberInput("esc", "Annual escalator", "0.01")}
            {renderNumberInput("holidayM", "Rent-free months")}
          </section>

          <Separator />

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">Debt & gates</h2>
            {renderNumberInput("loanAmt", "Loan amount")}
            {renderNumberInput("rateAPR", "APR", "0.01")}
            {renderNumberInput("termMonths", "Term (months)")}
            {renderNumberInput("ioMonths", "Interest-only months")}
            {renderNumberInput("dscrGate", "DSCR gate", "0.01")}
          </section>

          <Separator />

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">Taxes & working capital</h2>
            {renderNumberInput("salesTaxRate", "Sales tax", "0.01")}
            {renderNumberInput("entityTaxRate", "Entity tax", "0.01")}
            {renderNumberInput("ARdays", "AR days")}
            {renderNumberInput("APdays", "AP days")}
            {renderNumberInput("InvDays", "Inventory days")}
          </section>

          <Separator />

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">Cash & distributions</h2>
            {renderNumberInput("startingCash", "Starting cash")}
            {renderNumberInput("minCash", "Min cash covenant")}
            <div className="grid gap-1">
              <Label htmlFor="payout">Payout ratio</Label>
              <Slider
                id="payout"
                min={0}
                max={1}
                step={0.01}
                value={inputs.payout}
                onChange={(event) =>
                  updateInput("payout", toNumber(event.target.value) as any)
                }
              />
              <div className="text-sm text-muted-foreground">
                {formatPercent(inputs.payout)}
              </div>
            </div>
          </section>

          <Separator />

          <section className={sectionClass}>
            <h2 className="text-xl font-semibold">Deal & exit</h2>
            {renderNumberInput("assetsF", "In-kind assets (F)")}
            {renderNumberInput("PM", "Project magnitude (PM)")}
            {renderNumberInput("exitMult", "Exit multiple")}
            {renderNumberInput("ebitdaMultiple", "EBITDA multiple")}
          </section>
        </div>
      </ScrollArea>

      <div className="space-y-6 lg:min-w-0">
        <div className="grid gap-4 md:grid-cols-3">
          {summaryCards.map((item) => (
            <Card key={item.label}>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {item.value}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorEBITDA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" interval={chartData.length > 24 ? 5 : 2} />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#2563eb"
                    fill="url(#colorRevenue)"
                  />
                  <Area
                    type="monotone"
                    dataKey="ebitda"
                    name="EBITDA"
                    stroke="#16a34a"
                    fill="url(#colorEBITDA)"
                  />
                  <Area
                    type="monotone"
                    dataKey="cash"
                    name="Cash"
                    stroke="#f97316"
                    fill="url(#colorCash)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" interval={chartData.length > 24 ? 5 : 2} />
                  <YAxis domain={[0, 6]} tickFormatter={(value) => value.toFixed(1)} />
                  <Tooltip formatter={(value: number) => value.toFixed(2)} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="dscr"
                    name="DSCR"
                    stroke="#7c3aed"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExportCsv}>Export CSV</Button>
          <Button variant="secondary" onClick={() => window.print()}>
            Print / PDF
          </Button>
        </div>

        <Tabs defaultValue="monthly">
          <TabsList>
            <TabsTrigger value="monthly">Monthly table</TabsTrigger>
            <TabsTrigger value="yearly">Yearly table</TabsTrigger>
            <TabsTrigger value="f-cash">F cash flows &amp; exit</TabsTrigger>
          </TabsList>
          <TabsContent value="monthly">
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-border">
                    {["Month","Core","Events","Subs","Revenue","COGS","VarLabor","ProcFees","Contribution","EBITDA","Interest","Principal","PreTax","IncomeTax","SalesTax","DeltaNWC","DistTotal","Cash","DSCR"].map((header) => (
                      <th key={header} className="whitespace-nowrap px-2 py-2 text-left font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {model.rows.map((row) => (
                    <tr key={row.m} className="border-b border-border/60">
                      <td className="px-2 py-2">{row.m}</td>
                      <td className="px-2 py-2">{formatCurrency(row.core)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.events)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.subs)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.revenue)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.cogs)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.varLabor)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.procFees)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.contribution)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.EBITDA)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.interest)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.principal)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.preTax)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.incomeTax)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.salesTax)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.deltaNWC)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.distTotal)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.cash)}</td>
                      <td className="px-2 py-2">{row.DSCR === Number.POSITIVE_INFINITY ? "∞" : row.DSCR.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="yearly">
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-border">
                    {["Year","Revenue","EBITDA","PreTax","Distributions","Cash"].map((header) => (
                      <th key={header} className="whitespace-nowrap px-2 py-2 text-left font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {model.yearly.map((row) => (
                    <tr key={row.year} className="border-b border-border/60">
                      <td className="px-2 py-2">{row.year}</td>
                      <td className="px-2 py-2">{formatCurrency(row.revenue)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.EBITDA)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.preTax)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.distributions)}</td>
                      <td className="px-2 py-2">{formatCurrency(row.cash)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="f-cash">
            <Card>
              <CardHeader>
                <CardTitle>F cash flows</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Initial in-kind: {formatCurrency(model.in_kind_F)}</p>
                <p>
                  Total distributions to F (incl. exit): {formatCurrency(
                    model.rows.reduce((acc, row) => acc + row.distF, 0)
                  )}
                </p>
                <p>Exit value: {formatCurrency(model.exitF)}</p>
                <p>
                  IRR (annualized): {model.IRR_annual !== null ? formatPercent(model.IRR_annual) : "n/a"}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
