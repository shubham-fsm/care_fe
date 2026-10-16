/**
 * Provisional diagnosis suggestions from the presenting complaints.
 *
 * A small, transparent rule list for common OPD conditions: each complaint
 * is recognised from a structured symptom (its SNOMED code or name) or from
 * free text (English, Hindi and Hinglish words), and each diagnosis lists
 * the complaints that point to it. Suggestions are ranked by how many of a
 * diagnosis' complaints are present. They are only suggestions: the doctor
 * picks one, and it is added as a provisional diagnosis. The diagnosis code
 * itself is looked up in the terminology server when picked, by `term`.
 */

export interface Complaint {
  id: string;
  label: string;
  /** SNOMED CT codes of matching symptoms */
  codes: string[];
  /** Words in symptom names or free text (English / Hindi / Hinglish) */
  words: RegExp;
}

export const COMPLAINTS: Complaint[] = [
  {
    id: "fever",
    label: "fever",
    codes: ["386661006"],
    words:
      /\b(fever|pyrexia|febrile|bukh(a|aa)r|jwar|taap)\b|बुखार|ज्वर|बुख़ार/i,
  },
  {
    id: "chills",
    label: "chills",
    codes: ["43724002"],
    words: /\b(chills?|rigou?rs?|shivering|kamp ?kampi)\b|कंपकंपी|ठंड लग/i,
  },
  {
    id: "cough",
    label: "cough",
    codes: ["49727002"],
    words: /\b(cough(ing)?|kh(a|aa)nsi)\b|खांसी|खाँसी/i,
  },
  {
    id: "cold",
    label: "cold / runny nose",
    codes: ["82272006", "64531003", "267101005"],
    words:
      /\b(cold|coryza|runny nose|rhinorrh?oea|nasal discharge|sneez\w*|sardi|zukam|jukam|naak beh\w*)\b|सर्दी|जुकाम|ज़ुकाम|छींक/i,
  },
  {
    id: "sore_throat",
    label: "sore throat",
    codes: ["162397003", "267102003"],
    words:
      /\b(sore throat|throat pain|pain in throat|gala dard|gale (me|mein) dard|gala kharab)\b|गले में दर्द|गला/i,
  },
  {
    id: "headache",
    label: "headache",
    codes: ["25064002"],
    words: /\b(headache|head ache|cephalgia|s(i|a)r ?dard)\b|सिर दर्द|सिरदर्द/i,
  },
  {
    id: "body_ache",
    label: "body ache",
    codes: ["68962001"],
    words:
      /\b(body ?(ache|pain)|myalgia|muscle pain|badan dard)\b|बदन दर्द|शरीर दर्द/i,
  },
  {
    id: "joint_pain",
    label: "joint pain",
    codes: ["57676002"],
    words:
      /\b(joint pain|arthralgia|knee pain|jod(o|on)? (me|mein)? ?dard|ghutn(e|a) (me|mein)? ?dard)\b|जोड़ों में दर्द|घुटने/i,
  },
  {
    id: "back_pain",
    label: "back pain",
    codes: ["161891005", "279039007"],
    words: /\b(back ?(ache|pain)|lumbago|kamar ?dard)\b|कमर दर्द/i,
  },
  {
    id: "abdominal_pain",
    label: "abdominal pain",
    codes: ["21522001"],
    words:
      /\b(abdominal pain|pain abdomen|stomach ?(ache|pain)|belly pain|pet ?dard)\b|पेट दर्द|पेट में दर्द/i,
  },
  {
    id: "vomiting",
    label: "vomiting",
    codes: ["422400008"],
    words: /\b(vomit\w*|emesis|ulti)\b|उल्टी/i,
  },
  {
    id: "nausea",
    label: "nausea",
    codes: ["422587007"],
    words: /\b(nausea|ji machal\w*)\b|मतली|जी मचल/i,
  },
  {
    id: "diarrhoea",
    label: "loose motions",
    codes: ["62315008"],
    words:
      /\b(diarrh?oea|loose (motions?|stools?)|dast|watery stools?)\b|दस्त/i,
  },
  {
    id: "constipation",
    label: "constipation",
    codes: ["14760008"],
    words: /\b(constipation|kab(j|z))\b|कब्ज/i,
  },
  {
    id: "acidity",
    label: "acidity / heartburn",
    codes: ["16331000", "162031009"],
    words:
      /\b(acidity|heartburn|indigestion|dyspepsia|khatti dakar|gas|seene (me|mein) jalan)\b|बदहजमी|खट्टी डकार|एसिडिटी/i,
  },
  {
    id: "loss_of_appetite",
    label: "loss of appetite",
    codes: ["79890006"],
    words:
      /\b(loss of appetite|anorexia|not eating|bhook?h? (na|nahi|kam))\b|भूख न|भूख कम/i,
  },
  {
    id: "weight_loss",
    label: "weight loss",
    codes: ["89362005"],
    words: /\b(weight loss|losing weight|wajan kam|vajan kam)\b|वजन कम/i,
  },
  {
    id: "dysuria",
    label: "burning urination",
    codes: ["49650001"],
    words:
      /\b(dysuria|burning (micturition|urination|urine)|painful urination|pesh(a|aa)b (me|mein) jalan)\b|पेशाब में जलन/i,
  },
  {
    id: "frequent_urination",
    label: "frequent urination",
    codes: ["162116003"],
    words:
      /\b(frequent urination|frequency of micturition|polyuria|baar ?baar pesh(a|aa)b)\b|बार बार पेशाब/i,
  },
  {
    id: "thirst",
    label: "excessive thirst",
    codes: ["17173007"],
    words: /\b(excessive thirst|polydipsia|zy?aada py(a|aa)s)\b|ज्यादा प्यास/i,
  },
  {
    id: "chest_pain",
    label: "chest pain",
    codes: ["29857009"],
    words:
      /\b(chest pain|pain (in )?chest|seene (me|mein) dard|chhati (me|mein) dard)\b|सीने में दर्द|छाती में दर्द/i,
  },
  {
    id: "breathlessness",
    label: "breathlessness",
    codes: ["267036007"],
    words:
      /\b(breathless\w*|shortness of breath|dyspn?oea|sob|s(a|aa)ns (ph|f)ool\w*|s(a|aa)ns lene me\w*)\b|सांस फूल|साँस फूल|सांस लेने/i,
  },
  {
    id: "wheeze",
    label: "wheezing",
    codes: ["56018004"],
    words: /\b(wheez\w*|seeti)\b|सीटी/i,
  },
  {
    id: "palpitations",
    label: "palpitations",
    codes: ["80313002"],
    words: /\b(palpitations?|dhadkan tez|ghabrahat)\b|धड़कन|घबराहट/i,
  },
  {
    id: "dizziness",
    label: "dizziness",
    codes: ["404640003", "399153001"],
    words: /\b(dizz\w*|giddiness|vertigo|chakkar)\b|चक्कर/i,
  },
  {
    id: "weakness",
    label: "weakness / tiredness",
    codes: ["13791008", "84229001"],
    words:
      /\b(weakness|fatigue|tired\w*|lethargy|kamzori|thakan)\b|कमजोरी|कमज़ोरी|थकान/i,
  },
  {
    id: "itching",
    label: "itching",
    codes: ["418290006"],
    words: /\b(itch\w*|pruritus|khujli)\b|खुजली/i,
  },
  {
    id: "rash",
    label: "rash",
    codes: ["271807003"],
    words: /\b(rash(es)?|eruption|d(a|aa)ne|chakatte)\b|दाने|चकत्ते/i,
  },
  {
    id: "ear_pain",
    label: "ear pain",
    codes: ["16001004"],
    words:
      /\b(ear ?(ache|pain)|otalgia|ear discharge|k(a|aa)n (me|mein)? ?dard)\b|कान में दर्द|कान दर्द/i,
  },
  {
    id: "red_eye",
    label: "red / watery eyes",
    codes: ["75705005", "246679005"],
    words:
      /\b(red eyes?|eye redness|watering eyes?|eye discharge|(a|aa)nkh (lal|se paani))\b|आंख लाल|आँख लाल/i,
  },
  {
    id: "jaundice",
    label: "yellow eyes / urine",
    codes: ["18165001"],
    words: /\b(jaundice|icterus|yellow (eyes|urine|skin)|peeliya)\b|पीलिया/i,
  },
];

