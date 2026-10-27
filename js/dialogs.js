const activeDialogs = new Set();
const activeToasts = new Set();
let dialogSequence = 0;

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

function currentTheme() {
  return document.body.classList.contains("panel-open") ? "panel" : "finance";
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
  dialog.element.classList.add("is-leaving");
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
  theme = currentTheme(),
}) {
  const layer = getLayer();
  const titleId = nextId("dialog-title");
  const messageId = nextId("dialog-message");
  const element = document.createElement("div");
  element.className = "ui-dialog-backdrop";
  element.dataset.theme = theme;
  element.innerHTML = `
    <section class="ui-dialog" role="dialog" aria-modal="true">
      <div class="ui-dialog-heading">
        <p class="ui-dialog-kicker">${kind === "alert" ? "提示" : "确认操作"}</p>
        <h2></h2>
      </div>
      <p class="ui-dialog-message"></p>
      <div class="ui-dialog-input-wrap" hidden>
        <input class="ui-dialog-input" autocomplete="off">
        <p class="ui-dialog-error" role="status" aria-live="polite"></p>
      </div>
      <div class="ui-dialog-actions"></div>
    </section>
  `;

  const sheet = element.querySelector(".ui-dialog");
  const heading = element.querySelector("h2");
  const messageElement = element.querySelector(".ui-dialog-message");
  const inputWrap = element.querySelector(".ui-dialog-input-wrap");
  const inputElement = element.querySelector(".ui-dialog-input");
  const inputError = element.querySelector(".ui-dialog-error");
  const actions = element.querySelector(".ui-dialog-actions");
  const cancelButton = document.createElement("button");
  const confirmButton = document.createElement("button");
  cancelButton.type = "button";
  confirmButton.type = "button";
  cancelButton.className = "ui-dialog-button ui-dialog-cancel";
  confirmButton.className = "ui-dialog-button ui-dialog-confirm";
  const choiceButtons = [];
  if (Array.isArray(choices) && choices.length > 0) {
    actions.classList.add("is-choices");
    for (const choice of choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ui-dialog-button ui-dialog-choice";
      button.classList.toggle("is-danger", choice.danger === true);
      button.textContent = choice.label;
      button.dataset.choiceValue = choice.value;
      actions.append(button);
      choiceButtons.push({ button, value: choice.value });
    }
    actions.append(cancelButton);
  } else {
    actions.append(cancelButton, confirmButton);
  }

  sheet.setAttribute("aria-labelledby", titleId);
  sheet.setAttribute("aria-describedby", messageId);
  heading.id = titleId;
  heading.textContent = title;
  messageElement.id = messageId;
  messageElement.textContent = message;
  confirmButton.textContent = confirmText;
  confirmButton.classList.toggle("is-danger", danger);
  cancelButton.textContent = cancelText;
  cancelButton.hidden = kind === "alert";
  actions.classList.toggle("is-alert", kind === "alert");

  if (input) {
    inputWrap.hidden = false;
    inputElement.type = input.type || "text";
    inputElement.placeholder = input.placeholder || "";
    inputElement.value = input.defaultValue || "";
    inputElement.maxLength = input.maxLength || 120;
    inputElement.setAttribute("aria-label", input.label || title);
    if (input.inputMode) {
      inputElement.inputMode = input.inputMode;
    }
  }

  layer.append(element);
  lockPageScroll(true);

  return new Promise((resolve) => {
    const dialog = {
      element,
      resolve,
      cancelValue,
      closed: false,
      onKeyDown: null,
    };
    activeDialogs.add(dialog);

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
      dialog.closed = true;
      window.removeEventListener("keydown", dialog.onKeyDown, true);
      removeDialog(dialog);
      resolve(input ? inputElement.value : true);
    };

    const cancelAction = () => closeDialog(dialog);
    dialog.onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelAction();
      } else if (event.key === "Enter" && input && event.target === inputElement) {
        event.preventDefault();
        acceptAction();
      }
    };

    confirmButton.addEventListener("click", acceptAction);
    cancelButton.addEventListener("click", cancelAction);
    for (const choice of choiceButtons) {
      choice.button.addEventListener("click", () => {
        if (dialog.closed) {
          return;
        }
        dialog.closed = true;
        window.removeEventListener("keydown", dialog.onKeyDown, true);
        removeDialog(dialog);
        resolve(choice.value);
      });
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
    theme: options.theme,
    cancelValue: false,
  });
}

export function showAlert(message, options = {}) {
  return createDialog({
    kind: "alert",
    title: options.title || "提示",
    message,
    confirmText: options.okText || "确定",
    theme: options.theme,
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
    theme: options.theme,
    cancelValue: null,
    input: {
      type: options.inputType || "text",
      placeholder: options.placeholder || "",
      defaultValue: options.defaultValue || "",
      maxLength: options.maxLength || 120,
      inputMode: options.inputMode,
      label: options.inputLabel,
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
    theme: options.theme,
    cancelValue: null,
  });
}

export function showToast(message, options = {}) {
  const layer = getLayer();
  const element = document.createElement("div");
  element.className = "ui-toast";
  element.dataset.theme = options.theme || currentTheme();
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

  const duration = Number.isFinite(options.duration) ? options.duration : 3_200;
  let timer = 0;
  let hidden = false;
  const toastController = { hide: null };
  const hide = () => {
    if (hidden) {
      return;
    }
    hidden = true;
    activeToasts.delete(toastController);
    window.clearTimeout(timer);
    element.classList.add("is-leaving");
    window.setTimeout(() => element.remove(), 150);
  };
  toastController.hide = hide;
  activeToasts.add(toastController);

  if (options.actionLabel && typeof options.onAction === "function") {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "ui-toast-action";
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

  if (duration > 0) {
    timer = window.setTimeout(hide, duration);
  }

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
