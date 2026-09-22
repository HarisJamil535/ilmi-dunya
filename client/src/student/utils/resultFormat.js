export const formatDuration = (value = 0) => {
  const seconds = Math.max(0, Math.round(Number(value) || 0));
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
};

export const formatScore = (value = 0) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