export interface DiagnosisRule {
  /** Shown on the suggestion */
  label: string;
  /** Searched in the diagnosis list (terminology server) when picked */
  term: string;
  /** Complaint ids pointing to this diagnosis; the first ones weigh most */
  complaints: string[];
  /** Complaints that must be present for the suggestion to show */
  requires?: string[];
  /** How common it is in a district OPD (0-1): common ones rank higher */
  prior: number;
}

export const DIAGNOSIS_RULES: DiagnosisRule[] = [
  {
    label: "Acute upper respiratory infection",
    prior: 1,
    term: "Acute upper respiratory infection",
    complaints: ["cough", "cold", "sore_throat", "fever", "headache"],
    requires: ["cough"],
  },
  {
    label: "Common cold",
    prior: 0.9,
    term: "Common cold",
    complaints: ["cold", "sore_throat", "cough", "headache"],
    requires: ["cold"],
  },
  {
    label: "Acute pharyngitis",
    prior: 0.85,
    term: "Acute pharyngitis",
    complaints: ["sore_throat", "fever", "cough"],
    requires: ["sore_throat"],
  },
  {
    label: "Influenza",
    prior: 0.6,
    term: "Influenza",
    complaints: ["fever", "body_ache", "cough", "headache", "chills", "cold"],
    requires: ["fever"],
  },
  {
    label: "Viral fever",
    prior: 1,
    term: "Viral disease",
    complaints: ["fever", "body_ache", "headache", "weakness", "cold"],
    requires: ["fever"],
  },
  {
    label: "Malaria",
    prior: 0.85,
    term: "Malaria",
    complaints: ["fever", "chills", "headache", "body_ache", "vomiting"],
    requires: ["fever"],
  },
  {
    label: "Typhoid fever",
    prior: 0.7,
    term: "Typhoid fever",
    complaints: [
      "fever",
      "abdominal_pain",
      "headache",
      "loss_of_appetite",
      "weakness",
      "constipation",
      "diarrhoea",
    ],
    requires: ["fever"],
  },
  {
    label: "Dengue fever",
    prior: 0.6,
    term: "Dengue fever",
    complaints: [
      "fever",
      "body_ache",
      "headache",
      "joint_pain",
      "rash",
      "vomiting",
    ],
    requires: ["fever"],
  },
  {
    label: "Acute bronchitis",
    prior: 0.7,
    term: "Acute bronchitis",
    complaints: ["cough", "wheeze", "breathlessness", "fever", "chest_pain"],
    requires: ["cough"],
  },
  {
    label: "Pneumonia",
    prior: 0.45,
    term: "Pneumonia",
    complaints: ["fever", "cough", "breathlessness", "chest_pain", "chills"],
    requires: ["cough", "fever"],
  },
  {
    label: "Asthma",
    prior: 0.8,
    term: "Asthma",
    complaints: ["breathlessness", "wheeze", "cough"],
    requires: ["breathlessness"],
  },
  {
    label: "Pulmonary tuberculosis",
    prior: 0.45,
    term: "Pulmonary tuberculosis",
    complaints: [
      "cough",
      "weight_loss",
      "fever",
      "loss_of_appetite",
      "weakness",
    ],
    requires: ["cough"],
  },
  {
    label: "Gastroenteritis",
    prior: 1,
    term: "Gastroenteritis",
    complaints: ["diarrhoea", "vomiting", "abdominal_pain", "fever", "nausea"],
    requires: ["diarrhoea"],
  },
  {
    label: "Gastritis",
    prior: 0.9,
    term: "Gastritis",
    complaints: ["acidity", "abdominal_pain", "nausea", "vomiting"],
  },
  {
    label: "Gastro-oesophageal reflux disease",
    prior: 0.7,
    term: "Gastroesophageal reflux disease",
    complaints: ["acidity", "chest_pain", "nausea"],
    requires: ["acidity"],
  },
  {
    label: "Constipation",
    prior: 0.9,
    term: "Constipation",
    complaints: ["constipation", "abdominal_pain"],
    requires: ["constipation"],
  },
  {
    label: "Urinary tract infection",
    prior: 1,
    term: "Urinary tract infection",
    complaints: ["dysuria", "frequent_urination", "fever", "abdominal_pain"],
  },
  {
    label: "Diabetes mellitus type 2",
    prior: 0.7,
    term: "Diabetes mellitus type 2",
    complaints: ["thirst", "frequent_urination", "weakness", "weight_loss"],
  },
  {
    label: "Hypertension",
    prior: 0.6,
    term: "Hypertensive disorder",
    complaints: ["headache", "dizziness", "palpitations"],
    requires: ["headache", "dizziness"],
  },
  {
    label: "Anaemia",
    prior: 0.8,
    term: "Anemia",
    complaints: ["weakness", "dizziness", "breathlessness", "palpitations"],
    requires: ["weakness"],
  },
  {
    label: "Migraine",
    prior: 0.7,
    term: "Migraine",
    complaints: ["headache", "nausea", "vomiting"],
    requires: ["headache"],
  },
  {
    label: "Tension-type headache",
    prior: 0.8,
    term: "Tension-type headache",
    complaints: ["headache"],
  },
  {
    label: "Vertigo",
    prior: 0.8,
    term: "Vertigo",
    complaints: ["dizziness", "vomiting", "nausea"],
    requires: ["dizziness"],
  },
  {
    label: "Osteoarthritis of knee",
    prior: 0.9,
    term: "Osteoarthritis of knee",
    complaints: ["joint_pain"],
  },
  {
    label: "Low back pain",
    prior: 0.9,
    term: "Low back pain",
    complaints: ["back_pain"],
  },
  {
    label: "Myalgia",
    prior: 0.8,
    term: "Myalgia",
    complaints: ["body_ache", "weakness"],
    requires: ["body_ache"],
  },
  {
    label: "Scabies",
    prior: 0.9,
    term: "Scabies",
    complaints: ["itching", "rash"],
    requires: ["itching"],
  },
  {
    label: "Fungal skin infection (tinea)",
    prior: 0.9,
    term: "Dermatophytosis",
    complaints: ["itching", "rash"],
    requires: ["itching", "rash"],
  },
  {
    label: "Urticaria",
    prior: 0.8,
    term: "Urticaria",
    complaints: ["rash", "itching"],
    requires: ["rash"],
  },
  {
    label: "Allergic rhinitis",
    prior: 0.7,
    term: "Allergic rhinitis",
    complaints: ["cold", "itching", "red_eye"],
    requires: ["cold"],
  },
  {
    label: "Acute otitis media",
    prior: 0.9,
    term: "Acute otitis media",
    complaints: ["ear_pain", "fever"],
    requires: ["ear_pain"],
  },
  {
    label: "Conjunctivitis",
    prior: 0.9,
    term: "Conjunctivitis",
    complaints: ["red_eye"],
  },
  {
    label: "Viral hepatitis",
    prior: 0.8,
    term: "Viral hepatitis",
    complaints: [
      "jaundice",
      "loss_of_appetite",
      "nausea",
      "abdominal_pain",
      "fever",
    ],
    requires: ["jaundice"],
  },
  {
    label: "Angina pectoris",
    prior: 0.6,
    term: "Angina pectoris",
    complaints: ["chest_pain", "breathlessness", "palpitations"],
    requires: ["chest_pain"],
  },
];

