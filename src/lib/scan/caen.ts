import type { Bilingual } from "@/lib/scan/types";

/*
 * CAEN activity labels in English and Romanian. Since 2025 ANAF and the Trade
 * Register use CAEN Rev.3 (= NACE Rev.2.1), so a 4-digit code resolves to its
 * Rev.3 meaning first and to Rev.2 (2008) only when Rev.3 has no such class
 * (6201 → custom software, now 6210). Romanian labels are the official ones
 * from ONRC's N_CAEN.csv; the curated classes cover what SMEs register most
 * (retail, food service, health, beauty, construction, IT, consultancy,
 * transport, real estate, education…). loadCaenLabel() adds every other
 * class from caen-classes.json, loaded only when needed.
 */

export type CaenRevision = 2 | 3;
type Entry = readonly [en: string, ro: string];

const DIVISIONS: Record<string, Entry> = {
  "01": [
    "Crop and animal production, hunting and related services",
    "Agricultură, vânătoare și servicii anexe",
  ],
  "02": ["Forestry and logging", "Silvicultură și exploatare forestieră"],
  "03": ["Fishing and aquaculture", "Pescuitul și acvacultura"],
  "05": ["Mining of coal and lignite", "Extracția cărbunelui superior și inferior"],
  "06": [
    "Extraction of crude petroleum and natural gas",
    "Extracția petrolului brut și a gazelor naturale",
  ],
  "07": ["Mining of metal ores", "Extracția minereurilor metalifere"],
  "08": ["Other mining and quarrying", "Alte activități extractive"],
  "09": ["Mining support service activities", "Activități de servicii anexe extracției"],
  "10": ["Manufacture of food products", "Industria alimentară"],
  "11": ["Manufacture of beverages", "Fabricarea băuturilor"],
  "12": ["Manufacture of tobacco products", "Fabricarea produselor din tutun"],
  "13": ["Manufacture of textiles", "Fabricarea produselor textile"],
  "14": ["Manufacture of wearing apparel", "Fabricarea articolelor de îmbrăcăminte"],
  "15": [
    "Manufacture of leather and footwear",
    "Fabricarea articolelor din piele și a încălțămintei",
  ],
  "16": [
    "Manufacture of wood and wood products, except furniture",
    "Prelucrarea lemnului și fabricarea produselor din lemn (exclusiv mobilă)",
  ],
  "17": [
    "Manufacture of paper and paper products",
    "Fabricarea hârtiei și a produselor din hârtie",
  ],
  "18": [
    "Printing and reproduction of recorded media",
    "Tipărire și reproducerea pe suporți a înregistrărilor",
  ],
  "19": [
    "Manufacture of coke and refined petroleum products",
    "Fabricarea produselor de cocserie și a produselor obținute din prelucrarea țițeiului",
  ],
  "20": [
    "Manufacture of chemicals and chemical products",
    "Fabricarea substanțelor și a produselor chimice",
  ],
  "21": ["Manufacture of pharmaceutical products", "Fabricarea produselor farmaceutice"],
  "22": [
    "Manufacture of rubber and plastic products",
    "Fabricarea produselor din cauciuc și mase plastice",
  ],
  "23": [
    "Manufacture of other non-metallic mineral products",
    "Fabricarea altor produse din minerale nemetalice",
  ],
  "24": ["Manufacture of basic metals", "Industria metalurgică"],
  "25": [
    "Manufacture of fabricated metal products",
    "Fabricarea construcțiilor și a produselor din metal",
  ],
  "26": [
    "Manufacture of computer, electronic and optical products",
    "Fabricarea calculatoarelor și a produselor electronice și optice",
  ],
  "27": ["Manufacture of electrical equipment", "Fabricarea echipamentelor electrice"],
  "28": ["Manufacture of machinery and equipment", "Fabricarea de mașini, utilaje și echipamente"],
  "29": [
    "Manufacture of motor vehicles and trailers",
    "Fabricarea autovehiculelor, remorcilor și semiremorcilor",
  ],
  "30": ["Manufacture of other transport equipment", "Fabricarea altor mijloace de transport"],
  "31": ["Manufacture of furniture", "Fabricarea de mobilă"],
  "32": ["Other manufacturing", "Alte activități industriale"],
  "33": [
    "Repair, maintenance and installation of machinery and equipment",
    "Repararea, întreținerea și instalarea mașinilor și echipamentelor",
  ],
  "35": [
    "Electricity, gas, steam and air conditioning supply",
    "Producția și furnizarea de energie electrică și termică, gaze și aer condiționat",
  ],
  "36": ["Water collection, treatment and supply", "Captarea, tratarea și distribuția apei"],
  "37": ["Sewerage", "Colectarea și epurarea apelor uzate"],
  "38": [
    "Waste collection, treatment and materials recovery",
    "Colectarea, tratarea și eliminarea deșeurilor; recuperarea materialelor",
  ],
  "39": [
    "Remediation and other waste management services",
    "Activități și servicii de decontaminare",
  ],
  "41": ["Construction of buildings", "Construcții de clădiri"],
  "42": ["Civil engineering", "Lucrări de geniu civil"],
  "43": ["Specialised construction activities", "Lucrări speciale de construcții"],
  "45": [
    "Trade and repair of motor vehicles and motorcycles",
    "Comerț, întreținerea și repararea autovehiculelor și a motocicletelor",
  ],
  "46": ["Wholesale trade", "Comerț cu ridicata"],
  "47": ["Retail trade", "Comerț cu amănuntul"],
  "49": ["Land transport", "Transporturi terestre"],
  "50": ["Water transport", "Transporturi pe apă"],
  "51": ["Air transport", "Transporturi aeriene"],
  "52": [
    "Warehousing and transport support activities",
    "Depozitare și activități auxiliare pentru transporturi",
  ],
  "53": ["Postal and courier activities", "Activități de poștă și de curier"],
  "55": ["Accommodation", "Hoteluri și alte facilități de cazare"],
  "56": ["Food and beverage service activities", "Restaurante și alte servicii de alimentație"],
  "58": ["Publishing activities", "Activități de editare"],
  "59": [
    "Film, video and TV production, sound recording and music publishing",
    "Producție cinematografică, video și de televiziune; înregistrări audio și editare muzicală",
  ],
  "60": [
    "Broadcasting, news agency and content distribution",
    "Difuzare de programe, agenții de știri și distribuție de conținut",
  ],
  "61": ["Telecommunications", "Telecomunicații"],
  "62": [
    "Computer programming, IT consultancy and related activities",
    "Activități de servicii în tehnologia informației",
  ],
  "63": [
    "Data processing, hosting and other information services",
    "Prelucrarea datelor, găzduire și alte servicii informaționale",
  ],
  "64": ["Financial service activities", "Intermedieri financiare"],
  "65": [
    "Insurance, reinsurance and pension funding",
    "Asigurări, reasigurări și fonduri de pensii",
  ],
  "66": [
    "Activities auxiliary to financial services and insurance",
    "Activități auxiliare intermedierilor financiare și asigurărilor",
  ],
  "68": ["Real estate activities", "Tranzacții imobiliare"],
  "69": ["Legal and accounting activities", "Activități juridice și de contabilitate"],
  "70": [
    "Head offices and management consultancy",
    "Activități ale direcțiilor (centralelor) și de consultanță în management",
  ],
  "71": [
    "Architecture, engineering and technical testing",
    "Activități de arhitectură, inginerie și testări tehnice",
  ],
  "72": ["Scientific research and development", "Cercetare-dezvoltare"],
  "73": [
    "Advertising, market research and public relations",
    "Publicitate, studierea pieței și relații publice",
  ],
  "74": [
    "Other professional, scientific and technical activities",
    "Alte activități profesionale, științifice și tehnice",
  ],
  "75": ["Veterinary activities", "Activități veterinare"],
  "77": ["Rental and leasing activities", "Activități de închiriere și leasing"],
  "78": ["Employment activities", "Activități de servicii privind forța de muncă"],
  "79": [
    "Travel agencies, tour operators and reservation services",
    "Agenții turistice, tur-operatori și servicii de rezervare",
  ],
  "80": ["Investigation and security activities", "Activități de investigații și protecție"],
  "81": [
    "Services to buildings and landscape activities",
    "Servicii pentru clădiri și activități de peisagistică",
  ],
  "82": [
    "Office administrative and business support activities",
    "Activități de secretariat și servicii suport pentru întreprinderi",
  ],
  "84": ["Public administration and defence", "Administrație publică și apărare"],
  "85": ["Education", "Învățământ"],
  "86": ["Human health activities", "Activități referitoare la sănătatea umană"],
  "87": ["Residential care activities", "Servicii de îngrijire cu cazare"],
  "88": [
    "Social work activities without accommodation",
    "Activități de asistență socială, fără cazare",
  ],
  "90": ["Arts creation and performing arts", "Activități de creație și interpretare artistică"],
  "91": [
    "Libraries, archives, museums and other cultural activities",
    "Biblioteci, arhive, muzee și alte activități culturale",
  ],
  "92": ["Gambling and betting activities", "Activități de jocuri de noroc și pariuri"],
  "93": [
    "Sports, amusement and recreation activities",
    "Activități sportive, recreative și distractive",
  ],
  "94": ["Activities of membership organisations", "Activități asociative diverse"],
  "95": [
    "Repair and maintenance of computers, personal goods and vehicles",
    "Repararea calculatoarelor, a articolelor personale și a autovehiculelor",
  ],
  "96": ["Personal service activities", "Activități de servicii personale"],
  "97": [
    "Households as employers of domestic personnel",
    "Activități ale gospodăriilor private ca angajator de personal casnic",
  ],
  "98": [
    "Households producing goods and services for own use",
    "Activități ale gospodăriilor private pentru consum propriu",
  ],
  "99": [
    "Extraterritorial organisations and bodies",
    "Activități ale organizațiilor și organismelor extrateritoriale",
  ],
};

