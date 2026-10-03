import type { Bilingual } from "@/lib/scan/types";

import { bi } from "./model";

/*
 * Average gross monthly earnings (câștigul salarial mediu brut) by CAEN Rev.3
 * division, July 2026: the latest month published by the National Institute
 * of Statistics (INS) as of October 2026.
 *
 * Sources:
 * - INS press release no. 229 of 11 September 2026, "Câștigul salarial mediu
 *   lunar – iulie 2026": economy-wide 9,709 RON gross, 5,820 RON net.
 * - INS TEMPO table FOM107G (gross monthly earnings by CAEN Rev.3 sections and
 *   divisions), updated 11 September 2026:
 *   http://statistici.insse.ro:8077/tempo-online/#/pages/tables/insse-table
 *
 * Divisions the table publishes only at section level (35, 68, 84, 85) use the
 * section value. Refresh monthly: the next release is due 12 October 2026.
 */

export const WAGE_SOURCE = {
  month: bi("July 2026", "iulie 2026"),
  release: bi(
    "INS press release no. 229 of 11 Sept 2026; TEMPO table FOM107G",
    "comunicatul INS nr. 229 din 11 sept. 2026; tabelul TEMPO FOM107G",
  ),
  url: "http://statistici.insse.ro:8077/tempo-online/#/pages/tables/insse-table",
} as const;

/** Economy-wide average gross monthly earnings, July 2026 (RON). */
export const NATIONAL_GROSS_RON = 9709;

/** Employer's labour insurance contribution (CAM) on gross pay. */
export const CAM_RATE = 0.0225;

/** Working hours in an average month (21 days × 8 h). */
export const HOURS_PER_MONTH = 168;

type DivisionWage = { gross: number; label: Bilingual };

