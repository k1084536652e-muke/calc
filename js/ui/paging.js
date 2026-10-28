export const INCREMENTAL_BATCH_SIZE = 30;

export function initialBatchSize(total) {
  const count = Math.max(0, Math.floor(Number(total) || 0));
  return Math.min(INCREMENTAL_BATCH_SIZE, count);
}

export function renderBatchSize(total, previouslyRendered = 0) {
  const count = Math.max(0, Math.floor(Number(total) || 0));
  const retained = Math.max(
    0,
    Math.floor(Number(previouslyRendered) || 0)
  );
  return Math.min(count, Math.max(initialBatchSize(count), retained));
}

export function nextBatchWindow(
  total,
  loaded,
  batchSize = INCREMENTAL_BATCH_SIZE
) {
  const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
  const safeLoaded = Math.max(0, Math.floor(Number(loaded) || 0));
  const safeBatchSize = Math.max(1, Math.floor(Number(batchSize) || 1));
  const start = Math.min(safeLoaded, safeTotal);
  const end = Math.min(safeTotal, start + safeBatchSize);
  return {
    start,
    end,
    count: end - start,
    loaded: end,
    hasMore: end < safeTotal,
    complete: end >= safeTotal,
  };
}