/** Classes as they stand in CAEN Rev.3 (2025). */
const REV3: Record<string, Entry> = {
  "0111": [
    "Growing of cereals, leguminous crops and oil seeds",
    "Cultivarea cerealelor (excluzând orezul), plantelor leguminoase și a plantelor oleaginoase",
  ],
  "0113": [
    "Growing of vegetables, melons, roots and tubers",
    "Cultivarea legumelor și a pepenilor, a rădăcinoaselor și tuberculiferelor",
  ],
  "0141": ["Raising of dairy cattle", "Creșterea bovinelor de lapte"],
  "0146": ["Raising of pigs", "Creșterea porcinelor"],
  "0150": [
    "Mixed farming",
    "Activități în ferme mixte (cultura vegetală combinată cu creșterea animalelor)",
  ],
  "0161": [
    "Support activities for crop production",
    "Activități auxiliare pentru producția vegetală",
  ],
  "1013": [
    "Production of meat and poultry meat products",
    "Fabricarea produselor din carne (inclusiv din carne de pasăre)",
  ],
  "1071": [
    "Manufacture of bread, fresh pastry goods and cakes",
    "Fabricarea pâinii; fabricarea prăjiturilor și a produselor proaspete de patiserie",
  ],
  "1072": [
    "Manufacture of biscuits and preserved pastry goods",
    "Fabricarea biscuiților și pișcoturilor; fabricarea prăjiturilor și a produselor conservate de patiserie",
  ],
  "1105": ["Manufacture of beer", "Fabricarea berii"],
  "1107": [
    "Manufacture of soft drinks and bottled waters",
    "Producția de băuturi răcoritoare nealcoolice; producția de ape minerale și alte ape îmbuteliate",
  ],
  "1812": ["Other printing", "Alte activități de tipărire n.c.a."],
  "1813": ["Pre-press and pre-media services", "Servicii pregătitoare pentru pretipărire"],
  "2511": [
    "Manufacture of metal structures",
    "Fabricarea de construcții metalice și părți componente ale structurilor metalice",
  ],
  "2553": ["Machining (general mechanical engineering)", "Operațiuni de mecanică generală"],
  "2562": ["Manufacture of locks and hinges", "Fabricarea articolelor de feronerie"],
  "3100": ["Manufacture of furniture", "Fabricarea de mobilă"],
  "3299": ["Other manufacturing n.e.c.", "Fabricarea altor produse manufacturiere n.c.a."],
  "3312": ["Repair and maintenance of machinery", "Repararea și întreținerea mașinilor"],
  "3320": [
    "Installation of industrial machinery and equipment",
    "Instalarea mașinilor și echipamentelor industriale",
  ],
  "3511": [
    "Production of electricity from non-renewable sources",
    "Producția de energie electrică din resurse neregenerabile",
  ],
  "3512": [
    "Production of electricity from renewable sources",
    "Producția de energie electrică din resurse regenerabile",
  ],
  "3514": ["Distribution of electricity", "Distribuția energiei electrice"],
  "3515": ["Trade of electricity", "Comercializarea energiei electrice"],
  "3811": ["Collection of non-hazardous waste", "Colectarea deșeurilor nepericuloase"],
  "3821": ["Materials recovery", "Recuperarea materialelor reciclabile"],
  "4100": [
    "Construction of residential and non-residential buildings",
    "Lucrări de construcții ale clădirilor rezidențiale și nerezidențiale",
  ],
  "4211": [
    "Construction of roads and motorways",
    "Lucrări de construcții ale drumurilor și autostrăzilor",
  ],
  "4311": ["Demolition", "Lucrări de demolare a construcțiilor"],
  "4312": ["Site preparation", "Lucrări de pregătire a terenului"],
  "4313": ["Test drilling and boring", "Lucrări de foraj și sondaj pentru construcții"],
  "4321": ["Electrical installation", "Lucrări de instalații electrice"],
  "4322": [
    "Plumbing, heating and air-conditioning installation",
    "Lucrări de instalații sanitare, de încălzire și de aer condiționat",
  ],
  "4323": ["Installation of insulation", "Lucrări de izolații"],
  "4324": ["Other construction installation", "Alte lucrări de instalații pentru construcții"],
  "4331": ["Plastering", "Lucrări de ipsoserie"],
  "4332": ["Joinery installation", "Lucrări de tâmplărie și dulgherie"],
  "4333": ["Floor and wall covering", "Lucrări de pardosire și placare a pereților"],
  "4334": ["Painting and glazing", "Lucrări de vopsitorie, zugrăveli și montări de geamuri"],
  "4335": ["Other building completion and finishing", "Alte lucrări de finisare"],
  "4341": ["Roofing", "Lucrări de învelitori, șarpante și terase la construcții"],
  "4342": [
    "Other specialised construction for buildings",
    "Alte lucrări speciale de construcții pentru clădiri",
  ],
  "4350": [
    "Specialised construction in civil engineering",
    "Lucrări speciale de construcții pentru proiecte de geniu civil",
  ],
  "4360": [
    "Intermediation services for specialised construction",
    "Servicii de intermediere pentru lucrări speciale de construcții",
  ],
  "4391": ["Masonry and bricklaying", "Activități de zidărie"],
  "4399": ["Other specialised construction n.e.c.", "Alte lucrări speciale de construcții n.c.a."],
  "4613": [
    "Agents in timber and building materials",
    "Intermedieri în comerțul cu material lemnos și materiale de construcții",
  ],
  "4618": [
    "Agents in other particular products",
    "Intermedieri în comerțul specializat în vânzarea produselor cu caracter specific, n.c.a.",
  ],
  "4619": ["Agents in a variety of goods", "Intermedieri în comerțul cu produse diverse"],
  "4621": [
    "Wholesale of grain, seeds and animal feed",
    "Comerț cu ridicata al cerealelor, semințelor, furajelor și tutunului neprelucrat",
  ],
  "4639": [
    "Non-specialised wholesale of food, beverages and tobacco",
    "Comerț cu ridicata nespecializat de produse alimentare, băuturi și tutun",
  ],
  "4641": ["Wholesale of textiles", "Comerț cu ridicata al produselor textile"],
  "4642": [
    "Wholesale of clothing and footwear",
    "Comerț cu ridicata al îmbrăcămintei și încălțămintei",
  ],
  "4643": [
    "Wholesale of electrical household appliances",
    "Comerț cu ridicata al aparatelor electrice de uz gospodăresc, al aparatelor de radio și televizoarelor",
  ],
  "4645": [
    "Wholesale of perfume and cosmetics",
    "Comerț cu ridicata al produselor cosmetice și de parfumerie",
  ],
  "4646": [
    "Wholesale of pharmaceutical and medical goods",
    "Comerț cu ridicata al produselor farmaceutice și medicale",
  ],
  "4647": [
    "Wholesale of furniture, carpets and lighting",
    "Comerț cu ridicata al mobilei (inclusiv de birou și pentru magazine), covoarelor și a articolelor de iluminat",
  ],
  "4649": [
    "Wholesale of other household goods",
    "Comerț cu ridicata al altor bunuri de uz gospodăresc",
  ],
  "4650": [
    "Wholesale of ICT equipment",
    "Comerț cu ridicata al echipamentului informatic și de telecomunicații",
  ],
  "4664": [
    "Wholesale of other machinery and equipment",
    "Comerț cu ridicata al altor mașini și echipamente",
  ],
  "4671": ["Wholesale of motor vehicles", "Comerț cu ridicata al autovehiculelor"],
  "4672": [
    "Wholesale of motor vehicle parts and accessories",
    "Comerț cu ridicata al pieselor și accesoriilor pentru autovehicule",
  ],
  "4673": [
    "Wholesale of motorcycles, parts and accessories",
    "Comerț cu ridicata al motocicletelor; comerț cu ridicata al pieselor și accesoriilor pentru motociclete",
  ],
  "4683": [
    "Wholesale of wood, construction materials and sanitary equipment",
    "Comerț cu ridicata al materialului lemnos și a materialelor de construcție și echipamentelor sanitare",
  ],
  "4684": [
    "Wholesale of hardware, plumbing and heating supplies",
    "Comerț cu ridicata al echipamentelor și furniturilor de fierărie pentru instalații sanitare și de încălzire",
  ],
  "4685": ["Wholesale of chemical products", "Comerț cu ridicata al produselor chimice"],
  "4686": [
    "Wholesale of other intermediate products",
    "Comerț cu ridicata al altor produse intermediare",
  ],
  "4687": ["Wholesale of waste and scrap", "Comerț cu ridicata al deșeurilor și resturilor"],
  "4689": [
    "Other specialised wholesale n.e.c.",
    "Comerț cu ridicata specializat al altor produse n.c.a.",
  ],
  "4690": ["Non-specialised wholesale trade", "Comerț cu ridicata nespecializat"],
  "4711": [
    "Non-specialised retail, mainly food, beverages and tobacco",
    "Comerț cu amănuntul nespecializat, cu vânzare predominantă de produse alimentare, băuturi și tutun",
  ],
  "4712": [
    "Non-specialised retail, mainly non-food goods",
    "Comerț cu amănuntul nespecializat, cu vânzare predominantă de produse nealimentare",
  ],
  "4721": [
    "Retail sale of fruit and vegetables",
    "Comerț cu amănuntul al fructelor și legumelor proaspete",
  ],
  "4722": [
    "Retail sale of meat and meat products",
    "Comerț cu amănuntul al cărnii și al produselor din carne",
  ],
  "4723": [
    "Retail sale of fish and seafood",
    "Comerț cu amănuntul al peștelui, crustaceelor și moluștelor",
  ],
  "4724": [
    "Retail sale of bread, cakes and confectionery",
    "Comerț cu amănuntul al pâinii, produselor de patiserie și produselor zaharoase",
  ],
  "4725": ["Retail sale of beverages", "Comerț cu amănuntul al băuturilor"],
  "4726": ["Retail sale of tobacco products", "Comerț cu amănuntul al produselor din tutun"],
  "4727": ["Retail sale of other food", "Comerț cu amănuntul al altor produse alimentare"],
  "4730": [
    "Retail sale of automotive fuel",
    "Comerț cu amănuntul al carburanților pentru autovehicule",
  ],
  "4740": [
    "Retail sale of ICT equipment",
    "Comerț cu amănuntul al echipamentului informatic și de telecomunicații",
  ],
  "4751": ["Retail sale of textiles", "Comerț cu amănuntul al textilelor"],
  "4752": [
    "Retail sale of hardware, building materials, paints and glass",
    "Comerț cu amănuntul al articolelor de fierărie, al materialelor de construcții, al articolelor din sticlă și a celor pentru vopsit",
  ],
  "4753": [
    "Retail sale of carpets, rugs and wall and floor coverings",
    "Comerț cu amănuntul al covoarelor, carpetelor, tapetelor și a altor acoperitoare de podea",
  ],
  "4754": [
    "Retail sale of electrical household appliances",
    "Comerț cu amănuntul al articolelor și aparatelor electrocasnice",
  ],
  "4755": [
    "Retail sale of furniture, lighting and household articles",
    "Comerț cu amănuntul al mobilei, al articolelor de iluminat și al altor articole de uz casnic n.c.a.",
  ],
  "4761": ["Retail sale of books", "Comerț cu amănuntul al cărților"],
  "4762": [
    "Retail sale of newspapers and stationery",
    "Comerț cu amănuntul al ziarelor și articolelor de papetărie",
  ],
  "4763": ["Retail sale of sporting equipment", "Comerț cu amănuntul al echipamentelor sportive"],
  "4764": ["Retail sale of games and toys", "Comerț cu amănuntul al jocurilor și jucăriilor"],
  "4769": [
    "Retail sale of other cultural and recreation goods",
    "Comerț cu amănuntul de bunuri culturale și recreative n.c.a.",
  ],
  "4771": ["Retail sale of clothing", "Comerț cu amănuntul al îmbrăcămintei"],
  "4772": [
    "Retail sale of footwear and leather goods",
    "Comerț cu amănuntul al încălțămintei și articolelor din piele",
  ],
  "4773": ["Pharmacies (dispensing chemists)", "Comerț cu amănuntul al produselor farmaceutice"],
  "4774": [
    "Retail sale of medical and orthopaedic goods",
    "Comerț cu amănuntul al articolelor medicale și ortopedice",
  ],
  "4775": [
    "Retail sale of cosmetics and perfumes",
    "Comerț cu amănuntul al produselor cosmetice și de parfumerie",
  ],
  "4776": [
    "Retail sale of flowers, plants, pets and pet food",
    "Comerț cu amănuntul al florilor, plantelor și semințelor; comerț cu amănuntul al animalelor de companie și a hranei pentru acestea",
  ],
  "4777": [
    "Retail sale of watches and jewellery",
    "Comerț cu amănuntul al ceasurilor și bijuteriilor",
  ],
  "4778": ["Retail sale of other new goods", "Comerț cu amănuntul al altor bunuri noi"],
  "4779": ["Retail sale of second-hand goods", "Comerț cu amănuntul al bunurilor de ocazie"],
  "4781": ["Retail sale of motor vehicles", "Comerț cu amănuntul al autovehiculelor"],
  "4782": [
    "Retail sale of motor vehicle parts and accessories",
    "Comerț cu amănuntul al pieselor și accesoriilor pentru autovehicule",
  ],
  "4783": [
    "Retail sale of motorcycles, parts and accessories",
    "Comerț cu amănuntul al motocicletelor; comerț cu amănuntul al pieselor și accesoriilor pentru motociclete",
  ],
  "4791": [
    "Intermediation services for non-specialised retail sale",
    "Intermedieri în comerțul cu amănuntul nespecializat",
  ],
  "4792": [
    "Intermediation services for specialised retail sale",
    "Intermedieri în comerțul cu amănuntul specializat",
  ],
  "4931": [
    "Scheduled passenger land transport",
    "Transporturi terestre de pasageri, pe bază de grafic",
  ],
  "4932": [
    "Non-scheduled passenger land transport",
    "Transporturi terestre de pasageri, ocazionale",
  ],
  "4933": [
    "On-demand passenger transport with driver",
    "Transporturi terestre de pasageri cu vehicule cu șofer, pe bază de comandă",
  ],
  "4939": [
    "Other passenger land transport n.e.c.",
    "Alte transporturi terestre de călători n.c.a.",
  ],
  "4941": ["Freight transport by road", "Transporturi rutiere de mărfuri"],
  "4942": ["Removal services", "Servicii de mutare"],
  "5210": ["Warehousing and storage", "Depozitări"],
  "5221": [
    "Service activities incidental to land transport",
    "Activități de servicii anexe pentru transporturi terestre",
  ],
  "5224": ["Cargo handling", "Manipulări"],
  "5225": ["Logistics services", "Activități de servicii logistice pentru transporturi"],
  "5226": ["Other transport support activities", "Alte activități anexe transporturilor"],
  "5231": [
    "Intermediation services for freight transport",
    "Activități de intermediere pentru transportul de marfă",
  ],
  "5232": [
    "Intermediation services for passenger transport",
    "Activități de intermediere pentru transportul de pasageri",
  ],
  "5320": ["Other postal and courier activities", "Alte activități poștale și de curier"],
  "5510": ["Hotels and similar accommodation", "Hoteluri și alte facilități de cazare similare"],
  "5520": [
    "Holiday and other short-stay accommodation",
    "Facilități de cazare pentru vacanțe și perioade de scurtă durată",
  ],
  "5530": [
    "Camping grounds and recreational vehicle parks",
    "Parcuri pentru rulote, campinguri și tabere",
  ],
  "5540": ["Intermediation services for accommodation", "Intermedieri pentru servicii de cazare"],
  "5590": ["Other accommodation", "Alte servicii de cazare"],
  "5611": ["Restaurants", "Restaurante"],
  "5612": ["Mobile food services", "Activități ale unităților mobile de alimentație"],
  "5621": ["Event catering", "Activități de alimentație (catering) pentru evenimente"],
  "5622": ["Other food services", "Alte servicii de alimentație n.c.a."],
  "5630": ["Bars and other beverage serving", "Baruri și alte activități de servire a băuturilor"],
  "5640": [
    "Intermediation services for food and beverage services",
    "Intermedieri pentru servicii de alimentație și de servire a băuturilor",
  ],
  "5811": ["Book publishing", "Activități de editare a cărților"],
  "5812": ["Newspaper publishing", "Activități de editare a ziarelor"],
  "5813": [
    "Publishing of journals and periodicals",
    "Activități de editare a revistelor și periodicelor",
  ],
  "5819": ["Other publishing", "Alte activități de editare"],
  "5821": ["Publishing of video games", "Activități de editare a jocurilor de calculator"],
  "5829": ["Other software publishing", "Activități de editare a altor produse software"],
  "5911": [
    "Film, video and TV programme production",
    "Activități de producție cinematografică, video și de programe de televiziune",
  ],
  "5920": [
    "Sound recording and music publishing",
    "Activități de realizare a înregistrărilor audio și activități de editare muzicală",
  ],
  "6010": [
    "Radio broadcasting and audio distribution",
    "Activități radiodifuziune, activități de distribuție de programe audio",
  ],
  "6020": [
    "Television broadcasting and video distribution",
    "Activități de difuzare a programelor de televiziune, activități de distribuție de programe video",
  ],
  "6031": ["News agency activities", "Activități ale agențiilor de știri"],
  "6039": ["Other content distribution", "Activități de distribuție a altor conținuturi"],
  "6110": [
    "Wired, wireless and satellite telecommunications",
    "Activități de telecomunicații prin rețele cu cablu, prin rețele fără cablu și prin satelit",
  ],
  "6120": [
    "Telecommunications reselling and intermediation",
    "Activități de revânzare a serviciilor de telecomunicații și servicii de intermediere pentru telecomunicații",
  ],
  "6190": ["Other telecommunications", "Alte activități de telecomunicații"],
  "6210": [
    "Computer programming (custom software)",
    "Activități de realizare a soft-ului la comandă (software orientat client)",
  ],
  "6220": [
    "IT consultancy and computer facilities management",
    "Activități de consultanță în tehnologia informației și de management (gestiune și exploatare) a mijloacelor de calcul",
  ],
  "6290": [
    "Other IT and computer services",
    "Alte activități de servicii privind tehnologia informației",
  ],
  "6310": [
    "Data processing, web hosting and related activities",
    "Prelucrarea datelor, administrarea paginilor web și activități conexe",
  ],
  "6391": ["Web portals", "Activități ale portalurilor web"],
  "6392": [
    "Other information services n.e.c.",
    "Alte activități de servicii informaționale n.c.a.",
  ],
  "6492": ["Other credit granting", "Alte activități de creditare"],
  "6499": [
    "Other financial services n.e.c.",
    "Alte intermedieri financiare n.c.a., exceptând activități de asigurări și fonduri de pensii",
  ],
  "6619": [
    "Other activities auxiliary to financial services",
    "Activități auxiliare intermedierilor financiare, exceptând activități de asigurări și fonduri de pensii",
  ],
  "6622": ["Insurance agents and brokers", "Activități ale agenților și broker-ilor de asigurări"],
  "6629": [
    "Other activities auxiliary to insurance and pensions",
    "Alte activități auxiliare de asigurări și fonduri de pensii",
  ],
  "6811": [
    "Buying and selling of own real estate",
    "Cumpărarea și vânzarea de bunuri imobiliare proprii",
  ],
  "6812": ["Development of building projects", "Dezvoltare (promovare) imobiliară"],
  "6820": [
    "Renting of own or leased real estate",
    "Închirierea și subînchirierea bunurilor imobiliare proprii sau închiriate",
  ],
  "6831": ["Real estate agencies", "Servicii de intermediere a tranzacțiilor imobiliare"],
  "6832": [
    "Other real estate services on a fee or contract basis",
    "Alte activități pentru tranzacții imobiliare pe bază de comision sau contract",
  ],
  "6910": ["Legal activities", "Activități juridice"],
  "6920": [
    "Accounting, bookkeeping, auditing and tax consultancy",
    "Activități de contabilitate și audit financiar; consultanță în domeniul fiscal",
  ],
  "7010": [
    "Activities of head offices",
    "Activități ale direcțiilor(centralelor), birourilor administrative centralizate",
  ],
  "7020": [
    "Business and management consultancy",
    "Activități de consultanță în afaceri și management",
  ],
  "7111": ["Architecture", "Activități de arhitectură"],
  "7112": [
    "Engineering and related technical consultancy",
    "Activități de inginerie și consultanță tehnică legate de acestea",
  ],
  "7120": ["Technical testing and analysis", "Activități de testări și analize tehnice"],
  "7220": [
    "Research in social sciences and humanities",
    "Cercetare-dezvoltare în științe sociale și umaniste",
  ],
  "7311": ["Advertising agencies", "Activități ale agențiilor de publicitate"],
  "7312": ["Media representation", "Servicii de reprezentare media"],
  "7320": [
    "Market research and opinion polling",
    "Activități de studiere a pieței și de sondare a opiniei publice",
  ],
  "7330": [
    "Public relations and communication",
    "Activități în domeniul relațiilor publice și al comunicării",
  ],
  "7411": ["Industrial and fashion design", "Activități de design industrial și vestimentar"],
  "7412": [
    "Graphic design and visual communication",
    "Design grafic și activități de comunicare vizuală",
  ],
  "7413": ["Interior design", "Activități de design de interior"],
  "7414": ["Other specialised design", "Alte activități de design specializat"],
  "7420": ["Photography", "Activități fotografice"],
  "7430": ["Translation and interpreting", "Activități de traducere scrisă și orală (interpreți)"],
  "7491": [
    "Patent brokering and marketing services",
    "Activități de brokeraj în materie de brevete și servicii de marketing",
  ],
  "7499": [
    "Other professional, scientific and technical activities n.e.c.",
    "Alte activități profesionale, stiințifice și tehnice n.c.a.",
  ],
  "7500": ["Veterinary activities", "Activități veterinare"],
  "7711": [
    "Rental and leasing of cars and light vehicles",
    "Activități de închiriere și leasing cu autoturisme și autovehicule rutiere ușoare",
  ],
  "7712": [
    "Rental and leasing of trucks",
    "Activități de închiriere și leasing cu autovehicule rutiere grele",
  ],
  "7721": [
    "Rental of recreational and sports goods",
    "Activități de închiriere și leasing cu bunuri recreaționale și echipament sportiv",
  ],
  "7722": [
    "Rental of other personal and household goods",
    "Activități de închiriere și leasing cu alte bunuri personale și gospodărești n.c.a.",
  ],
  "7732": [
    "Rental of construction machinery and equipment",
    "Activități de închiriere și leasing cu mașini și echipamente pentru construcții",
  ],
  "7739": [
    "Rental of other machinery and equipment n.e.c.",
    "Activități de închirierea și leasing cu alte mașini, echipamente și bunuri tangibile n.c.a.",
  ],
  "7751": [
    "Intermediation services for car, motorhome and trailer rental",
    "Servicii de intermediere pentru închirierea și leasingul autoturismelor, autorulotelor și remorcilor",
  ],
  "7810": [
    "Employment placement agencies",
    "Activități ale agențiilor de plasare a forței de muncă",
  ],
  "7820": [
    "Temporary employment and other human resources provision",
    "Activități ale agențiilor de plasare temporară a forței de muncă și furnizarea altor resurse umane",
  ],
  "7911": ["Travel agencies", "Activități ale agențiilor turistice"],
  "7912": ["Tour operators", "Activități ale tur-operatorilor"],
  "7990": [
    "Other reservation and tourist assistance services",
    "Alte servicii de rezervare și asistență turistică",
  ],
  "8001": [
    "Private investigation and security",
    "Activități de investigații și servicii private de protecție",
  ],
  "8009": ["Other security activities n.e.c.", "Alte activități de protecție n.c.a."],
  "8110": ["Combined facilities support", "Activități de servicii suport combinate"],
  "8121": ["General cleaning of buildings", "Activități generale de curățenie a clădirilor"],
  "8122": ["Specialised cleaning", "Activități specializate de curățenie"],
  "8123": ["Other cleaning activities", "Alte activități de curățenie"],
  "8130": ["Landscaping services", "Activități de întreținere peisagistică"],
  "8210": [
    "Office administrative and support activities",
    "Activități de secretariat și servicii suport",
  ],
  "8220": ["Call centres", "Activități ale centrelor de intermediere telefonică (call center)"],
  "8230": [
    "Conference, trade show and event organisation",
    "Activități de organizare a expozițiilor, târgurilor și congreselor",
  ],
  "8240": [
    "Intermediation services for business support n.e.c.",
    "Activități de intermediere pentru servicii suport pentru întreprinderi n.c.a.",
  ],
  "8291": [
    "Collection agencies and credit bureaus",
    "Activități ale agențiilor de colectare și ale birourilor (oficiilor) de raportare a creditului",
  ],
  "8292": ["Packaging activities", "Activități de ambalare"],
  "8299": [
    "Other business support services n.e.c.",
    "Alte activități de servicii suport pentru întreprinderi n.c.a.",
  ],
  "8411": ["General public administration", "Activități de administrație publică generală"],
  "8510": ["Pre-primary education", "Învățământ preșcolar"],
  "8520": ["Primary education", "Învățământ primar"],
  "8531": ["General secondary education", "Învățământ secundar general"],
  "8532": [
    "Technical and vocational secondary education",
    "Învățământ secundar, tehnic sau profesional",
  ],
  "8533": ["Post-secondary non-tertiary education", "Învățământ post-secundar, non-universitar"],
  "8540": ["Tertiary education", "Învățământ superior universitar"],
  "8551": ["Sports and recreation education", "Învățământ în domeniul sportiv și recreațional"],
  "8552": [
    "Cultural education (music, theatre, dance, arts)",
    "Învățământ în domeniul cultural (muzică, teatru, dans, arte plastice, etc.)",
  ],
  "8553": ["Driving schools", "Școli de conducere (pilotaj)"],
  "8559": ["Other education n.e.c.", "Alte forme de învățământ n.c.a."],
  "8561": [
    "Intermediation services for courses and tutors",
    "Activități de intermediere pentru cursuri și tutori (îndrumători, profesori)",
  ],
  "8569": ["Educational support services", "Activități de servicii suport pentru învățământ"],
  "8621": ["General medical practice", "Activități de asistență medicală generală"],
  "8622": ["Specialist medical practice", "Activități de asistență medicală specializată"],
  "8623": ["Dental practice", "Activități de asistență stomatologică"],
  "8691": [
    "Medical imaging and laboratory services",
    "Servicii de diagnostic imagistic și activități ale laboratoarelor medicale",
  ],
  "8692": ["Ambulance transport", "Transportul pacienților cu ambulanța"],
  "8693": [
    "Psychologists and psychotherapists",
    "Activități ale psihologilor și psihoterapeuților, cu excepția medicilor",
  ],
  "8694": ["Nursing and midwifery", "Activități ale infirmierelor și moașelor"],
  "8695": ["Physiotherapy", "Activități de fizioterapie"],
  "8696": [
    "Traditional, complementary and alternative medicine",
    "Activități de medicină tradițională, complementară și alternativă",
  ],
  "8699": [
    "Other human health activities n.e.c.",
    "Alte activități referitoare la sănătatea umană n.c.a.",
  ],
  "8710": ["Residential nursing care", "Activități ale centrelor de îngrijire medicală"],
  "8720": [
    "Residential care for mental health and addiction",
    "Activități ale centrelor de recuperare pshică și de dezintoxicare, exclusiv spitale",
  ],
  "8730": [
    "Residential care for the elderly and disabled",
    "Activități ale căminelor de bătrâni și ale căminelor pentru persoane cu dizabilități aflate în incapacitate de a se îngriji singure",
  ],
  "8810": [
    "Social work without accommodation for the elderly and disabled",
    "Activități de asistență socială, fără cazare, pentru bătrâni și pentru persoane cu dizabilități aflate în incapacitate de a se îngriji singure",
  ],
  "8891": ["Child day-care", "Activități de îngrijire zilnică pentru copii"],
  "8899": [
    "Other social work without accommodation n.e.c.",
    "Alte activități de asistență socială, fără cazare, n.c.a.",
  ],
  "9011": [
    "Literary creation and musical composition",
    "Activități de creație literară și compoziție muzicală",
  ],
  "9012": ["Visual arts creation", "Activități de creație în domeniul artelor vizuale"],
  "9013": ["Other arts creation", "Alte activități de creație artistică"],
  "9020": ["Performing arts", "Activități de interpretare artistică (spectacole)"],
  "9031": [
    "Operation of arts facilities and venues",
    "Activități de gestionare a sălilor și amplasamentelor de spectacole",
  ],
  "9039": [
    "Other support activities for the arts",
    "Alte activități suport pentru creație și interpretare artistică",
  ],
  "9130": [
    "Conservation and restoration of cultural heritage",
    "Activități de conservare, restaurare și alte activități suport pentru patrimoniul cultural",
  ],
  "9200": ["Gambling and betting", "Activități de jocuri de noroc și pariuri"],
  "9311": ["Operation of sports facilities", "Activități ale bazelor sportive"],
  "9312": ["Sports clubs", "Activități ale cluburilor sportive"],
  "9313": ["Fitness centres", "Activități ale centrelor de fitness"],
  "9319": ["Other sports activities n.e.c.", "Alte activități sportive n.c.a."],
  "9321": ["Amusement and theme parks", "Activități ale parcurilor tematice și de distracții"],
  "9329": [
    "Other amusement and recreation n.e.c.",
    "Alte activități recreative și distractive n.c.a.",
  ],
  "9411": [
    "Business and employers' organisations",
    "Activități ale organizațiilor economice și patronale",
  ],
  "9412": ["Professional organisations", "Activități ale organizațiilor profesionale"],
  "9420": ["Trade unions", "Activități ale sindicatelor salariaților"],
  "9491": ["Religious organisations", "Activități ale organizațiilor religioase"],
  "9499": ["Other membership organisations n.e.c.", "Activități ale altor organizații n.c.a."],
  "9510": [
    "Repair of computers and communication equipment",
    "Repararea și întreținerea calculatoarelor și a echipamentelor de comunicații",
  ],
  "9521": [
    "Repair of consumer electronics",
    "Repararea și întreținerea aparatelor electronice de uz casnic",
  ],
  "9522": [
    "Repair of household appliances and garden equipment",
    "Repararea și întreținerea dispozitivelor de uz gospodăresc și a echipamentelor pentru casă și grădină",
  ],
  "9523": [
    "Repair of footwear and leather goods",
    "Repararea și întreținerea încălțămintei și a articolelor din piele",
  ],
  "9524": [
    "Repair of furniture and home furnishings",
    "Repararea și întreținerea mobilei și a furniturilor casnice",
  ],
  "9525": [
    "Repair of watches and jewellery",
    "Repararea și întreținerea ceasurilor și a bijuteriilor",
  ],
  "9529": [
    "Repair of other personal and household goods",
    "Repararea și întreținerea articolelor de uz personal și gospodăresc n.c.a.",
  ],
  "9531": ["Repair and maintenance of motor vehicles", "Repararea și întreținerea autovehiculelor"],
  "9532": ["Repair and maintenance of motorcycles", "Repararea și întreținerea motocicletelor"],
  "9540": [
    "Intermediation services for repair and maintenance",
    "Servicii de intermediere pentru repararea și întreținerea calculatoarelor, a articolelor personale și de uz gospodăresc, a autovehiculelor și motocicletelor",
  ],
  "9621": ["Hairdressing and barbers", "Activități de coafură și frizerie"],
  "9622": ["Beauty treatment", "Activități de tratament și înfrumusețare"],
  "9623": [
    "Day spas, saunas and steam baths",
    "Activități ale centrelor spa, saunelor și bailor de abur",
  ],
  "9691": ["Personal services at home", "Activități de servicii personale la domiciliu"],
  "9699": ["Other personal services n.e.c.", "Alte servicii personale n.c.a."],
};

