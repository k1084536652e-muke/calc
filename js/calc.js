const MAX_DISPLAY_DIGITS = 15;

const OPERATOR_SYMBOLS = {
  "+": "+",
  "-": "−",
  "*": "×",
  "/": "÷",
};

function compactNumber(value) {
  if (!Number.isFinite(value)) {
    throw new RangeError("结果超出范围");
  }
  if (Object.is(value, -0)) {
    return "0";
  }

  const rounded = Number(value.toPrecision(12));
  const text = String(rounded);
  if (text.length <= 16 || text.includes("e")) {
    return text;
  }

  return rounded.toExponential(8).replace(/\.?0+e/, "e");
}

function operate(left, right, operator) {
  let result;
  switch (operator) {
    case "+":
      result = left + right;
      break;
    case "-":
      result = left - right;
      break;
    case "*":
      result = left * right;
      break;
    case "/":
      if (right === 0) {
        throw new RangeError("不能除以零");
      }
      result = left / right;
      break;
    default:
      return right;
  }

  return Number(compactNumber(result));
}

export class Calculator {
  constructor({ display, expression, keypad, calculatorView, onSecret }) {
    this.displayElement = display;
    this.expressionElement = expression;
    this.calculatorView = calculatorView;
    this.onSecret = onSecret;
    this.hasAuth = false;

    this.displayValue = "0";
    this.accumulator = null;
    this.pendingOperator = null;
    this.waitingForOperand = false;
    this.justEvaluated = false;
    this.lastOperator = null;
    this.lastOperand = null;
    this.digitSequence = "";
    this.hasError = false;
    this.busy = false;
    this.keyboardEnabled = true;
    this.hint = "";

    keypad.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) {
        return;
      }

