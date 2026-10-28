const MAX_AMOUNT_INTEGER_DIGITS = 9;
const MAX_AMOUNT_DECIMAL_DIGITS = 2;
const MIN_CALCULATION_FEEDBACK_MS = 180;
const MONEY_FORMATTER = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

const TAX_BRACKETS = [
  { limit: 3_000, rate: 0.03, deduction: 0 },
  { limit: 12_000, rate: 0.1, deduction: 210 },
  { limit: 25_000, rate: 0.2, deduction: 1_410 },
  { limit: 35_000, rate: 0.25, deduction: 2_660 },
  { limit: 55_000, rate: 0.3, deduction: 4_410 },
  { limit: 80_000, rate: 0.35, deduction: 7_160 },
  { limit: Number.POSITIVE_INFINITY, rate: 0.45, deduction: 15_160 },
];

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validDecimalText(value) {
  return /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(value);
}

function sanitizeDecimal(value) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [integerPart = "", ...decimalParts] = cleaned.split(".");
  const integer = integerPart.slice(0, MAX_AMOUNT_INTEGER_DIGITS);
  if (decimalParts.length === 0) {
    return integer;
  }
  return `${integer}.${decimalParts.join("").slice(0, MAX_AMOUNT_DECIMAL_DIGITS)}`;
}

