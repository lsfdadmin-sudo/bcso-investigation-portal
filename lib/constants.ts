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
];

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

export function evidenceCategoryLabel(category: EvidenceCategory) {
  return EVIDENCE_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}
