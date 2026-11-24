import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { uploadDir } from "./paths";
import { renderStill, type StillScene } from "./stills";

type ResponderSeed = { id: string; badge: string; callsign: string; name: string; role: string };
type EventSeed = {
  id: string;
  at: string;
  badge: string;
  unit: string;
  title: string;
  type: string;
  findings: string;
};
type NodeSeed = {
  id: string;
  kind: "case" | "suspect" | "evidence" | "related";
  x: number;
  y: number;
  payload: Record<string, unknown>;
  photo?: { id: string; scene: StillScene; caption: string; stamp: string; name: string };
};
type EdgeSeed = { id: string; source: string; target: string; label: string };
type CaseSeed = {
  id: string;
  caseNumber: string;
  incidentType: string;
  location: string;
  occurredAt: string;
  narrative: string;
  status: "open" | "closed";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  closedBy: string | null;
  responders: ResponderSeed[];
  events: EventSeed[];
  nodes: NodeSeed[];
  edges: EdgeSeed[];
};

const CASES: CaseSeed[] = [
  {
    id: "case_sandy",
    caseNumber: "BCSO-26-1048",
    incidentType: "Armed Robbery",
    location: "24/7 Convenience, Algonquin Blvd & Niland Ave, Sandy Shores",
    occurredAt: "2026-11-18T10:14:00.000Z",
    createdAt: "2026-11-18T10:40:00.000Z",
    updatedAt: "2026-11-19T19:12:00.000Z",
    status: "open",
    createdBy: "221",
    closedAt: null,
    closedBy: null,
    narrative:
      "At 0214 hours on 18 November 2026, BCSO dispatch broadcast a robbery in progress at the 24/7 on Algonquin Boulevard and Niland Avenue, Sandy Shores. Clerk Jordan Hale reported two males entered the store. The lead subject displayed a short-barreled shotgun and demanded the register and the overnight drop. Hale complied. Both subjects left eastbound in a faded tan pickup. No shots were fired and no one was injured. Hale tripped the silent alarm at 0213 hours. Counter and east-lot cameras were recording.\n\nHale described the lead subject as a white male in his thirties, medium build, wearing a dark knit mask and a sun-faded work jacket. The second subject was taller, in a gray hooded sweatshirt, face covered by the hood and a bandana. A knit mask was recovered from the planter at the east edge of the lot. Latent comparison the following morning developed a candidate: Derek Lang, alias Dusty, who has a prior robbery arrest out of Sandy Shores. His sister registers a 1998 Declasse Yosemite, plate 4SND184. A sawed-off 12-gauge matching the clerk's description was later recovered from the wash behind Marina Drive.",
    responders: [
      { id: "sandy_r1", badge: "221", callsign: "2-ADAM-14", name: "Lena Ortiz", role: "Primary" },
      { id: "sandy_r2", badge: "118", callsign: "2-ADAM-12", name: "Marcus Pell", role: "Backup" },
      { id: "sandy_r3", badge: "SGT-01", callsign: "2-SAM-1", name: "Calvin Briggs", role: "Supervisor" },
    ],
    events: [
      {
        id: "sandy_ev1",
        at: "2026-11-18T10:13:00.000Z",
        badge: "DISP",
        unit: "DISPATCH",
        title: "Silent alarm and clerk call",
        type: "Dispatch",
        findings:
          "Alarm company and Jordan Hale both on the line. Two males inside, one armed with a short shotgun. Hale locked in the office after the subjects left.",
      },
      {
        id: "sandy_ev2",
        at: "2026-11-18T10:17:00.000Z",
        badge: "221",
        unit: "2-ADAM-14",
        title: "Primary on scene",
        type: "Arrival",
        findings:
          "Ortiz and Pell arrived together. Store empty of suspects. Hale uninjured. Scene held at the east doors. No casings in the lot.",
      },
      {
        id: "sandy_ev3",
        at: "2026-11-18T10:26:00.000Z",
        badge: "221",
        unit: "2-ADAM-14",
        title: "Clerk statement",
        type: "Witness",
        findings:
          "Hale walked the counter and the safe drop. Lead subject did the talking. Second subject stayed at the door and watched the lot. Demand was cash only. They fled east in a tan pickup.",
      },
      {
        id: "sandy_ev4",
        at: "2026-11-18T10:41:00.000Z",
        badge: "118",
        unit: "2-ADAM-12",
        title: "Mask recovered in the east lot",
        type: "Evidence",
        findings:
          "Dark knit mask in the planter, still warm to the touch. Photographed in place, bagged by Pell, and held for the lab. Shotgun not on scene.",
      },
      {
        id: "sandy_ev5",
        at: "2026-11-18T11:05:00.000Z",
        badge: "SGT-01",
        unit: "2-SAM-1",
        title: "BOLO for the Yosemite",
        type: "BOLO",
        findings:
          "Partial plate from the lot camera starts 4SND. County registration narrows to a 1998 Declasse Yosemite, tan, registered to Renee Lang of Marina Drive.",
      },
      {
        id: "sandy_ev6",
        at: "2026-11-19T18:40:00.000Z",
        badge: "D-08",
        unit: "DETECTIVES",
        title: "Latent candidate and weapon recovery",
        type: "Lab Result",
        findings:
          "Lab reports a usable latent inside the mask, candidate Derek Lang. A sawed-off 12-gauge was recovered the same afternoon from the wash behind Marina Drive, consistent with Hale's description.",
      },
    ],
    nodes: [
      {
        id: "sandy_root",
        kind: "case",
        x: 430,
        y: 20,
        payload: {
          caseNumber: "BCSO-26-1048",
          incidentType: "Armed Robbery",
          location: "24/7 Convenience, Algonquin Blvd & Niland Ave, Sandy Shores",
        },
      },
      {
        id: "sandy_dusty",
        kind: "suspect",
        x: 40,
        y: 220,
        payload: {
          name: "Derek Lang",
          alias: "Dusty",
          status: "at_large",
          notes:
            "Prior robbery arrest, Sandy Shores, 2024. Stays in a trailer off Marina Drive. Sister Renee Lang registers the suspect truck.",
        },
        photo: {
          id: "sandy_ph_dusty",
          scene: "silhouette",
          caption: "Derek Lang — no current booking photo",
          stamp: "BCSO-26-1048  ·  SUSPECT",
          name: "lang-id-placeholder.svg",
        },
      },
      {
        id: "sandy_unknown",
        kind: "suspect",
        x: 40,
        y: 450,
        payload: {
          name: "Unknown male",
          alias: "",
          status: "person_of_interest",
          notes: "Taller subject in a gray hoodie and bandana. Held the door. No face capture on the counter camera.",
        },
      },
      {
        id: "sandy_store",
        kind: "related",
        x: 430,
        y: 240,
        payload: {
          title: "24/7 Sandy Shores",
          location: "Algonquin Blvd & Niland Ave",
          occurredAt: "2026-11-18T10:14:00.000Z",
          notes: "Occurrence location. Clerk Jordan Hale. Silent alarm panel behind the counter.",
        },
        photo: {
          id: "sandy_ph_store",
          scene: "store",
          caption: "24/7 Sandy Shores — east elevation",
          stamp: "BCSO-26-1048  ·  18 NOV 2026",
          name: "sandy-shores-store.svg",
        },
      },
      {
        id: "sandy_mask",
        kind: "evidence",
        x: 820,
        y: 40,
        payload: {
          tag: "E-1048-01",
          category: "forensics",
          description: "Dark knit ski mask recovered from the east-lot planter.",
          custody: "Pell 118 collected at 0241. Transferred to BCSO property, locker B-14, then to the latent lab.",
          notes: "Interior latent developed. Candidate Derek Lang.",
        },
        photo: {
          id: "sandy_ph_mask",
          scene: "mask",
          caption: "E-1048-01 knit mask",
          stamp: "BCSO-26-1048  ·  EAST LOT",
          name: "knit-mask.svg",
        },
      },
      {
        id: "sandy_dvr",
        kind: "evidence",
        x: 820,
        y: 250,
        payload: {
          tag: "E-1048-02",
          category: "media",
          description: "DVR export, counter camera and east-lot camera, 0200–0230 hours.",
          custody: "Ortiz 221 pulled the export from the store office. Copy in evidence, original drive left in service.",
          notes: "Lot camera shows the tan pickup arriving at 0211 and leaving at 0215. Plate partial 4SND.",
        },
        photo: {
          id: "sandy_ph_dvr",
          scene: "monitor",
          caption: "E-1048-02 lot camera",
          stamp: "CAM 02  ·  02:14:06",
          name: "lot-camera.svg",
        },
      },
      {
        id: "sandy_gun",
        kind: "evidence",
        x: 820,
        y: 470,
        payload: {
          tag: "E-1048-03",
          category: "weapon",
          description: "Sawed-off 12-gauge recovered from the Marina Drive wash.",
          custody: "Detective D-08 located the firearm. Photographed, made safe, and booked into the armory cage.",
          notes: "Barrel length consistent with the clerk's description. No serial recovered.",
        },
        photo: {
          id: "sandy_ph_gun",
          scene: "box",
          caption: "E-1048-03 sealed firearm",
          stamp: "BCSO-26-1048  ·  ARMORY",
          name: "sealed-firearm.svg",
        },
      },
      {
        id: "sandy_truck",
        kind: "evidence",
        x: 430,
        y: 480,
        payload: {
          tag: "E-1048-04",
          category: "vehicle",
          description: "1998 Declasse Yosemite, tan, plate 4SND184.",
          custody: "Not yet located. Registration active to Renee Lang, Marina Drive, Sandy Shores.",
          notes: "Matches the getaway description and the partial plate from the lot camera.",
        },
        photo: {
          id: "sandy_ph_truck",
          scene: "truck",
          caption: "E-1048-04 registration photo",
          stamp: "PLATE 4SND184",
          name: "yosemite.svg",
        },
      },
      {
        id: "sandy_wash",
        kind: "related",
        x: 430,
        y: 710,
        payload: {
          title: "Marina Drive wash",
          location: "Behind Marina Dr, Sandy Shores",
          occurredAt: "2026-11-19T18:20:00.000Z",
          notes: "Recovery site for the shotgun. Tire tracks entering from the trailer row, not cast.",
        },
        photo: {
          id: "sandy_ph_wash",
          scene: "wash",
          caption: "Marina Drive wash",
          stamp: "BCSO-26-1048  ·  19 NOV 2026",
          name: "marina-wash.svg",
        },
      },
    ],
    edges: [
      { id: "sandy_e1", source: "sandy_root", target: "sandy_dusty", label: "Suspect In" },
      { id: "sandy_e2", source: "sandy_root", target: "sandy_unknown", label: "Suspect In" },
      { id: "sandy_e3", source: "sandy_root", target: "sandy_store", label: "Occurred At" },
      { id: "sandy_e4", source: "sandy_root", target: "sandy_mask", label: "Recovered At" },
      { id: "sandy_e5", source: "sandy_root", target: "sandy_dvr", label: "Recovered At" },
      { id: "sandy_e6", source: "sandy_root", target: "sandy_gun", label: "Recovered At" },
      { id: "sandy_e7", source: "sandy_root", target: "sandy_truck", label: "Getaway Vehicle" },
      { id: "sandy_e8", source: "sandy_mask", target: "sandy_dusty", label: "Fingerprints Matched" },
      { id: "sandy_e9", source: "sandy_truck", target: "sandy_dusty", label: "Registered Owner" },
      { id: "sandy_e10", source: "sandy_dusty", target: "sandy_gun", label: "Possessed" },
      { id: "sandy_e11", source: "sandy_gun", target: "sandy_wash", label: "Recovered At" },
      { id: "sandy_e12", source: "sandy_dvr", target: "sandy_store", label: "Recovered At" },
      { id: "sandy_e13", source: "sandy_truck", target: "sandy_unknown", label: "Fled In" },
    ],
  },
  {
    id: "case_paleto",
    caseNumber: "BCSO-26-1102",
    incidentType: "Narcotics",
    location: "Procopio Truck Stop, Great Ocean Hwy, Paleto Bay",
    occurredAt: "2026-11-21T00:40:00.000Z",
    createdAt: "2026-11-21T01:05:00.000Z",
    updatedAt: "2026-11-22T17:30:00.000Z",
    status: "open",
    createdBy: "305",
    closedAt: null,
    closedBy: null,
    narrative:
      "On 21 November 2026 at 1640 hours, Deputy Ibarra stopped a white Bravado panel van on Great Ocean Highway for a cracked right taillight at the Procopio Truck Stop. The driver, Maria Velez, was the sole occupant. A plain-smell odor was present at the driver's window. Velez gave written consent to search the cargo area.\n\nThe search located three heat-sealed bricks of a crystalline substance, a burner handset, and a notebook of cook quantities. Velez was arrested and booked at Paleto Bay. She declined to identify her supplier and referred to the person only as \"the Chemist.\" The notebook mentions a shed off Union Road in Grapeseed. That location has not been served. The van is registered to a Paleto shelf company, North Coast Haulage.",
    responders: [
      { id: "paleto_r1", badge: "305", callsign: "4-ADAM-19", name: "Rosa Ibarra", role: "Primary" },
      { id: "paleto_r2", badge: "D-14", callsign: "DETECTIVES", name: "Owen Cho", role: "Detective" },
      { id: "paleto_r3", badge: "190", callsign: "4-ADAM-7", name: "Nate Colby", role: "Backup" },
    ],
    events: [
      {
        id: "paleto_ev1",
        at: "2026-11-21T00:40:00.000Z",
        badge: "305",
        unit: "4-ADAM-19",
        title: "Traffic stop at the truck stop",
        type: "Arrival",
        findings:
          "White panel van, cracked right taillight, pulled into the truck-stop apron. Driver identified as Maria Velez from a California license. No passengers.",
      },
      {
        id: "paleto_ev2",
        at: "2026-11-21T00:48:00.000Z",
        badge: "305",
        unit: "4-ADAM-19",
        title: "Consent search",
        type: "Observation",
        findings:
          "Odor at the open window. Velez signed a consent card. Cargo area contained three sealed bricks, a phone in the door pocket, and a notebook under the passenger seat.",
      },
      {
        id: "paleto_ev3",
        at: "2026-11-21T01:10:00.000Z",
        badge: "305",
        unit: "4-ADAM-19",
        title: "Arrest and booking",
        type: "Arrest",
        findings:
          "Velez arrested for possession for sale. Advised, transported to Paleto Bay jail. Van towed to the BCSO yard under hold.",
      },
      {
        id: "paleto_ev4",
        at: "2026-11-21T18:15:00.000Z",
        badge: "D-14",
        unit: "DETECTIVES",
        title: "Notebook review",
        type: "Evidence",
        findings:
          "Quantities, a payment schedule, and a line reading \"shed off Union, Grapeseed — ask the Chemist.\" No full name. Phone is a burner with one recurring number, not yet subscribed.",
      },
      {
        id: "paleto_ev5",
        at: "2026-11-22T16:05:00.000Z",
        badge: "D-14",
        unit: "DETECTIVES",
        title: "Union Road drive-by",
        type: "Canvass",
        findings:
          "A metal shed behind a vacant parcel on Union Road matches the note. No approach. Surveillance requested before a warrant.",
      },
    ],
    nodes: [
      {
        id: "paleto_root",
        kind: "case",
        x: 420,
        y: 20,
        payload: {
          caseNumber: "BCSO-26-1102",
          incidentType: "Narcotics",
          location: "Procopio Truck Stop, Great Ocean Hwy, Paleto Bay",
        },
      },
      {
        id: "paleto_velez",
        kind: "suspect",
        x: 40,
        y: 210,
        payload: {
          name: "Maria Velez",
          alias: "",
          status: "in_custody",
          notes: "Driver and sole occupant. Booked Paleto Bay jail. Declined to name her supplier.",
        },
        photo: {
          id: "paleto_ph_velez",
          scene: "silhouette",
          caption: "Maria Velez — booking photo withheld",
          stamp: "BCSO-26-1102  ·  IN CUSTODY",
          name: "velez-booking.svg",
        },
      },
      {
        id: "paleto_chemist",
        kind: "suspect",
        x: 40,
        y: 450,
        payload: {
          name: "Unknown supplier",
          alias: "The Chemist",
          status: "at_large",
          notes: "Named only in Velez's notebook. No physical description yet. Tied to the Union Road shed.",
        },
        photo: {
          id: "paleto_ph_chemist",
          scene: "silhouette",
          caption: "Alias The Chemist — unidentified",
          stamp: "BCSO-26-1102  ·  AT LARGE",
          name: "chemist-unknown.svg",
        },
      },
      {
        id: "paleto_bricks",
        kind: "evidence",
        x: 800,
        y: 40,
        payload: {
          tag: "E-1102-01",
          category: "narcotics",
          description: "Three heat-sealed bricks of a crystalline substance from the cargo area.",
          custody: "Ibarra 305 booked the bricks into the narcotics safe. Lab weight pending.",
          notes: "Field test indicative. Full lab confirmation not back.",
        },
        photo: {
          id: "paleto_ph_bricks",
          scene: "bags",
          caption: "E-1102-01 sealed bricks",
          stamp: "BCSO-26-1102  ·  NARCOTICS SAFE",
          name: "sealed-bricks.svg",
        },
      },
      {
        id: "paleto_phone",
        kind: "evidence",
        x: 800,
        y: 260,
        payload: {
          tag: "E-1102-02",
          category: "media",
          description: "Burner handset from the driver's door pocket.",
          custody: "Cho D-14 has the handset in the digital lab. SIM imaged, handset charging log started.",
          notes: "One recurring number. Subscriber request out.",
        },
        photo: {
          id: "paleto_ph_phone",
          scene: "phone",
          caption: "E-1102-02 burner handset",
          stamp: "BCSO-26-1102  ·  DIGITAL LAB",
          name: "burner-phone.svg",
        },
      },
      {
        id: "paleto_notes",
        kind: "evidence",
        x: 800,
        y: 480,
        payload: {
          tag: "E-1102-03",
          category: "document",
          description: "Handwritten notebook of quantities and a payment schedule.",
          custody: "Photographed page by page, then bagged. Original in property.",
          notes: "References a shed off Union Road and \"the Chemist.\"",
        },
        photo: {
          id: "paleto_ph_notes",
          scene: "document",
          caption: "E-1102-03 notebook page",
          stamp: "BCSO-26-1102  ·  PROPERTY",
          name: "cook-notes.svg",
        },
      },
      {
        id: "paleto_van",
        kind: "evidence",
        x: 420,
        y: 470,
        payload: {
          tag: "E-1102-04",
          category: "vehicle",
          description: "White Bravado panel van, cracked right taillight.",
          custody: "Towed to the BCSO yard. Hold for detectives. Registered to North Coast Haulage.",
          notes: "Cargo area photographed before the tow.",
        },
        photo: {
          id: "paleto_ph_van",
          scene: "van",
          caption: "E-1102-04 panel van",
          stamp: "BCSO YARD  ·  HOLD",
          name: "panel-van.svg",
        },
      },
      {
        id: "paleto_stop",
        kind: "related",
        x: 420,
        y: 240,
        payload: {
          title: "Procopio Truck Stop",
          location: "Great Ocean Hwy, Paleto Bay",
          occurredAt: "2026-11-21T00:40:00.000Z",
          notes: "Stop location. Apron cameras requested from the truck stop manager.",
        },
        photo: {
          id: "paleto_ph_stop",
          scene: "stop",
          caption: "Procopio Truck Stop apron",
          stamp: "BCSO-26-1102  ·  21 NOV 2026",
          name: "truck-stop.svg",
        },
      },
      {
        id: "paleto_shed",
        kind: "related",
        x: 40,
        y: 690,
        payload: {
          title: "Union Road shed",
          location: "Union Rd, Grapeseed",
          occurredAt: "2026-11-22T16:05:00.000Z",
          notes: "Suspected lab. Not served. Drive-by only. Warrant in draft.",
        },
      },
    ],
    edges: [
      { id: "paleto_e1", source: "paleto_root", target: "paleto_velez", label: "Suspect In" },
      { id: "paleto_e2", source: "paleto_root", target: "paleto_chemist", label: "Suspect In" },
      { id: "paleto_e3", source: "paleto_root", target: "paleto_stop", label: "Occurred At" },
      { id: "paleto_e4", source: "paleto_root", target: "paleto_bricks", label: "Recovered At" },
      { id: "paleto_e5", source: "paleto_root", target: "paleto_phone", label: "Recovered At" },
      { id: "paleto_e6", source: "paleto_root", target: "paleto_notes", label: "Recovered At" },
      { id: "paleto_e7", source: "paleto_root", target: "paleto_van", label: "Associated With" },
      { id: "paleto_e8", source: "paleto_van", target: "paleto_velez", label: "Registered Owner" },
      { id: "paleto_e9", source: "paleto_notes", target: "paleto_chemist", label: "Associated With" },
      { id: "paleto_e10", source: "paleto_chemist", target: "paleto_shed", label: "Associated With" },
      { id: "paleto_e11", source: "paleto_bricks", target: "paleto_van", label: "Recovered At" },
      { id: "paleto_e12", source: "paleto_phone", target: "paleto_velez", label: "Possessed" },
    ],
  },
  {
    id: "case_grape",
    caseNumber: "BCSO-26-1177",
    incidentType: "Hit and Run",
    location: "Grapeseed Main St & Joad Ln, Grapeseed",
    occurredAt: "2026-11-23T03:05:00.000Z",
    createdAt: "2026-11-23T03:28:00.000Z",
    updatedAt: "2026-11-23T20:10:00.000Z",
    status: "open",
    createdBy: "412",
    closedAt: null,
    closedBy: null,
    narrative:
      "At 1905 hours on 22 November 2026, a cyclist was struck at Grapeseed Main Street and Joad Lane by a dark older sedan that continued north on Joad without stopping. The rider, Ellis Park, was conscious at the scene and transported to Paleto Bay Medical in stable condition. Park described a dark green or black four-door, one occupant, no plate read.\n\nPlastic debris and a smear of dark paint remained in the northbound lane. A ranch camera on Senora Way, two parcels north, captured a dark sedan passing at speed about ninety seconds after the collision. The frame is motion-blurred. No suspect has been identified. The bicycle and the paint transfer are at the lab for a make comparison.",
    responders: [
      { id: "grape_r1", badge: "412", callsign: "3-ADAM-6", name: "Helen Vos", role: "Primary" },
      { id: "grape_r2", badge: "264", callsign: "3-ADAM-9", name: "Chris Daley", role: "Traffic" },
    ],
    events: [
      {
        id: "grape_ev1",
        at: "2026-11-23T03:06:00.000Z",
        badge: "DISP",
        unit: "DISPATCH",
        title: "Injury collision, vehicle fled",
        type: "Dispatch",
        findings: "Caller on Grapeseed Main reported a cyclist down and a dark sedan northbound on Joad Lane.",
      },
      {
        id: "grape_ev2",
        at: "2026-11-23T03:11:00.000Z",
        badge: "412",
        unit: "3-ADAM-6",
        title: "Victim contact",
        type: "Arrival",
        findings:
          "Ellis Park conscious, complaining of a shoulder and ribs. Medical transported to Paleto Bay Medical. Scene coned by Daley.",
      },
      {
        id: "grape_ev3",
        at: "2026-11-23T03:24:00.000Z",
        badge: "264",
        unit: "3-ADAM-9",
        title: "Roadway debris",
        type: "Evidence",
        findings:
          "Dark paint transfer on the bicycle frame and a piece of bumper plastic in the northbound lane. Both booked.",
      },
      {
        id: "grape_ev4",
        at: "2026-11-23T19:40:00.000Z",
        badge: "412",
        unit: "3-ADAM-6",
        title: "Ranch camera still",
        type: "Canvass",
        findings:
          "Senora Way ranch camera shows a dark sedan northbound roughly ninety seconds after the collision. Plate not readable. Still exported.",
      },
    ],
    nodes: [
      {
        id: "grape_root",
        kind: "case",
        x: 400,
        y: 30,
        payload: {
          caseNumber: "BCSO-26-1177",
          incidentType: "Hit and Run",
          location: "Grapeseed Main St & Joad Ln, Grapeseed",
        },
      },
      {
        id: "grape_driver",
        kind: "suspect",
        x: 40,
        y: 230,
        payload: {
          name: "Unknown driver",
          alias: "",
          status: "at_large",
          notes: "Sole occupant of a dark green or black older four-door. No plate. Fled north on Joad Lane.",
        },
        photo: {
          id: "grape_ph_driver",
          scene: "silhouette",
          caption: "Unknown driver",
          stamp: "BCSO-26-1177  ·  AT LARGE",
          name: "unknown-driver.svg",
        },
      },
      {
        id: "grape_paint",
        kind: "evidence",
        x: 760,
        y: 60,
        payload: {
          tag: "E-1177-01",
          category: "forensics",
          description: "Paint transfer and bumper plastic from the northbound lane.",
          custody: "Daley 264 collected both items. At the lab for a make and color comparison.",
          notes: "Paint is a dark green under the scuff. Comparison not back.",
        },
        photo: {
          id: "grape_ph_paint",
          scene: "paint",
          caption: "E-1177-01 paint transfer",
          stamp: "BCSO-26-1177  ·  LAB",
          name: "paint-transfer.svg",
        },
      },
      {
        id: "grape_still",
        kind: "evidence",
        x: 760,
        y: 300,
        payload: {
          tag: "E-1177-02",
          category: "media",
          description: "Ranch camera still, Senora Way, dark sedan northbound.",
          custody: "Vos 412 exported the frame from the owner's recorder with consent.",
          notes: "Motion blur. Body style is an older four-door. Plate unreadable.",
        },
        photo: {
          id: "grape_ph_still",
          scene: "monitor",
          caption: "E-1177-02 ranch camera",
          stamp: "SENORA WAY  ·  +00:01:30",
          name: "ranch-still.svg",
        },
      },
      {
        id: "grape_bike",
        kind: "evidence",
        x: 760,
        y: 530,
        payload: {
          tag: "E-1177-03",
          category: "other",
          description: "Victim's bicycle, front fork bent, paint smear on the down tube.",
          custody: "Held in property. Victim notified.",
          notes: "Impact point is the front wheel and down tube.",
        },
      },
      {
        id: "grape_scene",
        kind: "related",
        x: 400,
        y: 280,
        payload: {
          title: "Main & Joad",
          location: "Grapeseed Main St & Joad Ln",
          occurredAt: "2026-11-23T03:05:00.000Z",
          notes: "Point of impact in the northbound lane. No independent witness stopped.",
        },
        photo: {
          id: "grape_ph_road",
          scene: "road",
          caption: "Grapeseed Main at Joad Lane",
          stamp: "BCSO-26-1177  ·  22 NOV 2026",
          name: "grapeseed-road.svg",
        },
      },
      {
        id: "grape_clinic",
        kind: "related",
        x: 40,
        y: 480,
        payload: {
          title: "Paleto Bay Medical",
          location: "Paleto Blvd, Paleto Bay",
          occurredAt: "2026-11-23T03:40:00.000Z",
          notes: "Ellis Park admitted stable. Statement to be taken when cleared by medical staff.",
        },
        photo: {
          id: "grape_ph_clinic",
          scene: "clinic",
          caption: "Paleto Bay Medical",
          stamp: "BCSO-26-1177  ·  VICTIM",
          name: "paleto-medical.svg",
        },
      },
    ],
    edges: [
      { id: "grape_e1", source: "grape_root", target: "grape_driver", label: "Suspect In" },
      { id: "grape_e2", source: "grape_root", target: "grape_scene", label: "Occurred At" },
      { id: "grape_e3", source: "grape_root", target: "grape_paint", label: "Recovered At" },
      { id: "grape_e4", source: "grape_root", target: "grape_still", label: "Associated With" },
      { id: "grape_e5", source: "grape_root", target: "grape_bike", label: "Associated With" },
      { id: "grape_e6", source: "grape_paint", target: "grape_scene", label: "Recovered At" },
      { id: "grape_e7", source: "grape_still", target: "grape_driver", label: "Associated With" },
      { id: "grape_e8", source: "grape_root", target: "grape_clinic", label: "Associated With" },
      { id: "grape_e9", source: "grape_bike", target: "grape_paint", label: "Associated With" },
    ],
  },
  {
    id: "case_cassidy",
    caseNumber: "BCSO-25-0891",
    incidentType: "Homicide",
    location: "Cassidy Creek trailhead, Paleto Forest",
    occurredAt: "2025-08-10T05:40:00.000Z",
    createdAt: "2025-08-10T06:20:00.000Z",
    updatedAt: "2025-08-14T23:05:00.000Z",
    status: "closed",
    createdBy: "SGT-01",
    closedAt: "2025-08-14T23:05:00.000Z",
    closedBy: "D-08",
    narrative:
      "On 9 August 2025, a hiker reported a person down at the Cassidy Creek trailhead turnout. Deputies located an adult male, later identified as Nolan Peck, deceased beside his truck. The scene was held for detectives. There were no other vehicles in the turnout when units arrived.\n\nA witness driving out of the forest road described a man leaving on foot toward the creek about twenty minutes before the call. A boot impression in the turnout matched footwear later recovered from Samuel Quinn's cabin. A revolver recovered from the creek matched the fatal shot. Quinn was arrested on 14 August 2025 at the cabin. The district attorney filed, and this file was cleared by arrest.",
    responders: [
      { id: "cassidy_r1", badge: "176", callsign: "4-ADAM-2", name: "Pauline Greer", role: "Primary" },
      { id: "cassidy_r2", badge: "D-08", callsign: "DETECTIVES", name: "Amira Shah", role: "Detective" },
      { id: "cassidy_r3", badge: "SGT-01", callsign: "4-SAM-1", name: "Calvin Briggs", role: "Supervisor" },
    ],
    events: [
      {
        id: "cassidy_ev1",
        at: "2025-08-10T05:48:00.000Z",
        badge: "176",
        unit: "4-ADAM-2",
        title: "Trailhead held",
        type: "Arrival",
        findings:
          "Greer located Nolan Peck deceased beside his truck. No suspect on scene. Turnout taped. Detective Shah called out.",
      },
      {
        id: "cassidy_ev2",
        at: "2025-08-10T07:30:00.000Z",
        badge: "D-08",
        unit: "DETECTIVES",
        title: "Witness on the forest road",
        type: "Witness",
        findings:
          "A passing driver described a man walking toward the creek, dark jacket, heavy boots, about twenty minutes before deputies arrived.",
      },
      {
        id: "cassidy_ev3",
        at: "2025-08-10T09:10:00.000Z",
        badge: "D-08",
        unit: "DETECTIVES",
        title: "Boot impression and creek search",
        type: "Evidence",
        findings:
          "A boot impression was cast at the edge of the turnout. A revolver was recovered from shallow water downstream. Both booked.",
      },
      {
        id: "cassidy_ev4",
        at: "2025-08-12T18:00:00.000Z",
        badge: "D-08",
        unit: "DETECTIVES",
        title: "Footwear match",
        type: "Lab Result",
        findings:
          "The cast is consistent with boots seized from Samuel Quinn's cabin on a consent search. Quinn was a known associate of Peck.",
      },
      {
        id: "cassidy_ev5",
        at: "2025-08-14T22:20:00.000Z",
        badge: "D-08",
        unit: "DETECTIVES",
        title: "Arrest",
        type: "Arrest",
        findings:
          "Samuel Quinn arrested at the cabin without incident. Booked. File submitted for clearance by arrest.",
      },
    ],
    nodes: [
      {
        id: "cassidy_root",
        kind: "case",
        x: 400,
        y: 20,
        payload: {
          caseNumber: "BCSO-25-0891",
          incidentType: "Homicide",
          location: "Cassidy Creek trailhead, Paleto Forest",
        },
      },
      {
        id: "cassidy_quinn",
        kind: "suspect",
        x: 40,
        y: 220,
        payload: {
          name: "Samuel Quinn",
          alias: "",
          status: "in_custody",
          notes: "Arrested 14 August 2025 at his cabin. Known associate of the victim. Cleared by arrest.",
        },
        photo: {
          id: "cassidy_ph_quinn",
          scene: "silhouette",
          caption: "Samuel Quinn — in custody",
          stamp: "BCSO-25-0891  ·  CLEARED",
          name: "quinn-custody.svg",
        },
      },
      {
        id: "cassidy_gun",
        kind: "evidence",
        x: 760,
        y: 60,
        payload: {
          tag: "E-0891-01",
          category: "weapon",
          description: "Revolver recovered from Cassidy Creek.",
          custody: "Shah D-08 recovered the firearm from shallow water. Made safe and booked to the armory.",
          notes: "Matched to the fatal shot by the lab.",
        },
        photo: {
          id: "cassidy_ph_gun",
          scene: "box",
          caption: "E-0891-01 sealed revolver",
          stamp: "BCSO-25-0891  ·  ARMORY",
          name: "sealed-revolver.svg",
        },
      },
      {
        id: "cassidy_boot",
        kind: "evidence",
        x: 760,
        y: 300,
        payload: {
          tag: "E-0891-02",
          category: "forensics",
          description: "Boot impression cast from the turnout, and the comparison boots.",
          custody: "Cast poured on scene. Boots seized from the cabin under consent.",
          notes: "Lab reports the cast and the boots are consistent.",
        },
        photo: {
          id: "cassidy_ph_boot",
          scene: "boot",
          caption: "E-0891-02 boot cast",
          stamp: "BCSO-25-0891  ·  TURNOUT",
          name: "boot-cast.svg",
        },
      },
      {
        id: "cassidy_statement",
        kind: "evidence",
        x: 760,
        y: 530,
        payload: {
          tag: "E-0891-03",
          category: "document",
          description: "Signed statement of the passing driver.",
          custody: "Original in the case jacket. Copy scanned to the file.",
          notes: "Places a man on foot toward the creek minutes before the call.",
        },
        photo: {
          id: "cassidy_ph_statement",
          scene: "document",
          caption: "E-0891-03 witness statement",
          stamp: "BCSO-25-0891  ·  CASE JACKET",
          name: "witness-statement.svg",
        },
      },
      {
        id: "cassidy_turnout",
        kind: "related",
        x: 400,
        y: 260,
        payload: {
          title: "Trailhead turnout",
          location: "Cassidy Creek, Paleto Forest",
          occurredAt: "2025-08-10T05:40:00.000Z",
          notes: "Occurrence location. Victim's truck remained in the turnout.",
        },
        photo: {
          id: "cassidy_ph_forest",
          scene: "forest",
          caption: "Cassidy Creek trailhead",
          stamp: "BCSO-25-0891  ·  09 AUG 2025",
          name: "cassidy-creek.svg",
        },
      },
      {
        id: "cassidy_cabin",
        kind: "related",
        x: 40,
        y: 480,
        payload: {
          title: "Quinn cabin",
          location: "Paleto Forest service road",
          occurredAt: "2025-08-14T22:20:00.000Z",
          notes: "Arrest location. Boots recovered here.",
        },
      },
    ],
    edges: [
      { id: "cassidy_e1", source: "cassidy_root", target: "cassidy_quinn", label: "Suspect In" },
      { id: "cassidy_e2", source: "cassidy_root", target: "cassidy_turnout", label: "Occurred At" },
      { id: "cassidy_e3", source: "cassidy_root", target: "cassidy_gun", label: "Recovered At" },
      { id: "cassidy_e4", source: "cassidy_root", target: "cassidy_boot", label: "Recovered At" },
      { id: "cassidy_e5", source: "cassidy_root", target: "cassidy_statement", label: "Associated With" },
      { id: "cassidy_e6", source: "cassidy_boot", target: "cassidy_quinn", label: "Fingerprints Matched" },
      { id: "cassidy_e7", source: "cassidy_gun", target: "cassidy_quinn", label: "Possessed" },
      { id: "cassidy_e8", source: "cassidy_statement", target: "cassidy_quinn", label: "Witnessed" },
      { id: "cassidy_e9", source: "cassidy_boot", target: "cassidy_cabin", label: "Recovered At" },
      { id: "cassidy_e10", source: "cassidy_gun", target: "cassidy_turnout", label: "Recovered At" },
    ],
  },
];

