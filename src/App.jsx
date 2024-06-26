import React, { useLayoutEffect, useRef } from 'react';
import { proxy, useSnapshot } from 'valtio';
import Chart from 'chart.js/auto';

const EPSILON = 0.01;

const state = proxy({
  loanAmount: '300000',
  interest: '7',
  loanTerm: '0',
  extraMonthlyPayment: '0',
  error: null,
  results: {
    monthlyPayment: null,
    totalPaid: null,
    totalYears: null,
    tableData: null,
  },
});

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const chartConfig = {
  type: 'bar',
  options: {
    plugins: {
      title: {
        display: true,
        text: 'Average Monthly Payment Ratio',
      },
      tooltip: {
        callbacks: {
          title: ([value]) => {
            return `Year ${value.label}`;
          },
          label: ({ dataset, raw }) => {
            return ` ${dataset.label} - $${raw.toFixed(2)}`;
          },
        },
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: 'Year',
        },
      },
      y: {
        stacked: true,
        ticks: {
          callback: (value) => {
            return `$${value}`;
          },
        },
      },
    },
  },
};

function handleAmountChange({ target }) {
  state.loanAmount = target.value;
}

function handleTermChange({ target }) {
  state.loanTerm = target.value;
}

function handleInterestChange({ target }) {
  state.interest = target.value;
}

function handleExtraMonthlyPaymentChange({ target }) {
  state.extraMonthlyPayment = target.value;
}

function calculate(loanAmount, interest, loanTerm, extraPrincipal = 0) {
  const termYears = { 0: 30, 1: 15 }[loanTerm];
  const termMonths = termYears * 12;

  // Amortization for monthly payments
  // Loan amount * [(i * (1 + i)²) / ((1 + i)² - 1)]

  const i = interest / 12;
  const a = i * Math.pow(1 + i, termMonths);
  const b = Math.pow(1 + i, termMonths) - 1;
  const monthlyPayment = (loanAmount * a) / b;

  let principal = loanAmount;
  let totalPaid = 0;

  const payments = [];

  while (principal > EPSILON) {
    const monthlyPayments = [];

    for (let j = 0; j < 12; j++) {
      let interestPayment = (principal * interest) / 12;
      let principalPayment = monthlyPayment + extraPrincipal - interestPayment;

      if (principal <= principalPayment) {
        principalPayment = principal;
      }

      principal -= principalPayment;
      totalPaid += interestPayment + principalPayment;

      if (principal <= EPSILON) {
        principal = 0;
      }

      monthlyPayments.push({
        interestPayment,
        principalPayment,
        principal,
        totalPaid,
      });

      if (principal <= EPSILON) {
        break;
      }
    }
    if (monthlyPayments.length > 0) {
      payments.push(monthlyPayments);
    }
  }

  const chartData = {
    labels: payments.map((_, index) => index + 1),
    datasets: [
      { label: 'Interest', data: [] },
      { label: 'Principal', data: [] },
    ],
  };
  const tableData = [];

  payments.forEach((monthlyPayments) => {
    let yearInterest = 0;
    let yearPrincipal = 0;

    monthlyPayments.forEach((payment) => {
      yearInterest += payment.interestPayment;
      yearPrincipal += payment.principalPayment;
    });

    chartData.datasets[0].data.push(yearInterest / monthlyPayments.length);
    chartData.datasets[1].data.push(yearPrincipal / monthlyPayments.length);

    const lastPrincipal =
      monthlyPayments[monthlyPayments.length - 1]?.principal ?? 0;

    tableData.push({
      interest: currencyFormatter.format(Math.round(yearInterest)),
      principal: currencyFormatter.format(Math.round(yearPrincipal)),
      principalBalance: currencyFormatter.format(Math.round(lastPrincipal)),
    });
  });

  return {
    monthlyPayment: currencyFormatter.format(Math.round(monthlyPayment)),
    totalPaid: currencyFormatter.format(Math.round(totalPaid)),
    totalYears: payments.length,
    chartData,
    tableData,
  };
}

