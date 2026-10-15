// Display helpers shared across pages.
export const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const TZ = "Africa/Lagos";
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { timeZone: TZ }) : "—");
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("en-GB", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }) : "—");

export const label = (s) => (s || "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export const availability = (t) => {
  if (t.format === "digital") return { text: "Read online", available: true };
  if (!t.total_copies) return { text: "No copies", available: false };
  const free = t.available_copies;
  return { text: free ? `${free} of ${t.total_copies} available` : `All ${t.total_copies} on loan`, available: free > 0 };
};

export const isMember = (role) => role === "student" || role === "lecturer";
export const roleHome = (role) => (isMember(role) ? "/dashboard" : "/staff");

// Plain-English wording for audit log action codes. Unknown codes fall back to "Entity verb".
const actionText = {};
export const actionLabel = (code = "") => {
  if (actionText[code]) return actionText[code];
  const [entity, ...verb] = code.split(".");
  return verb.length ? label(`${entity} ${verb.join(" ")}`.replace(/_/g, " ")) : label(code);
};
