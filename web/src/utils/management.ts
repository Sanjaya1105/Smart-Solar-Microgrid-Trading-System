export const message = (error: unknown) =>
  error instanceof Error ? error.message : "Request failed. Please try again.";

export const localDate = (value: string) => {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