/** Rev.2 (2008) classes that Rev.3 dropped or gave another meaning. */
const REV2: Record<string, Entry> = {
  "2562": ["Machining", "Operațiuni de mecanică generală"],
  "3101": [
    "Manufacture of office and shop furniture",
    "Fabricarea de mobilă pentru birouri și magazine",
  ],
  "3102": ["Manufacture of kitchen furniture", "Fabricarea de mobilă pentru bucătării"],
  "3109": ["Manufacture of other furniture", "Fabricarea de mobilă n.c.a."],
  "3511": ["Production of electricity", "Producția de energie electrică"],
  "3512": ["Transmission of electricity", "Transportul energiei electrice"],
  "3514": ["Trade of electricity", "Comercializarea energiei electrice"],
  "3821": [
    "Treatment and disposal of non-hazardous waste",
    "Tratarea și eliminarea deșeurilor nepericuloase",
  ],
  "4110": ["Development of building projects", "Dezvoltare (promovare) imobiliară"],
  "4120": [
    "Construction of residential and non-residential buildings",
    "Lucrări de construcții a clădirilor rezidențiale și nerezidențiale",
  ],
  "4329": ["Other construction installation", "Alte lucrări de instalații pentru construcții"],
  "4339": ["Other building completion and finishing", "Alte lucrări de finisare"],
  "4391": ["Roofing", "Lucrări de învelitori, șarpante și terase la construcții"],
  "4511": [
    "Sale of cars and light motor vehicles",
    "Comerț cu autoturisme și autovehicule ușoare (sub 3,5 tone)",
  ],
  "4519": ["Sale of other motor vehicles", "Comerț cu alte autovehicule"],
  "4520": ["Maintenance and repair of motor vehicles", "Întreținerea și repararea autovehiculelor"],
  "4531": [
    "Wholesale of motor vehicle parts and accessories",
    "Comerț cu ridicata de piese și accesorii pentru autovehicule",
  ],
  "4532": [
    "Retail sale of motor vehicle parts and accessories",
    "Comerț cu amănuntul de piese și accesorii pentru autovehicule",
  ],
  "4540": [
    "Sale and repair of motorcycles and parts",
    "Comerț cu motociclete, piese și accesorii aferente; întreținerea și repararea motocicletelor",
  ],
  "4651": [
    "Wholesale of computers, peripherals and software",
    "Comerț cu ridicata al calculatoarelor, echipamentelor periferice și software-ului",
  ],
  "4652": [
    "Wholesale of electronic and telecom equipment",
    "Comerț cu ridicata de componente și echipamente electronice și de telecomunicații",
  ],
  "4664": [
    "Wholesale of textile-industry and sewing machinery",
    "Comerț cu ridicata al mașinilor pentru industria textilă și al mașinilor de cusut și de tricotat",
  ],
  "4669": [
    "Wholesale of other machinery and equipment",
    "Comerț cu ridicata al altor mașini și echipamente",
  ],
  "4671": [
    "Wholesale of fuels and related products",
    "Comerț cu ridicata al combustibililor solizi, lichizi și gazoși și al produselor derivate",
  ],
  "4672": [
    "Wholesale of metals and metal ores",
    "Comerț cu ridicata al metalelor și minereurilor metalice",
  ],
  "4673": [
    "Wholesale of wood, construction materials and sanitary equipment",
    "Comerț cu ridicata al materialului lemnos și al materialelor de construcții și echipamentelor sanitare",
  ],
  "4674": [
    "Wholesale of hardware, plumbing and heating supplies",
    "Comerț cu ridicata al echipamentelor și furniturilor de fierărie pentru instalații sanitare și de încălzire",
  ],
  "4675": ["Wholesale of chemical products", "Comerț cu ridicata al produselor chimice"],
  "4676": [
    "Wholesale of other intermediate products",
    "Comerț cu ridicata al altor produse intermediare",
  ],
  "4677": ["Wholesale of waste and scrap", "Comerț cu ridicata al deșeurilor și resturilor"],
  "4719": [
    "Non-specialised retail, mainly non-food goods",
    "Comerț cu amănuntul în magazine nespecializate, cu vânzare predominantă de produse nealimentare",
  ],
  "4729": [
    "Retail sale of other food",
    "Comerț cu amănuntul al altor produse alimentare, în magazine specializate",
  ],
  "4741": [
    "Retail sale of computers, peripherals and software",
    "Comerț cu amănuntul al calculatoarelor, unităților periferice și software-ului in magazine specializate",
  ],
  "4742": [
    "Retail sale of telecommunications equipment",
    "Comerț cu amănuntul al echipamentului pentru telecomunicații în magazine specializate",
  ],
  "4743": [
    "Retail sale of audio and video equipment",
    "Comerț cu amănuntul al echipamentelor audio/video în magazine specializate",
  ],
  "4759": [
    "Retail sale of furniture, lighting and household articles",
    "Comerț cu amănuntul al mobilei, al articolelor de iluminat și al articolelor de uz casnic n.c.a., în magazine specializate",
  ],
  "4763": [
    "Retail sale of music and video recordings",
    "Comerț cu amănuntul al discurilor și benzilor magnetice cu sau fără înregistrări audio/video, în magazine specializate",
  ],
  "4764": [
    "Retail sale of sporting equipment",
    "Comerț cu amănuntul al echipamentelor sportive, în magazine specializate",
  ],
  "4765": [
    "Retail sale of games and toys",
    "Comerț cu amănuntul al jocurilor și jucăriilor, în magazine specializate",
  ],
  "4781": [
    "Market and stall retail of food, beverages and tobacco",
    "Comerț cu amănuntul al produselor alimentare, băuturilor și produselor din tutun efectuat prin standuri, chioșcuri și piețe",
  ],
  "4782": [
    "Market and stall retail of textiles, clothing and footwear",
    "Comerț cu amănuntul al textilelor, îmbrăcămintei și încălțămintei efectuat prin standuri, chioșcuri și piețe",
  ],
  "4789": [
    "Market and stall retail of other goods",
    "Comerț cu amănuntul prin standuri, chioșcuri și piețe al altor produse",
  ],
  "4791": [
    "Retail sale via mail order or the internet",
    "Comerț cu amănuntul prin intermediul caselor de comenzi sau prin Internet",
  ],
  "4799": [
    "Other retail sale outside stores, stalls or markets",
    "Comerț cu amănuntul efectuat în afara magazinelor, standurilor, chioșcurilor și piețelor",
  ],
  "4910": [
    "Interurban passenger rail transport",
    "Transporturi interurbane de călători pe calea ferată",
  ],
  "4931": [
    "Urban and suburban passenger transport",
    "Transporturi urbane, suburbane și metropolitane de călători",
  ],
  "4932": ["Taxi operation", "Transporturi cu taxiuri"],
  "5229": ["Other transport support activities", "Alte activități anexe transporturilor"],
  "5610": ["Restaurants and mobile food services", "Restaurante"],
  "5629": ["Other food services", "Alte servicii de alimentație n.c.a."],
  "6110": ["Wired telecommunications", "Activități de telecomunicații prin rețele cu cablu"],
  "6120": [
    "Wireless telecommunications",
    "Activități de telecomunicații prin rețele fără cablu (exclusiv prin satelit)",
  ],
  "6201": [
    "Computer programming (custom software)",
    "Activități de realizare a soft-ului la comandă (software orientat client)",
  ],
  "6202": ["IT consultancy", "Activități de consultanță în tehnologia informației"],
  "6203": [
    "Computer facilities management",
    "Activități de management (gestiune și exploatare) a mijloacelor de calcul",
  ],
  "6209": [
    "Other IT and computer services",
    "Alte activități de servicii privind tehnologia informației",
  ],
  "6311": [
    "Data processing, web hosting and related activities",
    "Prelucrarea datelor, administrarea paginilor web și activități conexe",
  ],
  "6312": ["Web portals", "Activități ale portalurilor web"],
  "6391": ["News agency activities", "Activități ale agențiilor de știri"],
  "6399": [
    "Other information services n.e.c.",
    "Alte activități de servicii informaționale n.c.a.",
  ],
  "6810": [
    "Buying and selling of own real estate",
    "Cumpărarea și vânzarea de bunuri imobiliare proprii",
  ],
  "6832": [
    "Management of real estate on a fee or contract basis",
    "Administrarea imobilelor pe bază de comision sau contract",
  ],
  "7021": [
    "Public relations and communication",
    "Activități de consultanță în domeniul relațiilor publice și al comunicării",
  ],
  "7022": [
    "Business and management consultancy",
    "Activități de consultanță pentru afaceri și management",
  ],
  "7211": ["Research in biotechnology", "Cercetare-dezvoltare în biotehnologie"],
  "7219": [
    "Research in natural sciences and engineering",
    "Cercetare-dezvoltare în alte științe naturale și inginerie",
  ],
  "7410": ["Specialised design", "Activități de design specializat"],
  "7490": [
    "Other professional, scientific and technical activities n.e.c.",
    "Alte activități profesionale, științifice și tehnice n.c.a.",
  ],
  "7722": [
    "Rental of video tapes and discs",
    "Închirierea de casete video și discuri (CD-uri, DVD-uri)",
  ],
  "7729": [
    "Rental of other personal and household goods",
    "Activități de închiriere și leasing cu alte bunuri personale și gospodărești n.c.a.",
  ],
  "7820": [
    "Temporary employment agencies",
    "Activități de contractare, pe baze temporare, a personalului",
  ],
  "7830": [
    "Other human resources provision",
    "Servicii de furnizare și management a forței de muncă",
  ],
  "8010": ["Private security", "Activități de protecție și gardă"],
  "8020": ["Security systems services", "Activități de servicii privind sistemele de securizare"],
  "8129": ["Other cleaning activities", "Alte activități de curățenie"],
  "8211": ["Combined office administrative services", "Activități combinate de secretariat"],
  "8219": [
    "Photocopying, document preparation and office support",
    "Activități de fotocopiere, de pregătire a documentelor și alte activități specializate de secretariat",
  ],
  "8541": ["Post-secondary non-tertiary education", "Învățământ superior non-universitar"],
  "8542": ["Tertiary education", "Învățământ superior universitar"],
  "8560": ["Educational support services", "Activități de servicii suport pentru învățământ"],
  "8690": ["Other human health activities", "Alte activități referitoare la sănătatea umană"],
  "9001": ["Performing arts", "Activități de interpretare artistică (spectacole)"],
  "9002": [
    "Support activities to performing arts",
    "Activități suport pentru interpretare artistică (spectacole)",
  ],
  "9003": ["Artistic creation", "Activități de creație artistică"],
  "9004": ["Operation of arts facilities", "Activități de gestionare a sălilor de spectacole"],
  "9102": ["Museums", "Activități ale muzeelor"],
  "9103": [
    "Historical sites, buildings and visitor attractions",
    "Gestionarea monumentelor, clădirilor istorice și a altor obiective de interes turistic",
  ],
  "9511": [
    "Repair of computers and peripheral equipment",
    "Repararea calculatoarelor și a echipamentelor periferice",
  ],
  "9512": ["Repair of communication equipment", "Repararea echipamentelor de comunicații"],
  "9602": [
    "Hairdressing and other beauty treatment",
    "Coafură și alte activități de înfrumusețare",
  ],
  "9604": ["Physical well-being activities", "Activități de întreținere corporală"],
  "9609": ["Other personal services n.e.c.", "Alte activități de servicii n.c.a."],
};

