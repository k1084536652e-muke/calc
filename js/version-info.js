if (!globalThis.CALC_VERSION) {
  throw new Error("CALC_VERSION 未初始化");
}

export const APP_VERSION = globalThis.CALC_VERSION.app;
export const DATA_SCHEMA_VERSION = globalThis.CALC_VERSION.dataSchema;