export const DIVISION_GROSS_RON: Record<string, DivisionWage> = {
  "01": { gross: 7667, label: bi("agriculture", "agricultură") },
  "02": { gross: 8834, label: bi("forestry and logging", "silvicultură și exploatare forestieră") },
  "03": { gross: 5025, label: bi("fishing and aquaculture", "pescuit și acvacultură") },
  "05": { gross: 12201, label: bi("coal mining", "extracția cărbunelui") },
  "06": { gross: 22259, label: bi("oil and gas extraction", "extracția petrolului și gazelor") },
  "07": { gross: 10605, label: bi("metal ore mining", "extracția minereurilor metalifere") },
  "08": { gross: 7857, label: bi("other mining and quarrying", "alte activități extractive") },
  "09": { gross: 15773, label: bi("mining support services", "servicii anexe extracției") },
  "10": { gross: 7331, label: bi("food manufacturing", "industria alimentară") },
  "11": { gross: 10211, label: bi("beverage manufacturing", "fabricarea băuturilor") },
  "12": { gross: 16662, label: bi("tobacco products", "fabricarea produselor din tutun") },
  "13": { gross: 7489, label: bi("textiles", "fabricarea produselor textile") },
  "14": {
    gross: 5903,
    label: bi("clothing manufacturing", "fabricarea articolelor de îmbrăcăminte"),
  },
  "15": { gross: 6737, label: bi("leather and footwear", "pielărie și încălțăminte") },
  "16": { gross: 6489, label: bi("wood products", "prelucrarea lemnului") },
  "17": { gross: 8820, label: bi("paper products", "fabricarea hârtiei") },
  "18": { gross: 8035, label: bi("printing", "tipărire") },
  "19": { gross: 20346, label: bi("refined petroleum products", "produse petroliere rafinate") },
  "20": { gross: 9156, label: bi("chemicals", "substanțe și produse chimice") },
  "21": { gross: 11423, label: bi("pharmaceuticals", "produse farmaceutice") },
  "22": { gross: 9328, label: bi("rubber and plastics", "produse din cauciuc și mase plastice") },
  "23": { gross: 9632, label: bi("non-metallic minerals", "produse din minerale nemetalice") },
  "24": { gross: 10840, label: bi("basic metals", "industria metalurgică") },
  "25": {
    gross: 9150,
    label: bi("fabricated metal products", "construcții metalice și produse din metal"),
  },
  "26": {
    gross: 11252,
    label: bi("computers and electronics", "calculatoare și produse electronice"),
  },
  "27": { gross: 9251, label: bi("electrical equipment", "echipamente electrice") },
  "28": { gross: 10735, label: bi("machinery", "mașini și utilaje") },
  "29": { gross: 12173, label: bi("motor vehicles", "autovehicule") },
  "30": { gross: 12144, label: bi("other transport equipment", "alte mijloace de transport") },
  "31": { gross: 6355, label: bi("furniture", "fabricarea de mobilă") },
  "32": { gross: 7352, label: bi("other manufacturing", "alte activități industriale") },
  "33": {
    gross: 9954,
    label: bi("repair and installation of machinery", "repararea și instalarea mașinilor"),
  },
  "35": { gross: 15143, label: bi("energy supply", "energie electrică, termică și gaze") },
  "36": { gross: 8750, label: bi("water supply", "captarea și distribuția apei") },
  "37": { gross: 8881, label: bi("sewerage", "epurarea apelor uzate") },
  "38": { gross: 7479, label: bi("waste management", "gestionarea deșeurilor") },
  "39": { gross: 7606, label: bi("remediation", "decontaminare") },
  "41": { gross: 7889, label: bi("construction of buildings", "construcții de clădiri") },
  "42": { gross: 10263, label: bi("civil engineering", "lucrări de geniu civil") },
  "43": { gross: 8954, label: bi("specialised construction", "lucrări speciale de construcții") },
  // Division 45 does not exist in CAEN Rev.3 (motor trade moved to 46/47, repairs to 95).
  "45": { gross: 8832, label: bi("motor trade and repair", "comerț și reparații auto") },
  "46": { gross: 10329, label: bi("wholesale trade", "comerț cu ridicata") },
  "47": { gross: 7723, label: bi("retail trade", "comerț cu amănuntul") },
  "49": { gross: 8493, label: bi("land transport", "transporturi terestre") },
  "50": { gross: 9252, label: bi("water transport", "transporturi pe apă") },
  "51": { gross: 17429, label: bi("air transport", "transporturi aeriene") },
  "52": {
    gross: 12929,
    label: bi("warehousing and transport support", "depozitare și servicii anexe transporturilor"),
  },
  "53": { gross: 6848, label: bi("postal and courier", "poștă și curierat") },
  "55": { gross: 6358, label: bi("accommodation", "hoteluri și alte facilități de cazare") },
  "56": {
    gross: 5677,
    label: bi("restaurants and food service", "restaurante și servicii de alimentație"),
  },
  "58": { gross: 18015, label: bi("publishing", "activități de editare") },
  "59": {
    gross: 11208,
    label: bi("film, video and music production", "producție cinematografică, video și muzicală"),
  },
  "60": {
    gross: 12008,
    label: bi("broadcasting and content distribution", "difuzare și distribuție de conținut"),
  },
  "61": { gross: 11190, label: bi("telecommunications", "telecomunicații") },
  "62": {
    gross: 22635,
    label: bi("programming and IT consultancy", "programare și consultanță IT"),
  },
  "63": {
    gross: 14104,
    label: bi("data processing and web portals", "prelucrarea datelor și portaluri web"),
  },
  "64": { gross: 16539, label: bi("financial services", "intermedieri financiare") },
  "65": { gross: 16228, label: bi("insurance", "asigurări") },
  "66": {
    gross: 12454,
    label: bi("auxiliary financial services", "servicii auxiliare financiare"),
  },
  "68": { gross: 8838, label: bi("real estate", "tranzacții imobiliare") },
  "69": {
    gross: 13772,
    label: bi("legal and accounting", "activități juridice și de contabilitate"),
  },
  "70": {
    gross: 17892,
    label: bi("head offices and management consultancy", "management și consultanță în management"),
  },
  "71": { gross: 14161, label: bi("architecture and engineering", "arhitectură și inginerie") },
  "72": { gross: 13362, label: bi("research and development", "cercetare-dezvoltare") },
  "73": {
    gross: 12653,
    label: bi("advertising and market research", "publicitate și studiul pieței"),
  },
  "74": { gross: 11215, label: bi("other professional services", "alte activități profesionale") },
  "75": { gross: 10534, label: bi("veterinary", "activități veterinare") },
  "77": { gross: 10620, label: bi("rental and leasing", "închiriere și leasing") },
  "78": { gross: 8395, label: bi("employment services", "servicii privind forța de muncă") },
  "79": {
    gross: 8449,
    label: bi("travel agencies and tour operators", "agenții de turism și tur-operatori"),
  },
  "80": { gross: 5434, label: bi("security services", "investigații și protecție") },
  "81": {
    gross: 5919,
    label: bi("building services and landscaping", "servicii pentru clădiri și peisagistică"),
  },
  "82": {
    gross: 12097,
    label: bi("office support services", "servicii suport pentru întreprinderi"),
  },
  "84": { gross: 11831, label: bi("public administration", "administrație publică") },
  "85": { gross: 9566, label: bi("education", "învățământ") },
  "86": { gross: 11137, label: bi("human health", "sănătate umană") },
  "87": { gross: 7546, label: bi("residential care", "îngrijire cu cazare") },
  "88": { gross: 5062, label: bi("social work", "asistență socială fără cazare") },
  "90": {
    gross: 8742,
    label: bi("arts and entertainment", "activități de creație și interpretare"),
  },
  "91": {
    gross: 7182,
    label: bi("libraries, museums and culture", "biblioteci, muzee și cultură"),
  },
  "92": { gross: 8214, label: bi("gambling", "jocuri de noroc") },
  "93": { gross: 6960, label: bi("sports and recreation", "activități sportive și recreative") },
  "94": { gross: 8631, label: bi("membership organisations", "activități asociative") },
  "95": {
    gross: 6538,
    label: bi("repair of vehicles, computers and goods", "reparații auto, calculatoare și bunuri"),
  },
  "96": { gross: 4882, label: bi("other personal services", "alte activități de servicii") },
};
