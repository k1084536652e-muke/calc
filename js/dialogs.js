const activeDialogs = new Set();
const activeToasts = new Set();
let dialogSequence = 0;
let toastSequence = 0;

function getLayer() {
  let layer = document.querySelector("#ui-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "ui-layer";
    layer.className = "ui-layer";
    document.body.append(layer);
  }
  return layer;
}

function nextId(prefix) {
  dialogSequence += 1;
  return `${prefix}-${dialogSequence}`;
}

function lockPageScroll(locked) {
  document.body.classList.toggle("ui-scroll-locked", locked);
}

function removeDialog(dialog) {
  activeDialogs.delete(dialog);
  dialog.element.classList.add("closing");
  window.setTimeout(() => {
    dialog.element.remove();
    lockPageScroll(activeDialogs.size > 0);
  }, 150);
}

function closeDialog(dialog) {
  if (dialog.closed) {
    return;
  }
  dialog.closed = true;
  window.removeEventListener("keydown", dialog.onKeyDown, true);
  removeDialog(dialog);
  dialog.resolve(dialog.cancelValue);
}

function focusableElements(container) {
  return [
    ...container.querySelectorAll(
      'button:not([disabled]):not([hidden]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ),
  ];
}

function createDialog({
  kind,
  title,
  message,
  confirmText = "确定",
  cancelText = "取消",
  danger = false,
  input,
  choices,
  cancelValue,
}) {
  const layer = getLayer();
  const titleId = nextId("dialog-title");
  const messageId = nextId("dialog-message");
  const errorId = nextId("dialog-error");
  const element = document.createElement("div");
  element.className = "dlg-back";
  element.innerHTML = `
    <section class="dlg" role="${kind === "alert" ? "alertdialog" : "dialog"}" aria-modal="true">
      <h4></h4>
      <p></p>
      <div class="din-wrap" hidden>
        <label class="din">
          <input autocomplete="off">
          <span class="din-suffix"></span>
        </label>
        <p class="derr" role="status" aria-live="polite"></p>
      </div>
      <div class="dbtns"></div>
    </section>
  `;

  const sheet = element.querySelector(".dlg");
  const heading = element.querySelector("h4");
  const messageElement = element.querySelector("p");
  const inputWrap = element.querySelector(".din-wrap");
  const inputLabel = element.querySelector(".din");
  const inputElement = element.querySelector(".din input");
  const suffixElement = element.querySelector(".din-suffix");
  const inputError = element.querySelector(".derr");
  const actions = element.querySelector(".dbtns");
  const cancelButton = document.createElement("button");
  const confirmButton = document.createElement("button");
  const choiceButtons = [];
  cancelButton.type = "button";
  confirmButton.type = "button";
  cancelButton.className = "dcancel";
  confirmButton.className = "dconfirm";
  confirmButton.classList.toggle("danger", danger);

  sheet.setAttribute("aria-labelledby", titleId);
  heading.id = titleId;
  heading.textContent = title;
  messageElement.id = messageId;
  messageElement.textContent = message;
  if (message) {
    sheet.setAttribute("aria-describedby", messageId);
  } else {
    messageElement.hidden = true;
  }

  if (Array.isArray(choices) && choices.length > 0) {
    actions.classList.add("choices");
    for (const choice of choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dchoice";
      button.classList.toggle("danger", choice.danger === true);
      button.textContent = choice.label;
      actions.append(button);
      choiceButtons.push({ button, value: choice.value });
    }
    actions.append(cancelButton);
  } else {
    actions.append(cancelButton, confirmButton);
  }
  cancelButton.textContent = cancelText;
  confirmButton.textContent = confirmText;
  cancelButton.hidden = kind === "alert";
  actions.classList.toggle("alert", kind === "alert");
  actions.classList.toggle(
    "single",
    kind === "alert" || choiceButtons.length === 1
  );

  if (input) {
    inputWrap.hidden = false;
    inputElement.type = input.type || "text";
    inputElement.placeholder = input.placeholder || "";
    inputElement.value = input.defaultValue || "";
    inputElement.maxLength = input.maxLength || 120;
    inputElement.setAttribute("aria-label", input.label || title);
    inputElement.setAttribute("aria-describedby", errorId);
    inputError.id = errorId;
    if (input.inputMode) {
      inputElement.inputMode = input.inputMode;
    }
    if (input.pattern) {
      inputElement.pattern = input.pattern;
    }
    inputLabel.classList.toggle("has-suffix", Boolean(input.suffix));
    suffixElement.textContent = input.suffix || "";
    suffixElement.hidden = !input.suffix;
  } else {
    sheet.classList.add("noinput");
  }

  layer.append(element);
  lockPageScroll(true);
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => element.classList.add("show"));
  });

  return new Promise((resolve) => {
    const dialog = {
      element,
      resolve,
      cancelValue,
      closed: false,
      onKeyDown: null,
    };
    activeDialogs.add(dialog);

    const finish = (value) => {
      if (dialog.closed) {
        return;
      }
      dialog.closed = true;
      window.removeEventListener("keydown", dialog.onKeyDown, true);
      removeDialog(dialog);
      resolve(value);
    };

    const acceptAction = () => {
      if (dialog.closed) {
        return;
      }
      if (input && input.validate) {
        const error = input.validate(inputElement.value);
        if (error) {
          inputError.textContent = error;
          inputElement.focus();
          return;
        }
      }
      finish(input ? inputElement.value : true);
    };

    const cancelAction = () => closeDialog(dialog);
    dialog.onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelAction();
        return;
      }
      if (event.key === "Enter" && input && event.target === inputElement) {
        event.preventDefault();
        acceptAction();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const focusable = focusableElements(sheet);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    confirmButton.addEventListener("click", acceptAction);
    cancelButton.addEventListener("click", cancelAction);
    for (const choice of choiceButtons) {
      choice.button.addEventListener("click", () => finish(choice.value));
    }
    element.addEventListener("click", (event) => {
      if (event.target === element && kind !== "alert") {
        cancelAction();
      }
    });
    window.addEventListener("keydown", dialog.onKeyDown, true);

    window.setTimeout(() => {
      if (input) {
        inputElement.focus();
        inputElement.select();
      } else {
        (choiceButtons[0]?.button || confirmButton).focus();
      }
    }, 30);
  });
}