      if (button.dataset.digit !== undefined) {
        this.inputDigit(button.dataset.digit);
      } else if (button.dataset.operator) {
        this.setOperator(button.dataset.operator);
      } else if (button.dataset.action) {
        this.handleAction(button.dataset.action);
      }
    });

    window.addEventListener("keydown", (event) => this.handleKey(event));
    this.render();
  }

  handleAction(action) {
    switch (action) {
      case "clear":
        this.clear();
        break;
      case "sign":
        this.toggleSign();
        break;
      case "percent":
        this.applyPercent();
        break;
      case "decimal":
        this.inputDecimal();
        break;
      case "equals":
        void this.equals();
        break;
      default:
        break;
    }
  }

  handleKey(event) {
    if (
      !this.keyboardEnabled ||
      this.busy ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      this.inputDigit(event.key);
      return;
    }

    const keyMap = {
      "+": () => this.setOperator("+"),
      "-": () => this.setOperator("-"),
      "*": () => this.setOperator("*"),
      "/": () => this.setOperator("/"),
      ".": () => this.inputDecimal(),
      ",": () => this.inputDecimal(),
      "%": () => this.applyPercent(),
      Enter: () => void this.equals(),
      "=": () => void this.equals(),
      Escape: () => this.clear(),
      Backspace: () => this.backspace(),
    };

    if (keyMap[event.key]) {
      event.preventDefault();
      keyMap[event.key]();
    }
  }

  inputDigit(digit) {
    if (this.busy || !/^\d$/.test(digit)) {
      return;
    }
    if (this.hasError) {
      this.clear();
    }

    if (this.justEvaluated) {
      this.resetCalculation();
      this.digitSequence = "";
      this.displayValue = "0";
      this.justEvaluated = false;
    }

    if (this.waitingForOperand) {
      this.displayValue = digit;
      this.waitingForOperand = false;
    } else if (this.displayValue === "0") {
      this.displayValue = digit;
    } else if (this.displayValue === "-0") {
      this.displayValue = `-${digit}`;
    } else {
      const digitCount = this.displayValue.replace(/[^0-9]/g, "").length;
      if (digitCount < MAX_DISPLAY_DIGITS) {
        this.displayValue += digit;
      }
    }

    this.digitSequence += digit;
    this.render();
  }

  inputDecimal() {
    if (this.busy) {
      return;
    }
    if (this.hasError) {
      this.clear();
    }
    if (this.justEvaluated) {
      this.resetCalculation();
      this.digitSequence = "";
      this.displayValue = "0";
    }

    if (this.waitingForOperand) {
      this.displayValue = "0.";
      this.waitingForOperand = false;
    } else if (!this.displayValue.includes(".")) {
      this.displayValue += ".";
    }

    this.justEvaluated = false;
    this.render();
  }

  backspace() {
    if (this.busy || this.hasError || this.waitingForOperand) {
      return;
    }

    if (this.justEvaluated) {
      this.resetCalculation();
      this.digitSequence = "";
      this.justEvaluated = false;
    }

    if (this.digitSequence.length > 0) {
      this.digitSequence = this.digitSequence.slice(0, -1);
    }

    const next = this.displayValue.slice(0, -1);
    this.displayValue = next === "" || next === "-" ? "0" : next;
    this.render();
  }

  toggleSign() {
    if (this.busy || this.hasError) {
      return;
    }

    if (this.waitingForOperand) {
      this.displayValue = "-0";
      this.waitingForOperand = false;
    } else if (this.displayValue.startsWith("-")) {
      this.displayValue = this.displayValue.slice(1);
    } else if (this.displayValue !== "0") {
      this.displayValue = `-${this.displayValue}`;
    }

    this.justEvaluated = false;
    this.render();
  }

  applyPercent() {
    if (this.busy || this.hasError) {
      return;
    }

    const current = Number(this.displayValue);
    let percentage = current / 100;
    if (
      this.accumulator !== null &&
      (this.pendingOperator === "+" || this.pendingOperator === "-")
    ) {
      percentage = (this.accumulator * current) / 100;
    }

    this.displayValue = compactNumber(percentage);
    this.waitingForOperand = false;
    this.justEvaluated = false;
    this.render();
  }

  setOperator(operator) {
    if (this.busy || this.hasError) {
      return;
    }
    if (!OPERATOR_SYMBOLS[operator]) {
      return;
    }

    if (this.accumulator === null) {
      this.accumulator = Number(this.displayValue);
    } else if (!this.waitingForOperand) {
      try {
        this.accumulator = operate(
          this.accumulator,
          Number(this.displayValue),
          this.pendingOperator
        );
        this.displayValue = compactNumber(this.accumulator);
      } catch {
        this.showError();
        return;
      }
    }

    this.pendingOperator = operator;
    this.waitingForOperand = true;
    this.justEvaluated = false;
    this.lastOperator = null;
    this.lastOperand = null;
    this.digitSequence = "";
    this.render();
  }

  async equals() {
    if (this.busy || this.hasError) {
      return;
    }

    const candidate = this.digitSequence;
    if (typeof this.onSecret === "function") {
      this.setBusy(true);
      let opened = false;
      try {
        opened = await this.onSecret(candidate);
      } catch (error) {
        console.error("解锁检查失败", error);
      } finally {
        this.setBusy(false);
      }

      if (opened) {
        this.clear();
        return;
      }
    }

    this.calculateEquals();
  }

  calculateEquals() {
    if (this.hasError) {
      return;
    }

    let expression = "";
    try {
      if (this.pendingOperator !== null && this.accumulator !== null) {
        const operand = Number(this.displayValue);
        expression = `${compactNumber(this.accumulator)} ${
          OPERATOR_SYMBOLS[this.pendingOperator]
        } ${compactNumber(operand)} =`;
        const result = operate(this.accumulator, operand, this.pendingOperator);
        this.displayValue = compactNumber(result);
        this.lastOperator = this.pendingOperator;
        this.lastOperand = operand;
        this.pendingOperator = null;
        this.accumulator = null;
      } else if (this.lastOperator && this.lastOperand !== null) {
        const left = Number(this.displayValue);
        expression = `${compactNumber(left)} ${
          OPERATOR_SYMBOLS[this.lastOperator]
        } ${compactNumber(this.lastOperand)} =`;
        this.displayValue = compactNumber(
          operate(left, this.lastOperand, this.lastOperator)
        );
      }
    } catch {
      this.showError();
      return;
    }

    this.expressionElement.textContent = expression;
    this.waitingForOperand = true;
    this.justEvaluated = true;
    this.digitSequence = "";
    this.render(false);
  }

  clear() {
    this.displayValue = "0";
    this.accumulator = null;
    this.pendingOperator = null;
    this.waitingForOperand = false;
    this.justEvaluated = false;
    this.lastOperator = null;
    this.lastOperand = null;
    this.digitSequence = "";
    this.hasError = false;
    this.expressionElement.textContent = "";
    this.render();
  }

  resetCalculation() {
    this.accumulator = null;
    this.pendingOperator = null;
    this.waitingForOperand = false;
    this.lastOperator = null;
    this.lastOperand = null;
    this.expressionElement.textContent = "";
  }

  showError() {
    this.displayValue = "错误";
    this.accumulator = null;
    this.pendingOperator = null;
    this.waitingForOperand = false;
    this.justEvaluated = false;
    this.lastOperator = null;
    this.lastOperand = null;
    this.digitSequence = "";
    this.hasError = true;
    this.render();
  }

  setBusy(busy) {
    this.busy = busy;
    this.calculatorView.classList.toggle("is-checking", busy);
  }

  setHint(message) {
    this.hint = message;
    this.render();
  }

  render(renderExpression = true) {
    this.displayElement.textContent = this.displayValue;
    this.displayElement.classList.toggle(
      "is-long",
      this.displayValue.length > 9
    );
    this.displayElement.classList.toggle(
      "is-very-long",
      this.displayValue.length > 14
    );

    if (renderExpression) {
      if (this.hint) {
        this.expressionElement.textContent = this.hint;
      } else if (this.accumulator !== null && this.pendingOperator) {
        this.expressionElement.textContent = `${compactNumber(
          this.accumulator
        )} ${OPERATOR_SYMBOLS[this.pendingOperator]}`;
      } else if (!this.justEvaluated) {
        this.expressionElement.textContent = "";
      }
    }

    for (const button of this.calculatorView.querySelectorAll(
      "[data-operator]"
    )) {
      button.classList.toggle(
        "is-active",
        button.dataset.operator === this.pendingOperator &&
          this.waitingForOperand
      );
    }
  }
}
