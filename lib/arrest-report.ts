/** Backdraft CAD arrest report numbers: `RPT-` plus the report code. */
export const ARREST_REPORT_PATTERN = /^RPT-[A-Z0-9-]+$/i;

const ARREST_REPORT_MAX = 40;

export function normalizeArrestReport(value: string) {
  const compact = value.trim().toUpperCase().replace(/\s+/g, "");
  if (!compact) return "";
  if (compact.startsWith("RPT-")) return compact;
  if (compact.startsWith("RPT")) {
    const rest = compact.slice(3).replace(/^-+/, "");
    return rest ? `RPT-${rest}` : "RPT-";
  }
  if (/^[0-9-]+$/.test(compact) && /[0-9]/.test(compact)) {
    return `RPT-${compact.replace(/^-+/, "")}`;
  }
  return compact;
}

export function arrestReportError(value: string) {
  const report = normalizeArrestReport(value);
  if (!report) return "Backdraft CAD arrest report number is required.";
  if (report.length > ARREST_REPORT_MAX) {
    return "Backdraft CAD arrest report number must be 40 characters or fewer.";
  }
  if (!report.startsWith("RPT-") || !ARREST_REPORT_PATTERN.test(report)) {
    return "Backdraft CAD arrest report numbers must start with RPT-.";
  }
  return null;
}