export function showConfirm(message, options = {}) {
  return createDialog({
    kind: "confirm",
    title: options.title || "请确认",
    message,
    confirmText: options.confirmText || "确定",
    cancelText: options.cancelText || "取消",
    danger: options.danger === true,
    cancelValue: false,
  });
}

export function showAlert(message, options = {}) {
  return createDialog({
    kind: "alert",
    title: options.title || "提示",
    message,
    confirmText: options.okText || "确定",
    cancelValue: undefined,
  });
}

export function showPrompt(message, options = {}) {
  return createDialog({
    kind: "prompt",
    title: options.title || "请输入",
    message,
    confirmText: options.confirmText || "确定",
    cancelText: options.cancelText || "取消",
    cancelValue: null,
    input: {
      type: options.inputType || "text",
      placeholder: options.placeholder || "",
      defaultValue: options.defaultValue || "",
      maxLength: options.maxLength || 120,
      inputMode: options.inputMode,
      pattern: options.pattern,
      label: options.inputLabel,
      suffix: options.suffix || "",
      validate: options.validate,
    },
  });
}

export function showChoice(message, options = {}) {
  return createDialog({
    kind: "choice",
    title: options.title || "请选择",
    message,
    choices: options.choices || [],
    cancelText: options.cancelText || "取消",
    cancelValue: null,
  });
}

export function showToast(message, options = {}) {
  const layer = getLayer();
  for (const toast of [...activeToasts]) {
    toast.hide();
  }

  const element = document.createElement("div");
  element.className = "toast";
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  const copy = document.createElement("span");
  copy.textContent = message;
  element.append(copy);
  element.classList.toggle(
    "has-action",
    Boolean(options.actionLabel && options.onAction)
  );
  layer.append(element);

  const duration = Number.isFinite(options.duration) ? options.duration : 2_000;
  let timer = 0;
  let hidden = false;
  let removeTimer = 0;
  const toastController = { hide: null };
  const hide = () => {
    if (hidden) {
      return;
    }
    hidden = true;
    activeToasts.delete(toastController);
    window.clearTimeout(timer);
    element.classList.remove("show");
    removeTimer = window.setTimeout(() => element.remove(), 220);
  };
  toastController.hide = hide;
  activeToasts.add(toastController);

  if (options.actionLabel && typeof options.onAction === "function") {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "toast-action";
    action.textContent = options.actionLabel;
    action.addEventListener("click", () => {
      if (hidden) {
        return;
      }
      hide();
      options.onAction();
    });
    element.append(action);
  }

  const token = ++toastSequence;
  element.dataset.toastToken = String(token);
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (element.isConnected) {
        element.classList.add("show");
      }
    });
  });
  if (duration > 0) {
    timer = window.setTimeout(hide, duration);
  }
  toastController.cleanupTimer = removeTimer;
  return toastController;
}

export function closeAllDialogs() {
  for (const dialog of [...activeDialogs]) {
    closeDialog(dialog);
  }
  for (const toast of [...activeToasts]) {
    toast.hide();
  }
}