/** Curated Rev.3 classes that did not exist in Rev.2. */
const NEW_IN_REV3 = new Set([
  "2553",
  "3100",
  "3515",
  "4100",
  "4323",
  "4324",
  "4335",
  "4341",
  "4342",
  "4350",
  "4360",
  "4650",
  "4683",
  "4684",
  "4685",
  "4686",
  "4687",
  "4689",
  "4712",
  "4727",
  "4740",
  "4755",
  "4769",
  "4783",
  "4792",
  "4933",
  "5225",
  "5226",
  "5231",
  "5232",
  "5540",
  "5611",
  "5612",
  "5622",
  "5640",
  "6031",
  "6039",
  "6210",
  "6220",
  "6290",
  "6310",
  "6392",
  "6811",
  "6812",
  "7020",
  "7330",
  "7411",
  "7412",
  "7413",
  "7414",
  "7491",
  "7499",
  "7751",
  "8001",
  "8009",
  "8123",
  "8210",
  "8240",
  "8533",
  "8540",
  "8561",
  "8569",
  "8691",
  "8692",
  "8693",
  "8694",
  "8695",
  "8696",
  "8699",
  "9011",
  "9012",
  "9013",
  "9020",
  "9031",
  "9039",
  "9130",
  "9510",
  "9531",
  "9532",
  "9540",
  "9621",
  "9622",
  "9623",
  "9691",
  "9699",
]);

