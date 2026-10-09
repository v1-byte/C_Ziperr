/**
 * Size capture budget from the runner's currently available resources.
 * This is intentionally not a per-file cap: physical memory, disk, the
 * execution deadline, and artifact-provider limits remain the real ceiling.
 */
export function calculateCaptureBudget({
  availableMemoryBytes,
  availableDiskBytes,
  largeCapture = false
} = {}) {
  const memory = Number(availableMemoryBytes);
  if (!Number.isFinite(memory) || memory <= 0) return 0;

  const disk = availableDiskBytes == null ? Number.POSITIVE_INFINITY : Number(availableDiskBytes);
  if (Number.isNaN(disk) || disk < 0) return 0;

  // Reserve headroom for Chromium, browser responses, ZIP compression, and
  // the final ZIP buffer. Large-capture mode allocates more of the runner,
  // while still leaving room for packaging and upload.
  const memoryShare = largeCapture ? 0.36 : 0.22;
  const diskShare = largeCapture ? 0.72 : 0.45;
  return Math.max(0, Math.floor(Math.min(memory * memoryShare, disk * diskShare)));
}
