// Extended journal abbreviation mappings for PDF metadata extraction
// Maps full journal names to their standard abbreviations

export const JOURNAL_ABBREVIATIONS: Record<string, string> = {
  // Major Orthopaedic Journals
  "Journal of Bone and Joint Surgery": "JBJS",
  "Journal of Bone and Joint Surgery American": "JBJS",
  "Journal of Bone and Joint Surgery British": "JBJS",
  "J Bone Joint Surg": "JBJS",
  "J Bone Joint Surg Am": "JBJS",
  "J Bone Joint Surg Br": "JBJS",
  "JBJS Am": "JBJS",
  "JBJS Br": "JBJS",

  "American Journal of Sports Medicine": "AJSM",
  "Am J Sports Med": "AJSM",

  "Clinical Orthopaedics and Related Research": "CORR",
  "Clin Orthop Relat Res": "CORR",
  "Clin Orthop": "CORR",

  "Journal of Hand Surgery": "JHS",
  "J Hand Surg": "JHS",
  "J Hand Surg Am": "JHS",
  "J Hand Surg Eur": "JHS",

  "Foot and Ankle International": "FAI",
  "Foot Ankle Int": "FAI",

  Spine: "Spine",
  "Spine J": "SpineJ",
  "Spine Journal": "SpineJ",

  Arthroscopy: "Arthroscopy",
  "Arthroscopy The Journal of Arthroscopic and Related Surgery": "Arthroscopy",

  "Journal of the American Academy of Orthopaedic Surgeons": "JAAOS",
  "J Am Acad Orthop Surg": "JAAOS",

  "Journal of Orthopaedic Trauma": "JOT",
  "J Orthop Trauma": "JOT",

  "Bone and Joint Journal": "BJJ",
  "Bone Joint J": "BJJ",

  "Knee Surgery Sports Traumatology Arthroscopy": "KSSTA",
  "Knee Surg Sports Traumatol Arthrosc": "KSSTA",

  "Journal of Pediatric Orthopaedics": "JPO",
  "J Pediatr Orthop": "JPO",

  "Journal of Shoulder and Elbow Surgery": "JSES",
  "J Shoulder Elbow Surg": "JSES",

  // Sports Medicine
  "British Journal of Sports Medicine": "BJSM",
  "Br J Sports Med": "BJSM",

  "Sports Medicine": "SportsMed",
  "Sports Med": "SportsMed",

  "Knee": "Knee",

  "International Journal of Sports Medicine": "IntJSportsMed",
  "Int J Sports Med": "IntJSportsMed",

  // Hand and Upper Extremity
  "Journal of Wrist Surgery": "JWS",
  "J Wrist Surg": "JWS",

  "Hand": "Hand",

  "Hand Clinics": "HandClin",
  "Hand Clin": "HandClin",

  // Plastic Surgery
  "British Journal of Plastic Surgery": "BJPS",
  "Br J Plast Surg": "BJPS",

  "Annals of Plastic Surgery": "AnnPlastSurg",
  "Ann Plast Surg": "AnnPlastSurg",

  "Plastic and Reconstructive Surgery": "PRS",
  "Plast Reconstr Surg": "PRS",

  // Spine
  "European Spine Journal": "ESJ",
  "Eur Spine J": "ESJ",

  // Note: "Spine Journal" mapped to SpineJ above
  "The Spine Journal": "SpineJ",

  "Neurosurgery": "Neurosurg",

  "Journal of Neurosurgery Spine": "JNeurosurgSpine",
  "J Neurosurg Spine": "JNeurosurgSpine",

  // Trauma
  "Injury": "Injury",

  "Journal of Trauma": "JTrauma",
  "J Trauma": "JTrauma",
  "Journal of Trauma and Acute Care Surgery": "JTIIC",
  "J Trauma Acute Care Surg": "JTIIC",

  // Reviews and General
  "Current Reviews in Musculoskeletal Medicine": "CRMM",
  "Curr Rev Musculoskelet Med": "CRMM",

  "Current Surgery Reports": "CSS",

  // Foot and Ankle
  "Foot and Ankle Surgery": "FAS",
  "Foot Ankle Surg": "FAS",

  "Journal of Foot and Ankle Surgery": "JFAS",
  "J Foot Ankle Surg": "JFAS",

  // Oncology
  "Clinical Orthopaedic Oncology": "ClinOrthopOncol",
  "Journal of Surgical Oncology": "JSurgOncol",
  "J Surg Oncol": "JSurgOncol",

  // Pediatrics
  "Journal of Children's Orthopaedics": "JChildOrthop",
  "J Child Orthop": "JChildOrthop",

  // Arthroplasty
  "Journal of Arthroplasty": "JArthroplasty",
  "J Arthroplasty": "JArthroplasty",

  "Hip International": "HipInt",
  "Hip Int": "HipInt",

  // General Medical
  "New England Journal of Medicine": "NEJM",
  "N Engl J Med": "NEJM",

  JAMA: "JAMA",
  "Journal of the American Medical Association": "JAMA",

  Lancet: "Lancet",
  "The Lancet": "Lancet",

  "BMJ": "BMJ",
  "British Medical Journal": "BMJ",

  // Radiology
  Radiology: "Radiology",

  "AJR American Journal of Roentgenology": "AJR",
  AJR: "AJR",

  "Skeletal Radiology": "SkelRadiol",
  "Skeletal Radiol": "SkelRadiol",

  // Rehabilitation
  "Archives of Physical Medicine and Rehabilitation": "ArchPhysMedRehabil",
  "Arch Phys Med Rehabil": "ArchPhysMedRehabil",

  "Physical Therapy": "PhysTher",
  "Phys Ther": "PhysTher",

  // Research
  "Acta Orthopaedica": "ActaOrthop",
  "Acta Orthop": "ActaOrthop",

  "International Orthopaedics": "IntOrthop",
  "Int Orthop": "IntOrthop",

  "Orthopaedic Clinics of North America": "OrthopClinNorthAm",
  "Orthop Clin North Am": "OrthopClinNorthAm",

  "Techniques in Orthopaedics": "TechOrthop",
  "Tech Orthop": "TechOrthop",

  "Orthopedics": "Orthopedics",

  "Journal of Orthopaedics": "JOrthop",
  "J Orthopaedics": "JOrthop",
  "J Orthop": "JOrthop",

  // Anatomy
  "Journal of Anatomy": "JAnat",
  "J Anat": "JAnat",
  "J. Anat.": "JAnat",
};

