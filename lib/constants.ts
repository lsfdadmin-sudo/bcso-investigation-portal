import type { EvidenceCategory, SuspectStatus } from "./types";

export const INCIDENT_TYPES = [
  "Armed Robbery",
  "Narcotics",
  "Hit and Run",
  "Homicide",
  "Burglary",
  "Assault",
  "Stolen Vehicle",
  "Weapons Violation",
  "Theft",
  "Suspicious Circumstance",
] as const;

export const EVENT_TYPES = [
  "Dispatch",
  "Arrival",
  "Observation",
  "Witness",
  "Evidence",
  "Pursuit",
  "BOLO",
  "Arrest",
  "Canvass",
  "Lab Result",
  "Other",
] as const;

export const RESPONDER_ROLES = [
  "Primary",
  "Backup",
  "Supervisor",
  "Detective",
  "Traffic",
  "K9",
  "Air Unit",
] as const;

export const SUSPECT_STATUSES: { value: SuspectStatus; label: string }[] = [
  { value: "at_large", label: "At Large" },
  { value: "in_custody", label: "In Custody" },
  { value: "witness", label: "Witness" },
  { value: "person_of_interest", label: "Person of Interest" },
  { value: "victim", label: "Victim" },
];

const SUSPECT_STATUS_CLASS: Record<SuspectStatus, string> = {
  at_large: "border-status-crimson/30 bg-status-crimson/10 text-status-crimson",
  in_custody: "border-status-emerald/30 bg-status-emerald/10 text-status-emerald",
  witness: "border-signal-cyan/30 bg-signal-cyan/10 text-signal-cyan",
  person_of_interest: "border-status-amber/30 bg-status-amber/10 text-status-amber",
  victim: "border-status-steel/35 bg-status-steel/15 text-status-steel",
};

export const EVIDENCE_CATEGORIES: { value: EvidenceCategory; label: string }[] = [
  { value: "weapon", label: "Weapon" },
  { value: "vehicle", label: "Vehicle" },
  { value: "forensics", label: "Forensics" },
  { value: "document", label: "Document" },
  { value: "media", label: "Media" },
  { value: "narcotics", label: "Narcotics" },
  { value: "other", label: "Other" },
];

export const LINK_LABELS = [
  "Associated With",
  "Suspect In",
  "Fingerprints Matched",
  "Registered Owner",
  "Recovered At",
  "Possessed",
  "Fled In",
  "Witnessed",
  "Occurred At",
  "Known Associate",
  "Getaway Vehicle",
  "Chain of Custody",
] as const;

export function suspectStatusLabel(status: SuspectStatus) {
  return SUSPECT_STATUSES.find((item) => item.value === status)?.label ?? status;
}

export function suspectStatusClass(status: SuspectStatus) {
  return SUSPECT_STATUS_CLASS[status] ?? "border-white/10 bg-white/5 text-fog";
}

export function evidenceCategoryLabel(category: EvidenceCategory) {
  return EVIDENCE_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}