export interface ComplaintInput {
  /** SNOMED code of a structured symptom, if any */
  code?: string;
  /** Symptom name, or free text */
  text?: string;
}

/** Complaint ids recognised in the given symptoms / free text. */
export function recogniseComplaints(inputs: ComplaintInput[]) {
  const found = new Set<string>();
  for (const input of inputs) {
    for (const complaint of COMPLAINTS) {
      if (
        (input.code && complaint.codes.includes(input.code)) ||
        (input.text && complaint.words.test(input.text))
      ) {
        found.add(complaint.id);
      }
    }
  }
  return found;
}

export interface DiagnosisSuggestion {
  rule: DiagnosisRule;
  /** Labels of the complaints that point to it */
  basedOn: string[];
  score: number;
}

/** Best matching diagnoses for the recognised complaints, best first. */
export function suggestDiagnoses(
  complaints: Set<string>,
  limit = 5,
): DiagnosisSuggestion[] {
  if (complaints.size === 0) return [];
  const label = (id: string) =>
    COMPLAINTS.find((complaint) => complaint.id === id)?.label ?? id;
  return DIAGNOSIS_RULES.flatMap((rule) => {
    if (rule.requires && !rule.requires.every((id) => complaints.has(id))) {
      return [];
    }
    const matched = rule.complaints.filter((id) => complaints.has(id));
    if (matched.length === 0) return [];
    // Earlier complaints weigh more, more of the rule's complaints present
    // is better, and common conditions come first
    const n = rule.complaints.length;
    const weight = matched.reduce(
      (sum, id) => sum + 1 - rule.complaints.indexOf(id) / n,
      0,
    );
    const score = (weight + matched.length / n) * rule.prior;
    return [{ rule, basedOn: matched.map(label), score }];
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