export const App = () => {
  // Since the snapshot state will be used for inputs, the sync option needs to
  // be used to prevent the cursor from jumping around.
  // https://github.com/pmndrs/valtio/issues/132
  const snap = useSnapshot(state, { sync: true });
  const canvasRef = useRef();
  const chartRef = useRef();

  const handleSubmit = (event) => {
    event?.preventDefault();

    const loanAmount = Number(state.loanAmount);
    const interest = Number(state.interest) * 0.01;
    const extraMonthlyPayment = Number(state.extraMonthlyPayment);

    if (isNaN(loanAmount) || !loanAmount) {
      state.error = 'Loan amount is invalid';
    } else if (isNaN(interest) || !interest) {
      state.error = 'Interest is invalid';
    } else if (isNaN(extraMonthlyPayment) || extraMonthlyPayment < 0) {
      state.error = 'Extra monthly payment is invalid';
    } else {
      state.error = '';
      const { monthlyPayment, totalPaid, totalYears, chartData, tableData } =
        calculate(loanAmount, interest, state.loanTerm, extraMonthlyPayment);

      state.results.monthlyPayment = monthlyPayment;
      state.results.totalPaid = totalPaid;
      state.results.totalYears = totalYears;
      state.results.tableData = tableData;

      if (!chartRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        const chart = new Chart(ctx, {
          ...chartConfig,
          data: chartData,
        });
        chartRef.current = chart;
      } else {
        const chart = chartRef.current;
        chart.data = chartData;
        chart.update();
      }
    }
  };

  useLayoutEffect(handleSubmit, []);

  return (
    <div className="p-4 lg:p-16">
      <div className="text-zinc-400 text-xl mb-4 lg:mb-8 text-center">
        Mortgage Calculator
      </div>
      <div className="flex justify-center">
        <div className="flex flex-col lg:flex-row justify-center gap-8 max-w-[1400px]">
          <div className="flex flex-col gap-8 flex-1 h-fit">
            <form
              className="p-4 lg:p-8 __border rounded"
              onSubmit={handleSubmit}
            >
              <div className="flex flex-col gap-2 text-sm mb-8">
                <div className="flex gap-4">
                  <div className="flex flex-col flex-[3]">
                    <label className="text-zinc-400">Loan amount</label>
                    <div className="relative">
                      <div className="absolute left-1 top-[5px]">$</div>
                      <input
                        type="text"
                        className="bg-zinc-900 __border rounded pl-4 pr-2 py-1 w-full"
                        value={snap.loanAmount}
                        onChange={handleAmountChange}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col flex-1">
                    <label className="text-zinc-400">Interest</label>
                    <div className="relative">
                      <div className="absolute right-1 top-[5px]">%</div>
                      <input
                        type="text"
                        className="bg-zinc-900 __border rounded pr-4 pl-2 py-1 w-full"
                        value={snap.interest}
                        onChange={handleInterestChange}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-zinc-400">Loan term</label>
                  <select
                    className="bg-zinc-900 __border rounded px-2 py-1 w-full"
                    value={snap.loanTerm}
                    onChange={handleTermChange}
                  >
                    <option value="0">30 year fixed</option>
                    <option value="1">15 year fixed</option>
                  </select>
                </div>
                <div className="flex flex-col flex-[3]">
                  <label className="text-zinc-400">Extra monthly payment</label>
                  <div className="relative">
                    <div className="absolute left-1 top-[5px]">$</div>
                    <input
                      type="text"
                      className="bg-zinc-900 __border rounded pl-4 pr-2 py-1 w-full"
                      value={snap.extraMonthlyPayment}
                      onChange={handleExtraMonthlyPaymentChange}
                    />
                  </div>
                </div>
                {snap.error && (
                  <div className="text-red-400 mt-2">{snap.error}</div>
                )}
              </div>
              <button
                className="bg-gradient-to-r from-cyan-500 to-blue-500 rounded p-2 hover:opacity-60 transition-opacity w-full text-lg"
                type="submit"
              >
                Calculate
              </button>
            </form>
          </div>
          <div className="flex flex-col gap-8 flex-[2]">
            <div className="flex flex-col sm:flex-row gap-8">
              <div className="py-4 flex-1 text-center __border rounded">
                <div className="text-sm">Monthly payment</div>
                <div className="text-lg font-bold">
                  {snap.results.monthlyPayment}
                </div>
              </div>
              <div className="py-4 flex-1 text-center __border rounded">
                <div className="text-sm">Total paid</div>
                <div className="text-lg font-bold">
                  {snap.results.totalPaid}
                </div>
              </div>
              <div className="py-4 flex-1 text-center __border rounded">
                <div className="text-sm">Total years</div>
                <div className="text-lg font-bold">
                  {snap.results.totalYears}
                </div>
              </div>
            </div>
            <div className="p-4 lg:p-8 __border rounded h-[300px] lg:h-[500px]">
              <canvas
                ref={canvasRef}
                width="800"
                height="400"
                className="max-w-full"
              />
            </div>
            <div className="p-4 lg:p-8 __border rounded">
              <table className="w-full">
                <thead>
                  <tr className="text-left">
                    <th className="px-2 py-1 first-of-type:border-l border-r border-t border-zinc-300 dark:border-zinc-500">
                      Year
                    </th>
                    <th className="px-2 py-1 first-of-type:border-l border-r border-t border-zinc-300 dark:border-zinc-500">
                      Interest
                    </th>
                    <th className="px-2 py-1 first-of-type:border-l border-r border-t border-zinc-300 dark:border-zinc-500">
                      Principal
                    </th>
                    <th className="px-2 py-1 first-of-type:border-l border-r border-t border-zinc-300 dark:border-zinc-500">
                      Ending Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {snap.results.tableData?.map(
                    ({ interest, principal, principalBalance }, index) => (
                      <tr
                        key={index}
                        className="first-of-type:border-t border-b border-zinc-300 dark:border-zinc-500"
                      >
                        <td className="px-2 py-1 first-of-type:border-l border-r border-zinc-300 dark:border-zinc-500">
                          {index + 1}
                        </td>
                        <td className="px-2 py-1 first-of-type:border-l border-r border-zinc-300 dark:border-zinc-500">
                          {interest}
                        </td>
                        <td className="px-2 py-1 first-of-type:border-l border-r border-zinc-300 dark:border-zinc-500">
                          {principal}
                        </td>
                        <td className="px-2 py-1 first-of-type:border-l border-r border-zinc-300 dark:border-zinc-500">
                          {principalBalance}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