function parseAmount(value) {
  const normalized = value.trim();
  if (!validDecimalText(normalized)) {
    return null;
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function formatMoney(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return MONEY_FORMATTER.format(roundMoney(Math.max(0, value)));
}

function formatPrincipal(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return MONEY_FORMATTER.format(roundMoney(Math.max(0, value)));
}

function formatRate(rate) {
  return `${rate.toFixed(2).replace(/\.?0+$/, "")}%`;
}

export function calculateMortgage({
  principalYuan,
  years,
  annualRatePercent,
  repayment,
}) {
  const months = Math.round(years * 12);
  if (
    !Number.isFinite(principalYuan) ||
    principalYuan <= 0 ||
    !Number.isFinite(months) ||
    months <= 0 ||
    !Number.isFinite(annualRatePercent) ||
    annualRatePercent < 0
  ) {
    throw new RangeError("贷款参数无效");
  }

  const monthlyRate = annualRatePercent / 100 / 12;
  const basePrincipalPayment = principalYuan / months;
  let firstPayment;
  let monthlyDecrease = 0;
  let totalInterest;
  let totalPayment;

  if (repayment === "equal-principal") {
    firstPayment = basePrincipalPayment + principalYuan * monthlyRate;
    monthlyDecrease = basePrincipalPayment * monthlyRate;
    totalInterest =
      principalYuan * monthlyRate * ((months + 1) / 2);
    totalPayment = principalYuan + totalInterest;
  } else {
    if (monthlyRate === 0) {
      firstPayment = basePrincipalPayment;
    } else {
      const factor = (1 + monthlyRate) ** months;
      firstPayment =
        (principalYuan * monthlyRate * factor) / (factor - 1);
    }
    totalPayment = firstPayment * months;
    totalInterest = totalPayment - principalYuan;
  }

  if (
    ![firstPayment, monthlyDecrease, totalInterest, totalPayment].every(
      Number.isFinite
    )
  ) {
    throw new RangeError("贷款结果超出可计算范围");
  }

  return {
    months,
    firstPayment: roundMoney(firstPayment),
    monthlyDecrease: roundMoney(monthlyDecrease),
    totalInterest: roundMoney(totalInterest),
    totalPayment: roundMoney(totalPayment),
  };
}

export function calculateIncomeTax({
  monthlyIncome,
  socialInsurance,
  specialDeduction,
}) {
  if (
    ![monthlyIncome, socialInsurance, specialDeduction].every(
      Number.isFinite
    ) ||
    monthlyIncome < 0 ||
    socialInsurance < 0 ||
    specialDeduction < 0
  ) {
    throw new RangeError("收入参数无效");
  }

  const taxableIncome = Math.max(
    0,
    monthlyIncome - socialInsurance - specialDeduction - 5_000
  );
  const bracket =
    TAX_BRACKETS.find((item) => taxableIncome <= item.limit) ||
    TAX_BRACKETS[TAX_BRACKETS.length - 1];
  const tax = taxableIncome * bracket.rate - bracket.deduction;
  const payableTax = roundMoney(Math.max(0, tax));
  const afterTaxIncome = roundMoney(
    Math.max(0, monthlyIncome - socialInsurance - payableTax)
  );

  return {
    taxableIncome: roundMoney(taxableIncome),
    payableTax,
    afterTaxIncome,
  };
}

function fitOutputText(element) {
  if (!element || element.hidden || element.getClientRects().length === 0) {
    return;
  }
  element.style.removeProperty("font-size");
  const computed = getComputedStyle(element);
  let size = Number.parseFloat(computed.fontSize);
  const minimum = 12;
  const parent = element.parentElement;
  const parentWidth = Math.max(1, parent?.clientWidth || 0);
  const reservedWidth = [...(parent?.children || [])].reduce(
    (width, child) => {
      if (child === element) {
        return width;
      }
      const style = getComputedStyle(child);
      return (
        width +
        child.getBoundingClientRect().width +
        (Number.parseFloat(style.marginLeft) || 0) +
        (Number.parseFloat(style.marginRight) || 0)
      );
    },
    0
  );
  const availableWidth = Math.max(1, parentWidth - reservedWidth);
  let attempts = 0;
  while (
    (element.scrollWidth > element.clientWidth + 1 ||
      element.scrollWidth > availableWidth + 1 ||
      element.scrollHeight > element.clientHeight + 1) &&
    size > minimum &&
    attempts < 30
  ) {
    size -= 1;
    element.style.fontSize = `${size}px`;
    attempts += 1;
  }
}

function setFieldError(input, errorElement, message) {
  errorElement.textContent = message;
  errorElement.hidden = !message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
  input.closest(".frow")?.classList.toggle("err", Boolean(message));
}

export class FinanceCalculator {
  constructor({ onCode, onModeChange }) {
    this.onCode = onCode;
    this.onModeChange = onModeChange;
    this.repayment = "equal-payment";
    this.busy = false;
    this.entryReady = false;
    this.authenticated = false;
    this.codeEligible = true;
    this.firstUseHintAfter = 0;

    this.elements = {
      mortgageForm: document.querySelector("#mortgage-form"),
      mortgagePanel: document.querySelector("#mortgage-panel"),
      mortgageTab: document.querySelector('[data-finance-mode="mortgage"]'),
      taxPanel: document.querySelector("#tax-panel"),
      taxTab: document.querySelector('[data-finance-mode="tax"]'),
      calcTitle: document.querySelector("#calc-title"),
      loanAmount: document.querySelector("#loan-amount"),
      loanError: document.querySelector("#loan-amount-error"),
      years: document.querySelector("#loan-years"),
      yearsError: document.querySelector("#loan-years-error"),
      rate: document.querySelector("#loan-rate"),
      rateError: document.querySelector("#loan-rate-error"),
      repaymentButtons: document.querySelectorAll("[data-repayment]"),
      mortgageSubmit: document.querySelector("#mortgage-submit"),
      mortgageResult: document.querySelector("#mortgage-result"),
      resultTerm: document.querySelector("#result-term"),
      resultMonthlyLabel: document.querySelector("#result-monthly-label"),
      resultMonthly: document.querySelector("#result-monthly"),
      resultDecreaseRow: document.querySelector("#result-decrease-row"),
      resultDecrease: document.querySelector("#result-decrease"),
      resultInterest: document.querySelector("#result-interest"),
      resultTotal: document.querySelector("#result-total"),
      resultSummary: document.querySelector("#result-summary"),
      setupHint: document.querySelector("#setup-hint"),
      taxForm: document.querySelector("#tax-form"),
      taxIncome: document.querySelector("#tax-income"),
      taxIncomeError: document.querySelector("#tax-income-error"),
      taxInsurance: document.querySelector("#tax-insurance"),
      taxInsuranceError: document.querySelector("#tax-insurance-error"),
      taxDeduction: document.querySelector("#tax-deduction"),
      taxDeductionError: document.querySelector("#tax-deduction-error"),
      taxSubmit: document.querySelector("#tax-submit"),
      taxResult: document.querySelector("#tax-result"),
      taxTaxable: document.querySelector("#tax-taxable"),
      taxPayable: document.querySelector("#tax-payable"),
      taxAfterIncome: document.querySelector("#tax-after-income"),
    };
    this.defaultSetupHint = this.elements.setupHint.textContent;

    this.bind();
    this.updateRepaymentButtons();
    this.updateSubmitState();
  }

  bind() {
    for (const modeButton of document.querySelectorAll("[data-finance-mode]")) {
      modeButton.addEventListener("click", () => {
        this.setMode(modeButton.dataset.financeMode);
      });
    }

    for (const input of document.querySelectorAll("[data-decimal-input]")) {
      input.addEventListener("input", () => {
        const rawValue = input.value;
        if (input === this.elements.loanAmount) {
          if (rawValue === "") {
            this.codeEligible = true;
          } else if (/[^0-9]/.test(rawValue)) {
            this.codeEligible = false;
          }
        }
        const cursorAtEnd =
          input.selectionStart === rawValue.length ||
          input.selectionStart === null;
        input.value = sanitizeDecimal(rawValue);
        if (
          input === this.elements.loanAmount &&
          input.value === ""
        ) {
          this.codeEligible = true;
        }
        if (cursorAtEnd) {
          input.setSelectionRange(input.value.length, input.value.length);
        }
      });
    }

    this.elements.years.addEventListener("input", () => {
      this.elements.years.value = this.elements.years.value
        .replace(/\D/g, "")
        .slice(0, 2);
    });

    this.elements.rate.addEventListener("input", () => {
      this.elements.rate.value = this.elements.rate.value
        .replace(/[^\d.]/g, "")
        .replace(/(\..*)\./g, "$1")
        .replace(/^(\d{2})\d+/, "$1")
        .replace(/(\.\d{2})\d+/, "$1")
        .slice(0, 5);
    });

    for (const button of this.elements.repaymentButtons) {
      button.addEventListener("click", () => {
        this.repayment = button.dataset.repayment;
        this.updateRepaymentButtons();
      });
    }

    this.elements.mortgageForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.submitMortgage();
    });
    this.elements.taxForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.submitTax();
    });

    window.addEventListener("resize", () => {
      this.fitResults();
    });
  }

  setMode(mode) {
    if (mode !== "mortgage" && mode !== "tax") {
      return;
    }
    const isMortgage = mode === "mortgage";
    this.elements.mortgagePanel.hidden = !isMortgage;
    this.elements.taxPanel.hidden = isMortgage;
    this.elements.mortgageTab.setAttribute(
      "aria-selected",
      String(isMortgage)
    );
    this.elements.taxTab.setAttribute("aria-selected", String(!isMortgage));
    this.elements.mortgageTab.classList.toggle("is-active", isMortgage);
    this.elements.mortgageTab.classList.toggle("on", isMortgage);
    this.elements.taxTab.classList.toggle("is-active", !isMortgage);
    this.elements.taxTab.classList.toggle("on", !isMortgage);
    if (this.elements.calcTitle) {
      this.elements.calcTitle.textContent = isMortgage
        ? "房贷计算"
        : "个税计算";
    }
    requestAnimationFrame(() => this.fitResults());
    if (typeof this.onModeChange === "function") {
      this.onModeChange(mode);
    }
  }

  updateRepaymentButtons() {
    for (const button of this.elements.repaymentButtons) {
      const selected = button.dataset.repayment === this.repayment;
      button.classList.toggle("is-active", selected);
      button.classList.toggle("on", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  }

  setAuthenticated(authenticated) {
    this.authenticated = authenticated;
    if (authenticated) {
      this.setSetupHint("");
    }
  }

  setSetupHint(message) {
    this.elements.setupHint.textContent = message;
    this.elements.setupHint.hidden = !message;
  }

  setEntryReady(ready) {
    this.entryReady = Boolean(ready);
    this.updateSubmitState();
  }

  deferFirstUseHint(duration = 120_000) {
    this.firstUseHintAfter = Date.now() + Math.max(0, duration);
  }

  updateSubmitState() {
    this.elements.mortgageSubmit.disabled = !this.entryReady || this.busy;
  }

  setBusy(busy) {
    this.busy = busy;
    this.elements.mortgageSubmit.textContent = busy ? "正在计算…" : "计算";
    this.updateSubmitState();
  }

  setTaxBusy(busy) {
    this.elements.taxSubmit.disabled = busy;
    this.elements.taxSubmit.textContent = busy ? "正在计算…" : "计算";
  }

  clearLoanInput() {
    this.elements.loanAmount.value = "";
    this.codeEligible = true;
  }

  focusLoanInput() {
    this.elements.loanAmount.focus();
  }

  async submitMortgage() {
    if (this.busy) {
      return;
    }

    const startedAt = Date.now();
    this.setBusy(true);
    try {
      const candidate = this.elements.loanAmount.value.trim();
      if (
        this.codeEligible &&
        /^\d{4,8}$/.test(candidate) &&
        typeof this.onCode === "function"
      ) {
        let opened = false;
        try {
          opened = await this.onCode(candidate);
        } catch (error) {
          console.error("本机校验失败", error);
        }
        if (opened) {
          this.elements.mortgageResult.hidden = true;
          this.clearLoanInput();
          return;
        }
      }

      if (
        !this.authenticated &&
        Date.now() >= this.firstUseHintAfter
      ) {
        this.setSetupHint(this.defaultSetupHint);
      }
      this.elements.mortgageResult.hidden = true;

      const loanAmount = parseAmount(candidate);
      if (loanAmount === null) {
        setFieldError(
          this.elements.loanAmount,
          this.elements.loanError,
          "请输入贷款金额"
        );
        return;
      }
      if (loanAmount <= 0) {
        setFieldError(
          this.elements.loanAmount,
          this.elements.loanError,
          "贷款金额应大于 0"
        );
        return;
      }
      setFieldError(this.elements.loanAmount, this.elements.loanError, "");

      const years = Number(this.elements.years.value);
      if (
        !/^\d{1,2}$/.test(this.elements.years.value) ||
        !Number.isInteger(years) ||
        years < 1 ||
        years > 30
      ) {
        setFieldError(
          this.elements.years,
          this.elements.yearsError,
          "请输入 1–30 年"
        );
        return;
      }
      setFieldError(this.elements.years, this.elements.yearsError, "");

      const rate = parseAmount(this.elements.rate.value);
      if (rate === null || rate < 0 || rate > 100) {
        setFieldError(
          this.elements.rate,
          this.elements.rateError,
          "请输入 0–100 的利率"
        );
        return;
      }
      setFieldError(this.elements.rate, this.elements.rateError, "");

      try {
        const result = calculateMortgage({
          principalYuan: loanAmount,
          years,
          annualRatePercent: rate,
          repayment: this.repayment,
        });
        const isEqualPrincipal = this.repayment === "equal-principal";
        this.elements.resultTerm.textContent = `${
          isEqualPrincipal ? "等额本金" : "等额本息"
        } · ${result.months} 期`;
        this.elements.resultMonthlyLabel.textContent = isEqualPrincipal
          ? "首月月供"
          : "每月月供";
        this.elements.resultMonthly.textContent = formatMoney(
          result.firstPayment
        );
        this.elements.resultDecreaseRow.hidden = !isEqualPrincipal;
        this.elements.resultDecrease.textContent = isEqualPrincipal
          ? formatMoney(result.monthlyDecrease)
          : "—";
        this.elements.resultInterest.textContent = formatMoney(
          result.totalInterest
        );
        this.elements.resultTotal.textContent = formatMoney(
          result.totalPayment
        );
        this.elements.resultSummary.textContent = `贷款本金 ${formatPrincipal(
          loanAmount
        )} 元`;
        this.elements.mortgageResult.hidden = false;
        requestAnimationFrame(() => this.fitResults());
      } catch (error) {
        console.error("房贷计算失败", error);
        setFieldError(
          this.elements.loanAmount,
          this.elements.loanError,
          "输入金额超出可计算范围"
        );
      }
    } finally {
      const remaining =
        MIN_CALCULATION_FEEDBACK_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      }
      this.setBusy(false);
    }
  }

  async submitTax() {
    const startedAt = Date.now();
    this.setTaxBusy(true);
    try {
      const income = parseAmount(this.elements.taxIncome.value);
      if (income === null || income < 0) {
        setFieldError(
          this.elements.taxIncome,
          this.elements.taxIncomeError,
          "请输入月收入"
        );
        this.elements.taxResult.hidden = true;
        return;
      }
      setFieldError(this.elements.taxIncome, this.elements.taxIncomeError, "");

      const insurance = parseAmount(this.elements.taxInsurance.value || "0");
      if (insurance === null || insurance < 0) {
        setFieldError(
          this.elements.taxInsurance,
          this.elements.taxInsuranceError,
          "请输入有效的五险一金金额"
        );
        this.elements.taxResult.hidden = true;
        return;
      }
      setFieldError(
        this.elements.taxInsurance,
        this.elements.taxInsuranceError,
        ""
      );

      const deduction = parseAmount(this.elements.taxDeduction.value || "0");
      if (deduction === null || deduction < 0) {
        setFieldError(
          this.elements.taxDeduction,
          this.elements.taxDeductionError,
          "请输入有效的专项附加扣除"
        );
        this.elements.taxResult.hidden = true;
        return;
      }
      setFieldError(
        this.elements.taxDeduction,
        this.elements.taxDeductionError,
        ""
      );

      const result = calculateIncomeTax({
        monthlyIncome: income,
        socialInsurance: insurance,
        specialDeduction: deduction,
      });
      this.elements.taxTaxable.textContent = formatMoney(result.taxableIncome);
      this.elements.taxPayable.textContent = formatMoney(result.payableTax);
      this.elements.taxAfterIncome.textContent = formatMoney(
        result.afterTaxIncome
      );
      this.elements.taxResult.hidden = false;
      requestAnimationFrame(() => this.fitResults());
    } finally {
      const remaining =
        MIN_CALCULATION_FEEDBACK_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      }
      this.setTaxBusy(false);
    }
  }

  fitResults() {
    for (const output of document.querySelectorAll(".fit-output")) {
      fitOutputText(output);
    }
  }
}
