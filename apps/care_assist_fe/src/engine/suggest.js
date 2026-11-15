// @ts-nocheck
// Rule engine copied unchanged from the Chrome widget (suggest.js v1.1.12): 233 rules, CARE names, tests, advice.
const ENGINE = (() => {
  "use strict";
  const ROUTE = /\/facility\/([^/]+)\/patient\/([^/]+)\/encounter\/([^/]+)\/questionnaire/;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- lab tests: how to recognise them in the facility's activity definitions
  const TESTS = {
    CBC: { name: "CBC", not: /hba1c|glycated/i, re: /\bcbc\b|\bcbp\b|complete blood|blood count|full blood|ha?emogram|\btlc\b.*\bdlc\b/i },
    MP: { name: "Malaria test (MP / RDT)", re: /malaria|\bmp\b|plasmodium|bivalent|\bpf\b.*\bpv\b|\bpv\b.*\bpf\b|thin film|thick film/i },
    WIDAL: { name: "Widal (after week 1; supportive only)", not: /igm|rapid|rdt|card|typhidot|culture|typhus|scrub/i, re: /widal|typh/i },
    DENGUE: { name: "Dengue NS1 / IgM", re: /dengue|ns1/i },
    RBS: { name: "Random blood sugar", re: /\bg?rbs\b|\brbg\b|random.*(glucose|sugar)|(glucose|sugar).*(random|\(r\)|\br\b)|blood sugar$|glucometer|capillary.*glucose|^glucose measurement, blood$/i },
    FBS: { name: "Fasting blood sugar", re: /\bfbs\b|\bfpg\b|\bfbg\b|fasting.*(glucose|sugar)|(glucose|sugar).*(fasting|\(f\))/i },
    HBA1C: { name: "HbA1c", re: /hb ?a1c|ha?emoglobin a1c|glycated|glycosylated/i },
    URINE: { name: "Urine routine", not: /pregnan|hcg|culture|albumin|\bacr\b|sugar|ketone/i, re: /urin(e|alysis)|urine.*(r\/?m|r\/?e|routine)|\bure\b|\bu\/?r\/?m\b/i },
    LIPID: { name: "Lipid profile", re: /lipid/i },
    KFT: { name: "Kidney function (KFT)", not: /x-?ray|ultrason|\busg\b|\bus scan|scan|biopsy/i, re: /\bkft\b|\brft\b|renal|kidney|creatinine|\burea\b|\bbun\b/i },
    SPUTUM: { name: "Sputum NAAT / AFB", re: /sputum|\bafb\b|cbnaat|truenat|genexpert|naat|mycobacterium|tuberculosis dna/i },
    CXR: { name: "Chest X-ray", re: /chest.*x.?ray|x.?ray.*chest|\bcxr\b|chest.*\bpa\b|skiagram.*chest/i },
    ECG: { name: "ECG", re: /\becg\b|\bekg\b|electrocardio/i },
    HB: { name: "Haemoglobin", prefer: /level|estimation/i, not: /a1c|glycat|glycos|electrophor|hplc/i, re: /ha?emoglobin|\bhb\b|\bhgb\b/i },
    STOOL: { name: "Stool routine", re: /stool|f(a)?eces|f(a)?ecal|occult blood/i },
    UPT: { name: "Pregnancy test (UPT)", re: /pregnan|\bupt\b|hcg|\bcard test\b.*preg/i },
    LFT: { name: "Liver function (LFT)", not: /serial images|scan|scint|imaging/i, re: /\blft\b|liver function|hepatic function|bilirubin|sgpt|sgot|\balt\b|alanine aminotransferase/i },
    HBSAG: { name: "HBsAg", re: /hbs ?ag|hepatitis ?b|australia antigen/i },
    TFT: { name: "Thyroid (TSH / T3 / T4)", re: /thyroid|\btsh\b|\bt3\b|\bt4\b|\btft\b/i },
    URIC: { name: "Serum uric acid", re: /uric/i },
    ESR: { name: "ESR", re: /\besr\b|sedimentation/i },
    RAF: { name: "RA factor", re: /\bra factor|rheumatoid/i },
    USG: { name: "Ultrasound (USG)", prefer: /abdom/i, re: /\busg\b|ultrasound|sonograph|\bus scan\b/i },
    XRAY: { name: "X-ray of the affected part", not: /kub|chest/i, re: /x.?ray(?!.*chest)/i },
    DOPPLER: { name: "Venous Doppler", re: /doppler/i, tier: "DH" },
    BCULT: { name: "Blood culture (before antibiotics)", re: /blood culture|culture.*blood/i, tier: "CHC/DH" },
    TYPHRDT: { name: "Typhoid IgM rapid test (if no culture)", not: /typhus|scrub/i, re: /typh\w*.*(igm|rapid|rdt|card)|typhidot/i, tier: "PHC+" },
    NS1: { name: "Dengue NS1 (day 1-4)", re: /ns1|dengue.*(antigen|\bag\b)/i, tier: "SC+" },
    DIGM: { name: "Dengue IgM (day 5+)", re: /dengue.*igm|igm.*dengue/i, tier: "CHC/DH" },
    WBCT: { name: "20-minute whole blood clotting test", re: /20 ?wbct|whole blood clot|clotting time/i, tier: "PHC+" },
    OGTT: { name: "75 g OGTT (2-h, \u2265140 = GDM)", re: /ogtt|glucose tolerance|75 ?g/i, tier: "SC+" },
    BGRP: { name: "Blood group & Rh", re: /blood group|grouping|\babo\b|rh typ|rh factor/i, tier: "PHC+" },
    VDRL: { name: "Syphilis (RDT / RPR / VDRL)", re: /vdrl|\brpr\b|syphilis|treponem/i, tier: "SC+" },
    HIV: { name: "HIV rapid test", not: /dna|pcr|viral load|rna/i, re: /\bhiv\b|retro ?viral/i, tier: "SC+" },
    HCV: { name: "Anti-HCV", re: /hcv|hepatitis c/i, tier: "PHC+" },
    TROP: { name: "Troponin", re: /troponin|\btrop\b/i, tier: "CHC/DH" },
    SCRUB: { name: "Scrub typhus (Weil-Felix / IgM)", re: /scrub|weil|orientia|tsutsugamushi/i, tier: "PHC+ (endemic)" },
    RK39: { name: "rK39 (kala-azar) RDT", re: /rk ?39|kala.?azar|leishman/i, tier: "PHC+" },
    LEPTO: { name: "Leptospira IgM", re: /lepto/i, tier: "CHC/DH" },
    CHIK: { name: "Chikungunya IgM", re: /chikungunya|\bchik\b/i, tier: "CHC/DH" },
    FILARIA: { name: "Filaria test (FTS / night blood smear)", re: /filari|microfilar|\bfts\b|night blood/i, tier: "PHC+" },
    SICKLE: { name: "Sickle cell test (RDT / solubility)", re: /sickl|solubility|\bhplc\b/i, tier: "SC+" },
    KUB: { name: "X-ray KUB", not: /usg|ultra|sono/i, re: /\bkub\b/i, tier: "CHC/DH" },
    PEF: { name: "Peak flow", re: /peak (expiratory )?flow|\bpefr?\b/i, tier: "PHC+" },
    KOH: { name: "KOH mount", re: /\bkoh\b/i, tier: "PHC+" },
    URINEACR: { name: "Urine albumin (ACR)", re: /microalbumin|\bacr\b|albumin.*urine|urine.*albumin/i, tier: "CHC/DH" },
  };
  // Typical facility level (FDSI 2025 / ICMR NEDL 2025) for tests already listed above.
  const TIER = { CBC: "PHC+", MP: "SC+", WIDAL: "PHC+", DENGUE: "SC+", RBS: "SC+", FBS: "SC+", HBA1C: "CHC/DH", URINE: "SC+", LIPID: "PHC+",
    KFT: "PHC+", SPUTUM: "PHC+ (sample at SC)", CXR: "CHC/DH", ECG: "CHC/DH", HB: "SC+", STOOL: "PHC+", UPT: "SC+", LFT: "PHC+", HBSAG: "SC+",
    TFT: "CHC/DH", URIC: "PHC+", ESR: "PHC+", RAF: "PHC+", USG: "CHC/DH", XRAY: "CHC/DH", DOPPLER: "DH" };
  for (const [k, t] of Object.entries(TIER)) if (TESTS[k] && !TESTS[k].tier) TESTS[k].tier = t;
  TESTS.MP.name = "Malaria bivalent RDT (or slide)";

  // Word groups that must appear in the SAME sentence, in any order
  // (so "redness in eye", "eye is red" and "aankh laal" all match).
  const G = {
    swell: /swell|swoll|sujan|soojan|sooja|suja|edema|oedema|puffy|phool (gaya|gaye|gayi)/i,
    leg: /\b(legs?|feet|foot|ankles?|pair|pairon|paon|paaon|pindli|calf|takhna)\b/i,
    oneSide: /\b(one|left|right|single|ek|baayan|baaye|daayan|daaye|unilateral)\b/i,
    bothSide: /\b(both|dono|bilateral)\b/i,
    red: /red(ness)?|laal|lal\b|congest|inflam/i,
    eye: /\b(eyes?|aankh|aankhon|aankhen|ankh)\b/i,
    pain: /pain|dard|tender|ache|dukh|sore/i,
    warm: /warm|hot|garam|fever|bukhar/i,
    joint: /\b(joints?|knee|ghutn[ae]|ankle|wrist|kalai|toe|anguth[ae]|finger|ungli|jod)\b/i,
    bigToe: /big toe|great toe|angutha|anguthe/i,
    morningStiff: /morning stiff|subah (akdan|jakdan)|stiffness/i,
    ear: /\b(ear|ears|kaan)\b/i,
    discharge: /discharge|pus|beh|paani|mawad|watering/i,
    throat: /throat|gala|gale|tonsil/i,
    tooth: /\b(tooth|teeth|daant|dant|gum|masude)\b/i,
    finger: /\b(fingers?|thumbs?|ungli\w*|angutha|index finger|middle finger|ring finger|little finger)\b/i,
    hand: /\b(hands?|palms?|hatheli|haath)\b/i,
    webSpace: /\bweb( space)?\b|between (the )?(fingers|toes)|ungli\w* ke beech/i,
    infect: /infect\w*|\bpus\b|mawad|\bpees\b|abscess|throbb\w*|discharg\w*|red(ness)?[^,.;\n]{0,10}swell\w*|swell\w*[^,.;\n]{0,10}red(ness)?/i,
    toe: /\b(toes?|toe ?nails?|anguth[ae]|big toe)\b/i,
    footW: /\b(foot|feet|sole|soles|heel|heels|toes?|talwa|tal[uv]a|edi|aedi)\b/i,
    axilla: /\b(armpit|axilla\w*|underarm|bagal|kankh)\b/i,
    buttock: /\b(buttocks?|gluteal|chutad|nitamb)\b/i,
    perianal: /peri-?anal|(near|around|beside|side of|close to) (the )?(anus|anal|guda|back passage)|(anus|anal|guda)[^,.;\n]{0,10}(swell|boil|pus|abscess)/i,
    faceW: /\b(face|cheeks?|gaal|chehra|chehre|jaw)\b/i,
    heat: /heat ?stroke|sun ?stroke|heat exhaust|\bloo\b|loo lag|lu lag|garmi lag|sunstroke|(exposure|worked|working|kaam)[^,.;\n]{0,25}(sun|heat|dhoop|dhup)|(sun|heat|dhoop|dhup)[^,.;\n]{0,15}(exposure|me kaam|mein kaam)/i,
    tobacco: /smok|tobacco|gutk|khaini|bidi|beedi|cigar|zarda|\bgul\b|pan masala|hookah/i,
    giddyW: /gidd|dizz|chakkar/i,
    chestPain: /chest (pain|heaviness|tightness|discomfort)|seene (me|mein) (dard|bhaari)|chhati (me|mein) dard|\bpain[^,.;\n]{0,25}\b(chest|seena|seene|chhati)\b(?! ?x.?ray)|\bchest\b[^,.;\n]{0,15}\bpain/i,
    exertion: /exertion|walking|chalne|seedhi|sweat|paseena|left arm|jaw|radiat/i,
    yellow: /jaundice|peeliya|piliya|yellow(ness)? (of )?(eyes|urine|skin)|peela (peshab|pesab)|aankh peeli/i,
    neckSwell: /neck|gala|gardan|goit/i,
    flank: /flank|loin|kamar ke (side|bagal)|kidney stone|pathri|renal colic/i,
    piles: /piles|bleeding pr\b|bawasir|bavasir|haemorrhoid|hemorrhoid|bleeding per rectum|anal (pain|bleed)|latrine (me|mein) khoon/i,
    groin: /groin|hernia|jangh|hydrocele|scrot/i,
    dogBite: /(dog|cat|monkey|rat|animal|kutt[ae]|billi|bandar) ?(bite|scratch|lick)|dog bite|bitten by (a )?dog|kutt(a|e) (ne )?kaat|animal bite|monkey bite|bandar (ne )?kaat|cat bite/i,
    snakeBite: /snake ?bite|saa?np (ne )?kaat/i,
    injury: /injur|trauma|road traffic|assault|maar ?peet|chot|wound|ghaav|ghav|fall|gir (gaya|gayi|gaye)|accident|cut\b|kat gaya|sprain|moch/i,
    burn: /\bburns?\b|burnt|jal gaya|jal gayi|jhulas/i,
    worms: /worms?|keed[ae]|kriimi|krimi/i,
    vertigo: /vertigo|room spinning|ghoom(ta|ne)|spinning/i,
    giddy: /giddiness|giddy|dizz|chakkar|light ?headed/i,
    hearing: /(decreased|reduced|loss of|poor|less|kam) hearing|hearing loss|deaf|sunai (nahi|kam)|ear block/i,
    epistaxis: /epistaxis|nasal bleed|nose ?bleed|bleeding (from |of |in )?(the )?nose|nose bleeding|naak se khoon|nakseer/i,
    hypoPatch: /hypo ?-?pigment|(white|pale|light|halka|safed) (patch|daag)|(patch|daag)[^.;\n,]{0,15}(white|pale|halka|safed)/i,
    chronicUlcer: /(old|chronic|non.?healing|long.?standing|purana)[^.;\n]{0,15}ulcer|ulcer[^.;\n]{0,40}(>|more than|since|for)\s*\d+\s*(month|year|week|mahina|saal)|ulcer[^.;\n]{0,30}\d+\s*(months|years|saal)/i,
    labour: /labou?r pain|in labou?r|pain(s)? of labou?r|leaking|water broke|prasav (pida|dard)|dard (shuru|aa raha) .*delivery/i,
    postDated: /post.?dated|post.?term|overdue|past (the )?(due date|edd)|beyond edd|>\s*40 weeks|41 weeks|42 weeks/i,
    knownCase: /known case of|follow up case of|uncontrolled|\broutine\b|\bknown (htn|hypertensi|diabet|dm|type 2|tb|tubercul|thyroid)|on treatment for|on (att|akt|dots)\b|\bk\/?c\/?o\b/i,
    tbWord: /tubercul|\btb\b|koch|\batt\b|\bakt\b|\bdots\b/i,
    hyperthy: /hyperthyroid|thyrotoxic|grave'?s/i,
    hypothy: /hypothyroid/i,
    biteFollow: /vaccin|\barv\b|\bdose\b|injection|tika|follow|\bf\/u\b|old case|\b(2nd|3rd|4th|second|third|fourth) (dose|inj)/i,
    vaccineVisit: /vaccin|immuni[sz]|\barv\b|tika|teeka/i,
    fitness: /fitness|medical certificate|check ?up|routine (exam|check)|health check/i,
    suddenVision: /sudden[^.;\n]{0,25}(vision|blind)|(vision|blind)[^.;\n]{0,25}sudden/i,
    thal: /thalassemia|thalassaemia/i,
    neoJaundice: /neonatal jaundice|newborn[^.;\n]{0,15}(jaundice|yellow)|jaundice[^.;\n]{0,15}(newborn|neonat|baby)/i,
    yellowBody: /yellow\w* discolou?ration|peela pad/i,
    dental: /dental caries|\bcaries\b|cavity|daant (me|mein) keeda|decay/i,
    gum: /bleeding gums?|gums? bleed|calculus|\bstains?\b|deposit[^.;\n]{0,25}teeth|teeth[^.;\n]{0,25}deposit|mobil\w* (of )?(teeth|tooth)|loose (teeth|tooth)|food lodg|bad breath|halitosis|masude (se )?khoon/i,
    foreignBody: /foreign body|\bfb\b (in )?(ear|nose|eye|throat)/i,
    earOnly: /ear ?ache|otalgia|discharging (right|left|re|le|ear|both ears)|(blocked|wax|ringing sensation|tinnitus)[^.;\n]{0,15}(right|left|re\b|le\b|ear)?|\bcsom\b|otorrh/i,
    earWax: /\bwax\b|blocked (re|le|right|left|ear|both ears)/i,
    tinnitus: /ringing sensation|tinnitus/i,
    stickyEye: /sticky eyes?|epiphora|watering (of )?eyes?|eyes? watering/i,
    fracture: /#|fracture|\bfx\b|plaster|external fix|ext fix/i,
    headInj: /head (injury|trauma)|trauma to head|sir (me|mein|par) chot|scalp (injury|wound|cut|lacerat\w*|tear)|(injur\w*|wound|cut|chot|lacerat\w*|tear|swelling)[^,.;\n]{0,10}(in|on|over|of|at) (the )?(scalp|head|sir)|sir (fat|phat)/i,
    limb: /\b(hand|hands|foot|feet|leg|legs|arm|arms|hip|shoulder|elbow|thigh|heel|calf|limb|scalp|chest wall)\b/i,
    neckPain: /neck pain|pain[^.;\n]{0,10}neck|cervical (pain|spond)|upper back/i,
    fissure: /fissure|painful defecation|pain (during|on|while) defecation|latrine (me|mein|ke time) dard/i,
    lymph: /lymphadenopath|lymph node|gilti|gaanth/i,
    wellBaby: /well baby|healthy baby|growth monitoring|routine (baby|child) check/i,
    poorGain: /poor (weight|wt)( gain)?|poor di[e]?t|not gaining weight|malnutrition|low birth weight|prematur|\blbw\b|\bsam\b|\bmam\b/i,
    exCry: /excess\w* cry|irritable (baby|child|infant)|breath holding/i,
    enuresis: /enuresis|bed ?wetting|bistar (geela|gila)/i,
    lscs: /\blscs\b|previous cs\b|c(a)?esarean|c.?section/i,
    alcohol: /alcoh?ol|chr alch|sharab|daru/i,
    routineFu: /routine (f\/u|follow|visit)|follow.?up( visit| case)?\s*$|^\W*(follow up case of|follow.?up|f\/u|review|repeat medicine|dawa lene)\W*$/i,
    noComplaint: /no (fresh )?complain|asymptomatic|no problem/i,
    bareNcd: /^[\s,\/&?.()0-9-]*((uncontrolled|accelerated|acc|known case of|follow up case of|and|with|type 2 diabetes|diabetes mellitus|diabet\w*|dm|htn|hypertension|ii|2)[\s,\/&?.()0-9-]*)+$/i,
    radiateArm: /radiat\w*[^.;\n]{0,25}(arm|shoulder|hand)|(arm|shoulder|hand)[^.;\n]{0,15}(tak|me) (jata|ja raha)/i,
    radiateLeg: /radiat\w*[^.;\n]{0,25}(leg|thigh|foot|buttock|calf)|sciatica|(leg|pair) (tak|me) (jata|ja raha)|shooting[^.;\n]{0,15}leg/i,
    radiateBack: /radiat\w*[^.;\n]{0,20}back|tearing|between (the )?shoulder blades|interscapular/i,
    pleuritic: /pleuritic|(pain|dard)[^.;\n]{0,25}(breath|saans|cough|khans)|(deep )?breath(ing)?[^.;\n]{0,15}pain/i,
    chestWall: /chest wall|tender(ness)? (over|on|of) (the )?(chest|rib|sternum)|costochondr|pressing (the )?chest/i,
    dermatomal: /dermatom|band.?like|belt.?like|(blister|vesicle|rash|daane)[^.;\n]{0,30}(one side|left|right|band)|herpes zoster|shingles|\bzoster\b|nagin/i,
    caudaEq: /saddle|(urine|peshab|urinary)[^.;\n]{0,25}(retention|not pass|ruk|nahi)|(bowel|bladder) (incontinence|control)|both legs? (weak|numb)|weakness (of |in )?both legs/i,
    backRed: /night pain|pain at (night|rest)|raat (ko|me) dard|weight loss|wajan kam|known (cancer|ca\b)|fever[^.;\n]{0,15}back|back[^.;\n]{0,15}fever|gibbus|tb spine|pott/i,
    headSite: /(one|left|right|half|single)[ -]?sided headache|headache[^.;\n]{0,15}(one|left|right|half) side|unilateral headache|hemicrania|adhe sir|aadha sir|migraine|occipital|back of (the )?head|temporal|temple|frontal|forehead|periorbital|around (the )?eye|behind (the )?eye/i,
    hypoSens: /numb|tingl|jhunjhun|sunn|pins and needles|burning (feet|soles|hands)|paresthes/i,
    gloveStock: /(both|dono)[^.;\n]{0,15}(feet|foot|soles|hands|legs)|(feet|soles|hands)[^.;\n]{0,15}(both|dono)|glove|stocking/i,
    paraWeak: /(weakness|cannot move|unable to (walk|stand|move))[^.;\n]{0,20}both legs|both legs[^.;\n]{0,15}(weak|paraly)|paraple|parapar/i,
    facialPalsy: /bell'?s palsy|facial (palsy|weakness|paralysis)|(face|mouth|muh)[^.;\n]{0,15}(deviat|tedha|droop)|cannot close (the )?eye/i,
    suddenDeaf: /sudden[^.;\n]{0,20}(deaf|hearing loss|loss of hearing)|(deaf|hearing loss)[^.;\n]{0,15}sudden/i,
    diplopia: /diplopia|double vision|do do dikh/i,
    lidSwell: /(eye ?lid|palpebral|periorbital|around (the )?eyes?)[^.;\n]{0,15}(swell|puff)|(swell|puff)\w*[^.;\n]{0,15}(eye ?lid|around (the )?eyes?|face (in|on) (the )?morning)|puffy (face|eyes)/i,
    hotJoint: /(hot|warm|red)[^.;\n]{0,20}(joint|knee|ankle|wrist|elbow|ghutn)|(joint|knee|ankle|wrist|elbow)[^.;\n]{0,20}(hot|warm|red)/i,
    groinItch: /(itch|khujli|rash|ring)[^.;\n]{0,20}(groin|thigh|jangh|private part)|(groin|jangh)[^.;\n]{0,20}(itch|khujli|rash)|tinea cruris/i,
    feetItch: /(itch|khujli|crack|peeling)[^.;\n]{0,20}(between (the )?toes|toe ?web|feet|foot)|athlete'?s foot|tinea pedis/i,
    scalpItch: /(itch|khujli|patch|hair loss|dandruff|scaling)[^.;\n]{0,20}scalp|scalp[^.;\n]{0,20}(itch|khujli|patch|scal)|tinea capitis/i,
    nodeRegion: /(cervical|neck|gale|gardan|submandibular|axill\w*|armpit|bagal|inguinal|groin|jangh|supraclavicular|occipital|preauricular)[^.;\n]{0,25}(lymph|node|gland|gilti|gaanth|swelling)|(lymph|node|gland|gilti|gaanth)[^.;\n]{0,25}(cervical|neck|axill\w*|armpit|inguinal|groin|supraclavicular)|lymphadenopath/i,
    spleenBig: /splenomegal|spleen|tilli|left (upper|hypochondri)[^.;\n]{0,20}(mass|lump|heavi|swelling)/i,
    breastLump: /breast[^.;\n]{0,20}(lump|mass|gaanth|swelling)|(lump|gaanth)[^.;\n]{0,15}breast/i,
    faceSwell: /swell[^.;\n]{0,30}(face|cheek|jaw|parotid|below (the )?ear)|(face|cheek|jaw|parotid)[^.;\n]{0,20}swell|mumps|galsua/i,
    menses: /irregular (period|menses)|heavy (period|bleeding)|period (zyada|jyada)|menorrhagia|masik/i,
    whiteDis: /white discharge|safed paani|leucorrh?oea|vaginal discharge/i,
    seizure: /seizure|convulsion|fits?\b|mirgi|daura|jhatke/i,
    stroke: /one side weak|half body|lakwa|paralysis|facial (deviation|droop)|muh tedha|slurred speech|zubaan ladkhada|hemipar/i,
    wheeze: /wheez|asthma|dama|saa?ns (phool|phulna|ki taklif)|breathless|copd/i,
    sinus: /sinus|nose block|naak band|blocked nose|facial pain/i,
    mouthUlcer: /mouth ulcer|oral ulcer|chhale|chaale|ulcers? in mouth/i,
    lump: /lump|gaanth|ganth|swelling/i,
    eyelid: /eyelid|palak|stye|gudheri|anjani/i,
    blur: /blur|dimin\w* (of )?vision|dim vision|decreas\w* vision|low vision|poor vision|presbyopia|refractive|difficulty in (reading|seeing)|dhundhla|dhundla|cannot see|kam dikh|vision (loss|decreased)|cataract|motiyabind/i,
    mood: /sad|udaas|udas|depress|ghabrahat|anxiety|anxious|tension|neend nahi|insomnia|can'?t sleep/i,
    palpit: /palpitation|dhadkan (tez|badh)|heart racing/i,
    urineRet: /cannot pass urine|peshab (nahi|ruk)|retention/i,
    abd: /\b(abdomen|abdominal|abd|stomach|tummy|belly|pet|pait|peit|epigastri\w*|umbilic\w*|navel|naabhi|nabhi)\b/i,
    rLower: /right (lower|iliac)|\brif\b|\brlq\b|mcburney|daayi?n? (taraf|side|or) neeche|right side (neeche|lower)/i,
    rUpper: /right (upper|hypochondri\w*)|\bruq\b|gall ?(bladder|stone)|pitt/i,
    lowerAbd: /lower (abd\w*|belly|stomach|tummy)|suprapubic|pedu|neeche (pet|ka pet)|pet (ke )?neeche/i,
    upperAbd: /upper (abd\w*|belly|stomach|tummy)|epigastri|upar (pet|ka pet)|pet (ke )?upar/i,
    fattyFood: /fatty|oily|tel wala|after (food|meal|eating)|khana khane ke baad/i,
    vomitW: /vomit|ulti/i,
    periods: /period|menses|mahwari|masik|mc\b/i,
    constip: /constipat|kabz|qabz|kabj|latrine (nahi|saaf nahi)|potty (nahi|hard)|hard stool/i,
    alteredSens: /unconscious|drowsy|drowsiness|confus|behosh|altered (sensorium|consciousness|behaviou?r)|disorient|not responding|lethargic|sust pad|hosh nahi/i,
    cannotDrink: /cannot (drink|feed|breast ?feed)|unable to (drink|feed)|not (drinking|feeding|taking feeds?)|doodh nahi (pee|pi)|feed nahi le/i,
    vomitsAll: /vomits everything|vomiting everything|sab (kuch )?ulti|kuch bhi nahi ruk/i,
    missedPeriod: /missed (period|menses)|period (miss|nahi aaya|late)|late period|mahina (nahi aaya|band|ruk)|amenorr/i,
    pvBleed: /bleeding (per vagina|pv)|vaginal bleeding|\bpv bleed|pv spotting|neeche se khoon/i,
    headacheSevere: /thunderclap|worst headache|sudden severe headache|sabse tez sir ?dard|achanak tez sir ?dard/i,
    neckStiff: /neck stiff|stiff neck|gardan (akad|jakad)/i,
    haematemesis: /vomiting blood|blood in vomit|ha?ematemesis|khoon ki ulti|ulti (me|mein) khoon/i,
    melaena: /black (tarry )?stool|mela?ena|kala (paikhana|latrine|potty|mal)/i,
    bloodStool: /blood in (stool|motion)|bloody (stool|diarrh)|dysentery|latrine (me|mein) khoon|potty (me|mein) khoon|mucus/i,
    longPain: /more than 20 min|> ?20 min|20 minute|half an hour|aadha ghanta/i,
    suicide: /suicid|self.?harm|kill (my|him|her)self|end (my|his|her) life|marna chaht|jeena nahi chaht|khudkhushi|aatmahatya/i,
    eschar: /eschar|black scab|kala (daag|khurand)|burnt cigarette/i,
    spleen: /spleen|splenomegal|tilli/i,
    skinDark: /skin (darken|black)|kala pad (gaya|raha)|darkening/i,
    conjSuff: /conjunctival suffusion|red eyes? without discharge/i,
    calfTender: /calf (pain|tender)|pindli (me|mein) dard|muscle tender/i,
    floodExp: /flood|sewage|\brats?\b|paddy|khet (me|mein) kaam|naala|drain water|gande paani/i,
    sickle: /sickle|sickling/i,
    painCrisis: /pain crisis|recurrent (bone|joint|limb) pain|baar baar (haddi|jod|hath pair) (me|mein )?dard/i,
    patchAnaes: /(patch|daag|dhabba|chakatta)[^.;\n]{0,40}(numb|sunn|no sensation|loss of sensation|anaesth|anesth|sensation (nahi|kam))|(numb|sunn|anaesth|anesth)[^.;\n]{0,40}(patch|daag|dhabba)/i,
    ringworm: /ringworm|\btinea\b|daad|daadh|ring.?shaped|annular/i,
    oralPatch: /(white|red) patch (in|on) (mouth|tongue|cheek)|leukoplakia|erythroplakia|munh (me|mein) (safed|laal) (daag|dhabba)/i,
  };
  const near = (t, ...res) => t.split(/[.;!?\n]+/).some((s) => res.every((r) => r.test(s)));

  // ---------- words (English + common Hindi / Hinglish)
  const W = {
    fever: /fever|bukh?aa?r|jwar|pyrexia|feverish/i,
    chills: /chill|rigor|kapkapi|thand lag|shiver|sweat|paseena/i,
    bodyache: /body ?ache|badan dard|myalgia|joint pain|jod.*dard|retro.?orbital|aankh ke peeche/i,
    rash: /rash|daane|chakatte/i,
    bleed: /bleed|khoon|gum bleed|petechia/i,
    abdpain: /abd(omen|ominal)? pain|pain (in )?(the )?(abdomen|stomach|abd)|pet (me|mein )?dard|pet dard|stomach (pain|ache)|stomachache|tummy ache|belly ache/i,
    anorexia: /loss of appetite|bhook?h nahi|anorexia/i,
    cough: /cough|kh?aa?nsi|khasi/i,
    cold: /cold|\buri\b|\burti\b|running nose|rhinorr|nasal (discharge|congestion|block)|blocked nose|sardi|zukaa?m|runny nose|naak beh|sneez|chheenk|sore throat|gal(a|e) (me|mein )?(dard|kharash)|throat pain/i,
    breath: /breathless|short(ness)? of breath|\bsob\b|saa?ns (phool|lene)|dyspn/i,
    chestpain: /chest pain|seene (me|mein) dard|chest heaviness/i,
    crep: /crepitation|crackle|wheez/i,
    wtloss: /weight loss|wajan kam|vajan kam/i,
    nightsweat: /night sweat|raat (ko|me|mein) paseena/i,
    haemoptysis: /ha?emoptysis|blood[- ]?ting|blood in sputum|khoon.*(khansi|balgam)|balgam.*khoon/i,
    htn: /hypertension|\bhtn\b|high bp|bp (ki|ka) (dawa|davai)|bp badh/i,
    dm: /diabet|\bdm\b|sugar (ki|ka|hai)|madhumeh|polyuria|polydipsia|excess(ive)? thirst|pyaas|frequent urination/i,
    diarrhoea: /diarrh|loose (motion|stool)|dast|pechish/i,
    vomit: /vomit|ulti|nausea|ji machal/i,
    acidity: /acidity|gastritis|heart ?burn|jalan.*(pet|seena|chest)|(pet|seena) (me|mein) jalan|epigastric|indigestion|khatta dakar|bloat|gas/i,
    uti: /\buti\b|burning (and |in )?(micturition|urine)|(crying|pain) on micturition|dysuria|peshab (me|mein) jalan|jalan.*peshab|bar bar peshab|frequency of micturition/i,
    weak: /weak|anaemia|anemia|paleness|kamzori|fatigue|tired|thakan|pallor|pale|lazi|giddiness|chakkar|dizz/i,
    headache: /headache|sir ?dard|sar ?dard|migraine/i,
    backpain: /back ?pain|back ?ache|pain (over|in|of) (the )?(lower )?back|pain back|kamar (me|mein )?dard|kamar dard|lumbago/i,
    knee: /knee pain|ghut(na|ne)|joint pain|arthritis/i,
    itch: /itch|khujli|pruritus/i,
    nightitch: /night|raat|family|ghar (me|mein) (sab|sabko)/i,
    anc: /missed period|amenorr?hoea|amenorrhea|pregnan|mahina (nahi|band)|period nahi|\banc\b|^\W*\d+(\.5)? ?months?\W*$/i,
    sneeze: /sneez|chheenk/i,
    allergic: /allerg|dust|itchy eye/i,
    redeye: /red eye|aankh (lal|laal)|eye discharge|conjunctiv|aankh se paani/i,
  };

  // Rough duration in days from text like "3 days", "2 weeks", "x5d", "15 din", "1 mahina".
  function durationDays(t) {
    let d = 0;
    const take = (re, mult) => { let m; const r = new RegExp(re, "gi"); while ((m = r.exec(t))) d = Math.max(d, parseFloat(m[1]) * mult); };
    take("(\\d+(?:\\.\\d+)?)\\s*(?:days?|din|d\\b)", 1);
    take("x\\s*(\\d+)\\s*d", 1);
    take("(\\d+(?:\\.\\d+)?)\\s*(?:weeks?|wks?|hafte|hafta)", 7);
    take("(\\d+(?:\\.\\d+)?)\\s*(?:months?|mahin[ae]|mahina)", 30);
    return d;
  }

  // ---------- rules
  // Each rule: dx (label), search (term typed into CARE's diagnosis search), tests (list or
  // function of the signals), f(h) -> [score, reasons]. urgent:true rules are shown in a fixed
  // URGENT block above the ranked list and are never ranked away.
  // Sources (see "Indian OPD symptoms diagnoses and tests" report): ICMR Standard Treatment
  // Workflows (STW), ICMR Antimicrobial Treatment Guidelines 2019 (TG), NVBDCP malaria 2013,
  // NTEP, NP-NCD 2023, Anemia Mukt Bharat 2026, NACO STI/RTI 2024, MoHFW GDM 2018,
  // MoHFW Snakebite 2016, NCDC Rabies 2022, IMNCI / MoHFW respiratory STG 2016-17, FDSI 2025.
  // Rules marked "no Indian source" are clinical convention pending clinician review.
  const fev = (h) => h.fever || h.tempHigh;
  const RULES = [
    // ===== URGENT (never ranked away) =====
    { urgent: true, dx: "Acute encephalitis syndrome — admit / refer now", search: "Acute encephalitis", tests: ["MP", "RBS"], // ICMR STW AES
      f: (h) => fev(h) && (h.near(G.alteredSens) || h.near(G.seizure)) ? [10, ["fever", "altered sensorium or seizure"]] : [0] },
    { urgent: true, dx: "Child danger sign — refer urgently (IMNCI)", search: "Acute illness", tests: [], // IMNCI / MoHFW Resp STG
      f: (h) => h.under5 && (h.near(G.cannotDrink) || h.near(G.vomitsAll) || h.near(G.seizure) || h.near(G.alteredSens)) ? [10, ["child under 5 with a general danger sign"]] : [0] },
    { urgent: true, dx: "Rule out ectopic pregnancy — urine pregnancy test first", search: "Ectopic pregnancy", tests: ["UPT", "HB"], // NACO 2024 red flags
      f: (h) => h.abdP && (h.near(G.missedPeriod) || h.near(G.pvBleed)) && !h.male && !(h.gaMonths > 3) ? [9, ["abdominal pain", h.near(G.missedPeriod) ? "missed / late period" : "vaginal bleeding"]] : [0] },
    { urgent: true, dx: "Pregnancy danger sign / pre-eclampsia — refer", search: "Pre-eclampsia", tests: ["URINE", "HB"], // ICMR STW ANC 2025
      f: (h) => h.pregnant && (h.bpHigh || h.near(G.headacheSevere) || h.near(G.blur) || h.near(G.seizure) || h.near(G.pvBleed)) ? [9, ["pregnant", h.bpHigh ? `BP ${h.bp}` : null, h.near(G.pvBleed) ? "vaginal bleeding" : null, h.near(G.headacheSevere) || h.near(G.blur) ? "headache / blurred vision" : null]] : [0] },
    { urgent: true, dx: "Upper GI bleed — resuscitate and refer", search: "Upper gastrointestinal hemorrhage", tests: ["HB", "CBC", "BGRP"], // ICMR STW Gastroenterology
      f: (h) => h.near(G.haematemesis) || h.near(G.melaena) ? [9, [h.near(G.haematemesis) ? "vomiting blood" : null, h.near(G.melaena) ? "black stool" : null]] : [0] },
    { urgent: true, dx: "Snake bite — 20WBCT, give ASV without waiting for tests", search: "Snake bite", tests: ["WBCT"], // MoHFW Snakebite 2016
      f: (h) => h.near(G.snakeBite) ? [9, ["snake bite"]] : [0] },
    { urgent: true, dx: "Stroke (suspected) — note time last normal, rush to DH with CT", search: "Cerebrovascular accident", tests: ["RBS", "ECG"], // ICMR STW Neurology
      f: (h) => h.near(G.stroke) ? [9, ["one-sided weakness / facial deviation / speech", h.bpHigh ? `BP ${h.bp}` : null]] : [0] },
    { urgent: true, dx: "Acute coronary syndrome possible — ECG within 10 minutes", search: "Acute coronary syndrome", tests: ["ECG", "TROP", "RBS", "LIPID"], // ICMR STW Cardiology
      f: (h) => h.near(G.chestPain) && (h.near(G.exertion) || h.near(G.longPain) || h.bpHigh || h.dm || h.age >= 40) ? [9, ["chest pain", h.near(G.exertion) ? "sweating / exertion / radiating" : null, h.age >= 40 ? `age ${h.age}` : null]] : [0] },
    { urgent: true, dx: "Painful red eye with blurred vision — refer (glaucoma / keratitis)", search: "Acute angle-closure glaucoma", tests: [], // ICMR STW Ophthalmology
      f: (h) => h.near(G.eye, G.red) && (h.near(G.eye, G.pain) || h.near(G.blur) || /halo/i.test(h.text)) ? [8, ["red eye", "pain / blurred vision / haloes"]] : [0] },
    { urgent: true, dx: "Animal bite — wash 15 min; Cat III: RIG + vaccine", search: "Dog bite - wound", tests: [], // NCDC Rabies 2022
      f: (h) => h.near(G.dogBite) && !G.biteFollow.test(h.text) ? [8, ["animal bite", h.bdays > 0 ? `bite ${h.bdays} day${h.bdays > 1 ? "s" : ""} ago: still start PEP today (day 0 = first dose)` : null]] : [0],
      adv: (h) => `Animal bite: wash the wound with soap and running water for 15 minutes; do not apply chilli, oil or turmeric; do not stitch at once; Cat III (deep / bleeding / on face or hand): rabies immunoglobulin + vaccine; Td. Rabies vaccine (ID, NCDC 2022): ${arvDates(h.now, 0)}; complete all doses even if the animal is healthy` },
    { urgent: true, dx: "In labour / labour pains — shift to labour room, partograph", search: "Normal labor", tests: ["HB", "BGRP", "HIV", "HBSAG", "VDRL"], // MoHFW LaQshya / SBA guidelines
      f: (h) => h.near(G.labour) || (h.pregnant && h.gaMonths >= 8 && h.abdP) ? [9, [h.near(G.labour) ? "labour pains" : "late pregnancy with abdominal pain"]] : [0] },
    { urgent: true, dx: "Post-dated pregnancy — obstetric review today (induction after 41 weeks)", search: "Post-term pregnancy", tests: ["USG"], // MoHFW SBA / ICMR STW ANC
      f: (h) => h.near(G.postDated) ? [8, ["post-dated / overdue"]] : [0] },
    { urgent: true, dx: "Urinary retention — catheterise first", search: "Retention of urine", tests: ["URINE", "USG", "KFT"], // ICMR STW Urology
      f: (h) => h.near(G.urineRet) ? [8, ["cannot pass urine"]] : [0] },
    { urgent: true, dx: "Suicide risk — refer now; Tele-MANAS 14416", search: "Suicidal thoughts", tests: [], // ICMR STW Psychiatry
      f: (h) => h.near(G.suicide) ? [10, ["thoughts of self-harm"]] : [0] },

    // ===== Fever (malaria RDT is added to every fever; see rank()) =====
    { dx: "Malaria (suspected) — bivalent RDT on every fever", search: "Malaria", tests: ["MP"], // NVBDCP 2013
      f: (h) => fev(h) ? [3 + (h.chills ? 2 : 0), ["fever", h.chills ? "chills / sweating" : null]] : [0] },
    { dx: "Fever, unspecified", search: "Fever", tests: (h) => (h.fdays >= 3 ? ["CBC"] : []), // ICMR TG Ch.2: no tests/antibiotics day 1-2
      f: (h) => fev(h) ? [1, ["fever", h.tempHigh ? `Temp ${h.temp}` : null, h.fdays >= 3 ? `${h.fdays} days` : "day 1-2: tests can wait"]] : [0] },
    { dx: "Dengue (suspected) — watch warning signs, daily platelets", search: "Dengue fever", tests: (h) => [h.fdays >= 5 ? "DIGM" : "NS1", "CBC"], // ICMR STW Dengue
      f: (h) => { const n = [h.bodyache, h.rash, h.bleed, h.headache, h.vomit, /retro.?orbital|aankh ke peeche/i.test(h.text)].filter(Boolean).length;
        return fev(h) && n >= 2 ? [3 + (h.bleed ? 2 : 0), ["fever", `${n} dengue features`, h.fdays ? (h.fdays >= 5 ? "day 5+: IgM" : "day 1-4: NS1") : null]] : [0]; } },
    { dx: "Typhoid (enteric fever) — blood culture before antibiotics", search: "Typhoid fever", tests: (h) => ["BCULT", "CBC", "TYPHRDT", ...(h.fdays >= 7 ? ["WIDAL"] : []), "LFT"], // ICMR TG 2019; FDSI. Widal only supportive, after week 1
      f: (h) => fev(h) && (h.fdays >= 5 || (h.abdP && h.near(G.spleen))) ? [3 + (h.abdP || h.anorexia ? 1 : 0), ["fever", h.fdays >= 5 ? `${h.fdays} days` : null, h.abdP ? "abdominal symptoms" : null]] : [0] },
    { dx: "Scrub typhus (suspected) — consider doxycycline", search: "Scrub typhus", tests: ["SCRUB"], // DHR-ICMR 2015
      f: (h) => fev(h) && (h.near(G.eschar) || h.fdays >= 5) ? [h.near(G.eschar) ? 6 : 3, ["fever", h.near(G.eschar) ? "eschar" : `${h.fdays} days`]] : [0] },
    { dx: "Kala-azar (suspected) — rK39 RDT", search: "Visceral leishmaniasis", tests: ["RK39", "CBC"], // NEDL/FDSI rK39 at PHC; case definition to verify (NCVBDC)
      f: (h) => fev(h) && h.fdays >= 14 && (h.near(G.spleen) || h.wtloss || h.near(G.skinDark)) ? [5, ["fever > 2 weeks", h.near(G.spleen) ? "spleen" : null, h.wtloss ? "weight loss" : null]] : [0] },
    { dx: "Leptospirosis (suspected)", search: "Leptospirosis", tests: ["LEPTO", "CBC", "LFT", "KFT"], // ICMR TG 2019
      f: (h) => fev(h) && (h.near(G.conjSuff) || h.near(G.calfTender) || h.near(G.floodExp)) ? [4, ["fever", h.near(G.floodExp) ? "water / field exposure" : "calf tenderness / red eyes"]] : [0] },
    { dx: "Chikungunya (suspected)", search: "Chikungunya", tests: ["CHIK"], // ICMR TG Ch.2
      f: (h) => fev(h) && (h.near(G.joint, G.pain) || h.near(G.swell, G.joint)) ? [3, ["fever", "joint pain"]] : [0] },
    { dx: "Presumptive TB — sputum smear / NAAT", search: "Pulmonary tuberculosis", tests: ["SPUTUM", "CXR"], // NTEP
      f: (h) => (h.cough && (h.cdays >= 14 || h.wtloss || h.nightsweat)) || h.haemoptysis ? [5, [h.cough ? "cough" : null, h.cdays >= 14 ? `${h.cdays} days` : null, h.wtloss ? "weight loss" : null, h.nightsweat ? "night sweats" : null, h.haemoptysis ? "blood in sputum" : null]] : [0] },

    // ===== Respiratory / ENT =====
    { dx: "Acute upper respiratory infection — no tests or antibiotics", search: "Upper respiratory infection", tests: [], // ICMR TG 2019
      f: (h) => h.cold || (h.cough && h.cdays < 14 && !h.haemoptysis && !h.wtloss && !h.breath && !h.chestpain && !h.crep && !h.rrHigh && !h.rrFastChild) ? [2, [h.cold ? "cold / running nose / sore throat" : "cough", h.cough && h.cdays ? `${h.cdays} days` : null]] : [0] },
    { dx: "Pneumonia (child, IMNCI fast breathing)", search: "Pneumonia", tests: [], // MoHFW Resp STG 2017
      f: (h) => h.under5 && (h.cough || h.breath) && h.rrFastChild ? [6, ["cough / difficult breathing", `RR ${h.rr} (fast for age)`]] : [0] },
    { dx: "Lower respiratory infection / Pneumonia", search: "Pneumonia", tests: ["CBC", "CXR"], // ICMR TG 2019 (CXR where available)
      f: (h) => !h.under5 && h.cough && (h.breath || h.chestpain || h.crep || h.rrHigh || h.spo2Low) ? [3 + (fev(h) ? 1 : 0) + (h.spo2Low ? 1 : 0), ["cough", h.breath ? "breathlessness" : null, h.crep ? "crepitations" : null, h.rrHigh ? `RR ${h.rr}` : null, h.spo2Low ? `SpO₂ ${h.spo2}%` : null]] : [0] },
    { dx: "Asthma / COPD — peak flow", search: "Asthma", tests: (h) => ["PEF", "CXR", ...(h.cdays >= 14 ? ["SPUTUM"] : [])], // ICMR STW Pulmonology
      f: (h) => h.near(G.wheeze) ? [3, ["wheeze / breathlessness", h.spo2Low ? `SpO₂ ${h.spo2}%` : null]] : [0] },
    { dx: "Acute tonsillitis / pharyngitis", search: "Acute tonsillitis", tests: [], // ICMR TG 2019; STW ENT
      f: (h) => h.near(G.throat, G.pain) && fev(h) ? [3, ["sore throat", "fever"]] : [0] },
    { dx: "Acute sinusitis (<7 days usually viral)", search: "Acute sinusitis", tests: [], // ICMR STW ENT
      f: (h) => h.near(G.sinus) ? [2, ["nasal block / facial pain"]] : [0] },
    { dx: "Acute otitis media / ear discharge", search: "Acute otitis media", tests: [], // ICMR STW ENT
      f: (h) => h.near(G.ear, G.pain) || h.near(G.ear, G.discharge) || /ear ?ache|otalgia|discharging (right|left|re\b|le\b|ear|both ears)|\bcsom\b|otorrh/i.test(h.text) ? [3, ["ear pain / discharge"]] : [0] },
    { dx: "Allergic rhinitis", search: "Allergic rhinitis", tests: [], // no Indian source
      f: (h) => h.sneeze && h.allergic ? [2, ["sneezing", "allergy / dust"]] : [0] },

    // ===== NCD =====
    { dx: "Hypertension follow-up — check adherence and BP", search: "Essential hypertension", tests: ["KFT", "URINEACR", "LIPID", "RBS"], // NP-NCD; ICMR STW HTN
      f: (h) => h.htn && h.ncdKnown ? [h.bpHigh ? 5 : 4, ["known hypertensive", h.bp ? `BP ${h.bp}${h.bpHigh ? " — not controlled" : ""}` : null, h.bpSev ? "≥180/110: refer" : null]] : [0] },
    { dx: "Hypertension — repeat reading to confirm", search: "Essential hypertension", tests: ["FBS", "HBA1C", "URINEACR", "KFT", "LIPID", "ECG"], // ICMR STW HTN; NP-NCD
      f: (h) => !(h.htn && h.ncdKnown) && (h.bpHigh || h.htn) ? [h.bpHigh ? 3 : 2, [h.bp && h.bpHigh ? `BP ${h.bp}` : null, h.bpSev ? "≥180/110: start treatment and refer" : h.bpConfirm ? "≥160/100: confirmed in one visit" : null, h.htn ? (G.knownCase.test(h.text) ? "known HTN — follow-up, check adherence" : "known / mentioned HTN") : null]] : [0] },
    { dx: "Type 2 diabetes follow-up — FBS, HbA1c, feet, eyes", search: "Type 2 diabetes mellitus", tests: ["FBS", "HBA1C", "URINEACR", "KFT", "LIPID"], // NP-NCD; ICMR STW T2DM
      f: (h) => h.dm && h.ncdKnown ? [4, ["known diabetic", h.rbs ? `RBS ${h.rbs}` : null]] : [0] },
    { dx: "Diabetes (suspected) — confirm with FBS / HbA1c", search: "Type 2 diabetes mellitus", tests: ["FBS", "HBA1C", "LIPID", "URINEACR", "KFT"], // NP-NCD; ICMR STW T2DM
      f: (h) => (h.dm && !h.ncdKnown) || h.rbsSusp ? [h.rbsHigh ? 3 : 2, [h.dm ? "diabetes symptoms / history" : null, h.rbsSusp ? `RBS ${h.rbs}` : null]] : [0] },
    { dx: "Anaemia (to confirm) — Hb, sickling test", search: "Anemia", tests: ["HB", "CBC", "SICKLE"], // AMB 2026; FDSI
      f: (h) => h.weak ? [1, ["weakness / pallor / giddiness"]] : [0] },
    { dx: "Sickle cell disease (screen)", search: "Sickle cell disease", tests: ["SICKLE", "HB"], // FDSI/NEDL; trigger wording needs clinician review
      f: (h) => h.near(G.sickle) || (h.near(G.painCrisis) && (h.weak || /jaundice|peeliya/i.test(h.text))) ? [4, ["sickle history / recurrent pain crises"]] : [0] },
    { dx: "Palpitations — ECG", search: "Palpitations", tests: ["ECG", "TFT", "HB", "RBS", "KFT"], // ICMR STW Cardiology
      f: (h) => h.near(G.palpit) || (h.adult && h.pulse > 110) ? [3, ["palpitations", h.adult && h.pulse > 110 ? `Pulse ${h.pulse}` : null]] : [0] },
    { dx: "Chest pain — ECG", search: "Chest pain", tests: ["ECG", "TROP"], // ICMR STW Cardiology: any chest pain
      f: (h) => h.near(G.chestPain) ? [4, ["chest pain"]] : [0] },
    { dx: "Thyroid swelling (goitre)", search: "Goiter", tests: ["TFT", "USG"], // ICMR STW Endocrinology
      f: (h) => h.near(G.swell, G.neckSwell) || /goit|thyroid swell|swelling[^.;\n]{0,20}thyroid/i.test(h.text) ? [3, ["neck swelling / thyroid"]] : [0] },
    { dx: "Hyperthyroidism — follow-up", search: "Hyperthyroidism", tests: ["TFT", "CBC"], // ICMR STW Endocrinology
      f: (h) => G.hyperthy.test(h.text) ? [4, ["known hyperthyroidism"]] : [0] },
    { dx: "Hypothyroidism — follow-up", search: "Hypothyroidism", tests: ["TFT", "LIPID"], // ICMR STW Endocrinology
      f: (h) => G.hypothy.test(h.text) ? [4, ["known hypothyroidism"]] : [0] },
    { dx: "Tuberculosis on treatment — follow-up (NTEP, Ni-kshay)", search: "Pulmonary tuberculosis", tests: (h) => (h.cough ? ["SPUTUM"] : []).concat(["RBS", "HIV"]), // NTEP: DM and HIV screening for every TB patient
      f: (h) => G.knownCase.test(h.text) && G.tbWord.test(h.text) || /\b(on|taking) (att|akt|dots|tb (medicine|dawa))\b/i.test(h.text) ? [6, ["known TB / on treatment"]] : [0] },
    { dx: "Pedal oedema — find the cause (heart, kidney, liver, anaemia)", search: "Edema of lower extremity", tests: ["HB", "KFT", "LFT", "URINE", "ECG", "TFT"], // ICMR STW Cardiology/Endocrinology
      f: (h) => (h.near(G.swell, G.leg) && !h.near(G.red, G.leg) && !h.near(G.oneSide, G.leg)) || /anasarca|swelling (in|of|all over) (the )?(whole )?body/i.test(h.text) ? [3, [/anasarca|body/i.test(h.text) ? "generalised swelling" : "leg / feet swelling", h.near(G.bothSide, G.leg) ? "both legs" : null, h.bpHigh ? `BP ${h.bp}` : null]] : [0] },

    // ===== Abdomen / GI / renal =====
    { dx: "Acute gastroenteritis — assess dehydration, ORS + zinc", search: "Gastroenteritis", tests: (h) => (h.near(G.bloodStool) || h.ddays >= 7 ? ["STOOL"] : []), // ICMR AMR Ch.5; STW Paed Diarrhoea
      f: (h) => h.diarrhoea ? [2 + (h.vomit ? 1 : 0), ["loose motions", h.vomit ? "vomiting" : null, h.near(G.bloodStool) ? "blood in stool: treat as dysentery" : null]] : [0] },
    { dx: "Gastritis / dyspepsia", search: "Gastritis", tests: [], // no Indian guideline (JAPI 2024)
      f: (h) => h.acidity || h.near(G.upperAbd, G.pain) ? [h.near(G.upperAbd) ? 3 : 2, ["acidity / upper abdominal pain or burning"]] : [0] },
    { dx: "Acute appendicitis (suspected) — refer surgery", search: "Acute appendicitis", tests: ["CBC", "URINE", "USG"], // ICMR STW Appendicitis
      f: (h) => h.near(G.rLower) && (h.near(G.pain) || h.abdP) ? [4 + (h.near(G.vomitW) ? 1 : 0), ["right lower abdominal pain", h.near(G.vomitW) ? "vomiting" : null]] : [0] },
    { dx: "Biliary colic / gallstones (suspected)", search: "Biliary colic", tests: ["USG", "LFT", "CBC"], // ICMR STW Surgery
      f: (h) => h.near(G.rUpper) && (h.near(G.pain) || h.abdP) ? [3 + (h.near(G.fattyFood) ? 1 : 0), ["right upper abdominal pain", h.near(G.fattyFood) ? "after fatty food" : null]] : [0] },
    { dx: "Abdominal pain — examine (site, tenderness, guarding)", search: "Abdominal pain", tests: (h) => [...(h.repro ? ["UPT"] : []), "CBC", "URINE", "USG"], // NACO: UPT first in women
      f: (h) => h.abdP ? [2, ["abdominal pain", h.near(G.upperAbd) ? "upper" : h.near(G.lowerAbd) ? "lower" : null, h.repro ? "woman 15-49: pregnancy test first" : null]] : [0] },
    { dx: "Dysmenorrhoea (painful periods)", search: "Dysmenorrhea", tests: ["UPT"], // NACO: block if period missed
      f: (h) => (h.near(G.lowerAbd, G.pain) || h.abdP) && h.near(G.periods) && !h.near(G.missedPeriod) && !h.male ? [3, ["lower abdominal pain", "with periods"]] : [0] },
    { dx: "Viral hepatitis / jaundice", search: "Viral hepatitis", tests: (h) => ["LFT", "HBSAG", "HCV", "USG", ...(fev(h) ? ["MP", "BCULT"] : [])], // ICMR STW Gastro; NVHCP
      f: (h) => (h.near(G.yellow) || G.yellowBody.test(h.text)) && !G.neoJaundice.test(h.text) ? [4, ["yellow eyes / urine / body", fev(h) ? "with fever: test malaria, blood culture" : null]] : [0] },
    { dx: "Renal colic (kidney stone)", search: "Renal colic", tests: ["URINE", "KUB", "USG", "KFT"], // ICMR STW Urology
      f: (h) => h.near(G.flank) ? [3, ["flank pain / stone", fev(h) ? "fever with rigors: refer" : null]] : [0] },
    { dx: "Urinary tract infection", search: "Urinary tract infection", tests: (h) => ["URINE", ...(fev(h) && h.near(G.flank) ? ["BCULT"] : [])], // ICMR STW Nephrology
      f: (h) => h.uti ? [3, ["burning / frequent urination"]] : [0] },
    { dx: "Haemorrhoids (piles)", search: "Hemorrhoids", tests: ["HB"], // ICMR STW Gastro (bleed flags)
      f: (h) => h.near(G.piles) ? [3, ["piles / bleeding per rectum"]] : [0] },
    { dx: "Hernia / groin or scrotal swelling (hydrocele) — refer surgery", search: "Inguinal hernia", tests: ["USG"], // no Indian source
      f: (h) => h.near(G.groin) ? [3, ["groin / scrotal swelling"]] : [0] },
    { dx: "Constipation", search: "Constipation", tests: [], // no Indian source
      f: (h) => h.near(G.constip) ? [3, ["constipation"]] : [0] },
    { dx: "Intestinal worms", search: "Helminthiasis", tests: ["STOOL", "HB"], // NDD SOP
      f: (h) => h.near(G.worms) ? [3, ["worms"]] : [0] },

    // ===== Women / pregnancy =====
    { dx: "Pregnancy / ANC visit", search: "Pregnancy", tests: ["UPT", "HB", "URINE", "BGRP", "OGTT", "VDRL", "HIV", "HBSAG", "MP"], // ICMR STW ANC 2025; GDM 2018; Syphilis 2014
      f: (h) => h.anc || (G.lscs.test(h.text) && !h.male) ? [h.gaMonths ? 5 : 3, [G.lscs.test(h.text) ? "previous LSCS: high-risk, plan hospital delivery" : null, h.gaMonths ? `pregnancy / amenorrhoea ${h.gaMonths} months` : "missed period / pregnancy", h.gaMonths >= 9 ? "term — birth plan, institutional delivery" : h.gaMonths >= 6 ? "check BP, Hb, fetal movements" : null]] : [0] },
    { dx: "Rabies post-exposure vaccination — next dose (days 0, 3, 7, 28)", search: "Requires rabies vaccination course", tests: [], // NCDC Rabies 2022
      f: (h) => h.near(G.dogBite) && G.biteFollow.test(h.text) || /rabies|\barv\b/i.test(h.text) ? [6, ["bite follow-up / rabies vaccine", arvDay0(h) ? null : "check the vaccination card for day 0"]]
        : h.near(G.dogBite) && h.bdays >= 2 ? [5, [`bite ${h.bdays} days ago`, "if vaccine already started: next dose from the card"]] : [0],
      adv: (h) => { const d0 = arvDay0(h); return `Rabies vaccine (ID, NCDC 2022): ${d0 ? arvDates(h.now, d0) : "next doses on day 3, 7 and 28 counted from the first dose (day 0) \u2014 check the card"}`; } },
    { dx: "Immunisation visit", search: "Immunisation due", tests: [], // UIP
      f: (h) => G.vaccineVisit.test(h.text) && !/rabies|\barv\b/i.test(h.text) && !h.near(G.dogBite) ? [2, ["vaccination"]] : [0] },
    { dx: "General check-up / fitness certificate", search: "General medical examination", tests: ["HB", "RBS"], // no Indian source; NP-NCD opportunistic screening age 30+
      f: (h) => G.fitness.test(h.text) && !h.anc ? [1, ["check-up / fitness"]] : [0] },
    { dx: "Vaginal discharge — speculum exam, NACO kit 1 / 2", search: "Vaginal discharge", tests: ["KOH", "VDRL", "HIV"], // NACO 2024
      f: (h) => h.near(G.whiteDis) ? [3, ["white discharge"]] : [0] },
    { dx: "Menstrual disorder (heavy / irregular periods)", search: "Menorrhagia", tests: ["HB", "UPT", "USG"], // AMB Hb; ICMR OBG STW not retrieved
      f: (h) => h.near(G.menses) ? [3, ["heavy / irregular periods"]] : [0] },

    // ===== Skin / MSK / eye / dental / neuro / mental =====
    { dx: "Leprosy (suspected) — test sensation, refer NLEP", search: "Leprosy", tests: [], // NLR India sheet (NLEP 2024)
      f: (h) => h.near(G.patchAnaes) || /thick(ened)? nerve/i.test(h.text) ? [6, ["skin patch with loss of sensation"]] : G.hypoPatch.test(h.text) ? [4, ["hypopigmented patch", "test sensation in the patch"]] : [0] },
    { dx: "Chronic non-healing ulcer — check sugar, sensation; refer if > 6 weeks", search: "Chronic ulcer of skin", tests: ["RBS", "HBA1C", "CBC"], // no Indian source (clinical convention)
      f: (h) => G.chronicUlcer.test(h.text) ? [4, ["long-standing ulcer"]] : [0] },
    { dx: "Epistaxis (nose bleed) — pinch nose, check BP", search: "Epistaxis", tests: ["CBC"], // no Indian source
      f: (h) => G.epistaxis.test(h.text) ? [4, ["bleeding from nose"]] : [0] },
    { dx: "Hearing loss — otoscopy (wax / otitis)", search: "Hearing loss", tests: [], // NPPCD
      f: (h) => G.hearing.test(h.text) ? [3, ["decreased hearing"]] : [0] },
    { dx: "Parotitis / mumps (to rule out)", search: "Mumps", tests: [], // no Indian source
      f: (h) => G.faceSwell.test(h.text) ? [3, ["swelling of face / below ear"]] : [0] },
    { dx: "Giddiness / dizziness — check BP, sugar, Hb", search: "Dizziness", tests: ["RBS", "HB"], // no Indian source
      f: (h) => G.giddy.test(h.text) && !h.near(G.vertigo) ? [2, ["giddiness"]] : [0] },
    { dx: "Scabies — treat contacts", search: "Scabies", tests: [], // ICMR STW Dermatology
      f: (h) => (h.itch && h.nightitch) || /scabies/i.test(h.text) ? [3, ["itching", "worse at night / family members"]] : [0] },
    { dx: "Tinea (ringworm)", search: "Tinea corporis", tests: ["KOH"], // ICMR STW Dermatology
      f: (h) => h.near(G.ringworm) ? [3, ["ring-shaped itchy patch"]] : [0] },
    { dx: "Dermatitis", search: "Dermatitis", tests: [], // ICMR STW Dermatology
      f: (h) => h.itch && !h.nightitch && !h.near(G.ringworm) ? [1, ["itching / rash"]] : [0] },
    { dx: "Cellulitis of lower limb", search: "Cellulitis of lower limb", tests: ["CBC", "RBS"], // ICMR STW Dermatology
      f: (h) => h.near(G.swell, G.leg) && h.near(G.red, G.leg) ? [3 + (h.near(G.warm) || h.tempHigh ? 1 : 0), ["leg swelling", "redness", h.near(G.warm) || h.tempHigh ? "warm / fever" : null]] : [0] },
    { dx: "Deep vein thrombosis (suspected) — refer", search: "Deep venous thrombosis of lower extremity", tests: ["DOPPLER"], // no Indian source
      f: (h) => h.near(G.swell, G.leg, G.oneSide) && !h.near(G.red, G.leg) && (h.near(G.pain, G.leg) || /calf|pindli/i.test(h.text)) ? [3, ["one leg swollen", "calf / leg pain"]] : [0] },
    { dx: "Gout", search: "Gout", tests: ["URIC"], // no Indian guideline
      f: (h) => h.near(G.bigToe, G.pain) || h.near(G.bigToe, G.swell) ? [3, ["big toe pain / swelling"]] : [0] },
    { dx: "Rheumatoid arthritis (to confirm)", search: "Rheumatoid arthritis", tests: ["RAF", "ESR", "CBC"], // no Indian guideline; RAF on PHC list
      f: (h) => (h.near(G.swell, G.joint) || h.near(G.pain, G.joint)) && h.near(G.morningStiff) ? [3, ["joint pain / swelling", "morning stiffness"]] : [0] },
    { dx: "Joint swelling / arthritis", search: "Arthritis", tests: ["ESR", "URIC", "CBC", "XRAY"], // generic fallback; ICMR STW OA/gout workup
      f: (h) => h.near(G.swell, G.joint) && !fev(h) && !h.near(G.morningStiff) ? [2, ["joint swelling"]] : [0] },
    { urgent: true, dx: "Sudden loss of vision — refer to eye specialist now", search: "Sudden visual loss", tests: ["RBS"], // ICMR STW Ophthalmology
      f: (h) => G.suddenVision.test(h.text) ? [9, ["sudden diminishing of vision"]] : [0] },
    { dx: "Head injury — GCS, vomiting, loss of consciousness; CT if red flags", search: "Head injury", tests: [], // ICMR STW Neurosurgery
      f: (h) => G.headInj.test(h.text) ? [6, ["head / scalp injury", /scalp/i.test(h.text) ? "clean, close the wound; Td" : null]] : [0],
      adv: (h) => `Head injury: watch for vomiting, drowsiness, fits, bleeding from ear / nose, severe headache: come back at once (CT needed)${/scalp|wound|cut|lacerat/i.test(h.text) ? "; scalp wound: clean, suture, Td if not taken in 5 years" : ""}` },
    { dx: "Thalassaemia — follow-up / transfusion", search: "Thalassemia", tests: ["HB", "CBC", "BGRP", "HIV", "HBSAG", "HCV", "LFT"], // National guidelines on haemoglobinopathies 2016
      f: (h) => G.thal.test(h.text) && !h.near(G.sickle) ? [6, ["thalassaemia", /transfus/i.test(h.text) ? "for transfusion: pre-transfusion Hb" : null]] : [0] },
    { dx: "Neonatal jaundice — serum bilirubin; urgent if < 24 h old or palms / soles yellow", search: "Neonatal jaundice", tests: ["LFT", "BGRP", "CBC"], // IMNCI / FBNC
      f: (h) => G.neoJaundice.test(h.text) || (h.age === 0 && (h.near(G.yellow) || G.yellowBody.test(h.text))) ? [6, ["jaundice in a newborn"]] : [0] },
    { dx: "Well-baby visit — weight, feeding, immunisation due", search: "Well child", tests: [], // UIP / RBSK
      f: (h) => G.wellBaby.test(h.text) || (/routine|regular|check ?up/i.test(h.text) && (h.age == null || h.age < 6) && !/fitness/i.test(h.text)) ? [4, ["well baby / routine check-up"]] : [0] },
    { dx: "Poor weight gain / low birth weight — plot growth, MUAC, feeding", search: "Failure to thrive", tests: ["HB"], // MoHFW SAM guidelines; AMB
      f: (h) => G.poorGain.test(h.text) ? [4, ["poor weight gain / low birth weight"]] : [0] },
    { dx: "Excessive crying / breath-holding (infant) — examine ears, abdomen, hernia", search: "Excessive crying of infant", tests: (h) => (/breath holding/i.test(h.text) ? ["HB"] : []), // no Indian source
      f: (h) => G.exCry.test(h.text) ? [3, ["excessive cry / breath-holding spell"]] : [0] },
    { dx: "Enuresis (bed-wetting)", search: "Enuresis", tests: ["URINE", "RBS"], // no Indian source
      f: (h) => G.enuresis.test(h.text) ? [3, ["bed-wetting"]] : [0] },
    { dx: "Foreign body (ear / nose / throat / eye) — do not probe blindly; refer", search: "Foreign body", tests: [], // ICMR STW ENT
      f: (h) => G.foreignBody.test(h.text) ? [5, ["foreign body"]] : [0] },
    { dx: "Ear wax / blocked ear", search: "Impacted cerumen", tests: [], // ICMR STW ENT
      f: (h) => G.earWax.test(h.text) ? [3, ["blocked ear / wax"]] : [0] },
    { dx: "Tinnitus — otoscopy, hearing test", search: "Tinnitus", tests: [], // NPPCD
      f: (h) => G.tinnitus.test(h.text) ? [3, ["ringing in the ear"]] : [0] },
    { dx: "Vaginal bleeding — pregnancy test first", search: "Abnormal uterine bleeding", tests: ["UPT", "HB", "USG"], // AMB Hb; ICMR STW ANC
      f: (h) => h.near(G.pvBleed) && !h.abdP && !h.pregnant ? [4, ["bleeding per vaginum"]] : [0] },
    { dx: "Difficulty swallowing / lump in throat — refer ENT; urgent if cannot swallow liquids", search: "Dysphagia", tests: ["HB"], // ICMR STW ENT
      f: (h) => /dysphagia|(unable|difficult\w*|pain) (to|in|on) swallow|lump in (the )?throat|nigalne (me|mein)/i.test(h.text) ? [4, ["difficulty swallowing"]] : [0] },
    { dx: "Anal fissure / painful defecation", search: "Anal fissure", tests: [], // no Indian source
      f: (h) => G.fissure.test(h.text) ? [3, ["painful defecation / fissure"]] : [0] },
    { dx: "Lymph node swelling — rule out TB (FNAC), examine throat / scalp", search: "Lymphadenopathy", tests: ["CBC", "ESR", "CXR"], // NTEP (extra-pulmonary TB)
      f: (h) => G.lymph.test(h.text) ? [4, ["lymph node swelling"]] : [0] },
    { dx: "Fracture follow-up — check X-ray, plaster / fixator, movement", search: "Fracture", tests: ["XRAY"], // no Indian source
      f: (h) => G.fracture.test(h.text) ? [5, ["fracture / plaster"]] : [0] },
    { dx: "Breathlessness — SpO₂, respiratory rate, chest exam", search: "Dyspnea", tests: ["CXR", "ECG", "HB"], // ICMR STW Pulmonology / Cardiology
      f: (h) => h.breath && !h.cough && !h.near(G.wheeze) ? [3, ["breathlessness", h.spo2Low ? `SpO₂ ${h.spo2}%` : null]] : [0] },
    { dx: "Nausea / vomiting — assess dehydration; pregnancy test if woman 15-49", search: "Vomiting", tests: (h) => (h.repro ? ["UPT"] : []), // no Indian source
      f: (h) => h.vomit && !h.diarrhoea && !h.abdP && !fev(h) && !h.anc ? [2, ["vomiting"]] : [0] },
    { dx: "Skin rash — examine (allergy, infection, drug)", search: "Skin rash", tests: [], // no Indian source
      f: (h) => (h.rash || /skin (race|allerg)|allergic skin|insect bite|urticaria|pitti/i.test(h.text)) && !fev(h) && !h.itch ? [2, ["rash / skin allergy"]] : [0] },
    { dx: "Body ache (myalgia) — check temperature", search: "Myalgia", tests: [], // no Indian source
      f: (h) => h.bodyache && !fev(h) && !h.cough && !h.cold && !h.near(G.pain, G.joint) ? [1, ["body ache"]] : [0] },
    { dx: "Neck / upper back pain", search: "Neck pain", tests: [], // no Indian source
      f: (h) => G.neckPain.test(h.text) && !G.headInj.test(h.text) ? [2, ["neck / upper back pain"]] : [0] },
    { dx: "Limb pain — examine; X-ray if injury or swelling", search: "Pain in limb", tests: (h) => (h.near(G.injury) || h.near(G.swell, G.limb) ? ["XRAY"] : []), // no Indian source
      f: (h) => h.near(G.pain, G.limb) && !h.near(G.chestPain) && !G.fracture.test(h.text) && !h.near(G.radiateLeg) && !h.near(G.radiateArm) && !h.near(G.swell, G.leg) ? [1, ["limb / shoulder / hip pain", h.days >= 90 ? "long-standing" : null]] : [0] },
    { dx: "Swelling of limb / scalp — examine (injury, infection)", search: "Swelling", tests: [], // no Indian source
      f: (h) => h.near(G.swell, G.limb) && !h.near(G.swell, G.leg) && !h.near(G.swell, G.joint) ? [1, ["local swelling"]] : [0] },
    { dx: "Alcohol use — assess dependence, liver; counsel", search: "Alcohol dependence", tests: ["LFT", "CBC", "RBS"], // ICMR STW Psychiatry
      f: (h) => G.alcohol.test(h.text) ? [3, ["alcohol use"]] : [0] },
    { dx: "Follow-up visit — review treatment and reports", search: "Follow-up examination", tests: [], // -
      f: (h) => G.routineFu.test(h.text.trim()) ? [1, ["routine follow-up"]] : [0] },
    { dx: "No complaint — screening: BP, sugar (age 30+), Hb", search: "General medical examination", tests: ["RBS", "HB"], // NP-NCD opportunistic screening
      f: (h) => G.noComplaint.test(h.text) ? [1, ["no complaint"]] : [0] },
    { dx: "Viral fever — if no focus found and malaria test negative", search: "Viral fever", tests: ["CBC"], // ICMR TG 2019: most short fevers are viral
      f: (h) => fev(h) && !(h.fdays >= 5) && !h.near(G.alteredSens) && !h.uti && !h.abdP ? [2, ["fever", h.fdays ? `${h.fdays} days` : null, "short fever, no focus"]] : [0] },
    { dx: "Scabies? — ask: worse at night, others at home itching", search: "Scabies", tests: [], // ICMR STW Dermatology
      f: (h) => h.itch && !h.nightitch && !/eye|groin|scalp|foot|feet|toe/i.test(h.text) && !h.near(G.ringworm) ? [1, ["itching", "check web spaces, night itch, family"]] : [0] },
    { dx: "Tinea (fungal)? — look for ring-shaped scaly patch", search: "Tinea corporis", tests: ["KOH"], // ICMR STW Dermatology
      f: (h) => h.itch && !h.near(G.ringworm) && !/eye|scalp/i.test(h.text) ? [1, ["itching", "look for ring-shaped patch"]] : [0] },
    // ===== From Sadar production data (doctors' own choices, Sep 2026) =====
    { dx: "Disorder of refraction (glasses) — check vision with pinhole", search: "Disorder of refraction", tests: [], // Sadar: commonest for gradual vision loss
      f: (h) => h.near(G.blur) && !G.suddenVision.test(h.text) ? [h.age != null && h.age >= 55 ? 2 : 4, ["gradual blurred vision", h.age != null && h.age < 40 ? `age ${h.age}` : null]] : [0] },
    { dx: "Presbyopia — difficulty reading near, age 40+", search: "Presbyopia", tests: [], // Sadar: 2nd commonest for gradual vision loss
      f: (h) => h.near(G.blur) && !G.suddenVision.test(h.text) && (h.age == null || h.age >= 40) ? [h.age != null && h.age >= 40 && h.age < 60 ? 4 : 2, ["blurred vision", h.age ? `age ${h.age}` : "if age 40+"]] : [0] },
    { dx: "Delivery normal", search: "Delivery normal", tests: [], // Sadar labour room
      f: (h) => /normal (vaginal )?delivery|delivery normal|vaginal delivery|\bnvd\b|labou?r pain|in labou?r/i.test(h.text) ? [6, ["delivery / labour"]] : [0] },
    { dx: "Delivery by caesarean section", search: "Deliveries by caesarean", tests: [], // Sadar labour room
      f: (h) => /\blscs\b|c(a)?esarean|c.?section|\bcs\b/i.test(h.text) && /done|delivered|delivery|post/i.test(h.text) ? [6, ["caesarean"]] : [0] },
    { urgent: true, dx: "Emergency caesarean indication (non-progress, meconium, breech, fetal distress)", search: "Delivery by emergency caesarean section", tests: ["HB", "BGRP"], // Sadar labour room
      f: (h) => /non.?progress|\bnpol\b|meconium|breech|fetal distress|foetal distress|obstructed|cpd\b/i.test(h.text) ? [8, ["labour complication"]] : [0] },
    { dx: "Otomycosis (fungal ear) — itching, white / black debris", search: "Otomycosis", tests: [], // Sadar ENT
      f: (h) => (h.near(G.ear, G.pain) || /ear ?ache|itch\w*[^,.;\n]{0,10}(ear|\ble\b|\bre\b|both ears)|ear[^,.;\n]{0,10}itch|discharg/i.test(h.text)) && /ear|\ble\b|\bre\b|both ears|discharging/i.test(h.text) ? [/itch/i.test(h.text) ? 4 : 3, ["ear pain / itching / discharge"]] : [0] },
    { dx: "Otitis externa — painful ear canal, pain on pulling ear", search: "Otitis externa", tests: [], // Sadar ENT
      f: (h) => h.near(G.ear, G.pain) || /ear ?ache|otalgia/i.test(h.text) ? [3, ["ear pain"]] : [0] },
    { dx: "Retraction of tympanic membrane — blocked ear, Eustachian tube", search: "Retraction of tympanic membrane", tests: [], // Sadar ENT
      f: (h) => /blocked|heaviness|fullness/i.test(h.text) && /ear|\ble\b|\bre\b|both ears/i.test(h.text) ? [2, ["blocked / heavy ear"]] : [0] },
    { dx: "Allergic rhinitis — sneezing, itchy nose", search: "Allergic rhinitis", tests: [], // Sadar ENT
      f: (h) => /sneez|chheenk|allerg\w* rhin|itchy nose/i.test(h.text) ? [4, ["sneezing"]] : [0] },
    { dx: "Gastro-oesophageal reflux — burning / lump in throat", search: "Gastrooesophageal reflux disease", tests: [], // Sadar ENT
      f: (h) => /burning[^,.;\n]{0,15}(throat|chest)|lump in (the )?throat|acid reflux|khatta pani/i.test(h.text) ? [4, ["burning / lump in throat"]] : [0] },
    { dx: "Tonsillitis — throat pain, check tonsils", search: "Tonsillitis", tests: [], // Sadar ENT
      f: (h) => /throat pain|sore throat|tonsil|gale? (me|mein) dard/i.test(h.text) ? [3, ["throat pain"]] : [0] },
    { dx: "Mobile tooth — periodontitis", search: "Mobility poor", tests: [], // Sadar dental
      f: (h) => /mobil\w*|loose (tooth|teeth)|hil(ta|te) daant/i.test(h.text) ? [5, ["loose teeth"]] : [0] },
    { dx: "Impacted third molar (wisdom tooth)", search: "Impacted third molar tooth", tests: ["XRAY"], // Sadar dental
      f: (h) => /impacted|wisdom|third molar|akal daad/i.test(h.text) ? [5, ["impacted / wisdom tooth"]] : [0] },
    { dx: "Dentine sensitivity", search: "Sensitivity", tests: [], // Sadar dental
      f: (h) => /sensitiv|thanda (pani )?lag/i.test(h.text) && /teeth|tooth|daant|dant|^\W*sensitivity\W*$/i.test(h.text) ? [4, ["teeth sensitive to cold"]] : [0] },
    { dx: "Root caries / root stump", search: "Root caries", tests: ["XRAY"], // Sadar dental
      f: (h) => /root (caries|stump|stamp)|rooth/i.test(h.text) ? [5, ["root caries / stump"]] : [0] },
    { dx: "Low birth weight infant — weight, feeding, warmth", search: "Low birth weight infant", tests: [], // Sadar paediatrics
      f: (h) => /\blbw\b|low birth weight/i.test(h.text) ? [5, ["low birth weight"]] : [0] },
    { dx: "Failure to gain weight — growth chart, feeding, Hb", search: "Failure to gain weight", tests: ["HB"], // Sadar paediatrics
      f: (h) => /failure to (gain|thrive)|not gaining weight|poor weight gain/i.test(h.text) ? [5, ["not gaining weight"]] : [0] },
    { dx: "Scrotal pain — examine testis; sudden severe = torsion, urgent", search: "Scrotal pain", tests: ["USG"], // Sadar surgery
      f: (h) => /scrot\w*[^,.;\n]{0,10}pain|pain[^,.;\n]{0,10}scrot|testi\w* pain/i.test(h.text) ? [5, ["scrotal pain"]] : [0] },
    { dx: "Carbuncle — incision and drainage if fluctuant; check blood sugar", search: "Carbuncle", tests: ["RBS"], // Harrison Ch 124: carbuncle -> look for diabetes
      f: (h) => /carbuncle|pus points|multiple (pus )?(points|heads|openings)|sieve/i.test(h.text) ? [6, ["carbuncle / many pus points", "check sugar (diabetes)"]] : [0] },
    // ---- Infections and local problems by body part (Bailey & Love / ICMR STW Surgery & Dermatology principles; needs clinician review)
    { urgent: true, dx: "Finger infection with tendon sheath signs — flexor tenosynovitis? refer urgently", search: "Tenosynovitis", searchBase: "Cellulitis of finger", tests: ["CBC", "RBS"],
      f: (h) => h.near(G.finger) && G.infect.test(h.text) && /(held|kept|stays?|remains?) (bent|flexed)|cannot (straighten|extend|open)|pain on (straighten|stretch|extend)\w*|whole finger swell|fusiform|sausage/i.test(h.text) ? [9, ["infected finger", "held bent / pain on straightening"]] : [0],
      adv: () => "Flexor tenosynovitis suspected: splint, elevate, IV antibiotics and refer the same day for surgical drainage" },
    { dx: "Paronychia — warm soaks; drain if pus", search: "Paronychia", tests: (h) => (/recur|again|baar baar/i.test(h.text) ? ["RBS"] : []),
      f: (h) => (/paronych|nail ?folds?|(side|edge|corner|around|beside|near) (of )?(the )?(finger ?|toe ?)?nail|nakhun (ke|me|mein) (paas|side|kinare)|(swell|pus|pain|red)\w*[^,.;\n]{0,20}(finger|toe)? ?nail/i.test(h.text)) && !/fung|thick\w* nail|discolou?r|ingrow|in-?grown/i.test(h.text) ? [6, ["swelling / pus at the nail fold"]] : [0],
      adv: () => "Paronychia: warm water soaks 3-4 times a day; drain if pus; antibiotic if spreading; keep hands dry" },
    { dx: "Felon (fingertip pulp infection) — drain early", search: "Felon", tests: ["RBS"],
      f: (h) => /felon|pulp (space )?infect|(finger ?tip|tip of (the )?(finger|thumb)|pulp)[^,.;\n]{0,20}(swell|pus|throbb|pain|infect)|(swell|pus|throbb|infect)\w*[^,.;\n]{0,20}(finger ?tip|tip of (the )?(finger|thumb))/i.test(h.text) ? [6, ["painful swollen fingertip"]] : [0],
      adv: () => "Felon: incision and drainage early (tense throbbing pulp), antibiotic, elevate; check sugar" },
    { dx: "Web space infection of hand — drain if pus; elevate", search: "Finger web space infection", searchBase: "Cellulitis of hand", tests: ["CBC", "RBS"],
      f: (h) => G.webSpace.test(h.text) && (h.near(G.finger) || h.near(G.hand) || G.infect.test(h.text)) && !h.near(G.footW) ? [7, ["infection between the fingers (web space)"]] : [0],
      adv: () => "Web space infection: incision and drainage if pus (collar-stud abscess), antibiotic, elevate the hand, review in 2 days" },
    { dx: "Hand / finger infection — look for pus, foreign body; elevate", search: "Cellulitis of finger", tests: (h) => ["CBC", "RBS", ...(/thorn|kaanta|glass|kaanch|splinter|nail prick|foreign/i.test(h.text) ? ["XRAY"] : [])],
      f: (h) => (h.near(G.finger) || h.near(G.hand)) && G.infect.test(h.text) && !G.webSpace.test(h.text) ? [5, ["infected finger / hand", /thorn|kaanta|glass|splinter/i.test(h.text) ? "foreign body: X-ray" : null]] : [0],
      adv: () => "Hand infection: elevate, antibiotic, drain if pus; X-ray if thorn / glass; Td if not taken in 5 years; return if finger cannot straighten" },
    { dx: "Infected wound — clean, dressing, antibiotic; tetanus (Td)", search: "Wound infection", tests: ["CBC", "RBS"], // UIP: Td for wound management
      f: (h) => /infected (wound|cut|injury|lacerat\w*|ulcer)|(wound|cut|injury)[^,.;\n]{0,20}(pus|infect|discharg|smell|foul)|pus from (the )?(wound|cut)/i.test(h.text) ? [6, ["wound with pus / infection"]] : [0],
      adv: () => "Infected wound: clean with saline, remove dead tissue, daily dressing, antibiotic; Td injection if not taken in 5 years; check sugar if slow to heal" },
    { urgent: true, dx: "Diabetic foot with gangrene / spreading infection — refer", search: "Diabetic foot", tests: ["RBS", "HBA1C", "CBC", "XRAY"], // NP-NCD (diabetes foot care)
      f: (h) => (h.dm || /diabet|sugar|\bdm\b/i.test(h.text)) && h.near(G.footW) && /black|gangren|smell|foul|spread|fever|kala pad/i.test(h.text) ? [9, ["diabetes", "foot: black / foul / spreading"]] : [0],
      adv: () => "Diabetic foot (gangrene / spreading infection): control sugar, IV antibiotics, refer to surgery the same day" },
    { dx: "Diabetic foot — ulcer / infection: dressing, offloading, sugar control", search: "Diabetic foot", tests: ["RBS", "HBA1C", "CBC", "XRAY"], // NP-NCD (diabetes foot care)
      f: (h) => (h.dm || /diabet|sugar|\bdm\b/i.test(h.text)) && h.near(G.footW) && /ulcer|wound|infect|pus|blister|swell|crack|sore|ghaav|ghav|zakhm/i.test(h.text) ? [7, ["diabetes", "foot ulcer / wound"]] : [0],
      adv: () => "Diabetic foot: check feet daily, clean dressing, no barefoot walking, offload pressure, control sugar; black skin, smell or fever = come back the same day" },
    { dx: "Ingrowing toenail — warm soaks; wedge excision if recurrent", search: "Ingrowing nail", tests: [],
      f: (h) => /ingrow\w*|in-?grown|toe ?nail[^,.;\n]{0,20}(pain|swell|pus|digging|ghus)|(pain|swell|pus)\w*[^,.;\n]{0,20}toe ?nail/i.test(h.text) ? [6, ["toenail growing into skin"]] : [0],
      adv: () => "Ingrowing toenail: warm soaks, cut nail straight across, wide shoes; antibiotic if infected; wedge excision if recurrent" },
    { dx: "Corn / callus — padding, proper footwear", search: "Corn", tests: [],
      f: (h) => /\bcorns?\b|callus|callosit|\bgatha\b|\bghatta\b|\bgatta\b/i.test(h.text) && !/corn ?flakes|corneal|cornea/i.test(h.text) ? [5, ["corn / callus"]] : [0],
      adv: () => "Corn: soft padding, well-fitting footwear, soak and gently pare; no blade at home; diabetics need foot check" },
    { dx: "Cracked heels — moisturise, footwear", search: "Cracked heel", searchBase: "Skin lesion", tests: [],
      f: (h) => /crack\w*[^,.;\n]{0,12}(heels?|feet|foot|soles?|edi|aedi)|(heels?|edi|aedi|soles?)[^,.;\n]{0,12}crack|bivai|biwai|phati edi|fissured? (heel|sole)/i.test(h.text) ? [5, ["cracked heels"]] : [0],
      adv: () => "Cracked heels: soak, dry, apply petroleum jelly / urea cream at night, wear closed footwear; diabetics check for infection" },
    { dx: "Head lice — permethrin 1% lotion; treat family", search: "Pediculosis capitis", tests: [],
      f: (h) => /\blice\b|\blouse\b|\bjue\b|\bjuein\b|\bjoon\b|pediculos|\bnits\b/i.test(h.text) ? [6, ["head lice"]] : [0],
      adv: () => "Head lice: permethrin 1% lotion, repeat after 7 days, fine comb wet hair, wash bedding; treat family members" },
    { dx: "Dandruff (seborrhoeic dermatitis) — antifungal shampoo", search: "Seborrhoeic dermatitis", tests: [],
      f: (h) => /dandruff|\brusi\b|seborr|scalp[^,.;\n]{0,15}(flak|scal|white powder)|(flak|scal)\w*[^,.;\n]{0,15}scalp/i.test(h.text) ? [4, ["dandruff / flaky scalp"]] : [0],
      adv: () => "Dandruff: ketoconazole 2% shampoo twice a week, leave 5 minutes before washing" },
    { dx: "Fungal nail (onychomycosis) — KOH; long treatment", search: "Onychomycosis", tests: ["KOH"],
      f: (h) => /onychomyc|nail fung|fungal nail|(thick\w*|discolou?r\w*|yellow|crumbl\w*|brittle|white)[^,.;\n]{0,15}nails?|nails?[^,.;\n]{0,15}(thick|discolou?r|crumbl|brittle|yellow)/i.test(h.text) ? [5, ["thick / discoloured nails"]] : [0],
      adv: () => "Fungal nail: confirm with KOH; keep feet dry; treatment takes months (oral antifungal per doctor)" },
    { dx: "Angular cheilitis — cracks at mouth corners: iron, B-complex", search: "Angular cheilitis", tests: ["HB"], // Anemia Mukt Bharat (check Hb)
      f: (h) => /cheilit|angular|(corners?|kone|kon) (of )?(the )?(mouth|lips|muh|honth)|muh ke kon\w*|(crack|sore|ulcer)\w*[^,.;\n]{0,15}corners? of (the )?(mouth|lips)/i.test(h.text) ? [5, ["cracks at mouth corners"]] : [0],
      adv: () => "Angular cheilitis: check Hb; iron and B-complex; antifungal cream; keep corners dry; check dentures" },
    { dx: "Cold sore (herpes labialis)", search: "Herpes labialis", tests: [],
      f: (h) => /cold sore|fever blister|herpes labial|(blister|vesicle|chhale)\w*[^,.;\n]{0,15}(on|around|near) (the )?lips?|lips?[^,.;\n]{0,10}(blister|vesicle|chhale)/i.test(h.text) ? [5, ["blisters on the lip"]] : [0],
      adv: () => "Cold sore: heals in 7-10 days; acyclovir cream early; do not share utensils" },
    { dx: "Armpit boil / abscess — drain; recurrent: hidradenitis, check sugar", search: "Abscess of axilla", tests: ["RBS"],
      f: (h) => h.near(G.axilla) && /boil|abscess|pus|phoda|phunsi|painful (swelling|lump)|swelling[^,.;\n]{0,10}pain/i.test(h.text) && !/lymph|node|gland/i.test(h.text) ? [6, ["armpit boil / abscess", /recur|again|baar baar/i.test(h.text) ? "recurrent: hidradenitis suppurativa" : null]] : [0],
      adv: () => "Armpit abscess: drain if fluctuant, antibiotic, keep area dry, avoid shaving with blade; recurrent boils: check sugar" },
    { dx: "Breastfeeding mother with painful red breast — mastitis / breast abscess", search: "Mastitis", tests: (h) => (/pus|abscess|fluctuant|soft swelling/i.test(h.text) ? ["USG", "CBC"] : ["CBC"]), // MoHFW (breastfeeding / PNC)
      f: (h) => !h.male && (/mastitis|breast abscess/i.test(h.text) || (/breast|stan|chhati me gaanth/i.test(h.text) && /pain|red|hard|swell|pus|fever|warm/i.test(h.text) && /lactat|breast ?feed|feeding|delivered|delivery|post ?partum|pnc|baby|bachcha|newborn/i.test(h.text))) ? [7, ["breastfeeding", "painful / red breast", /pus|abscess/i.test(h.text) ? "pus: breast abscess" : null]] : [0],
      adv: () => "Mastitis: continue breastfeeding or express milk from that side, warm compress, antibiotic, paracetamol; pus = drain (breast abscess)" },
    { dx: "Perianal abscess — incision and drainage", search: "Perianal abscess", tests: ["RBS"],
      f: (h) => (h.near(G.perianal) && /swell|pus|boil|abscess|discharg|pain|phoda|lump/i.test(h.text) && !/rash|nappy|diaper/i.test(h.text)) || /perianal abscess|ischiorectal/i.test(h.text) ? [6, ["painful swelling near the anus"]] : [0],
      adv: () => "Perianal abscess: incision and drainage (do not wait for it to burst), sitz bath, check sugar; recurrence = look for fistula" },
    { dx: "Pilonidal sinus / abscess — surgery referral", search: "Pilonidal sinus", tests: [],
      f: (h) => /pilonidal|(tail ?bone|coccyx|natal cleft|between (the )?buttocks|gudha ke upar)[^,.;\n]{0,25}(pus|sinus|discharge|swell|boil|hole)|(pus|sinus|discharge|swell|boil|hole)[^,.;\n]{0,25}(tail ?bone|coccyx|natal cleft|between (the )?buttocks)/i.test(h.text) ? [6, ["pus / sinus over the tailbone"]] : [0],
      adv: () => "Pilonidal sinus: drain if abscess, keep area clean and hair-free, refer to surgery for excision" },
    { dx: "Buttock abscess — drain; check sugar", search: "Gluteal abscess", tests: ["RBS"],
      f: (h) => h.near(G.buttock) && /boil|abscess|pus|phoda|swell|injection site/i.test(h.text) && !h.near(G.perianal) ? [6, ["buttock swelling / abscess", /injection/i.test(h.text) ? "after injection" : null]] : [0],
      adv: () => "Gluteal abscess: incision and drainage, antibiotic, dressing; check sugar" },
    { dx: "Balanitis — hygiene, antifungal; check sugar", search: "Balanitis", tests: ["RBS"],
      f: (h) => !h.female && /balanit|glans|(tip|head) of (the )?penis|penis[^,.;\n]{0,15}(red|itch|swell|discharg|pain|sore)|fore ?skin[^,.;\n]{0,15}(red|swell|itch|sore)/i.test(h.text) ? [5, ["red / sore tip of penis"]] : [0],
      adv: () => "Balanitis: wash daily with plain water and dry, clotrimazole cream; check sugar; recurrent or tight foreskin: refer" },
    { urgent: true, dx: "Newborn: redness spreading from the navel — serious infection, refer", search: "Omphalitis", tests: ["CBC"], // IMNCI / HBNC
      f: (h) => (h.age === 0 || /newborn|neonat|baby|shishu/i.test(h.text)) && /(navel|umbilic\w*|nabhi|naal)/i.test(h.text) && /spread|around|abdomen|pet tak|fever|bukhar|not feeding|lethargic/i.test(h.text) ? [9, ["newborn", "navel redness spreading / fever"]] : [0],
      adv: () => "Omphalitis with spreading redness: first dose of antibiotic and refer to SNCU / paediatrics" },
    { dx: "Navel pus / redness in baby — local infection (cord care)", search: "Omphalitis", tests: [], // IMNCI / HBNC
      f: (h) => (h.age === 0 || /newborn|neonat|baby|shishu/i.test(h.text)) && /(navel|umbilic\w*|nabhi|naal)[^,.;\n]{0,20}(pus|red|discharg|smell|swell|wet|ooz)|(pus|discharg|smell)[^,.;\n]{0,20}(navel|umbilic|nabhi|naal)/i.test(h.text) ? [7, ["newborn", "pus / redness at the navel"]] : [0],
      adv: () => "Cord infection: keep cord clean and dry, nothing applied on it; gentian violet / antibiotic as per IMNCI; redness spreading or fever = refer" },
    { dx: "Varicose veins of leg — leg elevation, stockings; Doppler", search: "Varicose veins of lower limb", tests: ["DOPPLER"],
      f: (h) => /varicose|(swollen|twisted|prominent|dilated|bulging|uthi|phuli)\w*[^,.;\n]{0,12}(veins?|nas|nasen)|veins?[^,.;\n]{0,12}(on|in|of) (the )?(legs?|calf|pair)[^,.;\n]{0,10}(swollen|prominent|bulg|twist)/i.test(h.text) ? [5, ["visible twisted leg veins"]] : [0],
      adv: () => "Varicose veins: raise legs when resting, compression stockings, avoid standing long; ulcer or bleeding = refer" },
    { dx: "Wart (viral) — reassure; cryotherapy / salicylic acid", search: "Viral wart", tests: [],
      f: (h) => /\bwarts?\b|\bmassa\b|\bmasse\b|verruc/i.test(h.text) ? [5, ["wart"]] : [0],
      adv: () => "Wart: salicylic acid paint or cryotherapy; do not pick; many go away on their own" },
    { urgent: true, dx: "Scorpion sting with sweating / vomiting / cold limbs — refer (prazosin per protocol)", search: "Poisoning due to bite of scorpion", tests: ["ECG"], // Indian practice; needs clinician review
      f: (h) => /scorpion|bichh?u|bicchu/i.test(h.text) && /sweat|pasina|vomit|ulti|cold|thanda|breath|saans|priap|restless/i.test(h.text) ? [9, ["scorpion sting", "sweating / vomiting / cold limbs"]] : [0],
      adv: () => "Scorpion sting with autonomic signs: monitor BP and pulse, prazosin per protocol, refer; local pain only: ice, lignocaine, observe 6 hours" },
    { dx: "Scorpion sting — local pain: ice / lignocaine; observe 6 hours", search: "Poisoning due to bite of scorpion", tests: [], // Indian practice; needs clinician review
      f: (h) => /scorpion|bichh?u|bicchu/i.test(h.text) ? [6, ["scorpion sting"]] : [0],
      adv: () => "Scorpion sting: ice and lignocaine at the site, paracetamol, observe 6 hours; sweating, vomiting, cold limbs or breathlessness = urgent" },
    { dx: "Insect bite / sting — cold compress, antihistamine", search: "Insect bite - wound", tests: [],
      f: (h) => /insect bite|bee sting|wasp|hornet|\bsting\b|keed[ae] (ne )?kaat|kida (ne )?kaat|(keeda|kida|machhar)[^,.;\n]{0,10}(kaat|bite)/i.test(h.text) && !/scorpion|bichh?u|snake|saanp|dog|kutt|monkey|cat\b/i.test(h.text) ? [5, ["insect bite / sting", /breath|swelling of (face|lips)|throat/i.test(h.text) ? "face / throat swelling or breathlessness: anaphylaxis" : null]] : [0],
      adv: () => "Insect bite: wash, cold compress, antihistamine; swelling of face or lips, or breathlessness = adrenaline and refer" },
    { dx: "Tooth abscess — drain / dental referral; antibiotic", search: "Dental abscess", tests: [], // NOHP
      f: (h) => /(tooth|teeth|dant|daant|gum)[^,.;\n]{0,25}(abscess|pus|swell|soojan|sujan)|(cheek|gaal|jaw|face)[^,.;\n]{0,15}swell\w*[^,.;\n]{0,25}(tooth|teeth|dant)|dental abscess|periapical/i.test(h.text) ? [/pus|abscess|periapical|cheek|gaal|jaw|face/i.test(h.text) ? 6 : 3, ["tooth with swelling / pus"]] : [0],
      adv: () => "Tooth abscess: antibiotic and analgesic, warm saline rinses, dental drainage / extraction; swelling under jaw or difficulty opening mouth = urgent" },
    { dx: "Abscess — incision and drainage", search: "Abscess", tests: ["RBS"], // Sadar surgery
      f: (h) => /abscess|pus (collection|pocket)|mawad/i.test(h.text) ? [5, ["abscess"]] : [0] },
    { dx: "Cellulitis", search: "Cellulitis", tests: ["CBC"], // Sadar surgery
      f: (h) => /cellulitis/i.test(h.text) ? [6, ["cellulitis"]] : [0] },
    { dx: "Kidney stone", search: "Kidney stone", tests: ["URINE", "KUB", "USG", "KFT"], // ICMR STW Urology
      f: (h) => /renal stone|kidney stone|calculus[^,.;\n]{0,10}(kidney|renal|ureter)|pathri/i.test(h.text) ? [5, ["kidney stone"]] : [0] },
    { dx: "Tuberculosis — known / on treatment", search: "Pulmonary tuberculosis", tests: ["SPUTUM"], // NTEP
      f: (h) => /\btb\b|tubercul|koch/i.test(h.text) && !/known case of|follow up case of/i.test(h.text) ? [5, ["TB mentioned"]] : [0] },
    { dx: "Mobile / loose tooth? — check mobility", search: "Mobility poor", tests: [], // Sadar dental
      f: (h) => h.near(G.tooth, G.pain) && !/mobil|loose/i.test(h.text) ? [1, ["teeth pain"]] : [0] },
    { dx: "Impacted third molar? — back teeth pain, jaw", search: "Impacted third molar tooth", tests: ["XRAY"], // Sadar dental
      f: (h) => h.near(G.tooth, G.pain) && !/impacted|wisdom/i.test(h.text) ? [1, ["teeth pain"]] : [0] },
    { dx: "Gingivitis with stains / calculus — scaling", search: "Gingivitis", tests: [], // Sadar dental (half the stain visits)
      f: (h) => /\bstain/i.test(h.text) && !/bleed/i.test(h.text) ? [2, ["stains: check gums"]] : [0] },
    { dx: "Foreign body sensation — evert lid", search: "Foreign body sensation", tests: [], // Sadar eye OPD
      f: (h) => /redness|red eye|gritt|something in (the )?eye|kuch gaya/i.test(h.text) && !/skin|body|rash/i.test(h.text) ? [2, ["red / gritty eye"]] : [0] },
    { dx: "Allergic conjunctivitis — itching, both eyes", search: "Allergic conjunctivitis", tests: [], // Sadar eye OPD
      f: (h) => /^\W*redness\W*$/i.test(h.text) ? [2, ["redness"]] : [0] },
    { dx: "Retraction of tympanic membrane? — otoscopy", search: "Retraction of tympanic membrane", tests: [], // Sadar ENT (earache)
      f: (h) => (h.near(G.ear, G.pain) || /ear ?ache/i.test(h.text)) && !/blocked|heaviness|fullness/i.test(h.text) ? [1, ["ear pain"]] : [0] },
    { dx: "Sensorineural (neural) hearing loss? — tuning fork", search: "Neural hearing loss", tests: [], // Sadar ENT
      f: (h) => G.hearing.test(h.text) || /ringing|tinnitus|sensitivity to noise/i.test(h.text) ? [2, ["reduced hearing / ringing"]] : [0] },
    { dx: "PIVD (disc prolapse)? — if pain goes down the leg", search: "PIVD - Prolapsed intervertebral disc", tests: [], // Sadar ortho
      f: (h) => h.backpain ? [1, ["back pain"]] : [0] },
    { dx: "Injury", search: "Injury", tests: [], // Sadar: doctors pick Injury and Wound
      f: (h) => /injur|trauma|fall|gir/i.test(h.text) && !/head injury|fracture|#/i.test(h.text) && !G.headInj.test(h.text) ? [2, ["injury"]] : [0] },
    // ===== Common OPD differentials (eye, skin, knee) — ICMR STW Ophthalmology / Dermatology; Harrison Ch 28, 53 =====
    { dx: "Subconjunctival haemorrhage — painless red patch, vision normal; check BP", search: "Subconjunctival haemorrhage", tests: [], // Harrison Ch 28
      f: (h) => /red eye|redness|eye[^,.;\n]{0,10}red|aankh (lal|laal)|blood (spot|in (the )?eye)|khoon/i.test(h.text) && /eye|aankh/i.test(h.text) && !/discharge|pus|sticky|itch|pain|watering/i.test(h.text) ? [2, ["red eye without discharge / pain", h.bpHigh ? `BP ${h.bp}` : null]] : [0] },
    { dx: "Allergic conjunctivitis — itching, watering, both eyes", search: "Atopic conjunctivitis", tests: [], // Harrison Ch 28
      f: (h) => /eye|aankh/i.test(h.text) && /itch|khujli/i.test(h.text) ? [3, ["itchy eyes"]] : [0] },
    { dx: "Dry eye — screen time, age, check for eyelid disease", search: "Dry eyes", tests: [], // Harrison Ch 28
      f: (h) => /dry eye|eyes? (dry|dryness)|aankh (sukh|sookh)|gritt|burning (of |in )?(the )?eyes?/i.test(h.text) ? [3, ["dry / gritty / burning eyes"]] : [0] },
    { dx: "Nasolacrimal duct obstruction — watering without redness", search: "Nasolacrimal duct obstruction", tests: [], // Harrison Ch 28
      f: (h) => /watering|epiphora|tears|aankh se paani/i.test(h.text) && !/red|discharge|pus|itch/i.test(h.text) ? [3, ["watering eye, not red"]] : [0] },
    { dx: "Foreign body in eye — evert lid, do not rub", search: "Retained foreign body in eye", tests: [], // Harrison Ch 28
      f: (h) => /(foreign body|something|dust|kuch|kachra|insect)[^,.;\n]{0,15}(eye|aankh)|(eye|aankh)[^,.;\n]{0,15}(foreign body|kachra)/i.test(h.text) ? [5, ["something went into the eye"]] : [0] },
    { dx: "Acne vulgaris — face / chest / back", search: "Acne vulgaris", tests: [], // Harrison Ch 53
      f: (h) => /pimple|acne|muhase|kil\b/i.test(h.text) ? [4, ["pimples"]] : [0] },
    { dx: "Boil / folliculitis — drain if fluctuant; check sugar if recurrent", search: "Furuncle", tests: (h) => (/recur|again|baar baar/i.test(h.text) ? ["RBS"] : []), // Harrison Ch 124
      f: (h) => /\bboils?\b|furuncle|abscess|phoda|phunsi|folliculit/i.test(h.text) ? [4, ["boil / pus-filled bump"]] : [0] },
    { dx: "Urticaria (hives) — wheals that come and go; ask food / drug", search: "Urticaria", tests: [], // Harrison Ch 52
      f: (h) => /urticaria|hives|wheal|pitti|itchy (red )?(bumps|patches) (come|that come)/i.test(h.text) ? [4, ["itchy wheals that come and go"]] : [0] },
    { dx: "Pityriasis versicolor — light / dark patches on chest, back", search: "Pityriasis versicolor", tests: ["KOH"], // Harrison Ch 53
      f: (h) => /(white|light|brown|dark)[^,.;\n]{0,12}(patch|spot|daag)[^,.;\n]{0,25}(chest|back|neck|shoulder)|versicolor/i.test(h.text) && !h.near(G.patchAnaes) ? [3, ["light / dark patches on trunk"]] : [0] },
    { dx: "Vitiligo — milky-white patches, normal sensation", search: "Vitiligo", tests: [], // Harrison Ch 53
      f: (h) => /vitiligo|milky white|safed daag|white patch/i.test(h.text) && !h.near(G.patchAnaes) && !/chest|back/i.test(h.text) ? [3, ["white patch (test sensation to rule out leprosy)"]] : [0] },
    { dx: "Psoriasis — thick scaly plaques on elbows, knees, scalp", search: "Psoriasis", tests: [], // Harrison Ch 53
      f: (h) => /psoria|scaly (plaque|patch)|silvery scal/i.test(h.text) ? [4, ["scaly plaques"]] : [0] },
    { dx: "Eczema — itchy dry or weeping patches", search: "Eczema", tests: [], // Harrison Ch 53
      f: (h) => /eczema|dry (itchy )?(skin|patch)|weeping/i.test(h.text) ? [3, ["itchy dry / weeping patches"]] : [0] },
    { dx: "Hair loss — check for patch (alopecia areata), scalp fungus, anaemia, thyroid", search: "Alopecia", tests: (h) => (/patch|spot/i.test(h.text) ? ["KOH"] : ["HB", "TFT"]), // Harrison Ch 53
      f: (h) => /hair (loss|fall)|baal (jhad|gir)|alopecia|bald/i.test(h.text) ? [3, ["hair loss"]] : [0] },
    { dx: "Knee injury / sprain — swelling after twist or fall; X-ray if cannot bear weight", search: "Injury of knee", tests: ["XRAY"], // Harrison Ch 14 (trauma)
      f: (h) => /knee|ghutn/i.test(h.text) && (h.near(G.injury) || /twist|sprain|fall|gir|moch/i.test(h.text)) ? [4, ["knee pain after injury"]] : [0] },
    { dx: "Ankle sprain — X-ray if bone tenderness or cannot walk", search: "Sprain of ankle", tests: (h) => (/cannot walk|unable to walk|bone/i.test(h.text) ? ["XRAY"] : []), // no Indian source
      f: (h) => /ankle|takhn/i.test(h.text) && (/twist|sprain|moch|turned|fall|gir/i.test(h.text) || h.near(G.injury)) ? [4, ["ankle twisted"]] : [0] },
    // ===== Harrison 20e, site / side (Ch 11-14, 18-22, 28-32, 37, 52-53, 59-62, 124-125, 273) =====
    { dx: "Rash with fever — look at where the rash is", search: "Skin rash", tests: (h) => ["CBC", ...(/palm|sole/i.test(h.text) ? ["SCRUB", "VDRL"] : []), ...(/petechi|purpur|bleed/i.test(h.text) ? ["NS1", "DIGM"] : [])], // Ch 16
      f: (h) => fev(h) && (h.rash || /vesic|blister|pox|chhale|petechi|purpur/i.test(h.text)) ? [4, ["fever with rash",
        /palm|sole/i.test(h.text) ? "palms / soles: scrub typhus / rickettsia, secondary syphilis, hand-foot-mouth" :
        /vesic|blister|pox|chhale/i.test(h.text) ? "blisters: chickenpox" :
        /petechi|purpur|bleed/i.test(h.text) ? "red spots that do not fade on pressing: dengue, meningococcal — urgent if unwell" :
        /cough|red eyes?|conjunctiv|koplik/i.test(h.text) ? "with cough / red eyes: measles" : "note where it started and spread"]] : [0] },
    { urgent: true, dx: "Chest pain radiating to the back — rule out aortic dissection; refer", search: "Dissection of aorta", tests: ["ECG", "CXR"], // Ch 11
      f: (h) => h.near(G.chestPain) && h.near(G.radiateBack) ? [9, ["chest pain going to the back / tearing"]] : [0] },
    { dx: "Pleuritic chest pain — pleurisy / pneumonia", search: "Pleuritic pain", tests: ["CXR", "CBC"], // Ch 11
      f: (h) => h.near(G.chestPain) && h.near(G.pleuritic) ? [4, ["chest pain worse on breathing / cough"]] : [0] },
    { dx: "Chest wall pain (costochondritis / muscle strain)", search: "Costochondritis", tests: ["ECG"], // Ch 11: still do ECG if any doubt
      f: (h) => h.near(G.chestPain) && h.near(G.chestWall) ? [3, ["chest wall tender on pressing"]] : [0] },
    { dx: "Herpes zoster (band-like rash / pain on one side)", search: "Herpes zoster", tests: [], // Ch 11, 53
      f: (h) => h.near(G.dermatomal) ? [5, ["one-sided band of pain / blisters"]] : [0] },
    { urgent: true, dx: "Cauda equina / spinal cord compression — refer urgently", search: "Cauda equina syndrome", tests: [], // Ch 14
      f: (h) => (h.backpain || G.neckPain.test(h.text)) && h.near(G.caudaEq) ? [10, ["back pain with urine retention / saddle numbness / both legs weak"]] : [0] },
    { dx: "Back pain with red flags — TB spine / infection / cancer; X-ray, ESR", search: "Tuberculosis of spine", tests: ["XRAY", "ESR", "CBC"], // Ch 14 (Pott's disease named)
      f: (h) => h.backpain && h.near(G.backRed) ? [5, ["back pain with night pain / fever / weight loss"]] : [0] },
    { dx: "Sciatica (back pain going down the leg)", search: "Sciatica", tests: [], // Ch 14: no tests without red flags
      f: (h) => (h.backpain || /buttock|hip/i.test(h.text)) && h.near(G.radiateLeg) ? [4, ["pain radiating down the leg"]] : [0] },
    { dx: "Cervical radiculopathy (neck pain going to the arm)", search: "Cervical radiculopathy", tests: [], // Ch 14
      f: (h) => G.neckPain.test(h.text) && h.near(G.radiateArm) ? [4, ["neck pain radiating to the arm"]] : [0] },
    { dx: "Headache by site — migraine / tension / cluster pattern", search: "Headache", tests: [], // Ch 13
      f: (h) => h.headache && G.headSite.test(h.text) ? [2, ["site of headache"]] : [0] },
    { dx: "Temporal arteritis (age 50+, temple headache) — ESR today", search: "Giant cell arteritis", tests: ["ESR", "CBC"], // Ch 13
      f: (h) => h.headache && /temporal|temple|kanpati/i.test(h.text) && (h.age == null || h.age >= 50) ? [3, ["temple headache", h.age ? `age ${h.age}` : "if age 50+"]] : [0] },
    { urgent: true, dx: "Weakness of both legs — spinal cord compression / GBS; refer", search: "Paraparesis", tests: ["RBS"], // Ch 21
      f: (h) => h.near(G.paraWeak) ? [9, ["weakness of both legs"]] : [0] },
    { dx: "Facial palsy (Bell's palsy) — check for stroke signs", search: "Bell's palsy", tests: ["RBS"], // Ch 21; stroke rule handles limb weakness
      f: (h) => h.near(G.facialPalsy) && !/arm|leg|hand|limb|half body|speech/i.test(h.text) ? [5, ["facial weakness only"]] : [0] },
    { dx: "Peripheral neuropathy (numbness of both feet / hands) — sugar, B12, leprosy", search: "Peripheral neuropathy", tests: ["RBS", "HBA1C", "CBC"], // Ch 22
      f: (h) => h.near(G.hypoSens) && (h.near(G.gloveStock) || /feet|soles|toes/i.test(h.text)) ? [4, ["numbness / tingling of feet or hands"]] : [0] },
    { dx: "Numbness of one limb — nerve / root lesion", search: "Numbness", tests: ["RBS"], // Ch 22
      f: (h) => h.near(G.hypoSens) && !h.near(G.gloveStock) && G.limb.test(h.text) && !/feet|soles|toes/i.test(h.text) ? [2, ["numbness / tingling of one limb"]] : [0] },
    { urgent: true, dx: "Sudden hearing loss — refer ENT within 1-2 days", search: "Sudden sensorineural hearing loss", tests: [], // Ch 30
      f: (h) => h.near(G.suddenDeaf) ? [8, ["sudden hearing loss"]] : [0] },
    { dx: "Double vision — check eye movements, BP, sugar; refer", search: "Diplopia", tests: ["RBS"], // Ch 28
      f: (h) => h.near(G.diplopia) ? [5, ["double vision"]] : [0] },
    { dx: "Eyelid / face puffiness — check urine protein (kidney), thyroid", search: "Periorbital edema", tests: ["URINE", "KFT", "TFT"], // Ch 37
      f: (h) => h.near(G.lidSwell) ? [3, ["puffy eyes / face"]] : [0] },
    { urgent: true, dx: "Hot swollen joint — septic arthritis until proven otherwise; refer for joint aspiration", search: "Bacterial arthritis", tests: ["CBC", "ESR", "URIC"], // Ch 125
      f: (h) => h.near(G.hotJoint) && (fev(h) || /one|single|ek|left|right/i.test(h.text)) ? [8, ["hot, red, swollen joint", fev(h) ? "with fever" : null]] : [0] },
    { dx: "Tinea cruris (groin fungal infection) — KOH", search: "Tinea cruris", tests: ["KOH"], // Ch 53
      f: (h) => h.near(G.groinItch) ? [4, ["itchy rash in the groin"]] : [0] },
    { dx: "Tinea pedis (fungal infection of feet) — KOH", search: "Tinea pedis", tests: ["KOH"], // Ch 53
      f: (h) => h.near(G.feetItch) ? [4, ["itch / cracks between the toes"]] : [0] },
    { dx: "Tinea capitis / scalp condition — KOH", search: "Tinea capitis", tests: ["KOH"], // Ch 53
      f: (h) => h.near(G.scalpItch) ? [3, ["scalp itch / patch"]] : [0] },
    { dx: "Lymph node swelling by region", search: "Lymphadenopathy", tests: (h) => (/supraclavicular/i.test(h.text) ? ["CBC", "ESR", "CXR", "USG"] : ["CBC", "ESR"]), // Ch 62
      f: (h) => h.near(G.nodeRegion) ? [/supraclavicular/i.test(h.text) ? 6 : 4, [/supraclavicular/i.test(h.text) ? "supraclavicular node: always abnormal, refer for biopsy" : /axill|armpit|inguinal|groin/i.test(h.text) ? "check the limb on the same side for a wound / infection" : "lymph node swelling", h.days >= 14 ? `${h.days} days: think TB` : null]] : [0] },
    { dx: "Enlarged spleen — malaria, kala-azar, thalassaemia / sickle; ultrasound", search: "Splenomegaly", tests: ["MP", "RK39", "CBC", "USG"], // Ch 62
      f: (h) => h.near(G.spleenBig) ? [5, ["enlarged spleen / left upper heaviness"]] : [0] },
    { dx: "Breast lump — examine both breasts and armpits; refer", search: "Lump in breast", tests: ["USG"], // Ch 62 (axillary nodes)
      f: (h) => h.near(G.breastLump) ? [6, ["breast lump"]] : [0] },
    { dx: "Swelling of one leg — examine for DVT, cellulitis, injury, filaria", search: "Swelling of lower limb", tests: ["CBC"], // Ch 37, 273, 276
      f: (h) => h.near(G.swell, G.leg) && h.near(G.oneSide) && !h.near(G.red, G.leg) && !h.near(G.pain, G.leg) && !/calf|pindli/i.test(h.text) && !h.near(G.swell, G.joint) ? [2, ["one leg / foot swollen"]] : [0] },
    { dx: "Blood in urine — urine microscopy, KFT, ultrasound; age 40+: refer to rule out cancer", search: "Hematuria", tests: ["URINE", "KFT", "USG", "CBC"], // Ch 48; ICMR STW Urology (40+)
      f: (h) => /ha?ematuria|blood in (the )?urine|red urine|peshab (me|mein) khoon|khoon (wala )?peshab/i.test(h.text) ? [h.age >= 40 ? 6 : 5, ["blood in urine", h.age >= 40 ? `age ${h.age}: cancer until proven otherwise` : null]] : [0] },
    { dx: "Joint pain (arthralgia)", search: "Arthralgia", tests: ["ESR", "URIC"], // no Indian source
      f: (h) => h.near(G.pain, G.joint) && !fev(h) && !h.near(G.swell, G.joint) && !((h.knee || /knee|ghutn/i.test(h.text)) && !(h.days && h.days < 30)) ? [1, ["joint pain", h.days && h.days < 30 ? `${h.days} days` : null]] : [0] },
    { dx: "Knee osteoarthritis", search: "Osteoarthritis of knee", tests: ["XRAY"], // ICMR STW OA 2024
      f: (h) => (h.knee || h.near(G.pain, /knee|ghutn/i)) && !fev(h) && !(h.days && h.days < 30) && h.age >= 40 ? [2, ["knee / joint pain", `age ${h.age}`]] : (h.knee || h.near(G.pain, /knee|ghutn/i)) && !fev(h) && !(h.days && h.days < 30) && !h.age ? [1, ["knee / joint pain"]] : [0] },
    { dx: "Low back pain", search: "Low back pain", tests: [], // no Indian source
      f: (h) => h.backpain ? [2, ["back pain"]] : [0] },
    { dx: "Injury / wound — check tetanus status", search: "Injury", tests: (h) => (G.headInj.test(h.text) || /scalp|face|head|lip|chest|abdomen/i.test(h.text) ? [] : ["XRAY"]), // no Indian source
      f: (h) => h.near(G.injury) && !h.near(G.dogBite) && !h.near(G.snakeBite) && !G.headInj.test(h.text) ? [2, ["injury / fall / wound"]] : [0] },
    { dx: "Burn injury", search: "Burn", tests: [], // no Indian source
      f: (h) => h.near(G.burn) ? [4, ["burn"]] : [0] },
    { dx: "Conjunctivitis", search: "Conjunctivitis", tests: [], // no Indian source; red-flag rule above
      f: (h) => (h.redeye || h.near(G.red, G.eye) || h.near(G.eye, G.discharge) || G.stickyEye.test(h.text) || /^\W*redness\W*$/i.test(h.text)) && !h.near(G.blur) && !h.near(G.eye, G.pain) ? [2, [/^\W*redness\W*$/i.test(h.text) ? "redness (if of the eye)" : "red / watering / sticky eye"]] : [0] },
    { dx: "Hordeolum (stye)", search: "External hordeolum", tests: [], // no Indian source
      f: (h) => h.near(G.eyelid) || h.near(G.lump, G.eye) ? [2, ["eyelid swelling / lump"]] : [0] },
    { dx: "Reduced vision / cataract — pinhole acuity, BP, sugar; refer", search: "Cataract", tests: ["RBS"], // ICMR STW Ophthalmology
      f: (h) => h.near(G.blur) && !h.near(G.eye, G.red) && !G.suddenVision.test(h.text) ? [3, ["blurred / reduced vision", /gradual/i.test(h.text) ? "gradual: cataract / refractive error / diabetic eye" : null, /presbyopia/i.test(h.text) ? "near-vision glasses" : null]] : [0] },
    { dx: "Dental caries / toothache — refer dental", search: "Dental caries", tests: [], // Oral Health OG
      f: (h) => h.near(G.tooth, G.pain) || h.near(G.tooth, G.swell) || G.dental.test(h.text) ? [3, [G.dental.test(h.text) ? "dental caries" : "tooth / gum pain"]] : [0] },
    { dx: "Gingivitis / periodontal disease — scaling, oral hygiene", search: "Gingivitis", tests: (h) => (/bleed/i.test(h.text) ? ["CBC", "RBS"] : []), // NOHP
      f: (h) => G.gum.test(h.text) && !(/\bstain|discolou?r/i.test(h.text) && !/bleed|calculus|tartar|loose|mobil|swell|pain|smell|breath/i.test(h.text)) ? [3, ["bleeding gums / calculus / loose teeth"]] : [0] },
    // ---- National programmes (NTCP, NPCCHH, NCVBDC filaria, NPPCF fluorosis)
    { urgent: true, dx: "Heat stroke — cool now (wet cloth, fan, ice packs), refer", search: "Heat stroke", tests: ["RBS", "KFT"], // NPCCHH Heat-related illness guidelines (MoHFW)
      f: (h) => G.heat.test(h.text) && (h.near(G.alteredSens) || h.near(G.seizure) || h.tempV >= 104) ? [10, ["heat / sun exposure", h.tempV >= 104 ? `Temp ${h.temp}` : "confusion / fits"]] : [0],
      adv: () => "Heat stroke: cool the body at once (wet cloth, fan, ice packs in armpit / groin), shift to cool place, IV fluids, refer; do not give antipyretic as first step" },
    { dx: "Heat exhaustion — rest in shade, ORS, cool fluids", search: "Heat exhaustion", tests: [], // NPCCHH Heat-related illness guidelines (MoHFW)
      f: (h) => G.heat.test(h.text) && !(h.near(G.alteredSens) || h.near(G.seizure) || h.tempV >= 104) ? [5, ["heat / sun exposure", h.near(G.giddyW) ? "giddiness" : null]] : [0],
      adv: () => "Heat exhaustion: rest in shade, ORS / cool water, loose cotton clothes, avoid sun 12 to 3 pm; return if confusion, fits or no urine" },
    { dx: "Tobacco use — brief advice to quit; quitline 1800-11-2356", search: "Tobacco user", tests: [], // NTCP: tobacco cessation (brief advice, National Tobacco Quitline)
      f: (h) => G.tobacco.test(h.text) && !/\b(no|not|non|never|quit|left|chhod)\w*[^,.;\n]{0,10}(smok|tobacco|gutk|khaini|bidi|beedi|cigar)/i.test(h.text) ? [4, ["tobacco use", /oral|mouth|gutk|khaini|gul|zarda/i.test(h.text) ? "check mouth for white / red patch" : null]] : [0],
      adv: () => "Tobacco: advise to quit (ask, advise, assess, assist, arrange); National Tobacco Quitline 1800-11-2356; check mouth for white / red patch" },
    { dx: "Lymphatic filariasis — limb care (MMDP); hydrocele surgery", search: "Filariasis", tests: ["FILARIA", "CBC"], // NCVBDC Elimination of Lymphatic Filariasis (MMDP)
      f: (h) => /filari|elephantias|haathi ?paon|hathipaon/i.test(h.text) || (h.near(G.swell, G.leg) && h.near(G.oneSide) && (h.days >= 90 || /long.?standing|years?|saal/i.test(h.text)) && !h.near(G.red, G.leg) && !h.near(G.pain, G.leg)) ? [/filari|elephant|haathi|hathi/i.test(h.text) ? 6 : 3, ["long-standing limb swelling / filaria", "Jharkhand is filaria-endemic"]] : [0],
      adv: () => "Filaria: wash and dry the leg daily, care of skin folds and cracks, raise the leg, exercise, footwear; antibiotic for acute attack; refer hydrocele for surgery; take MDA tablets in the campaign" },
    { dx: "Dental fluorosis (mottled / brown-streaked teeth) — ask drinking-water source", search: "Dental fluorosis", tests: [], // NPPCF (fluorosis) guidelines
      f: (h) => /fluoro|mottl\w*|chalky|(brown|yellow|white)[^,.;\n]{0,10}(streak|line|band|spot)s?[^,.;\n]{0,15}(teeth|tooth|dant)/i.test(h.text) ? [5, ["mottled / streaked teeth", "fluoride in drinking water (hand pump / borewell)"]] : [0],
      adv: () => "Fluorosis: ask drinking-water source; use safe low-fluoride water; diet rich in calcium, vitamin C; refer for water testing" },
    { dx: "Staining of teeth — scaling and polishing; ask tobacco / gutkha, tea", search: "Staining of teeth", tests: [], // production: doctors record "Staining of teeth"
      f: (h) => /(tooth|teeth|dant|daant)[^,.;\n]{0,15}(stain|discolou?r|yellow|black|peela|kala)|(stain|discolou?r|yellow|black|peela|peele|kala|kale)[^,.;\n]{0,15}(tooth|teeth|dant|daant)|^\W*stains?\W*$/i.test(h.text) ? [4, ["stained teeth"]] : [0] },
    { dx: "Mouth ulcer", search: "Aphthous ulcer of mouth", tests: [], // Oral Health OG
      f: (h) => h.near(G.mouthUlcer) && h.udays < 14 ? [2, ["mouth ulcers"]] : [0] },
    { dx: "Oral lesion > 2 weeks — oral cancer screening, refer", search: "Leucoplakia of oral mucosa", tests: [], // Oral Health OG; NP-NCD
      f: (h) => (h.near(G.mouthUlcer) && h.udays >= 14) || h.near(G.oralPatch) ? [6, ["ulcer / white or red patch for 2+ weeks"]] : [0] },
    { dx: "Headache — check BP; look for red flags", search: "Headache", tests: [], // NP-NCD; ICMR STW Neurology
      f: (h) => h.headache ? [1 + (h.bpHigh ? 1 : 0), ["headache", h.bpHigh ? `BP ${h.bp}` : null]] : [0] },
    { dx: "Headache red flag — refer", search: "Headache", tests: [], urgent: true, // ICMR STW Neurology
      f: (h) => h.near(G.headacheSevere) || (h.headache && h.near(G.neckStiff) && fev(h)) ? [8, ["sudden / worst headache or fever with neck stiffness"]] : [0] },
    { dx: "Seizure / epilepsy", search: "Seizure", tests: ["RBS", "MP"], // ICMR STW Neurology
      f: (h) => h.near(G.seizure) && !fev(h) ? [4, ["fits / seizure", "> 5 minutes = status epilepticus"]] : [0] },
    { dx: "Vertigo", search: "Vertigo", tests: [], // no Indian source
      f: (h) => h.near(G.vertigo) ? [2, ["spinning / vertigo"]] : [0] },
    { dx: "Depression / anxiety — assess, Tele-MANAS 14416", search: "Anxiety disorder", tests: ["TFT", "HB"], // ICMR STW Psychiatry
      f: (h) => h.near(G.mood) ? [2, ["low mood / anxiety / sleep"]] : [0] },
  ];

  // ---------- read the form
  function formText() {
    const parts = [];
    // Free-text answers only (textareas). Small inputs belong to other items, e.g. an allergy note.
    const advEl = typeof adviceBox === "function" ? adviceBox() : null; // the Advice box is the doctor's plan (and holds our own advice lines), not the complaint
    document.querySelectorAll("textarea").forEach((el) => {
      if (el.closest("#cvw-root") || !el.value || el === advEl) return;
      parts.push(el.value);
    });
    // Symptoms already added: rows in the block whose heading is "Symptoms".
    const heads = [...document.querySelectorAll("label, h2, h3, h4, div, span")].filter((e) => e.children.length === 0 && /^symptoms?$/i.test((e.textContent || "").trim()));
    for (const hd of heads) {
      let box = hd.parentElement;
      for (let i = 0; i < 6 && box && !box.querySelector("table, [role=row], li"); i++) box = box.parentElement;
      if (box) box.querySelectorAll("td, [role=cell], li").forEach((c) => parts.push(c.textContent || ""));
    }
    return dropNegations(parts.join(" \n "));
  }

  // Remove negated findings so "no cough" or "denies chest pain" does not count as present.
  // Real OPD entries are short, abbreviated and often glued together when copied
  // ("R.N COUGHBODYACHE", "cough - 5 daysno fever", "k/c/o t2 dmback pain").
  // Expand common abbreviations and split glued complaints into separate phrases.
  const GLUE = "cough|fever|bodyache|body ache|headache|weakness|laziness|sore throat|throat|pain abdomen|abdominal pain|chest pain|back pain|amenorr|giddiness|vomiting|loose motion|constipation|gas formation|ghabrahat|worms?|altered|decreased|burning|watering|noisy|hypo ?pigment|bleeding|came|chills|swelling|ulcer|breathlessness|running nose";
  function normalise(t) {
    return " " + String(t || "").slice(0, 6000).replace(/[ \t\u00a0]+/g, " ").replace(/\s*\n\s*/g, "\n") // long runs of spaces cannot slow the rules
      .replace(/\br\.\s?n\.?(?=[^a-z]|[a-z])/gi, " running nose, ")
      .replace(/\bs\.\s?o\.\s?b\.?|s\.o\.b\.?/gi, " breathlessness, ")
      .replace(new RegExp(`([a-z])(?=(${GLUE}))`, "gi"), "$1, ")
      .replace(/(\d+\s*(?:days|day|wks|wk|weeks|week|months|month))(?=[a-rt-z]|s[a-z])/gi, "$1, ") // "5 daysno fever"; not "7 day, s back"
      .replace(/\ba\/h\/o\b/gi, "alleged history of ").replace(/\bh\/o\b/gi, "history of ")
      .replace(/\bk\/?c\/?o\b|\bkco\b/gi, "known case of ").replace(/\bf\/?u\/?c\b|\bf\/u\b/gi, "follow up case of ").replace(/\bc\/o\b/gi, "complains of ")
      .replace(/\bdiab[ie]t[ie]?e?s\b|\bdiabities\b|\bdiabeties\b|\bdiabitis\b|\bdiabetis\b/gi, "diabetes").replace(/\bhyper ?tention\b|\bhypertenstion\b|\bhypertansion\b/gi, "hypertension").replace(/\bhypothyrod\w*|\bhypothyroidsm\b/gi, "hypothyroidism").replace(/\bloos\b/gi, "loose").replace(/\bsenstivity\b|\bsensitivty\b/gi, "sensitivity").replace(/\bheadche\b|\bheadace\b/gi, "headache").replace(/\babdomain\b|\babdoman\b/gi, "abdomen").replace(/\bbody pain\b/gi, "body ache").replace(/\bp\s?r\b(?=\s|$)/gi, "per rectum").replace(/(?<!\w)r\s*[\/.]?\s*n(?!\w)/gi, "running nose").replace(/\bwek?ness\b|\bweekness\b|\bweaknes\b/gi, "weakness").replace(/\bpolymenorr\w*/gi, "polymenorrhoea irregular periods").replace(/\bckd\b/gi, "chronic kidney disease").replace(/\bt\s?2\s?dm\b|\bdm\s?(2|ii)\b|\bt2dm\b/gi, "type 2 diabetes").replace(/\bryt\b/gi, "right").replace(/\blt\b\.?/gi, "left")
      .replace(/\bpreg\b\.?/gi, "pregnancy").replace(/amenorr?h?o?ea|amenorrohea/gi, "amenorrhoea").replace(/micturation/gi, "micturition")
      .replace(/\bwks?\b/gi, "weeks")
      .replace(/\ba?\s?fuc\b|\bfuv\b|\bf\.u\.c\b/gi, "follow up case of ").replace(/\bp\/v\b/gi, "pv").replace(/\blba\b/gi, "low back pain").replace(/\bnnj\b/gi, "neonatal jaundice")
      .replace(/\br\.?\s?t\.?\s?a\b/gi, "road traffic accident").replace(/\b(rt|rgt)\b\.?/gi, "right").replace(/\bbes\b/gi, "both ears").replace(/\b(b\/l|bil)\b/gi, "both")
      .replace(/[ \t]{2,}/g, " ").replace(/\banc ?(\d)/gi, "anc $1").replace(/th[ae]?l+[ae]s+[ae]?e?mia|thlas+emia/gi, "thalassemia").replace(/\bcou(fe|gh?)\b|\bcaugh\b|\bkof\b/gi, "cough")
      .replace(/\b(abomen|addomen|abdomin|abdmen|abdoman)\b/gi, "abdomen").replace(/\b(pasin|paion|paim)\b/gi, "pain").replace(/irredular|irrigular|iregular/gi, "irregular")
      .replace(/veginal|vaginel/gi, "vaginal").replace(/\bskine\b/gi, "skin").replace(/\bleeft|letf\b/gi, "left").replace(/\bmonky\b/gi, "monkey").replace(/decrea(ded|des|sd)/gi, "decreased")
      .replace(/\beare\b/gi, "ear").replace(/migrane|migraine?e/gi, "migraine").replace(/scratum|scrotam/gi, "scrotum").replace(/tren?fusion|transfussion/gi, "transfusion").replace(/blockded|bloked/gi, "blocked").replace(/an(a)?emiy?a/gi, "anaemia").replace(/weekness|weaknes\b/gi, "weakness").replace(/headach\b/gi, "headache")
      .replace(/mituration|micturation/gi, "micturition").replace(/assu?la?t\b|assualt/gi, "assault").replace(/sca?tch|scrach/gi, "scratch").replace(/\bcate bite/gi, "cat bite")
      .replace(/itnich|inching|iching/gi, "itching").replace(/\btenia\b/gi, "tinea").replace(/anasaca|anasarca/gi, "anasarca").replace(/painfull/gi, "painful").replace(/\bcray\b/gi, "cry").replace(/\s+,/g, ",").replace(/,\s*,/g, ",") + " ";
  }
  function dropNegations(t) {
    return normalise(t).replace(/\bno (fresh |new |any )?complain(t|ts)?\b/gi, " asymptomatic ")
      .replace(/\b(no|not|nil|denies|denied|without|negative for|absence of|h\/o no)\b[^,.;\n]{0,40}/gi, " ")
      .replace(/[^,.;\n]{0,30}\b(nahi hai|nahin hai|nahi tha|absent|ruled out)\b/gi, " ");
  }

  function signals() { const fm = location.pathname.match(/\/facility\/([0-9a-f-]{36})/i); return computeSignals(formText(), window.__cvwVitals || {}, { ...(window.__cvwPatient || {}), facility: fm ? fm[1] : null }); }
  // Rabies PEP, intradermal (NCDC National Guidelines 2022): doses on day 0, 3, 7, 28; day 0 = date of the first dose.
  const ARV_DAYS = [0, 3, 7, 28];
  const ddmm = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  function arvDates(now, d0) { // d0: Date of the first dose, or 0 for "today"
    const t = new Date(now); t.setHours(0, 0, 0, 0);
    const z = d0 ? new Date(d0) : t; z.setHours(0, 0, 0, 0);
    const out = ARV_DAYS.map((n) => { const d = new Date(z.getFullYear(), z.getMonth(), z.getDate() + n); const k = Math.round((d - t) / 86400000); return { n, d, k }; });
    const next = out.filter((x) => x.k >= 0);
    if (!next.length) return `course finished (day 28 was ${ddmm(out[3].d)})`;
    return next.map((x) => `Day ${x.n}${x.k === 0 ? " (today)" : ""} ${ddmm(x.d)}`).join(", ");
  }
  // First-dose date from the note: "1st dose on 10/11", "first ARV 5 days back", or "2nd dose" (today = day 3).
  function arvDay0(h) {
    const t = new Date(h.now); t.setHours(0, 0, 0, 0);
    const back = (n) => new Date(t.getFullYear(), t.getMonth(), t.getDate() - n);
    let m = h.text.match(/(1st|first|day ?0)[^,.;\n]{0,25}?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/i);
    if (m) { let y = m[4] ? +m[4] : t.getFullYear(); if (y < 100) y += 2000; let d = new Date(y, +m[3] - 1, +m[2]); if (!m[4] && d > t) d = new Date(y - 1, +m[3] - 1, +m[2]); if (d <= t && t - d < 60 * 86400000) return d; }
    m = h.text.match(/(1st|first|arv|vaccin\w*|dose|tika)[^,.;\n]{0,25}?(\d{1,2}) ?days? (back|ago|before)/i);
    if (m && +m[2] <= 40) return back(+m[2]);
    m = h.text.match(/\b(2nd|second|3rd|third|4th|fourth|last) (dose|inj\w*|arv)/i);
    if (m && !/(next|due|after|on \d)/i.test(h.text.slice(m.index - 12, m.index))) return back({ "2nd": 3, second: 3, "3rd": 7, third: 7, "4th": 28, fourth: 28, last: 28 }[m[1].toLowerCase()]);
    return null;
  }

  function computeSignals(text, v, p) {
    const h = { text, days: Math.round(durationDays(text)), near: (...res) => near(text, ...res), now: p && p.now ? new Date(p.now) : new Date() };
    // Duration taken from the sentence that mentions the symptom ("8 months pregnant" must not count as fever days).
    const daysNear = (re) => Math.round(Math.max(0, ...text.split(/[.;!?\n]+/).filter((x) => re.test(x)).map(durationDays)));
    { const seg = text.split(/[,.;!?\n]+/).filter((x) => G.dogBite.test(x)); h.bdays = seg.some((x) => /today|aaj|just now|abhi/i.test(x)) ? 0 : Math.round(Math.max(0, ...seg.map(durationDays))); } h.fdays = daysNear(W.fever); h.cdays = daysNear(W.cough); h.ddays = daysNear(W.diarrhoea); h.udays = daysNear(G.mouthUlcer);
    h.abdP = W.abdpain.test(text) || near(text, G.abd, G.pain);
    for (const [k, re] of Object.entries(W)) h[k] = re.test(text);
    // Patient context from CARE (content.js): age and sex change thresholds and rules.
    const ageM = p && p.ageMonths != null ? p.ageMonths : null;
    h.age = ageM != null ? Math.floor(ageM / 12) : null;
    h.under5 = ageM != null && ageM < 60; h.adult = ageM == null || ageM >= 216;
    h.male = p && p.gender === "male"; h.female = p && p.gender === "female"; h.fac = FAC_KEY[(p && p.facility) || ""] || "";
    h.repro = h.female && h.age >= 15 && h.age <= 49;
    h.pregnant = h.anc && !h.male;
    h.ncdKnown = G.knownCase.test(text) || G.bareNcd.test(text); // "DM", "HTN DM", "uncontrolled T2DM" as the whole complaint = known patient
    // Months of pregnancy / amenorrhoea from "amenorrhoea of 8 month", "pregnancy 9 month", "4 and half month"
    const gm = text.match(/(?:amenorrhoea|pregnan\w*|anc)[^.;\n\d]{0,20}(\d+(?:\.\d+)?)\s*(?:and half|\.5|1\/2)?\s*(?:months?|mahina|mahine)|(\d+(?:\.\d+)?)\s*(?:months?|mahina|mahine)[^.;\n]{0,15}(?:pregnan|amenorr)/i);
    h.gaMonths = gm ? parseFloat(gm[1] || gm[2]) : null;
    // Shared thresholds (same file as the vitals panel: thresholds.js)
    const T = globalThis.CVW_T || {};
    if (v.temp && v.temp.v != null) { const f = v.temp.v < 45 ? v.temp.v * 9 / 5 + 32 : v.temp.v; h.temp = `${v.temp.v}${v.temp.u || ""}`; h.tempHigh = f >= 99.5; h.tempV = f; }
    if (v.bp && v.bp.sys) { h.bp = `${v.bp.sys}/${v.bp.dia}`; h.bpHigh = v.bp.sys >= 140 || v.bp.dia >= 90; h.bpConfirm = v.bp.sys >= 160 || v.bp.dia >= 100; h.bpSev = v.bp.sys >= 180 || v.bp.dia >= 110; }
    if (v.rr && v.rr.v != null) { h.rr = v.rr.v; h.rrHigh = h.adult && v.rr.v > 24; h.rrFastChild = ageM != null && T.rrFast ? v.rr.v >= T.rrFast(ageM) : false; }
    if (v.spo2 && v.spo2.v != null) { h.spo2 = v.spo2.v; h.spo2Low = v.spo2.v < 94; }
    if (v.rbs && v.rbs.v != null) { h.rbs = v.rbs.v; h.rbsSusp = v.rbs.v >= 140; h.rbsHigh = v.rbs.v >= 200; }
    if (v.pulse && v.pulse.v != null) h.pulse = v.pulse.v;
    return h;
  }

  // Side (left / right / both) for diagnoses that have a side in SNOMED, e.g. "left ear hearing loss"
  // -> search "Hearing loss left" (finds "Hearing loss of left ear"). The side is taken from the phrase
  // that mentions the organ; RE / LE count only for ear and eye rules.
  const EAR = /\b(ears?|kaan|hearing|deaf|otitis|wax|tinnitus|ringing|earache|otalgia|discharging|blocked)\b/i;
  const EYE = /\b(eyes?|aankh\w*|ankh|vision|cataract|conjunctiv\w*|stye|eyelid|redness|epiphora|watering)\b/i;
  const SIDE_RULES = [
    [/^Hearing loss/, EAR, "ear"], [/^Acute otitis media/, EAR, "ear"], [/^Ear wax/, EAR, "ear"], [/^Tinnitus/, EAR, "ear"],
    [/^Conjunctivitis/, EYE, "eye"], [/^Reduced vision/, EYE, "eye"], [/^Hordeolum/, EYE, "eye"], [/^Sudden loss of vision/, EYE, "eye"], [/^Painful red eye/, EYE, "eye"],
    [/^Knee osteoarthritis/, /knee|ghutn/i, "knee"], [/^Joint (pain|swelling)/, G.joint, ""], [/^Limb pain/, G.limb, ""],
    [/^Cellulitis of lower limb/, G.leg, "leg"], [/^Swelling of one leg/, G.leg, "leg"], [/^Deep vein thrombosis/, G.leg, "leg"], [/^Hernia/, G.groin, ""],
    [/^Renal colic/, G.flank, ""], [/^Sciatica/, /leg|thigh|foot|buttock|calf|sciatica/i, "leg"], [/^Cervical radiculopathy/, /arm|shoulder|hand/i, "arm"],
    [/^Pleuritic chest pain|^Chest wall pain/, /chest|seene|chhati/i, ""], [/^Herpes zoster/, /./, ""],
    [/^Headache by site/, /head|sir|migraine|temporal|occipital|frontal/i, ""], [/^Temporal arteritis/, /temporal|temple/i, ""],
    [/^Facial palsy/, /face|facial|mouth|muh|eye|palsy/i, ""], [/^Numbness of one limb/, G.limb, ""], [/^Sudden hearing loss/, EAR, "ear"], [/^Double vision/, EYE, ""],
    [/^Hot swollen joint/, G.joint, ""], [/^Lymph node swelling/, /node|gland|gilti|gaanth|lymph|cervical|axill|armpit|inguinal|groin|supraclavicular/i, ""],
    [/^Breast lump/, /breast/i, "breast"], [/^Eyelid/, EYE, "eye"], [/^Gout/, /toe|foot|ankle|knee/i, ""],
  ];
  function sideIn(text, organ, earEye) {
    const pick = (t) => {
      const l = /\b(left|baa?y[ae]n?|baa?ya|ulte)\b/i.test(t) || (earEye && /\ble\b/i.test(t));
      const r = /\b(right|daa?y[ae]n?|daa?ya|seedhe)\b/i.test(t) || (earEye && /\bre\b/i.test(t));
      const b = /\b(both|bilateral|dono|donon)\b/i.test(t) || (earEye && /\bbe\b/i.test(t));
      return b || (l && r) ? "both" : l ? "left" : r ? "right" : "";
    };
    const parts = text.split(/[,.;\n]+/).filter((x) => organ.test(x));
    for (const x of parts) { const sd = pick(x); if (sd) return sd; }
    return parts.length ? "" : ""; // the organ is mentioned without a side, or not at all: no side
  }
  // Site of abdominal pain: "lower abdomen pain" -> "Lower abdominal pain" (label and search).
  const ABD_SITES = [
    [/epigastri\w*|pet (ke )?upar beech|upper (mid|central)/i, "Epigastric pain"],
    [/right (iliac|lower)|\brif\b|right side (of )?lower|daa?y[ae]n? (taraf )?neeche/i, "Right iliac fossa pain"],
    [/left (iliac|lower)|\blif\b|baa?y[ae]n? (taraf )?neeche/i, "Left iliac fossa pain"],
    [/right (upper|hypochondri\w*)|\bruq\b/i, "Right upper quadrant pain"],
    [/left (upper|hypochondri\w*)|\bluq\b/i, "Left upper quadrant pain"],
    [/umbilic\w*|navel|naa?bhi/i, "Periumbilical pain"],
    [/supra ?pubic|hypogastri\w*|pedu/i, "Suprapubic pain"],
    [/lower (abd\w*|belly|stomach|tummy)|(abd\w*|belly|stomach|tummy|pet)[^,.;\n]{0,12}lower|neeche (ka )?pet|pet (ke )?neeche/i, "Lower abdominal pain"],
    [/upper (abd\w*|belly|stomach|tummy)|(abd\w*|belly|stomach|tummy|pet)[^,.;\n]{0,12}upper|upar (ka )?pet|pet (ke )?upar/i, "Upper abdominal pain"],
    [/(whole|generali[sz]ed|diffuse|all over|poore?) (abd\w*|pet)|(abd\w*|pet)[^,.;\n]{0,10}(generali[sz]ed|diffuse)/i, "Generalized abdominal pain"],
  ];
  const HEAD_SITES = [
    [/occipital|back of (the )?head|peeche (ka )?sir/i, "Occipital headache"], [/frontal|forehead|maatha|mathe/i, "Frontal headache"],
    [/temporal|temple|kanpati/i, "Temporal headache"], [/periorbital|around (the )?eye|behind (the )?eye/i, "Periorbital headache"],
    [/(one|left|right|half|single)[ -]?sided|(one|left|right|half) side|unilateral|hemicrania|adhe sir|aadha sir/i, "Unilateral headache"],
    [/(both|dono) side|bilateral|whole head|poore sir|band.?like|tight band/i, "Bilateral headache"],
  ];
  const NODE_SITES = [
    [/supraclavicular/i, "Supraclavicular lymphadenopathy"], [/axill\w*|armpit|bagal/i, "Axillary lymphadenopathy"],
    [/inguinal|groin|jangh/i, "Inguinal lymphadenopathy"], [/submandibular/i, "Submandibular lymphadenopathy"],
    [/occipital/i, "Occipital lymphadenopathy"], [/preauricular|in front of (the )?ear/i, "Preauricular lymphadenopathy"],
    [/cervical|neck|gale|gardan/i, "Cervical lymphadenopathy"], [/generali[sz]ed|multiple (sites|regions)|all over/i, "Generalized lymphadenopathy"],
  ];
  const LIMB_PARTS = [[/\bhip\b/i, "Hip", "Pain of hip region"], [/shoulder/i, "Shoulder", "Pain of shoulder region"], [/elbow/i, "Elbow", "Pain of elbow region"], [/wrist|kalai/i, "Wrist", "Pain of wrist region"], [/\bhand|hands\b/i, "Hand", "Hand pain"],
    [/\bfoot|feet|heel|edi\b/i, "Foot", "Foot pain"], [/\bthigh\b|jangh/i, "Thigh", "Pain in lower limb"], [/\bcalf|pindli/i, "Calf", "Pain in lower limb"], [/\barm\b/i, "Arm", "Pain in upper limb"], [/\bleg\b/i, "Leg", "Pain in lower limb"]];
  function withSite(r, h) {
    if (/^Animal bite/.test(r.dx)) {
      const t = h.text;
      const nm = /\bcat\b|billi/i.test(t) ? (/scratch/i.test(t) ? "Cat scratch injury" : "Cat bite - wound") : /monkey|bandar/i.test(t) ? "Monkey bite - wound" : /human|aadmi/i.test(t) ? "Human bite mark"
        : /scratch/i.test(t) ? "Dog scratch" : /deep|lacerat|cat(egory)? ?(iii|3)\b/i.test(t) ? "Deep dog bite" : /\b(foot|feet|toes?|leg|legs|ankle|shin|pair|paon)\b/i.test(t) ? "Dog bite of foot"
        : /\b(hands?|fingers?|palm|thumb|haath)\b/i.test(t) ? "Dog bite of hand" : "Dog bite - wound"; // production names, by site
      return { ...r, search: nm };
    }
    if (/^Well-baby visit/.test(r.dx)) return { ...r, search: "Well baby" };
    if (/^Head injury —/.test(r.dx) && /scalp/i.test(h.text)) return { ...r, searchBase: r.search, search: "Scalp injury" };
    if (/^Abscess — /.test(r.dx) || r.dx === "Cellulitis") {
      const t = h.text, abs = /^Abscess/.test(r.dx);
      const S = [[G.perianal, "Perianal abscess", "Perianal abscess"], [G.buttock, "Gluteal abscess", "Gluteal abscess"], [G.axilla, "Abscess of axilla", "Cellulitis of axilla"],
        [/\bbreast|\bstan\b/i, "Breast abscess", "Cellulitis of breast"], [G.finger, "Abscess of finger", "Cellulitis of finger"], [G.hand, "Abscess of hand", "Cellulitis of hand"],
        [G.footW, "Abscess of foot", "Cellulitis of foot"], [G.faceW, "Abscess of face", "Cellulitis of face"], [/\bneck|gardan/i, "Abscess of neck", "Cellulitis of neck"],
        [/\b(arm|forearm|bazu|baanh)\b/i, "Abscess of upper limb", "Cellulitis of upper limb"], [/\b(thigh|jangh)\b/i, "Abscess of thigh", "Cellulitis of thigh"]];
      const m = S.find(([re]) => re.test(t));
      if (m) return { ...r, searchBase: r.search, search: abs ? m[1] : m[2] };
    }
    if (/^Menstrual disorder/.test(r.dx)) {
      const heavy = /heavy|menorrhagia|zyada|jyada|clots/i.test(h.text), irr = /irregular|delayed|early|anyamit/i.test(h.text);
      return heavy ? { ...r, dx: r.dx.replace(/\(heavy \/ irregular periods\)/, "(heavy periods)"), search: "Menorrhagia" } : irr ? { ...r, dx: r.dx.replace(/\(heavy \/ irregular periods\)/, "(irregular periods)"), search: "Irregular menstruation" } : r;
    }
    if (/^Joint pain \(arthralgia\)/.test(r.dx)) {
      const J = [[/knee|ghutn/i, "Knee"], [/ankle|takhn/i, "Ankle"], [/wrist|kalai/i, "Wrist"], [/elbow/i, "Elbow"], [/finger|ungli/i, "Finger"], [/toe|angut/i, "Toe"]].find(([re]) => re.test(h.text));
      if (J) { const nm = { Knee: "Knee pain", Ankle: "Ankle pain", Wrist: "Pain of wrist region", Elbow: "Pain of elbow region", Finger: "Pain in finger", Toe: "Pain in toe" }[J[1]]; return { ...r, searchBase: undefined, search: nm, dx: r.dx.replace(/^Joint pain \(arthralgia\)( \([^)]*\))?/, `${J[1]} joint pain${r.side ? ` (${r.side})` : ""}`) }; }
      return r;
    }
    if (/^Limb pain/.test(r.dx)) {
      const part = LIMB_PARTS.find(([re]) => re.test(h.text));
      if (part) return { ...r, searchBase: undefined, search: part[2], dx: r.dx.replace(/^Limb pain[^—]*/, `${part[1]} pain${r.side ? ` (${r.side})` : ""} `) };
      return r;
    }
    if (/^Hernia/.test(r.dx) && /hydroc/i.test(h.text)) return { ...r, searchBase: undefined, search: "Hydrocele" };
    if (/^Headache by site/.test(r.dx)) {
      const m = HEAD_SITES.find(([re]) => re.test(h.text));
      return m ? { ...r, site: m[1], searchBase: "Headache", search: m[1], dx: r.dx.replace(/^Headache by site/, m[1]), why: [m[1].toLowerCase()].concat(m[1] === "Unilateral headache" ? ["migraine / cluster pattern"] : m[1] === "Bilateral headache" ? ["tension-type pattern"] : m[1] === "Occipital headache" ? ["neck / cervical cause, check BP"] : []) } : r;
    }
    if (/^Lymph node swelling by region/.test(r.dx)) {
      const m = NODE_SITES.find(([re]) => re.test(h.text));
      return m ? { ...r, site: m[1], searchBase: "Lymphadenopathy", search: m[1], dx: r.dx.replace(/^Lymph node swelling by region/, m[1]) } : { ...r, dx: r.dx.replace(/ by region/, "") };
    }
    if (/^Chest pain —/.test(r.dx) && /\bleft\b/i.test(h.text) !== /\bright\b/i.test(h.text)) {
      const sd = /\bleft\b/i.test(h.text) ? "Left" : "Right";
      return { ...r, site: sd, searchBase: r.search, search: `${sd} sided chest pain`, /* exists in CARE */ dx: r.dx.replace(/^Chest pain/, `${sd}-sided chest pain`), side: undefined };
    }
    if (!/^Abdominal pain/.test(r.dx)) return r;
    const m = ABD_SITES.find(([re]) => re.test(h.text));
    if (!m) return r;
    return { ...r, site: m[1], searchBase: r.search, search: m[1], dx: r.dx.replace(/^Abdominal pain/, m[1]), why: r.why.filter((w) => w !== "upper" && w !== "lower") };
  }
  // Sided names that exist in CARE's diagnosis list (checked on staging, Nov 2026). {s} = left / right.
  const SIDED = [
    [/^Hearing loss/, "Hearing loss of {s} ear", "Bilateral hearing loss"],
    [/^Acute otitis media/, "Otitis media of {s} ear", "Bilateral otitis media"],
    [/^Tinnitus/, "Tinnitus of {s} ear", null],
    [/^Conjunctivitis|^Red eye/, "Conjunctivitis of {s} eye", "Bilateral conjunctivitis"],
    [/^Reduced vision/, "Cataract of {s} eye", "Bilateral cataracts"],
    [/^Knee osteoarthritis/, "Osteoarthritis of {s} knee", "Osteoarthritis of bilateral knees"],
    [/^Hernia/, "{S} inguinal hernia", "Bilateral inguinal hernia"],
    [/^Cellulitis of lower limb/, "Cellulitis of {s} lower limb", null],
    [/^Swelling of one leg/, "Swelling of {s} lower limb", null],
    [/^Sciatica/, "{S} sciatica", null],
    [/^Pleuritic chest pain|^Chest wall pain/, "{S} sided chest pain", null],
  ];
  function withSide(r, h) {
    const m = SIDE_RULES.find(([re]) => re.test(r.dx));
    if (!m) return r;
    const sd = sideIn(h.text, m[1], m[2] === "ear" || m[2] === "eye");
    if (!sd) return r;
    const label = sd === "both" ? (m[2] ? `both ${m[2]}s` : "both sides") : `${sd}${m[2] ? " " + m[2] : ""}`;
    const i = r.dx.indexOf(" \u2014");
    const t = SIDED.find(([re]) => re.test(r.dx));
    const cap = (x) => x[0].toUpperCase() + x.slice(1);
    const search = !t ? r.search : sd === "both" ? (t[2] || r.search) : t[1].replace("{s}", sd).replace("{S}", cap(sd));
    if (/hydroc/i.test(h.text) && /^Hernia/.test(r.dx)) return { ...r, side: sd, search: "Hydrocele", dx: i > 0 ? `${r.dx.slice(0, i)} (${label})${r.dx.slice(i)}` : `${r.dx} (${label})` };
    return { ...r, side: sd, searchBase: search !== r.search ? r.search : undefined, search, dx: i > 0 ? `${r.dx.slice(0, i)} (${label})${r.dx.slice(i)}` : `${r.dx} (${label})` };
  }

  // Symptom-level diagnoses, as doctors often record them ("Fever", "Knee pain", "Red eye").
  // Names are the exact CARE (SNOMED) display names found on staging, Nov 2026.
  // Advice written into the Advice box (+ Advice). Plain patient advice: what to do, warning signs, follow-up.
  // Based on ICMR STW / national programme guidance; draft for clinician review. No drug doses: the prescription has them.
  const ADVICE = {
    // ---- urgent
    "Acute encephalitis syndrome": "Fever with fits / unconsciousness (AES): admit or refer now; keep airway clear, turn on side during fits; check sugar; do not wait for test reports",
    "Child danger sign": "Child with danger sign: give first dose of treatment and refer urgently with a referral note; keep the child warm and continue breastfeeding on the way",
    "Rule out ectopic pregnancy": "Pain with missed period: urine pregnancy test now; if positive with pain or bleeding, refer for ultrasound today; come at once if fainting, severe pain or shoulder pain",
    "Pregnancy danger sign / pre-eclampsia": "Pregnancy danger sign: refer to FRU / DH today; come at once for severe headache, blurred vision, fits, bleeding, leaking fluid or reduced baby movements",
    "Upper GI bleed": "Vomiting blood / black stool: nothing by mouth, IV access, refer to DH now; stop painkillers like diclofenac / aspirin",
    "Snake bite": "Snake bite: keep calm and still, immobilise the limb, remove rings / tight clothes; no tourniquet, no cutting or sucking; 20WBCT and ASV at the hospital without delay",
    "Stroke (suspected)": "Possible stroke: note the time last seen normal; shift to DH with CT immediately; nothing by mouth until swallowing is checked",
    "Acute coronary syndrome possible": "Chest pain: ECG within 10 minutes; aspirin as per doctor; refer to higher centre if ECG changes; come at once for pain with sweating or breathlessness",
    "Painful red eye with blurred vision": "Painful red eye with blurred vision: see eye specialist today; do not use steroid drops without an eye examination",
    "In labour / labour pains": "Labour: shift to labour room, start partograph; nothing to be pushed early; companion allowed",
    "Post-dated pregnancy": "Overdue pregnancy: obstetric review today; count baby movements; come at once if movements reduce, water leaks or bleeding starts",
    "Urinary retention": "Unable to pass urine: catheterise, then find the cause (prostate, stone, medicines); refer to surgery if catheter needed again",
    "Suicide risk": "Thoughts of self-harm: do not leave the person alone; remove means (pesticide, medicines); refer to psychiatrist today; Tele-MANAS 14416 (free, 24x7)",
    "Chest pain radiating to the back": "Tearing chest pain to the back: refer urgently to higher centre; control BP; keep at rest",
    "Cauda equina / spinal cord compression": "Back pain with leg weakness / urine or stool problem: refer urgently to orthopaedics / neurosurgery for MRI today",
    "Weakness of both legs": "Weakness of both legs: refer urgently; come at once if breathing or swallowing becomes difficult",
    "Sudden loss of vision": "Sudden loss of vision: see eye specialist today; do not delay",
    "Sudden hearing loss": "Sudden hearing loss: see ENT within 1-2 days; early treatment can bring hearing back",
    "Hot swollen joint": "Hot swollen joint with fever: refer for joint aspiration and antibiotics today; rest the joint",
    "Temporal arteritis": "Headache at the temple with jaw pain, age 50+: ESR today and start treatment early to protect eyesight; report any vision change at once",
    "Headache red flag": "Headache with warning signs: refer for CT / specialist today; come at once if fits, weakness, vomiting or drowsiness",
    // ---- fever and infections
    "Malaria (suspected)": "Fever: malaria test (RDT) today; if positive, complete the full course of tablets; use mosquito net every night; come back if fever stays beyond 2 days of treatment, vomiting, drowsiness or yellow eyes",
    "Fever, unspecified": "Fever: paracetamol, plenty of fluids, sponge with normal water; malaria test; come back if fever beyond 3 days, rash, bleeding, vomiting, breathlessness or drowsiness",
    "Viral fever": "Viral fever: rest, plenty of fluids, paracetamol only (no painkillers like ibuprofen / diclofenac); come back if fever beyond 3 days, rash, bleeding, vomiting or belly pain",
    "Dengue (suspected)": "Dengue suspected: plenty of fluids (ORS, coconut water, juice), paracetamol only, no ibuprofen / aspirin / injections; come at once for belly pain, repeated vomiting, bleeding from gums / nose, black stool, cold hands or drowsiness; platelet count as advised",
    "Typhoid (enteric fever)": "Typhoid: complete the full antibiotic course even if fever goes; drink boiled / safe water, wash hands, avoid outside food; soft diet; come back if fever persists after 5 days, belly pain, black stool or vomiting",
    "Scrub typhus (suspected)": "Scrub typhus suspected: complete doxycycline course; look for black scab (eschar) on the body; come back if breathlessness, yellow eyes or drowsiness",
    "Kala-azar (suspected)": "Kala-azar suspected: rK39 test; if positive, treatment under the national programme is free; use bed net and indoor spraying",
    "Leptospirosis (suspected)": "Leptospirosis suspected: start treatment; avoid walking in flood / dirty water without footwear; come at once for yellow eyes, less urine or breathlessness",
    "Chikungunya (suspected)": "Chikungunya: rest, fluids, paracetamol for fever and joint pain; joint pain may last weeks; use mosquito net; come back for bleeding or severe weakness",
    "Presumptive TB": "Cough 2 weeks or more: give sputum sample today (free test); cover mouth while coughing; if TB is found, free medicines and monthly nutrition support (Ni-kshay Poshan Yojana)",
    "Tuberculosis on treatment": "TB treatment: take medicines daily without missing; collect monthly from health centre; report yellow eyes, vomiting or skin rash at once; Ni-kshay support for nutrition",
    "Tuberculosis": "TB: take medicines daily for the full course; do not stop when you feel better; family members with cough should get tested",
    "Acute upper respiratory infection": "Cold / sore throat: steam inhalation, warm salt-water gargles, fluids, paracetamol if fever; antibiotics are not needed; come back if breathlessness, high fever beyond 3 days or ear pain",
    "Pneumonia (child, IMNCI fast breathing)": "Child pneumonia: give antibiotic for full 5 days, continue feeding and breastfeeding; come back in 2 days or earlier if breathing worsens, chest indrawing, unable to drink or drowsy",
    "Lower respiratory infection / Pneumonia": "Chest infection: complete antibiotic course, fluids, rest; come back if breathless, lips blue, chest pain or fever beyond 3 days",
    "Asthma / COPD": "Asthma / COPD: use inhaler correctly (with spacer), carry reliever; avoid smoke, chulha smoke and dust; stop smoking; come at once if unable to speak in full sentences",
    "Acute tonsillitis / pharyngitis": "Sore throat: warm salt-water gargles, warm fluids, paracetamol; complete antibiotic course if given; come back if unable to swallow, drooling or mouth does not open",
    "Tonsillitis": "Tonsillitis: warm salt-water gargles, soft food, fluids; complete antibiotic course if given; come back if unable to swallow or neck swelling",
    "Acute sinusitis": "Sinusitis: steam inhalation, saline nasal drops, fluids; antibiotics only if beyond 10 days; come back if swelling around eye or severe headache",
    "Acute otitis media / ear discharge": "Ear infection: keep ear dry (cotton with oil while bathing), do not put oil or drops without advice; complete medicines; come back if discharge continues beyond 2 weeks or swelling behind ear",
    "Allergic rhinitis": "Allergic rhinitis: avoid dust, smoke and known triggers; wash face after outdoor work; antihistamine as prescribed; steam / saline nasal wash",
    "Urinary tract infection": "Urine infection: drink 2-3 litres of water, do not hold urine, complete the antibiotic course; come back if fever with chills, back pain or vomiting",
    "Viral hepatitis / jaundice": "Jaundice: rest, normal home food (no need to stop turmeric / oil completely), boiled water; no alcohol and no unnecessary medicines; come at once if confusion, vomiting, bleeding or deep yellow increasing",
    "Acute gastroenteritis": "Loose motions: ORS after every loose stool, continue food and breastfeeding; zinc for 14 days in children; wash hands; come at once if blood in stool, not drinking, very sleepy, sunken eyes or no urine for 6 hours",
    "Intestinal worms": "Worms: deworming tablet; wash hands with soap before eating and after toilet; wear footwear; cut nails; treat the whole family",
    "Parotitis / mumps": "Mumps: rest, soft food, fluids, paracetamol; stay home till swelling goes (about 5 days); come back if testis pain, severe headache or vomiting",
    "Herpes zoster": "Herpes zoster: keep rash clean and dry, do not burst blisters; antiviral early as prescribed; come back if near the eye or pain is severe",
    "Leprosy (suspected)": "Skin patch with less feeling: free tests and MDT treatment under NLEP; protect numb hands / feet from burns and injury; family members should be examined",
    "Scabies": "Scabies: apply permethrin from neck to toes at night, wash next morning, repeat after 7 days; treat all family members on the same day; wash clothes and bedding in hot water",
    "Scabies?": "Itching worse at night: scabies is likely; treat all family members together; wash clothes and bedding",
    "Tinea (ringworm)": "Fungal infection: apply cream twice daily for 2 weeks after the patch clears; keep area dry, cotton clothes, do not share towels; avoid steroid creams",
    "Tinea (fungal)?": "Ring-shaped itchy patch: antifungal cream, keep dry, do not use steroid creams",
    "Tinea cruris (groin fungal infection)": "Groin fungal infection: keep groin dry, loose cotton underwear changed daily, antifungal cream 2 weeks after clearing; do not use steroid creams",
    "Tinea pedis (fungal infection of feet)": "Fungal infection of feet: dry between toes, change socks daily, antifungal powder / cream; avoid closed wet shoes",
    "Tinea capitis / scalp condition": "Scalp fungal infection: oral medicine for weeks as prescribed; do not share combs / caps; check other children at home",
    "Cellulitis of lower limb": "Cellulitis: keep leg raised, complete antibiotics, mark the edge of redness; come back if redness spreads, fever or blisters; treat cracks between toes",
    "Cellulitis": "Cellulitis: keep part raised, complete antibiotics; come back if redness spreads, fever or pus",
    "Abscess": "Abscess: drainage done / needed; daily dressing, complete antibiotics if given; check sugar if boils come again",
    "Carbuncle": "Carbuncle: drainage and daily dressing, antibiotics; check blood sugar (diabetes is common); keep area clean",
    "Boil / folliculitis": "Boil: warm compress, do not squeeze; drain if soft; check sugar if boils keep coming",
    "Conjunctivitis": "Red eye (conjunctivitis): wash hands often, do not share towel / kajal, clean discharge with clean water; drops as prescribed; come back if pain, blurred vision or light hurts eyes",
    "Hordeolum (stye)": "Stye: warm compress 3-4 times a day, do not squeeze; come back if swelling spreads or vision changes",
    // ---- chronic / NCD
    "Hypertension follow-up": "BP: take tablets daily even when BP is normal, do not stop on your own; less salt and pickles / papad, walk 30 minutes daily, no tobacco / alcohol; check BP monthly at health centre",
    "Hypertension": "High BP reading: recheck BP after rest and on another day; less salt, regular walk, no tobacco; come back for BP check in 1-2 weeks",
    "Type 2 diabetes follow-up": "Diabetes: take medicines daily, less sugar / sweets / white rice, walk 30 minutes; check feet daily; sugar test monthly, eyes and kidney yearly; carry sweet if sugar falls (sweating, shaking)",
    "Diabetes (suspected)": "Possible diabetes: fasting sugar / HbA1c to confirm; reduce sugar and sweets, walk daily; come back with report",
    "Anaemia (to confirm)": "Anaemia: iron-folic acid tablets daily after food (stool may turn black, normal), green leafy vegetables, jaggery, pulses; deworming; recheck Hb after 1 month",
    "Sickle cell disease": "Sickle cell disease: drink plenty of water, avoid cold exposure and dehydration, folic acid daily, all vaccines; come at once for fever, severe pain, breathlessness or yellow eyes",
    "Thalassaemia": "Thalassaemia: regular transfusion as scheduled, iron chelation as prescribed; family screening before marriage / pregnancy",
    "Palpitations": "Palpitations: ECG; reduce tea / coffee, no tobacco; check Hb and thyroid; come at once if fainting or chest pain",
    "Chest pain": "Chest pain: ECG done; come at once if pain with sweating, breathlessness or pain going to arm / jaw",
    "Pleuritic chest pain": "Chest pain on breathing: chest X-ray; complete medicines; come back if breathless or high fever",
    "Chest wall pain": "Chest wall pain: rest, painkiller gel / tablet, avoid heavy lifting; ECG if any doubt; come back if pain with sweating or breathlessness",
    "Thyroid swelling (goitre)": "Neck swelling (goitre): thyroid test and ultrasound; use iodised salt; come back if difficulty breathing or swallowing",
    "Hyperthyroidism": "Hyperthyroidism: take tablets daily, thyroid test as advised; report fever with sore throat at once (medicine side effect)",
    "Hypothyroidism": "Hypothyroidism: take thyroxine empty stomach in the morning, 30 minutes before tea / food, daily for life; TSH test after 6-8 weeks",
    "Pedal oedema": "Swelling of feet: raise legs when resting, less salt; tests for heart, kidney, liver and Hb; come back if breathless or swelling of face",
    "Chronic non-healing ulcer": "Non-healing ulcer: daily clean dressing, check sugar, keep pressure off; check sensation; refer if no healing in 6 weeks",
    "Deep vein thrombosis (suspected)": "Painful swollen leg: refer for Doppler today; do not massage the leg; come at once if chest pain or breathlessness",
    "Gout": "Gout: rest the joint, ice, medicines as prescribed; drink plenty of water, reduce alcohol, red meat; come back if fever with joint swelling",
    "Rheumatoid arthritis (to confirm)": "Joint pain with morning stiffness: tests (RA factor, ESR); gentle exercise; refer to physician for long-term treatment",
    "Joint swelling / arthritis": "Joint swelling: rest, cold compress, medicines as prescribed; come back if fever, redness or unable to move the joint",
    "Joint pain (arthralgia)": "Joint pain: rest when painful, gentle exercise, weight control; painkillers only as prescribed (avoid long use)",
    "Knee osteoarthritis": "Knee pain (osteoarthritis): quadriceps exercises daily, weight loss, avoid squatting / cross-legged sitting and climbing stairs often; use western toilet / stick if needed",
    "Low back pain": "Back pain: stay active, avoid bed rest, hot fomentation, back exercises after pain settles; lift with knees bent; come back if leg weakness or urine / stool problem",
    "Back pain with red flags": "Back pain with fever / weight loss / night pain: X-ray and ESR; refer to orthopaedics",
    "Sciatica": "Sciatica: stay active, avoid lifting heavy weight, hot fomentation, exercises; come at once if leg weakness or urine / stool problem",
    "Cervical radiculopathy": "Neck pain going to arm: neck exercises, correct pillow and posture, hot fomentation; come back if arm weakness",
    "Neck / upper back pain": "Neck pain: correct posture, avoid long phone use with bent neck, neck exercises, hot fomentation",
    "Peripheral neuropathy": "Numbness of feet / hands: sugar and B12 tests; check feet daily for wounds, wear footwear; avoid hot water burns",
    "Numbness of one limb": "Numbness of one limb: avoid pressure on the limb; come at once if weakness, face deviation or speech problem (stroke)",
    "Facial palsy (Bell's palsy)": "Facial palsy: protect the eye (eye drops, tape / glasses at night), face exercises; medicines started early; come at once if limb weakness",
    "Seizure / epilepsy": "Fits: take medicines daily, do not stop suddenly; avoid swimming, driving, fire and heights; during a fit turn on side, nothing in mouth; come at once if fit lasts more than 5 minutes",
    "Vertigo": "Vertigo: get up slowly, avoid sudden head movements; exercises as shown; come at once if weakness, slurred speech or double vision",
    "Headache": "Headache: regular sleep and meals, enough water, less screen time; check BP and eyes; come at once if sudden severe headache, vomiting, weakness or fits",
    "Headache by site": "Headache: note triggers (sleep loss, fasting, sun); regular meals and sleep; painkiller not more than 2-3 days a week; check eyes",
    "Giddiness / dizziness": "Giddiness: sit or lie down when dizzy, drink enough water, get up slowly; BP, sugar, Hb checked; come at once if fainting, chest pain or weakness",
    "Depression / anxiety": "Low mood / anxiety: regular sleep, walk daily, talk to family; avoid alcohol; follow up in 2 weeks; Tele-MANAS 14416 (free, 24x7)",
    "Alcohol use": "Alcohol: reduce and stop with support; do not stop suddenly if drinking heavily daily (fits / confusion), see doctor; free help at Tele-MANAS 14416",
    "Double vision": "Double vision: see eye / neuro specialist; check BP and sugar; come at once if weakness or headache",
    "Eyelid / face puffiness": "Puffy eyes / face: urine test for protein, kidney and thyroid tests; less salt",
    // ---- abdomen / GI / GU
    "Gastritis / dyspepsia": "Acidity: small frequent meals, avoid spicy / oily food, tea on empty stomach, tobacco and alcohol; do not lie down soon after meals; come back if vomiting blood or black stool",
    "Gastro-oesophageal reflux": "Acid reflux: dinner 2-3 hours before sleep, raise head of bed, avoid tea / coffee / spicy food late; lose weight; no tobacco",
    "Acute appendicitis (suspected)": "Possible appendicitis: nothing by mouth, refer to surgery now; do not take painkillers or purgatives at home",
    "Biliary colic / gallstones (suspected)": "Gallstone pain: avoid fried / fatty food; ultrasound; come at once if fever, yellow eyes or continuous pain",
    "Abdominal pain": "Belly pain: light food, fluids; come at once if pain worsens, vomiting, fever, blood in stool / vomit or belly becomes hard",
    "Dysmenorrhoea (painful periods)": "Painful periods: hot water bag, light exercise, painkiller as prescribed; come back if pain between periods, heavy bleeding or fever",
    "Renal colic (kidney stone)": "Kidney stone: drink 3 litres of water daily, less salt; painkiller as prescribed; ultrasound; come at once if fever with chills or no urine",
    "Kidney stone": "Kidney stone: drink 3 litres of water daily, less salt; come at once if fever with chills or not passing urine",
    "Haemorrhoids (piles)": "Piles: high-fibre food (fruits, vegetables, whole grains), 2-3 litres water, sitz bath in warm water, do not strain; come back if heavy bleeding",
    "Anal fissure / painful defecation": "Fissure: warm sitz bath 2-3 times a day, high-fibre diet, plenty of water, stool softener as prescribed; do not strain",
    "Hernia / groin or scrotal swelling": "Hernia / hydrocele: avoid heavy lifting; surgery referral; come at once if the swelling becomes painful, hard and does not go back, with vomiting",
    "Constipation": "Constipation: more water, fruits, vegetables, whole grains; regular toilet time; walk daily; avoid long use of laxatives",
    "Nausea / vomiting": "Vomiting: small sips of ORS / water often, light food when better; pregnancy test if relevant; come at once if blood in vomit, unable to keep fluids or belly pain",
    "Blood in urine": "Blood in urine: urine test, kidney function and ultrasound; drink water; age 40+ needs specialist check to rule out cancer",
    "Scrotal pain": "Scrotal pain: sudden severe pain is an emergency (testis twisting) - go to surgery at once; support scrotum, painkiller",
    "Enlarged spleen": "Enlarged spleen: tests for malaria, kala-azar, blood disorders; avoid contact sports / injury to belly",
    // ---- women / pregnancy
    "Pregnancy / ANC visit": "Pregnancy: iron-folic acid daily, calcium twice daily (not with iron), TT / Td as due; 4+ ANC check-ups; eat extra meal, rest; plan delivery at hospital (JSY / JSSK free); come at once for bleeding, severe headache, swelling of face / hands, fits, leaking water, fever or reduced baby movements",
    "Vaginal discharge": "White discharge: keep area clean and dry, cotton underwear; complete medicines; partner also needs treatment (syndromic kit); come back if fever, belly pain or bleeding",
    "Menstrual disorder": "Period problem: keep a period calendar; iron tablets if bleeding is heavy; Hb test; come back if very heavy bleeding, dizziness, or bleeding after menopause",
    "Vaginal bleeding": "Vaginal bleeding: pregnancy test first; come at once if heavy bleeding, fainting or pain; bleeding after menopause needs specialist check",
    "Breast lump": "Breast lump: refer for examination and ultrasound / FNAC; check both breasts monthly after periods",
    "Delivery normal": "After delivery: breastfeed within 1 hour and on demand, keep baby warm (skin-to-skin), iron and calcium for 6 months; family planning advice; come at once for heavy bleeding, fever, foul discharge, fits or breathlessness",
    "Delivery by caesarean section": "After caesarean: keep wound clean and dry, walk early, breastfeed; no heavy lifting for 6 weeks; come back for fever, wound pus / opening, heavy bleeding",
    "Emergency caesarean indication": "Emergency caesarean: shift to OT / refer to FRU now with referral note",
    // ---- children
    "Neonatal jaundice": "Newborn jaundice: breastfeed every 2-3 hours; check yellowness in daylight; come at once if yellow palms / soles, baby too sleepy or not feeding, or jaundice in first 24 hours",
    "Well-baby visit": "Well baby: exclusive breastfeeding for 6 months, keep warm, vaccines as per card; weight check every month; come at once if not feeding, fast breathing, fever or cold to touch",
    "Poor weight gain / low birth weight": "Low weight baby: frequent breastfeeding (8-12 times a day), skin-to-skin (Kangaroo care), keep warm; weekly weight check; come at once if not feeding or cold",
    "Low birth weight infant": "Low birth weight: Kangaroo care, breastfeed every 2 hours, keep warm, no bath till weight improves; weekly weight check",
    "Failure to gain weight": "Poor weight gain: feed 5-6 times a day with energy-rich food (add oil / ghee), continue breastfeeding; deworming; Anganwadi THR; weight check monthly",
    "Excessive crying / breath-holding": "Excessive crying: check for hunger, wet nappy, ear pain, hernia; burp after feeds; come at once if crying with vomiting, swelling in groin or fever",
    "Enuresis (bed-wetting)": "Bed-wetting: no punishment, less fluids after evening, pass urine before sleep, reward dry nights; check urine if pain or day wetting",
    "Immunisation visit": "Vaccination: next dose date as per card; mild fever / pain at site is normal (paracetamol if needed, no hot compress); come back if high fever or fits",
    // ---- ENT / eye / dental
    "Epistaxis (nose bleed)": "Nose bleed: sit up, lean forward, pinch soft part of nose for 10 minutes, breathe through mouth; no picking; check BP; come back if bleeding does not stop",
    "Hearing loss": "Hearing loss: do not put oil / sticks in ear; hearing test; avoid loud noise",
    "Foreign body": "Foreign body: do not try to remove at home; doctor to remove with proper light / instruments",
    "Ear wax / blocked ear": "Ear wax: wax-softening drops for 3-5 days then cleaning by doctor; do not use buds / sticks",
    "Tinnitus": "Ringing in ear: hearing test; avoid loud noise, reduce tea / coffee; check BP",
    "Difficulty swallowing / lump in throat": "Difficulty swallowing: refer to ENT; come at once if unable to swallow water or saliva; stop tobacco",
    "Lymph node swelling": "Swollen gland: check for throat / teeth / scalp infection; if more than 2 weeks, FNAC to rule out TB",
    "Otomycosis (fungal ear)": "Fungal ear: keep ear dry, no oil / water in ear, do not scratch with sticks; drops as prescribed after cleaning",
    "Otitis externa": "Outer ear infection: keep ear dry, no buds / sticks; drops as prescribed; come back if face swelling or fever",
    "Retraction of tympanic membrane": "Blocked ear (Eustachian tube): steam inhalation, nasal drops as prescribed, gentle Valsalva; treat cold / allergy",
    "Sensorineural (neural) hearing loss?": "Hearing loss: audiometry; avoid loud noise; hearing aid if advised",
    "Allergic conjunctivitis": "Itchy eyes (allergy): cold compress, avoid rubbing, wash face after outdoor work; drops as prescribed; no steroid drops without eye examination",
    "Subconjunctival haemorrhage": "Red patch in eye: harmless, clears in 2-3 weeks; check BP; come back if pain or vision change",
    "Dry eye": "Dry eye: blink often, 20-20-20 rule for screens, lubricating drops; avoid direct fan / AC on face",
    "Nasolacrimal duct obstruction": "Watering eye: in babies, massage the inner corner of eye as shown, 4 times a day; adults: ENT / eye referral",
    "Foreign body in eye": "Foreign body in eye: do not rub; wash with clean water; doctor to remove; come back if pain or vision change",
    "Foreign body sensation": "Something in eye feeling: do not rub, wash with clean water; eye examination",
    "Disorder of refraction (glasses)": "Refractive error: get glasses as per eye test and wear them regularly; children: school eye check yearly",
    "Presbyopia": "Near vision weakness (age 40+): reading glasses; eye check every 1-2 years (cataract, glaucoma)",
    "Reduced vision / cataract": "Cataract: free surgery under NPCBVI; control sugar and BP before surgery; until then good light for reading",
    "Dental caries / toothache": "Tooth decay: brush twice daily with fluoride paste, rinse after meals, less sweets; dental filling / treatment; painkiller as prescribed",
    "Gingivitis / periodontal disease": "Gum disease: brush twice daily (soft brush), clean between teeth, warm salt-water rinse; scaling at dental OPD; no tobacco",
    "Gingivitis with stains / calculus": "Stains / tartar: scaling and polishing at dental OPD; brush twice daily; stop tobacco / gutkha",
    "Staining of teeth": "Stained teeth: scaling and polishing; brush twice daily; stop gutkha / tobacco, less tea",
    "Mobile tooth": "Loose tooth: dental check (gum disease), scaling; brush gently; no tobacco",
    "Mobile / loose tooth?": "Loose tooth: dental check (gum disease or injury)",
    "Impacted third molar": "Wisdom tooth pain: warm salt-water rinse, keep area clean; X-ray and dental opinion for removal; come back if swelling of face or mouth does not open",
    "Impacted third molar?": "Back tooth pain: warm salt-water rinse; dental check",
    "Dentine sensitivity": "Sensitive teeth: sensitivity toothpaste, soft brush, avoid very hot / cold; dental check",
    "Root caries / root stump": "Root stump: extraction / treatment at dental OPD; keep clean",
    "Mouth ulcer": "Mouth ulcer: avoid spicy food, warm salt-water rinse, gel as prescribed; B-complex; come back if ulcer beyond 2 weeks",
    "Oral lesion > 2 weeks": "Mouth ulcer / patch for 2+ weeks: refer for oral cancer screening; stop tobacco / gutkha / betel completely",
    // ---- skin
    "Dermatitis": "Skin allergy: avoid the cause (soap, detergent, metal, plants), moisturise, mild soap; do not use steroid cream without advice",
    "Eczema": "Eczema: moisturise twice daily, mild soap, cotton clothes; avoid scratching; medicines as prescribed",
    "Acne vulgaris": "Pimples: wash face twice with mild soap, do not squeeze, avoid oily creams; apply medicine as prescribed; takes 6-8 weeks",
    "Urticaria (hives)": "Hives: antihistamine as prescribed; avoid trigger food / medicine; come at once if swelling of lips / face or breathlessness",
    "Pityriasis versicolor": "Light / dark patches (fungal): antifungal shampoo / cream as prescribed; patches take months to regain colour; keep skin dry",
    "Vitiligo": "White patches: not infectious; sunscreen, treatment as prescribed; check sensation (leprosy rule-out)",
    "Psoriasis": "Psoriasis: moisturise daily, avoid scratching and injury; treatment as prescribed; not infectious",
    "Hair loss": "Hair loss: balanced diet, Hb / thyroid tests; avoid harsh treatments; patchy loss needs skin specialist",
    "Skin rash": "Rash: avoid new soaps / medicines; antihistamine if itchy; come back if fever, blisters, mouth sores or rash spreading",
    "Rash with fever": "Fever with rash: isolate from pregnant women and babies; fluids, paracetamol; come at once if bleeding spots or drowsiness",
    "Burn injury": "Burn: cool with running tap water for 20 minutes (no ice, toothpaste or oil), cover with clean cloth; dressing as advised; Td; come back if fever or pus",
    // ---- injury / bones
    "Injury": "Injury: clean the wound, dressing; Td if not taken in last 5 years; ice and rest for swelling; come back if swelling increases, numbness or unable to use the part",
    "Injury / wound": "Wound: keep clean and dry, change dressing as advised; Td injection if not taken in last 5 years; suture removal in 7-10 days; come back if pus, fever or redness spreading",
    "Knee injury / sprain": "Knee injury: rest, ice 15 minutes 3-4 times a day, crepe bandage, keep leg raised; X-ray if unable to bear weight; come back if knee locks or gives way",
    "Ankle sprain": "Ankle sprain: rest, ice, crepe bandage, keep foot raised for 2-3 days; X-ray if unable to walk; gentle movement after pain settles",
    "Fracture follow-up": "Fracture: keep plaster dry, move fingers / toes, keep limb raised; come at once if severe pain, swelling, numbness or blue fingers / toes",
    "Limb pain": "Limb pain: rest, hot / cold fomentation; X-ray if injury or swelling; come back if pain worsens or swelling",
    "Swelling of limb / scalp": "Swelling: cold compress for injury, warm for infection; come back if fever, pus or swelling increases",
    "Swelling of one leg": "One leg swollen: keep leg raised; tests for clot / infection / filaria; come at once if chest pain or breathlessness",
    "Body ache (myalgia)": "Body ache: rest, fluids, paracetamol; come back if fever, weakness increasing or dark urine",
    "PIVD (disc prolapse)?": "Back pain going down the leg: avoid lifting, stay gently active; come at once if leg weakness or urine / stool problem",
    // ---- other
    "General check-up / fitness certificate": "Check-up: BP, sugar (age 30+), Hb done; healthy diet, daily walk, no tobacco / alcohol; NCD screening yearly",
    "No complaint": "Screening: BP, sugar, Hb checked; daily walk, less salt / sugar / oil, no tobacco; repeat yearly",
    "Follow-up visit": "Follow-up: continue medicines as prescribed; bring all reports and medicines on next visit",
    "Breathlessness": "Breathlessness: SpO2 and chest check; avoid smoke; come at once if lips blue, unable to speak, or chest pain",
  };
  const SYMPTOM_ADVICE = {
    "Fever": "Fever: paracetamol, plenty of fluids, sponge with normal water; malaria test; come back if fever beyond 3 days, rash, bleeding, vomiting or drowsiness",
    "Cough": "Cough: warm fluids, steam inhalation, honey with warm water (not for babies under 1); cough 2 weeks or more: sputum test for TB",
    "Common cold": "Cold: steam inhalation, saline nasal drops, warm fluids; antibiotics not needed; come back if breathless or high fever",
    "Cough with fever": "Cough with fever: fluids, paracetamol, steam; come back if breathless, chest pain or fever beyond 3 days",
    "Headache": "Headache: regular sleep and meals, water, less screen time; check BP and eyes; come at once if sudden severe headache, vomiting or weakness",
    "Abdominal pain": "Belly pain: light food and fluids; come at once if pain worsens, vomiting, fever or blood in stool",
    "Loose stool": "Loose motions: ORS after every loose stool, continue food; wash hands; come at once if blood in stool, no urine for 6 hours or very weak",
    "Vomiting": "Vomiting: small sips of ORS often; come at once if blood in vomit or unable to keep fluids",
    "Weakness - general": "Weakness: balanced diet with pulses, green vegetables, fruits; Hb and sugar checked; enough sleep",
    "Muscle weakness": "Weakness: balanced diet, Hb and sugar checked; come at once if unable to walk or swallow",
    "Generalised aches and pains": "Body ache: rest, fluids, paracetamol; come back if fever or weakness increasing",
    "Backache": "Back pain: stay active, hot fomentation, correct posture while lifting; come back if leg weakness",
    "Low back pain": "Back pain: stay active, avoid bed rest, hot fomentation, lift with knees bent; come back if leg weakness or urine problem",
    "Itching": "Itching: mild soap, cotton clothes, moisturiser; if family members also itch at night, treat all for scabies",
    "Dizziness": "Dizziness: get up slowly, drink enough water; BP, sugar, Hb checked",
    "Giddiness": "Giddiness: get up slowly, drink enough water; BP, sugar, Hb checked",
    "Wound": "Wound: keep clean and dry, dressing; Td if not taken in last 5 years; come back if pus or fever",
    "Pain": "Pain: rest, painkiller as prescribed; come back if pain increases or new symptoms",
    "Dog scratch": "Animal scratch: wash with soap and running water for 15 minutes; rabies vaccine as advised; Td",
    "Deep dog bite": "Deep bite: wash 15 minutes, do not stitch immediately; rabies immunoglobulin + vaccine (Cat III); Td",
    "Sensitivity": "Sensitive teeth: sensitivity toothpaste, soft brush, avoid very hot / cold",
    "Toothache": "Toothache: warm salt-water rinse, painkiller as prescribed; dental treatment; come back if face swelling",
    "Pericoronitis": "Wisdom tooth gum infection: warm salt-water rinses, keep clean; dental opinion; come back if face swelling or mouth not opening",
    "Bleeding gums": "Bleeding gums: soft brush twice daily, salt-water rinse, scaling at dental OPD; check Hb",
    "Breath smells unpleasant": "Bad breath: brush twice and clean tongue, scaling at dental OPD, drink water; stop tobacco",
    "Uses contraception": "Family planning: options explained (sterilisation, Copper-T, Antara, Chhaya, condoms); sterilisation free with compensation",
    "Antenatal care status": "ANC: iron-folic acid daily, calcium, Td as due; next check-up date; come at once for bleeding, headache, swelling, fits or less baby movement",
    "Pregnancy": "Pregnancy: iron-folic acid daily, calcium, Td as due; 4+ check-ups; hospital delivery; come at once for bleeding, headache, swelling or fits",
    "Upper respiratory infection": "Cold / throat infection: steam, gargles, fluids, paracetamol; antibiotics not needed; come back if breathless",
    "Hypertensive disorder": "BP: tablets daily, less salt, walk daily, no tobacco; BP check monthly",
    "Fit for work": "Fitness: BP, sugar, vision checked; healthy diet and daily walk",
    "Fever with chills": "Fever with chills: malaria test today; paracetamol, fluids; complete treatment if positive; come back if fever persists or drowsiness",
    "Hemoptysis": "Blood in sputum: sputum test for TB and chest X-ray; come at once if large amount of blood or breathless",
    "Migraine": "Migraine: regular sleep and meals, avoid triggers (sun, fasting, loud noise); take medicine at start of headache; keep a headache diary",
    "Chest pain": "Chest pain: ECG; come at once if pain with sweating, breathlessness or pain going to arm / jaw",
    "Left sided chest pain": "Chest pain: ECG; come at once if pain with sweating, breathlessness or pain going to arm / jaw",
    "Right sided chest pain": "Chest pain: ECG if any doubt; come at once if pain with sweating or breathlessness",
    "Lower abdominal pain": "Lower belly pain: urine test, pregnancy test if relevant; come at once if pain worsens, fever or vomiting",
    "Upper abdominal pain": "Upper belly pain: small frequent meals, avoid spicy / oily food; come at once if vomiting blood, black stool or severe pain",
    "Epigastric pain": "Upper belly pain: small frequent meals, avoid spicy / oily food, no tobacco / alcohol; come back if vomiting blood or black stool",
    "Neck pain": "Neck pain: correct posture, neck exercises, hot fomentation; avoid long phone use with bent neck",
    "Knee pain": "Knee pain: quadriceps exercises, weight control, avoid squatting and cross-legged sitting; hot fomentation; come back if swelling or fever",
    "Ankle pain": "Joint pain: rest when painful, hot / cold fomentation, gentle exercise; painkiller only as prescribed; come back if swelling, redness, fever or unable to move",
    "Heel pain": "Heel pain: soft-soled footwear, stretch calf and sole, roll foot on a bottle, avoid barefoot walking on hard floor",
    "Hip pain": "Joint pain: rest when painful, hot / cold fomentation, gentle exercise; painkiller only as prescribed; come back if swelling, redness, fever or unable to move",
    "Shoulder region pain": "Shoulder pain: gentle shoulder exercises (pendulum, wall climbing), hot fomentation; avoid complete rest (stiffness)",
    "Elbow pain": "Elbow pain: rest from repeated gripping / lifting, ice or hot fomentation, strap if advised",
    "Wrist pain": "Wrist pain: rest, splint if advised, ice for swelling; X-ray if after a fall",
    "Hand pain": "Joint pain: rest when painful, hot / cold fomentation, gentle exercise; painkiller only as prescribed; come back if swelling, redness, fever or unable to move",
    "Foot pain": "Foot pain: proper footwear, foot exercises; diabetics check feet daily",
    "Leg pain": "Leg pain: rest, hot fomentation, stretching; come back if swelling of one leg, numbness or wound",
    "Pain in lower limb": "Leg pain: rest, hot fomentation, stretching; come back if swelling of one leg, numbness or wound",
    "Joint pain": "Joint pain: rest when painful, hot / cold fomentation, gentle exercise; painkiller only as prescribed; come back if swelling, redness, fever or unable to move",
    "Throat pain": "Sore throat: warm salt-water gargles, warm fluids, paracetamol; come back if unable to swallow or fever beyond 3 days",
    "Dental caries": "Tooth decay: brush twice daily with fluoride paste, less sweets; dental filling / treatment",
    "Red eye": "Red eye: wash hands, do not share towel, clean with clean water; come back if pain, blurred vision or light hurts eyes",
    "Dry eyes": "Dry eyes: blink often, 20-20-20 rule for screens, lubricating drops",
    "Itching of eye": "Itchy eyes: cold compress, do not rub; drops as prescribed; no steroid drops without eye check",
    "Itching of ear": "Itchy ear: do not use buds / sticks / oil; keep ear dry; ear check",
    "Epiphora": "Watering eye: eye check (blocked tear duct, infection); clean with clean water",
    "Pain in eye": "Eye pain: eye examination; come at once if vision becomes blurred or eye red and painful",
    "Acne": "Pimples: wash face twice with mild soap, do not squeeze, avoid oily creams",
    "Alopecia": "Hair fall: balanced diet, Hb / thyroid check; patchy loss needs skin specialist",
    "Skin lesion": "Skin lesion: keep clean, do not scratch; come back if it grows, bleeds or does not heal",
    "Rash": "Rash: avoid new soaps / medicines; antihistamine if itchy; come back if fever, blisters or rash spreading",
    "Constipation": "Constipation: more water, fruits, vegetables, whole grains; walk daily; regular toilet time",
    "Loss of appetite": "Poor appetite: small frequent meals; check Hb, sugar, liver; come back if weight loss or yellow eyes",
    "UTI - Urinary tract infection": "Urine infection: drink 2-3 litres of water, do not hold urine, complete medicines; come back if fever with chills or back pain",
    "Leukorrhoea": "White discharge: keep clean and dry, cotton underwear; complete medicines; partner may need treatment",
    "SOB - Shortness of breath": "Breathlessness: avoid smoke; come at once if lips blue, unable to speak or chest pain",
    "Bleeding": "Bleeding: rest; come at once if heavy bleeding, dizziness or fainting",
    "Anaemia": "Anaemia: iron-folic acid tablets after food, green vegetables, jaggery, pulses; deworming; Hb recheck after 1 month",
    "Pins and needles": "Tingling: sugar and B12 check; check feet daily for wounds",
    "Insomnia": "Poor sleep: fixed sleep time, no screens / tea after evening, daily walk; avoid sleeping pills without advice",
    "Palpitations": "Palpitations: less tea / coffee, no tobacco; ECG, Hb, thyroid; come at once if fainting or chest pain",
    "Swelling": "Swelling: cold compress for injury, warm for infection; come back if fever, pus or swelling increases",
    "Earache": "Ear pain: do not put oil / sticks in ear, keep dry; painkiller; come back if discharge, fever or swelling behind ear",
    "Boil": "Boil: warm compress, do not squeeze; drain if soft; check sugar if boils keep coming",
    "Amenorrhoea": "Missed period: urine pregnancy test; come at once if pain or bleeding",
    "Menstrual period late": "Late period: urine pregnancy test; come back after 1 week if test negative and no period",
    "Deliveries by caesarean": "Previous caesarean: deliver only at hospital with operation facility (FRU / DH); 4+ ANC visits",
    "Dysmenorrhoea": "Painful periods: hot water bag, light exercise, painkiller as prescribed; come back if pain between periods or heavy bleeding",
    "Human bite mark": "Human bite: wash well with soap and water, antibiotic, Td; do not stitch immediately; come back if redness or pus",
    "Cat scratch injury": "Cat scratch: wash with soap and running water for 15 minutes; rabies vaccine as advised; Td",
    "Lip ulcer": "Lip ulcer: keep clean, avoid spicy food; come back if beyond 2 weeks (needs check)",
    "Cyst": "Cyst: do not squeeze; surgery opinion if growing, painful or infected",
    "Impetigo": "Impetigo: wash crusts gently with soap and water, apply cream as prescribed, cut nails, separate towel; child can return to school after 2 days of treatment",
    "Hypothyroidism": "Hypothyroidism: thyroxine empty stomach in the morning daily; TSH after 6-8 weeks",
    "Deviated nasal septum": "Blocked nose: steam inhalation, saline drops; ENT opinion if always blocked or nose bleeds",
    "Medical report sent": "Report: as per medico-legal / certificate process",
    "Ulcer": "Ulcer: daily clean dressing, check sugar; come back if pus, spreading or not healing in 2 weeks",
    "Breast pain": "Breast pain: supportive bra, less tea / coffee; breast check; come back if lump, nipple discharge or redness",
    "Noisy respiration": "Noisy breathing: steam, saline drops; come at once if child breathes fast, chest pulls in or lips blue",
    "Fissure in ano": "Fissure: warm sitz bath, high-fibre food, plenty of water, do not strain",
    "Pedal oedema": "Swelling of feet: raise legs, less salt; tests for heart, kidney, liver, Hb",
    "Lipoma": "Lipoma: harmless fatty lump; surgery if growing or troublesome",
    "Allergic contact dermatitis": "Skin allergy: avoid the cause (soap, detergent, metal), moisturise; no steroid cream without advice",
    "Fungal infection": "Fungal infection: keep skin dry, cotton clothes, cream 2 weeks after clearing; do not share towels; avoid steroid creams",
    "Irregular periods": "Irregular periods: keep a period calendar; Hb, thyroid test; come back if heavy bleeding",
    "Chronic kidney disease": "Kidney disease: less salt, control BP and sugar, no painkillers without advice; kidney tests as scheduled",
    "Blood group": "Blood group test done",
    "Oral hygiene finding": "Teeth care: brush twice daily, rinse after meals, dental check every 6 months; no tobacco",
    "Tooth absent": "Missing tooth: dental opinion for replacement (denture / bridge)",
    "Head injury": "Head injury: watch for vomiting, drowsiness, fits, bleeding from ear / nose: come back at once",
  };

  function adviceFor(dx) {
    const p = String(dx || "").split(" \u2014")[0].trim();
    if (ADVICE[p]) return ADVICE[p];
    const q = p.replace(/\s*\([^)]*\)\s*$/, "");
    if (ADVICE[q]) return ADVICE[q];
    let best = ""; for (const k of Object.keys(ADVICE)) if (p.startsWith(k) && k.length > best.length) best = k;
    return best ? ADVICE[best] : "";
  }
  // Doctors' naming habits differ by hospital (HMIS master data, 74,538 visits, Mar-Nov 2026).
  // Base names follow Sadar; the CHCs below get the names their own doctors use most.
  const FAC_KEY = { "8ed05645-b4ae-40f4-b1d3-f5edbeda6c01": "sadar", "99cebf22-851d-4e54-b45b-b22823a178a0": "gola", "3ae26e4a-eed2-45e5-a5be-06f5909545b1": "mandu", "bbe6142f-bd1f-452a-8d63-da31e041e493": "patratu" };
  const FAC_NAMES = {
    gola: { "HTN - Hypertension": "Hypertensive disorder", "Low back pain": "Backache", "Leg pain": "Pain in lower limb", "Dizziness": "Giddiness", "Abscess": "Boil" },
    mandu: { "HTN - Hypertension": "Hypertensive disorder", "Low back pain": "Backache", "Leg pain": "Pain in lower limb", "Dizziness": "Giddiness" },
    patratu: { "HTN - Hypertension": "Hypertensive disorder", "Low back pain": "Backache", "Abscess": "Boil" },
  };
  const FAC_CHIPS = { gola: { anc: true, uri: true, muscleWeak: true }, mandu: { uri: true, muscleWeak: true } };
  const facName = (h, r) => { const m = FAC_NAMES[h.fac]; const n = m && m[r.search]; return n ? { ...r, search: n, dx: r.dx === r.search ? n : r.dx } : r; };
  const SYMPTOMS = [
    [(h) => h.fever, "Fever"],
    [(h) => h.cough, "Cough"],
    [(h) => h.cold || /\bcold\b|sardi|zukam|running nose/i.test(h.text), "Common cold"],
    [(h) => h.fever && h.cough, "Cough with fever"],
    [(h) => h.fever && h.chills && !h.cough, "Fever with chills"],
    [(h) => h.haemoptysis || /cough with blood|blood in sputum|blood[- ]?ting/i.test(h.text), "Hemoptysis"],
    [(h) => h.headache && !/migraine/i.test(h.text), "Headache"],
    [(h) => /migraine/i.test(h.text), "Migraine"],
    [(h) => h.near(G.chestPain), "Chest pain"],
    [(h) => h.abdP && !h.anc, "Abdominal pain"],
    [(h) => /backache|back ache/i.test(h.text), "Backache"],
    [(h) => h.backpain && !/backache|back ache/i.test(h.text) && !G.radiateLeg.test(h.text), "Low back pain"],
    [(h) => G.neckPain.test(h.text), "Neck pain"],
    [(h) => /knee|ghutn/i.test(h.text) && h.near(G.pain), "Knee pain"],
    [(h) => /ankle|takhn/i.test(h.text) && h.near(G.pain), "Ankle pain"],
    [(h) => /\bheel|edi\b/i.test(h.text) && h.near(G.pain), "Heel pain"],
    [(h) => /\bhip\b/i.test(h.text) && h.near(G.pain), "Hip pain"],
    [(h) => /shoulder/i.test(h.text) && h.near(G.pain), "Shoulder region pain"],
    [(h) => /elbow/i.test(h.text) && h.near(G.pain), "Elbow pain"],
    [(h) => /wrist|kalai/i.test(h.text) && h.near(G.pain), "Wrist pain"],
    [(h) => /\bhands?\b/i.test(h.text) && h.near(G.pain), "Hand pain"],
    [(h) => /\b(foot|feet)\b/i.test(h.text) && h.near(G.pain), "Foot pain"],
    [(h) => /\blegs?\b/i.test(h.text) && h.near(G.pain) && !/foot|feet|knee|ankle/i.test(h.text), "Leg pain"],
    [(h) => /joint pain|jod.*dard|arthralgia/i.test(h.text) && !/knee|ankle|hip|shoulder|wrist|elbow/i.test(h.text), "Joint pain"],
    [(h) => h.bodyache && !h.fever, "Generalised aches and pains"],
    [(h) => /sore throat|throat pain|gale? (me|mein) (dard|kharash)/i.test(h.text), "Throat pain"],
    [(h) => h.near(G.tooth, G.pain) && !/caries/i.test(h.text), "Dental caries"],
    [(h) => /red eye|redness|aankh (lal|laal)|eye[^,.;\n]{0,10}red/i.test(h.text) && !/skin|body|rash/i.test(h.text), "Red eye"],
    [(h) => /dry eye|eyes? (dry|dryness)|aankh (sukh|sookh)|grittiness/i.test(h.text), "Dry eyes"],
    [(h) => /itch\w*[^,.;\n]{0,10}eye|eye[^,.;\n]{0,10}itch|aankh (me|mein) khujli/i.test(h.text), "Itching of eye"],
    [(h) => /itch\w*[^,.;\n]{0,10}(ear|\ble\b|\bre\b|both ears)|ear[^,.;\n]{0,10}itch|kaan (me|mein) khujli/i.test(h.text), "Itching of ear"],
    [(h) => /watering|epiphora|aankh se paani|tears/i.test(h.text), "Epiphora"],
    [(h) => /pain[^,.;\n]{0,10}eye|eye[^,.;\n]{0,10}pain|aankh (me|mein) dard/i.test(h.text), "Pain in eye"],
    [(h) => h.itch && !/eye|ear|\ble\b|\bre\b|both ears/i.test(h.text), "Itching"],
    [(h) => /pimple|acne|muhase|kil\b/i.test(h.text), "Acne"],
    [(h) => /hair (loss|fall)|baal (jhad|gir)|alopecia/i.test(h.text), "Alopecia"],
    [(h) => /skin lesion|lesion (over|on)/i.test(h.text), "Skin lesion"],
    [(h) => h.rash && !fev(h), "Rash"],
    [(h) => h.vomit, "Vomiting"],
    [(h) => h.diarrhoea || /loose (stool|motion)/i.test(h.text), "Loose stool"],
    [(h) => /constipat|kabz|qabz/i.test(h.text), "Constipation"],
    [(h) => /loss of appetite|bhook?h nahi|anorexia/i.test(h.text), "Loss of appetite"],
    [(h) => h.uti, "UTI - Urinary tract infection"],
    [(h) => h.near(G.whiteDis), "Leukorrhoea"],
    [(h) => h.weak && !/giddi|dizz|chakkar/i.test(h.text), "Weakness - general"],
    [(h) => h.weak && !/giddi|dizz|chakkar/i.test(h.text) && FAC_CHIPS[h.fac] && FAC_CHIPS[h.fac].muscleWeak, "Muscle weakness"],
    [(h) => /giddi|dizz|chakkar|light ?headed/i.test(h.text), "Dizziness"],
    [(h) => h.breath, "SOB - Shortness of breath"],
    [(h) => /wound|cut\b|laceration|ghaav/i.test(h.text) || (h.near(G.injury) && !/head injury|fracture|#/i.test(h.text)), "Wound"],
    [(h) => /\bbleeding\b/i.test(h.text) && !/gum|nose|nasal|sputum/i.test(h.text), "Bleeding"],
    [(h) => /blood transfusion|for transfusion/i.test(h.text) && !G.thal.test(h.text), "Anaemia"],
    [(h) => /tingl|pins and needles|jhunjhun/i.test(h.text), "Pins and needles"],
    [(h) => /insomnia|neend nahi|sleepless|cannot sleep/i.test(h.text), "Insomnia"],
    [(h) => /palpitation|dhadkan|heart racing/i.test(h.text), "Palpitations"],
    [(h) => /swelling|sujan|soojan/i.test(h.text) && !h.near(G.swell, G.leg) && !h.near(G.swell, G.joint), "Swelling"],
    // ---- from production (HMIS master data, 74,538 visits, Mar-Nov 2026): names doctors chose for these complaints
    [(h) => FAC_CHIPS[h.fac] && FAC_CHIPS[h.fac].uri && h.fever && (h.cough || h.cold || /sore throat|throat pain|running nose|sneez/i.test(h.text)), "Upper respiratory infection"],
    [(h) => /^\W*(c\/?o\s*)?(pain|dard)\W*$/i.test(h.text.trim()), "Pain"],
    [(h) => FAC_CHIPS[h.fac] && FAC_CHIPS[h.fac].anc && /\banc\b|antenatal|for check ?up[^,.;\n]{0,10}preg|routine (anc|check)|months? preg|\bg\d\b[^,.;\n]{0,8}\d+ ?months?/i.test(h.text) && !h.male, "Antenatal care status"],
    [(h) => /\bprimi\b|\bgravida\b|\bg\d ?p\d/i.test(h.text) && !h.male, "Pregnancy"],
    [(h) => /amenorr/i.test(h.text) && !h.male, "Amenorrhoea"],
    [(h) => /menstrual period late|period (late|delayed)|late period|mens\w* (late|leta|delay)/i.test(h.text), "Menstrual period late"],
    [(h) => /lscs|caesar|cesar|c-?section|\bprevious cs\b|\bpost cs\b/i.test(h.text) && !h.male, "Deliveries by caesarean"],
    [(h) => /dysmenorr|painful (periods|menses)/i.test(h.text), "Dysmenorrhoea"],
    [(h) => /bltl|\bbtl\b|tubectomy|tube ligation|ligation|sterili[sz]ation|copper ?t|\biucd\b|family planning|contracept/i.test(h.text), "Uses contraception"],
    [(h) => G.dogBite.test(h.text) && /dog|kutt/i.test(h.text) && !/scratch/i.test(h.text), "Dog scratch"], // production: often coded as scratch
    [(h) => G.dogBite.test(h.text) && /dog|kutt/i.test(h.text) && /deep|lacerat|bleed|cat(egory)? ?(iii|3)|multiple/i.test(h.text), "Deep dog bite"],
    [(h) => /\bcat\b|billi/i.test(h.text) && /scratch|nakhun/i.test(h.text), "Cat scratch injury"],
    [(h) => /human bite|aadmi (ne )?kaat|insaan (ne )?kaat/i.test(h.text), "Human bite mark"],
    [(h) => /sensitiv\w*[^,.;\n]{0,15}(tooth|teeth|dant)|(tooth|teeth|dant)[^,.;\n]{0,15}sensitiv|thanda (paani )?lag/i.test(h.text), "Sensitivity"],
    [(h) => /tooth ?ache|teeth ?ache|dant (me|mein) dard|daant (me|mein) dard/i.test(h.text), "Toothache"],
    [(h) => /back tooth|lower (left|right) (back|posterior)|posterior (tooth|teeth|region)|wisdom|third molar|last (molar|tooth)|pain while chewing|chewing pain/i.test(h.text), "Pericoronitis"],
    [(h) => /bleeding gums?|gums? bleed|gingival bleed|masud\w* se khoon/i.test(h.text), "Bleeding gums"],
    [(h) => /bad breath|(bad|bed|foul) (smell|odou?r) (from|of|in) (the )?mouth|halitosis|muh se (badbu|badboo)/i.test(h.text), "Breath smells unpleasant"],
    [(h) => /lip ulcer|ulcer (on|of) (the )?lips?|honth (pe|par) chhal/i.test(h.text), "Lip ulcer"],
    [(h) => /\bcysts?\b/i.test(h.text) && !/ovar|kidney|renal|breast|ganglion|sebaceous|epidermoid/i.test(h.text), "Cyst"],
    [(h) => /impetigo/i.test(h.text), "Impetigo"],
    [(h) => /hypothyr/i.test(h.text), "Hypothyroidism"],
    [(h) => /nasal (obstruction|block\w*)|nose block|blocked nose|\bdns\b|deviated (nasal )?septum|naak band/i.test(h.text), "Deviated nasal septum"],
    [(h) => /age (verification|certificate|estimation)|medical report|injury report|mlc report/i.test(h.text), "Medical report sent"],
    [(h) => /^\W*ulcers?\W*$/i.test(h.text.trim()), "Ulcer"],
    [(h) => /breast pain|pain (in|of) (the )?breast|mastalgia|stan (me|mein) dard/i.test(h.text), "Breast pain"],
    [(h) => /noisy breath|noisy respiration|ghar ?ghar/i.test(h.text), "Noisy respiration"],
    [(h) => /fissure/i.test(h.text), "Fissure in ano"],
    [(h) => /ear ?ache|earache|ear pain|pain (in|of) (the )?ear|kaan (me|mein) dard/i.test(h.text), "Earache"],
    [(h) => /\bboils?\b|phoda|phunsi/i.test(h.text), "Boil"],
    [(h) => /fitness|fit for|medical fitness|yatra/i.test(h.text), "Fit for work"],
    [(h) => G.dogBite.test(h.text) && /dog|kutt/i.test(h.text) && !/scratch|deep|lacerat/i.test(h.text), "Deep dog bite"],
    [(h) => /pedal (o?edema|swelling)|swelling (of|in) (both )?(feet|legs)|pair (me|mein) sujan/i.test(h.text), "Pedal oedema"],
    [(h) => /lipoma/i.test(h.text), "Lipoma"],
    [(h) => /contact dermatitis/i.test(h.text), "Allergic contact dermatitis"],
    [(h) => /fungal infection|fungus/i.test(h.text) && !/nail|ear|eye/i.test(h.text), "Fungal infection"],
    [(h) => /irregular (periods|menses|mens\b)|polymenorr/i.test(h.text), "Irregular periods"],
    [(h) => /chronic kidney disease/i.test(h.text), "Chronic kidney disease"],
    [(h) => /blood group/i.test(h.text), "Blood group"],
    [(h) => /dental check ?up|teeth check ?up|oral check ?up/i.test(h.text), "Oral hygiene finding"],
    [(h) => /missing (tooth|teeth)|tooth (missing|absent)|teeth missing/i.test(h.text), "Tooth absent"],
    [(h) => /pain while opening (the )?mouth|\birt\s?(38|48)\b|\b(38|48)\s?(region|tooth)\b/i.test(h.text), "Pericoronitis"],
    [(h) => /\bg\d\b[^,.;\n]{0,8}\d+ ?(months?|weeks?)|\d+ ?months? (preg|amenorr)/i.test(h.text) && !h.male, "Pregnancy"],
  ];
  function symptomsOf(h) {
    const out = [];
    for (const [f, name] of SYMPTOMS) { try { if (f(h)) out.push({ dx: name, search: name, why: ["symptom as written"], symptom: true, advice: SYMPTOM_ADVICE[name] }); } catch { /* ignore */ } }
    return out;
  }

  // Names the doctors at Sadar actually chose in CARE (production export, 12-24 Sep 2026).
  // Widget names on the left are replaced by the doctors' names on the right.
  const DOCTOR_NAMES = {
    "Dog bite": "Dog bite - wound", "Well child": "Well baby", "General medical examination": "Fitness for work - finding",
    "Essential hypertension": "HTN - Hypertension", "Type 2 diabetes mellitus": "Diabetes mellitus", "Urinary tract infection": "UTI - Urinary tract infection",
    "Anemia": "Anaemia", "Thalassemia": "Thalassaemia", "Impacted cerumen": "Wax in ear canal", "Asthenia": "Weakness - general",
    "Dyspnoea": "SOB - Shortness of breath", "Dyspnea": "SOB - Shortness of breath", "Diarrhoea": "Loose stool", "Nasal discharge": "Common cold",
    "Pain of hip region": "Hip pain", "Pain of shoulder region": "Shoulder region pain", "Pain of elbow region": "Elbow pain", "Pain of wrist region": "Wrist pain",
    "Pain in lower limb": "Leg pain", "Pain in limb": "Leg pain", "Furuncle": "Abscess", "Anal fissure": "Fissure in ano", "Delivery by emergency caesarean section": "Deliveries by caesarean", "Irregular menstruation": "Irregular periods",
    "Cataract": "Cataract", "Acute otitis media": "Otitis media",
  };
  // Exact names in CARE's diagnosis list (checked on staging, 13 Nov 2026: the rule's name had no exact match).
  const CARE_NAMES = {
    "Arthralgia": "Joint pain", "Chikungunya": "Chikungunya fever", "Dengue fever": "Dengue", "Dermatitis": "Eczema",
    "Dysmenorrhea": "Dysmenorrhoea", "Edema of lower extremity": "Oedema of lower extremity", "Enuresis": "Nocturnal enuresis",
    "Filariasis": "Disease caused by Filarioidea", "Fracture": "Fracture of bone", "Goiter": "Goitre", "Head injury": "Injury of head",
    "Helminthiasis": "Worm infestation", "Hematuria": "Blood in urine", "Hemorrhoids": "Haemorrhoids", "Lump in breast": "Breast lump",
    "Myalgia": "Muscle pain", "Nasolacrimal duct obstruction": "Obstruction of nasolacrimal duct", "Normal labor": "Normal labour",
    "Periorbital edema": "Periorbital oedema", "Peripheral neuropathy": "Peripheral nerve disease",
    "Scabies": "Infestation by Sarcoptes scabiei var hominis", "Skin rash": "Rash", "Snake bite": "Snake bite - wound",
    "Upper gastrointestinal hemorrhage": "Upper gastrointestinal bleeding",
    "Felon": "Pulp abscess of finger", "Wound infection": "Local infection of wound", "Corn": "Corn - lesion", "Mastitis": "Acute mastitis",
    "Pilonidal sinus": "Pilonidal cyst", "Varicose veins of lower limb": "Varicose veins of lower extremity", "Breast abscess": "Abscess of breast",
  };
  const careName = (n) => CARE_NAMES[n] || n;
  const toDoctor = (r) => { const nm = DOCTOR_NAMES[r.search]; const out = nm ? { ...r, search: nm } : r; const c = careName(out.search); return c !== out.search ? { ...out, search: c } : out; };

  // Rank the rules for a set of signals (pure; used by the panel and by tests).
  // Returns { urgent: [...], top: [...up to 4], tests: [keys] }.
  function rank(h) {
    const scored = RULES.map((r) => { const [sc, why] = r.f(h); return { ...r, s: sc, why: (why || []).filter(Boolean), advice: sc > 0 ? (r.adv ? r.adv(h) : adviceFor(r.dx)) || undefined : undefined, testKeys: typeof r.tests === "function" ? r.tests(h) : r.tests }; })
      .filter((r) => r.s > 0).sort((a, b) => b.s - a.s);
    const urgent = scored.filter((r) => r.urgent);
    // "Fever, unspecified" only when nothing more specific explains the fever
    const rest = scored.filter((r) => !r.urgent);
    // Findings that come only from vitals (high BP / sugar not mentioned in the complaint) get their own
    // small section, so they never push the complaint's own causes out of the list.
    const fromVitals = (r) => (/^Hypertension — repeat/.test(r.dx) && !h.htn) || (/^Diabetes \(suspected\)/.test(r.dx) && !h.dm);
    const vit = rest.filter(fromVitals).slice(0, 2);
    const top = rest.filter((r) => !fromVitals(r) && !(r.dx.startsWith("Fever") && rest.some((x) => x !== r && x.why.includes("fever")))).slice(0, 3);
    let tests = [...urgent, ...top, ...vit].flatMap((r) => r.testKeys);
    // NVBDCP: every fever is a suspected malaria -> RDT, whatever else is suggested.
    if (h.fever || h.tempHigh) tests = ["MP", ...tests];
    const name = (r) => toDoctor(withSite(withSide(r, h), h));
    // Symptom chips: site / side names first (e.g. "Lower abdominal pain", "Left sided chest pain"), max 3.
    const named = top.map(name);
    let symptoms = symptomsOf(h).map((x) => {
      if (x.dx === "Abdominal pain") { const m = ABD_SITES.find(([re]) => re.test(h.text)); if (m) return { ...x, dx: m[1], search: m[1] }; }
      if (x.dx === "Headache") { const m = HEAD_SITES.find(([re]) => re.test(h.text)); if (m && m[1] !== "Bilateral headache") return { ...x, dx: m[1], search: m[1] }; }
      if (x.dx === "Chest pain" && /\bleft\b/i.test(h.text) !== /\bright\b/i.test(h.text)) { const sd = /\bleft\b/i.test(h.text) ? "Left" : "Right"; return { ...x, dx: `${sd} sided chest pain`, search: `${sd} sided chest pain` }; }
      if (x.dx === "Red eye") { const sd = sideIn(h.text, EYE, true); if (sd && sd !== "both") return { ...x, dx: `Red eye (${sd})` }; }
      return x;
    });
    const shown = new Set(named.concat(urgent).map((r) => (r.search || "").toLowerCase()));
    symptoms = symptoms.filter((x) => !shown.has(x.search.toLowerCase())).slice(0, 4);
    const fn = (r) => facName(h, r);
    const seenS = new Set(); const sym2 = symptoms.map(fn).filter((x) => !seenS.has(x.search) && seenS.add(x.search));
    return { urgent: urgent.map(name).map(fn), symptoms: sym2, top: named.map(fn), vitals: vit, tests: [...new Set(tests)] };
  }

  return { rank, computeSignals, dropNegations, TESTS, adviceFor };
})();
export default ENGINE;
