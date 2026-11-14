export const MAX_TRANSFER_RATE = 1024 ** 3

// Bytes per second; zero keeps the original unlimited path.
export function normalizeTransferRate(value) {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    (value !== 0 && (value < 1024 || value > MAX_TRANSFER_RATE))
  ) {
    throw new TypeError('请选择不限速，或设置 1 KB/s–1024 MB/s 之间的速度')
  }
  return value
}