// Reverse mapping: abbreviation to full list of patterns to search for
export const JOURNAL_SEARCH_PATTERNS: Record<string, string[]> = {
  JBJS: [
    "journal of bone and joint surgery",
    "j bone joint surg",
    "jbjs",
    "bone and joint surgery",
    "bone joint surg",
  ],
  AJSM: [
    "american journal of sports medicine",
    "am j sports med",
    "ajsm",
    "j sports med",
  ],
  CORR: [
    "clinical orthopaedics and related research",
    "clin orthop relat res",
    "clin orthop",
    "corr",
  ],
  JHS: [
    "journal of hand surgery",
    "j hand surg",
    "hand surgery",
    "jhs",
  ],
  FAI: [
    "foot and ankle international",
    "foot ankle int",
    "fai",
  ],
  Spine: ["spine"],
  SpineJ: ["spine journal", "spine j"],
  Arthroscopy: ["arthroscopy", "arthrosc"],
  JAAOS: [
    "journal of the american academy of orthopaedic surgeons",
    "j am acad orthop surg",
    "jaaos",
    "aaos",
  ],
  JOT: [
    "journal of orthopaedic trauma",
    "j orthop trauma",
    "jot",
    "orthop trauma",
  ],
  BJJ: [
    "bone and joint journal",
    "bone joint j",
    "bjj",
  ],
  KSSTA: [
    "knee surgery sports traumatology arthroscopy",
    "knee surg sports traumatol arthrosc",
    "kssta",
  ],
  JPO: [
    "journal of pediatric orthopaedics",
    "j pediatr orthop",
    "jpo",
    "pediatr orthop",
  ],
  JSES: [
    "journal of shoulder and elbow surgery",
    "j shoulder elbow surg",
    "jses",
    "shoulder elbow surg",
  ],
  BJSM: [
    "british journal of sports medicine",
    "br j sports med",
    "bjsm",
  ],
  JArthroplasty: [
    "journal of arthroplasty",
    "j arthroplasty",
    "arthroplasty",
  ],
  NEJM: [
    "new england journal of medicine",
    "n engl j med",
    "nejm",
  ],
  JAMA: [
    "jama",
    "journal of the american medical association",
  ],
  Lancet: ["lancet", "the lancet"],
  HandClin: [
    "hand clinics",
    "hand clin",
  ],
  BJPS: [
    "british journal of plastic surgery",
    "br j plast surg",
    "bjps",
  ],
  AnnPlastSurg: [
    "annals of plastic surgery",
    "ann plast surg",
  ],
  PRS: [
    "plastic and reconstructive surgery",
    "plast reconstr surg",
  ],
  ESJ: [
    "european spine journal",
    "eur spine j",
  ],
  TSJ: [
    "the spine journal",
  ],
  SJ: [
    "spine journal",
  ],
  JTIIC: [
    "journal of trauma and acute care surgery",
    "j trauma acute care surg",
  ],
  CRMM: [
    "current reviews in musculoskeletal medicine",
    "curr rev musculoskelet med",
  ],
  CSS: [
    "current surgery reports",
  ],
  JAnat: [
    "journal of anatomy",
    "j anat",
    "j. anat.",
    "j.anat.",
    "j. anat",
  ],
  JOrthop: [
    "journal of orthopaedics",
    "j orthopaedics",
    "j orthop",
  ],
};

// Common author suffix patterns to remove when extracting names
export const AUTHOR_SUFFIXES = [
  ", MD",
  ", M.D.",
  ", PhD",
  ", Ph.D.",
  ", DO",
  ", D.O.",
  ", FRCS",
  ", FACS",
  ", Jr.",
  ", Jr",
  ", Sr.",
  ", Sr",
  ", III",
  ", II",
  " MD",
  " PhD",
  " DO",
  " FRCS",
  " FACS",
];

// Characters that should be replaced with hyphens in filenames
export const FILENAME_REPLACEMENTS: Record<string, string> = {
  ":": "-",
  "/": "-",
  "\\": "-",
  "?": "",
  "*": "",
  '"': "",
  "<": "",
  ">": "",
  "|": "",
  "&": "and",
  "\u2018": "",
  "\u2019": "",
  "\u201C": "",
  "\u201D": "",
  "\u2013": "-",
  "\u2014": "-",
  "\u2026": "",
  ",": "",
  ";": "",
  "(": "",
  ")": "",
  "[": "",
  "]": "",
  "{": "",
  "}": "",
};
