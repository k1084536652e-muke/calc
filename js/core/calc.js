/**
 * 伪装计算器的数学部分（纯函数，无 DOM 依赖，可在 Node 中直接测试）。
 * 与定稿原型 / 旧版 finance.js 的算法、校验与文案口径完全一致：
 * - 房贷：等额本息（月供公式）、等额本金（首月 + 每月递减）
 * - 个税：月度七级超额累进 + 年终奖单独计税（÷12 查月度税率表）
 */

export const MAX_AMOUNT_INTEGER_DIGITS = 9;
export const MAX_AMOUNT_DECIMAL_DIGITS = 2;

const MONEY_FORMATTER = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

export const TAX_BRACKETS = [
  { limit: 3000, rate: 0.03, deduction: 0 },
  { limit: 12000, rate: 0.1, deduction: 210 },
  { limit: 25000, rate: 0.2, deduction: 1410 },
  { limit: 35000, rate: 0.25, deduction: 2660 },
  { limit: 55000, rate: 0.3, deduction: 4410 },
  { limit: 80000, rate: 0.35, deduction: 7160 },
  { limit: Number.POSITIVE_INFINITY, rate: 0.45, deduction: 15160 },
];

export function roundMoney(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function validDecimalText(v) {
  return /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(v);
}

export function sanitizeDecimal(value) {
  const cleaned = String(value).replace(/[^\d.]/g, "");
  const [integerPart = "", ...decimalParts] = cleaned.split(".");
  const integer = integerPart.slice(0, MAX_AMOUNT_INTEGER_DIGITS);
  if (decimalParts.length === 0) return integer;
  return `${integer}.${decimalParts.join("").slice(0, MAX_AMOUNT_DECIMAL_DIGITS)}`;
}

export function parseAmount(value) {
  const normalized = String(value).trim();
  if (!validDecimalText(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export function fmt(v) {
  return Number.isFinite(v) ? MONEY_FORMATTER.format(roundMoney(Math.max(0, v))) : "—";
}

/** 房贷：等额本息 / 等额本金 */
export function calculateMortgage({ principalYuan, years, annualRatePercent, repayment }) {
  const months = Math.round(years * 12);
  if (
    !Number.isFinite(principalYuan) || principalYuan <= 0 ||
    !Number.isFinite(months) || months <= 0 ||
    !Number.isFinite(annualRatePercent) || annualRatePercent < 0
  ) {
    throw new RangeError("贷款参数无效");
  }
  const monthlyRate = annualRatePercent / 100 / 12;
  const basePrincipalPayment = principalYuan / months;
  let firstPayment, monthlyDecrease = 0, totalInterest, totalPayment;
  if (repayment === "equal-principal") {
    firstPayment = basePrincipalPayment + principalYuan * monthlyRate;
    monthlyDecrease = basePrincipalPayment * monthlyRate;
    totalInterest = principalYuan * monthlyRate * ((months + 1) / 2);
    totalPayment = principalYuan + totalInterest;
  } else {
    if (monthlyRate === 0) firstPayment = basePrincipalPayment;
    else {
      const factor = (1 + monthlyRate) ** months;
      firstPayment = (principalYuan * monthlyRate * factor) / (factor - 1);
    }
    totalPayment = firstPayment * months;
    totalInterest = totalPayment - principalYuan;
  }
  if (![firstPayment, monthlyDecrease, totalInterest, totalPayment].every(Number.isFinite)) {
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

/** 个税：月度工资 + 年终奖单独计税（§61） */
export function calculateIncomeTax({ monthlyIncome, socialInsurance, specialDeduction, yearEndBonus = 0 }) {
  if (
    ![monthlyIncome, socialInsurance, specialDeduction, yearEndBonus].every(Number.isFinite) ||
    monthlyIncome < 0 || socialInsurance < 0 || specialDeduction < 0 || yearEndBonus < 0
  ) {
    throw new RangeError("收入参数无效");
  }
  const taxableIncome = Math.max(0, monthlyIncome - socialInsurance - specialDeduction - 5000);
  const bracket = TAX_BRACKETS.find((item) => taxableIncome <= item.limit) || TAX_BRACKETS[TAX_BRACKETS.length - 1];
  const tax = taxableIncome * bracket.rate - bracket.deduction;
  const payableTax = roundMoney(Math.max(0, tax));
  const afterTaxIncome = roundMoney(Math.max(0, monthlyIncome - socialInsurance - payableTax));
  const bonusBracket = TAX_BRACKETS.find((item) => yearEndBonus / 12 <= item.limit) || TAX_BRACKETS[TAX_BRACKETS.length - 1];
  const bonusTax = roundMoney(Math.max(0, yearEndBonus * bonusBracket.rate - bonusBracket.deduction));
  const bonusAfterTax = roundMoney(Math.max(0, yearEndBonus - bonusTax));
  return { taxableIncome: roundMoney(taxableIncome), payableTax, afterTaxIncome, bonusTax, bonusAfterTax };
}