export function seedPortal(database: DatabaseSync) {
  const insertCase = database.prepare(
    `INSERT INTO cases (
      id, case_number, incident_type, location, occurred_at, narrative, status,
      created_by, created_at, updated_at, closed_at, closed_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertResponder = database.prepare(
    `INSERT INTO responders (id, case_id, badge, callsign, name, role, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertEvent = database.prepare(
    `INSERT INTO events (
      id, case_id, occurred_at, badge, unit, title, event_type, findings, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertNode = database.prepare(
    `INSERT INTO nodes (id, case_id, kind, pos_x, pos_y, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertEdge = database.prepare(
    `INSERT INTO edges (id, case_id, source_id, target_id, source_handle, target_handle, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertPhoto = database.prepare(
    `INSERT INTO photos (id, node_id, filename, original_name, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const uploads = uploadDir();
  fs.mkdirSync(uploads, { recursive: true });

  for (const item of CASES) {
    insertCase.run(
      item.id,
      item.caseNumber,
      item.incidentType,
      item.location,
      item.occurredAt,
      item.narrative,
      item.status,
      item.createdBy,
      item.createdAt,
      item.updatedAt,
      item.closedAt,
      item.closedBy,
    );
    item.responders.forEach((responder, index) => {
      insertResponder.run(
        responder.id,
        item.id,
        responder.badge,
        responder.callsign,
        responder.name,
        responder.role,
        index,
      );
    });
    for (const event of item.events) {
      insertEvent.run(
        event.id,
        item.id,
        event.at,
        event.badge,
        event.unit,
        event.title,
        event.type,
        event.findings,
        event.badge,
        event.at,
        event.at,
      );
    }
    for (const node of item.nodes) {
      insertNode.run(
        node.id,
        item.id,
        node.kind,
        node.x,
        node.y,
        JSON.stringify(node.payload),
        item.createdAt,
        item.updatedAt,
      );
      if (node.photo) {
        const filename = `${node.photo.id}.svg`;
        const svg = renderStill(node.photo.scene, node.photo.caption, node.photo.stamp);
        fs.writeFileSync(path.join(uploads, filename), svg);
        insertPhoto.run(
          node.photo.id,
          node.id,
          filename,
          node.photo.name,
          "image/svg+xml",
          Buffer.byteLength(svg),
          item.updatedAt,
        );
      }
    }
    for (const edge of item.edges) {
      insertEdge.run(edge.id, item.id, edge.source, edge.target, "b", "t", edge.label, item.createdAt);
    }
  }
}