const bilingual = ([en, ro]: Entry): Bilingual => ({ en, ro });

/** "70.20", "7020", "111" → "7020" / "0111"; two digits stay a division. */
function normaliseCode(code: string): string | undefined {
  const digits = code.replace(/\D/g, "");
  if (digits.length === 2) return digits;
  if (digits.length === 3 || digits.length === 4) return digits.padStart(4, "0");
  return undefined;
}

function curated(code: string, revision?: CaenRevision): Entry | undefined {
  if (revision === 2) return REV2[code] ?? (NEW_IN_REV3.has(code) ? undefined : REV3[code]);
  return REV3[code] ?? REV2[code];
}

/**
 * Label of a CAEN class or division. Classes outside the curated list get
 * their division's label (correct, only broader); use loadCaenLabel() for the
 * exact Romanian class name.
 */
export function caenLabel(code: string, revision?: CaenRevision): Bilingual | undefined {
  const normalised = normaliseCode(code);
  if (!normalised) return undefined;
  const entry = curated(normalised, revision) ?? DIVISIONS[normalised.slice(0, 2)];
  return entry && bilingual(entry);
}

type ClassTable = { rev3: Record<string, string>; rev2: Record<string, string> };
let classes: Promise<ClassTable> | undefined;

/** Like caenLabel(), with the official Romanian name for every class of both revisions. */
export async function loadCaenLabel(
  code: string,
  revision?: CaenRevision,
): Promise<Bilingual | undefined> {
  const normalised = normaliseCode(code);
  if (!normalised || normalised.length === 2) return caenLabel(code, revision);
  const entry = curated(normalised, revision);
  if (entry) return bilingual(entry);
  classes ??= import("./caen-classes.json").then((m) => m.default as ClassTable);
  const table = await classes.catch(() => null);
  const ro =
    revision === 2
      ? (table?.rev2[normalised] ?? table?.rev3[normalised])
      : (table?.rev3[normalised] ?? table?.rev2[normalised]);
  const division = DIVISIONS[normalised.slice(0, 2)];
  // With the full table loaded, a code it doesn't know isn't a CAEN class.
  if (!ro) return table ? undefined : division && bilingual(division);
  return { en: division?.[0] ?? `CAEN ${normalised}`, ro };
}
