// ESPN's numeric team ids for men's college basketball, keyed by the
// abbreviation the sync writes into nfl_games.home_abbrev / away_abbrev.
//
// GENERATED, NOT HAND-WRITTEN, the same way lib/logos-cfb.ts was. Swept from
// every game cdn.espn.com served for the 2025-26 season (2025-11-01 through
// 2026-04-10) plus the opening weeks of 2026-27: 798 usable teams.
// Abbreviations that mapped to more than one ESPN id -- RGNT, PSC, all of them
// non-Division I opponents -- were dropped rather than guessed at, so an
// abbreviation-keyed map is safe for everything that remains.
//
// Only the 521 ids whose logo answered 200 image/png on 2026-10-08
// are here. The rest are mostly small-college opponents ESPN carries a name for
// but no artwork; they render as the typographic tile, which is the normal
// fallback (see lib/logos.ts).
//
// College ids are per SCHOOL, not per sport -- Duke is 150 on the football
// table too -- but the abbreviations are not shared reliably between the two
// sports, which is why this is its own table rather than a reuse of CFB_TEAM_IDS.
//
// TO REGENERATE: sweep cdn.espn.com/core/mens-college-basketball/schedule one
// day at a time (it answers one day per request, unlike the NBA feed), collect
// competitors[].team.{abbreviation,id}, drop collisions, verify each URL.
export const CBB_TEAM_IDS: Record<string, string> = {
  AAMU: '2010', // Alabama A&M Bulldogs
  ABSU: '2013', // Albany State Golden Rams
  ACU: '2000', // Abilene Christian Wildcats
  ADR: '2003', // Adrian Bulldogs
  ADSU: '2001', // Adams State Grizzlies
  AF: '2005', // Air Force Falcons
  AGSU: '2025', // Angelo State Rams
  AKR: '2006', // Akron Zips
  ALA: '333', // Alabama Crimson Tide
  ALBI: '2790', // Albion Britons
  ALCN: '2016', // Alcorn State Braves
  ALLG: '2018', // Allegheny Gators
  ALMA: '2800', // Alma Scots
  ALNU: '2019', // Allen Yellow Jackets
  ALST: '2011', // Alabama State Hornets
  AMCC: '357', // Texas A&M-Corpus Christi Islanders
  AMER: '44', // American University Eagles
  APP: '2026', // App State Mountaineers
  APSU: '2046', // Austin Peay Governors
  ARIZ: '12', // Arizona Wildcats
  ARK: '8', // Arkansas Razorbacks
  ARMY: '349', // Army Black Knights
  ARST: '2032', // Arkansas State Red Wolves
  ARTE: '2033', // Arkansas Tech Wonder Boys
  ASU: '9', // Arizona State Sun Devils
  AUB: '2', // Auburn Tigers
  AVER: '2047', // Averett Cougars
  BALL: '2050', // Ball State Cardinals
  BAY: '239', // Baylor Bears
  BBU: '2071', // Bloomsburg Huskies
  BC: '103', // Boston College Eagles
  BCU: '2065', // Bethune-Cookman Wildcats
  BCWV: '2062', // Bethany (WV) Bison
  BEL: '2057', // Belmont Bruins
  BELL: '91', // Bellarmine Knights
  BERR: '2757', // Berry Vikings
  BGSU: '189', // Bowling Green Falcons
  BING: '2066', // Binghamton Bearcats
  BMTA: '2058', // Belmont Abbey Crusaders
  BOBJ: '3243', // Bob Jones Bruins
  BOIS: '68', // Boise State Broncos
  BOWE: '2075', // Bowie State Bulldogs
  BRAD: '71', // Bradley Braves
  BRE: '2913', // Brevard Tornados
  BRI: '2079', // Bridgewater Eagles
  BRWN: '225', // Brown Bears
  BRY: '2803', // Bryant Bulldogs
  BTLR: '2086', // Butler Bulldogs
  BTTN: '2064', // Bethel (TN) Wildcats
  BU: '104', // Boston University Terriers
  BUCK: '2083', // Bucknell Bison
  BUF: '2084', // Buffalo Bulls
  BVU: '63', // Buena Vista Beavers
  BYU: '252', // BYU Cougars
  CAL: '25', // California Golden Bears
  CALD: '2857', // Caldwell Cougars
  CAM: '2097', // Campbell Fighting Camels
  CAN: '2099', // Canisius Golden Griffins
  CAPU: '424', // Capital Crusaders
  CARK: '2110', // Central Arkansas Bears
  CAT: '2107', // Catawba Indians
  CBU: '2856', // California Baptist Lancers
  CC: '40', // Curry Colonels
  CCO: '2121', // Centre Colonels
  CCSU: '2115', // Central Connecticut Blue Devils
  CCU: '324', // Coastal Carolina Chanticleers
  CGMU: '2102', // Carnegie Mellon Tartans
  CHAM: '2124', // Chaminade Silverswords
  CHI: '80', // Chicago Maroons
  CHSO: '2127', // Charleston Southern Buccaneers
  CHST: '2130', // Chicago State Cougars
  CIN: '2132', // Cincinnati Bearcats
  CIT: '2643', // The Citadel Bulldogs
  CLE: '325', // Cleveland State Vikings
  CLEM: '228', // Clemson Tigers
  CLT: '2429', // Charlotte 49ers
  CMU: '2117', // Central Michigan Chippewas
  CNIA: '2155', // Cornell (IA) Rams
  CNSU: '2119', // Central State Marauders
  CNTC: '2964', // Central College Dutch
  COE: '2141', // Coe Kohawks
  COFC: '232', // Charleston Cougars
  COLC: '2144', // Colorado College Tigers
  COLG: '2142', // Colgate Raiders
  COLO: '38', // Colorado Buffaloes
  COLU: '171', // Columbia Lions
  CONC: '2148', // Concord Mountain Lions
  CONN: '41', // UConn Huskies
  COPP: '2154', // Coppin State Eagles
  COR: '172', // Cornell Big Red
  CORB: '3106', // Corban Warriors
  CP: '13', // Cal Poly Mustangs
  CREI: '156', // Creighton Bluejays
  CRWN: '509', // Crown Polars
  CSS: '375', // St. Scholastica Saints
  CSU: '36', // Colorado State Rams
  CSUB: '2934', // Cal State Bakersfield Roadrunners
  CSUF: '2239', // Cal State Fullerton Titans
  CSUN: '2463', // Cal State Northridge Matadors
  CTLA: '2113', // Centenary (LA) Gentlemen
  CUC: '2151', // Concordia Chicago Cougars
  DART: '159', // Dartmouth Big Green
  DAV: '2166', // Davidson Wildcats
  DAY: '2168', // Dayton Flyers
  DEL: '48', // Delaware Blue Hens
  DEN: '2172', // Denver Pioneers
  DEP: '305', // DePaul Blue Demons
  DETM: '2174', // Detroit Mercy Titans
  DFC: '190', // Defiance Yellow Jackets
  DKSN: '2175', // Dickinson Red Devils
  DKSU: '512', // Dakota State Trojans
  DREX: '2182', // Drexel Dragons
  DRKE: '2181', // Drake Bulldogs
  DSU: '2169', // Delaware State Hornets
  DUKE: '150', // Duke Blue Devils
  DUQ: '2184', // Duquesne Dukes
  ECSU: '2207', // Elizabeth City State Vikings
  ECU: '151', // East Carolina Pirates
  EIU: '2197', // Eastern Illinois Panthers
  EKU: '2198', // Eastern Kentucky Colonels
  ELMR: '347', // Elmira Soaring Eagles
  ELON: '2210', // Elon Phoenix
  EMU: '2199', // Eastern Michigan Eagles
  ERKA: '101', // Eureka Red Devils
  ETAM: '2837', // East Texas A&M Lions
  ETSU: '2193', // East Tennessee State Buccaneers
  EU: '2196', // Eastern Eagles
  EVAN: '339', // Evansville Purple Aces
  EWU: '331', // Eastern Washington Eagles
  FAIR: '2217', // Fairfield Stags
  FAMU: '50', // Florida A&M Rattlers
  FAU: '2226', // Florida Atlantic Owls
  FC: '366', // Ferrum Panthers
  FDU: '161', // Fairleigh Dickinson Knights
  FGCU: '526', // Florida Gulf Coast Eagles
  FISK: '2225', // Fisk Bulldogs
  FIU: '2229', // Florida International Panthers
  FLA: '57', // Florida Gators
  FOR: '2230', // Fordham Rams
  FP: '144', // Franklin Pierce Ravens
  FPU: '2235', // Fresno Pacific Sunbirds
  FRES: '278', // Fresno State Bulldogs
  FRKL: '2233', // Franklin Grizzlies
  FSU: '52', // Florida State Seminoles
  FUR: '231', // Furman Paladins
  FVSU: '2232', // Fort Valley State Wildcats
  GASO: '290', // Georgia Southern Eagles
  GAST: '2247', // Georgia State Panthers
  GB: '2739', // Green Bay Phoenix
  GCU: '2253', // Grand Canyon Lopes
  GEN: '2242', // Geneva Golden Tornadoes
  GFU: '415', // George Fox Bruins
  GLDT: '417', // Gallaudet Bison
  GMU: '2244', // George Mason Patriots
  GONZ: '2250', // Gonzaga Bulldogs
  GRAM: '2755', // Grambling Tigers
  GRNB: '2256', // Greensboro Pride
  GT: '59', // Georgia Tech Yellow Jackets
  GTWN: '46', // Georgetown Hoyas
  GW: '45', // George Washington Revolutionaries
  GWEB: '2241', // Gardner-Webb Runnin' Bulldogs
  HALL: '2550', // Seton Hall Pirates
  HAMP: '2261', // Hampton Pirates
  HARV: '108', // Harvard Crimson
  HAW: '62', // Hawai'i Rainbow Warriors
  HC: '107', // Holy Cross Crusaders
  HCU: '2277', // Houston Christian Huskies
  HFU: '420', // Holy Family Tigers
  HIRM: '2274', // Hiram Terriers
  HNTC: '2938', // Huntingdon Hawks
  HNVR: '2262', // Hanover Panthers
  HOF: '2275', // Hofstra Pride
  HOU: '248', // Houston Cougars
  HOW: '47', // Howard Bison
  HPU: '2272', // High Point Panthers
  HWPU: '2758', // Howard Payne Yellow Jackets
  IDHO: '70', // Idaho Vandals
  IDST: '304', // Idaho State Bengals
  ILL: '356', // Illinois Fighting Illini
  ILST: '2287', // Illinois State Redbirds
  INST: '282', // Indiana State Sycamores
  IONA: '314', // Iona Gaels
  IOWA: '2294', // Iowa Hawkeyes
  ISU: '66', // Iowa State Cyclones
  IU: '84', // Indiana Hoosiers
  IUIN: '85', // IU Indianapolis Jaguars
  JAX: '294', // Jacksonville Dolphins
  JBU: '2301', // John Brown Golden Eagles
  JCSU: '2304', // Johnson C. Smith Golden Bulls
  JKST: '2296', // Jackson State Tigers
  JMU: '256', // James Madison Dukes
  JOES: '2603', // Saint Joseph's Hawks
  JXST: '55', // Jacksonville State Gamecocks
  KALC: '126', // Kalamazoo Hornets
  KC: '140', // Kansas City Roos
  KEAN: '2871', // Kean Cougars
  KENN: '338', // Kennesaw State Owls
  KENT: '2309', // Kent State Golden Flashes
  KNGS: '247', // King's Monarchs
  KSU: '2306', // Kansas State Wildcats
  KU: '2305', // Kansas Jayhawks
  KWC: '2316', // Kentucky Wesleyan Panthers
  KYSU: '2310', // Kentucky State Thorobreds
  'L-MD': '2352', // Loyola Maryland Greyhounds
  LAF: '322', // Lafayette Leopards
  LAM: '2320', // Lamar Cardinals
  LAS: '2325', // La Salle Explorers
  LAW: '268', // Lawrence Vikings
  LBSU: '299', // Long Beach State Beach
  LC: '2333', // Lewis & Clark River Otters
  LEH: '2329', // Lehigh Mountain Hawks
  LEM: '2330', // Le Moyne Dolphins
  LETU: '2326', // LeTourneau Yellow Jackets
  LGC: '548', // LaGrange Panthers
  LIB: '2335', // Liberty Flames
  LIN: '2815', // Lindenwood Lions
  LIP: '288', // Lipscomb Bisons
  LIU: '112358', // Long Island University Sharks
  LIV: '2940', // Livingstone Blue Bears
  LMU: '2351', // Loyola Marymount Lions
  LNMO: '2876', // Lincoln (MO) Blue Tigers
  LONG: '2344', // Longwood Lancers
  LOR: '263', // Loras Duhawks
  LOU: '97', // Louisville Cardinals
  LR: '2031', // Little Rock Trojans
  LSU: '99', // LSU Tigers
  LT: '2348', // Louisiana Tech Bulldogs
  LUC: '2350', // Loyola Chicago Ramblers
  'M-OH': '193', // Miami (OH) RedHawks
  MAC: '2359', // Macalester Scots
  MAN: '2363', // Manhattan Jaspers
  MARQ: '269', // Marquette Golden Eagles
  MASS: '113', // Massachusetts Minutemen
  MBAL: '124942', // Mary Baldwin Fighting Squirrels
  MCK: '2816', // McKendree Bearcats
  MCM: '241', // McMurry War Hawks
  MCN: '2377', // McNeese Cowboys
  MD: '120', // Maryland Terrapins
  ME: '311', // Maine Black Bears
  MEM: '235', // Memphis Tigers
  MER: '2382', // Mercer Bears
  MERC: '2385', // Mercyhurst Lakers
  MIA: '2390', // Miami Hurricanes
  MICH: '130', // Michigan Wolverines
  MILW: '270', // Milwaukee Panthers
  MINN: '135', // Minnesota Golden Gophers
  MISS: '145', // Ole Miss Rebels
  MIT: '109', // MIT Engineers
  MIZ: '142', // Missouri Tigers
  MLSP: '2398', // Millsaps Majors
  MMA: '2383', // Merchant Marine Mariners
  MNFD: '2365', // Mansfield Mountaineers
  MNIL: '2919', // Monmouth (IL) Fighting Scots
  MOBU: '2880', // Missouri Baptist Spartans
  MONM: '2405', // Monmouth Hawks
  MONT: '149', // Montana Grizzlies
  MORE: '2413', // Morehead State Eagles
  MORG: '2415', // Morgan State Bears
  MOST: '2623', // Missouri State Bears
  MRHO: '60', // Morehouse Maroon Tigers
  MRMK: '2771', // Merrimack Warriors
  MRSH: '276', // Marshall Thundering Herd
  MRST: '2368', // Marist Red Foxes
  MSK: '332', // Muskingum Fighting Muskies
  MSM: '116', // Mount St. Mary's Mountaineers
  MSST: '344', // Mississippi State Bulldogs
  MSSU: '2403', // Missouri Southern State Lions
  MSU: '127', // Michigan State Spartans
  MTST: '147', // Montana State Bobcats
  MTSU: '2393', // Middle Tennessee Blue Raiders
  MUR: '93', // Murray State Racers
  MVSU: '2400', // Mississippi Valley State Delta Devils
  NAU: '2464', // Northern Arizona Lumberjacks
  NAVY: '2426', // Navy Midshipmen
  NBRY: '2444', // Newberry Wolves
  NCAT: '2448', // North Carolina A&T Aggies
  NCC: '3071', // North Central College Cardinals
  NCCU: '2428', // North Carolina Central Eagles
  NCSU: '152', // NC State Wolfpack
  ND: '87', // Notre Dame Fighting Irish
  NDSU: '2449', // North Dakota State Bison
  NE: '111', // Northeastern Huskies
  NEB: '158', // Nebraska Cornhuskers
  NESU: '196', // Northeastern State RiverHawks
  NEV: '2440', // Nevada Wolf Pack
  NGU: '2822', // North Greenville Trailblazers
  NHVN: '2441', // New Haven Chargers
  NIA: '315', // Niagara Purple Eagles
  NICH: '2447', // Nicholls Colonels
  NIU: '2459', // Northern Illinois Huskies
  NJIT: '2885', // NJIT Highlanders
  NKU: '94', // Northern Kentucky Norse
  NMHU: '2424', // New Mexico Highlands Cowboys
  NMSU: '166', // New Mexico State Aggies
  NNMC: '3141', // Northern New Mexico Eagles
  NOLA: '2443', // LSU New Orleans Privateers
  NORF: '2450', // Norfolk State Spartans
  NPU: '75', // North Park Vikings
  NU: '77', // Northwestern Wildcats
  NWD: '2886', // Northwood Timberwolves
  NWIC: '3218', // Northwest Indian RedHawks
  NWOK: '2823', // Northwestern (OK) Rangers
  NWST: '2466', // Northwestern State Demons
  NYMT: '2951', // SUNY Maritime Privateers
  NYPM: '182', // SUNY Potsdam SUNY-POTSDAM
  OAK: '2473', // Oakland Golden Grizzlies
  ODU: '295', // Old Dominion Monarchs
  OHIO: '195', // Ohio Bobcats
  OKST: '197', // Oklahoma State Cowboys
  OMA: '2437', // Omaha Mavericks
  ORE: '2483', // Oregon Ducks
  ORST: '204', // Oregon State Beavers
  ORU: '198', // Oral Roberts Golden Eagles
  OSU: '194', // Ohio State Buckeyes
  OU: '201', // Oklahoma Sooners
  OWU: '2980', // Ohio Wesleyan Battling Bishops
  PAC: '279', // Pacific Tigers
  PCLT: '2486', // Pacific Lutheran Lutes
  PENN: '219', // Pennsylvania Quakers
  PEPP: '2492', // Pepperdine Waves
  PFW: '2870', // Purdue Fort Wayne Mastodons
  PITT: '221', // Pittsburgh Panthers
  PORT: '2501', // Portland Pilots
  PRES: '2506', // Presbyterian Blue Hose
  PRIN: '163', // Princeton Tigers
  PROV: '2507', // Providence Friars
  PRST: '2502', // Portland State Vikings
  PSU: '213', // Penn State Nittany Lions
  PUG: '2508', // Puget Sound Loggers
  PUR: '2509', // Purdue Boilermakers
  PV: '2504', // Prairie View A&M Panthers
  QUC: '2511', // Queens University Royals
  QUIN: '2514', // Quinnipiac Bobcats
  RAD: '2515', // Radford Highlanders
  REDL: '29', // Redlands Bulldogs
  RFU: '2524', // Rockford Regents
  RGV: '292', // UT Rio Grande Valley Vaqueros
  RHDS: '2519', // Rhodes Lynx
  RIC: '226', // Rhode Island College Anchormen
  RICE: '242', // Rice Owls
  RICH: '257', // Richmond Spiders
  RID: '2520', // Rider Broncs
  RIP: '2891', // Ripon Red Hawks
  RIT: '178', // RIT Tigers
  RIVI: '111913', // Rivier Raiders
  RMU: '2523', // Robert Morris Colonials
  ROW: '2827', // Rowan Profs
  RUTG: '164', // Rutgers Scarlet Knights
  SAC: '16', // Sacramento State Hornets
  SALV: '2776', // Salve Regina Seahawks
  SAM: '2535', // Samford Bulldogs
  SAR: '2568', // Southern Arkansas Muleriders
  SBU: '179', // St. Bonaventure Bonnies
  SC: '2579', // South Carolina Gamecocks
  SCIA: '2564', // Simpson (IA) Storm
  SCST: '2569', // South Carolina State Bulldogs
  SCU: '2541', // Santa Clara Broncos
  SDAK: '233', // South Dakota Coyotes
  SDST: '2571', // South Dakota State Jackrabbits
  SDSU: '21', // San Diego State Aztecs
  SEA: '2547', // Seattle U Redhawks
  SELA: '2545', // SE Louisiana Lions
  SEMO: '2546', // Southeast Missouri State Redhawks
  SF: '2539', // San Francisco Dons
  SFA: '2617', // Stephen F. Austin Lumberjacks
  SFPA: '2598', // Saint Francis Red Wolves
  SHAW: '2551', // Shaw Bears
  SHEN: '2828', // Shenandoah Hornets
  SHSU: '2534', // Sam Houston Bearkats
  SHU: '2529', // Sacred Heart Pioneers
  SIE: '2561', // Siena Saints
  SIU: '79', // Southern Illinois Salukis
  SIUE: '2565', // SIU Edwardsville Cougars
  SJSU: '23', // San José State Spartans
  SJU: '2599', // St. John's Red Storm
  SLU: '139', // Saint Louis Billikens
  SMC: '2608', // Saint Mary's Gaels
  SMMD: '117', // St. Mary's (MD) Seahawks
  SMU: '2567', // SMU Mustangs
  SOU: '2582', // Southern Jaguars
  SOVA: '2896', // Southern Virginia Knights
  SPU: '2612', // Saint Peter's Peacocks
  STAM: '2591', // St. Ambrose Fighting Bees
  STAN: '24', // Stanford Cardinal
  STBK: '2619', // Stony Brook Seawolves
  STET: '56', // Stetson Hatters
  STJF: '374', // St. John Fisher Cardinals
  STJM: '2600', // Saint John's (MN) Johnnies
  STL: '2605', // Saint Leo Monarchs
  STMN: '2900', // St. Thomas Tommies
  STO: '284', // Stonehill Skyhawks
  SUU: '253', // Southern Utah Thunderbirds
  SVC: '2614', // Saint Vincent Bearcats
  SWA: '2903', // Southwestern Adventist Knights
  SYR: '183', // Syracuse Orange
  'TA&M': '245', // Texas A&M Aggies
  TAMK: '2658', // Texas A&M-Kingsville Javelinas
  TAR: '2627', // Tarleton State Texans
  TCU: '2628', // TCU Horned Frogs
  TEM: '218', // Temple Owls
  TENN: '2633', // Tennessee Volunteers
  TEX: '251', // Texas Longhorns
  THI: '2644', // Thiel Tomcats
  TIFF: '2838', // Tiffin Dragons
  TLSA: '202', // Tulsa Golden Hurricane
  TNST: '2634', // Tennessee State Tigers
  TNTC: '2635', // Tennessee Tech Golden Eagles
  TOL: '2649', // Toledo Rockets
  TOW: '119', // Towson Tigers
  TRCC: '2652', // Trinity Christian Trolls
  TROY: '2653', // Troy Trojans
  TRST: '2654', // Truman State Bulldogs
  TTU: '2641', // Texas Tech Red Raiders
  TULN: '2655', // Tulane Green Wave
  TUSC: '2839', // Tusculum Pioneers
  TUTX: '386', // Trinity (TX) Tigers
  TXLU: '2639', // Texas Lutheran Bulldogs
  TXSO: '2640', // Texas Southern Tigers
  TXST: '326', // Texas State Bobcats
  UAA: '1', // Alaska Anchorage Seawolves
  UAB: '5', // UAB Blazers
  UALB: '399', // UAlbany Great Danes
  UAM: '2028', // Arkansas Monticello Boll Weevils
  UAPB: '2029', // Arkansas-Pine Bluff Golden Lions
  UCCS: '2145', // Colorado Colorado Springs Mountain Lions
  UCD: '302', // UC Davis Aggies
  UCF: '2116', // UCF Knights
  UCI: '300', // UC Irvine Anteaters
  UCLA: '26', // UCLA Bruins
  UCR: '27', // UC Riverside Highlanders
  UCSB: '2540', // UC Santa Barbara Gauchos
  UCSD: '28', // UC San Diego Tritons
  UGA: '61', // Georgia Bulldogs
  UIC: '82', // UIC Flames
  UIW: '2916', // Incarnate Word Cardinals
  UK: '96', // Kentucky Wildcats
  UL: '309', // Louisiana Ragin' Cajuns
  ULM: '2433', // UL Monroe Warhawks
  ULV: '2318', // La Verne Leopards
  UMBC: '2378', // UMBC Retrievers
  UMES: '2379', // Maryland Eastern Shore Hawks
  UML: '2349', // UMass Lowell River Hawks
  UMW: '2701', // Montana Western Bulldogs
  UNA: '2453', // North Alabama Lions
  UNC: '153', // North Carolina Tar Heels
  UNCA: '2427', // UNC Asheville Bulldogs
  UNCG: '2430', // UNC Greensboro Spartans
  UNCO: '2458', // Northern Colorado Bears
  UNCW: '350', // UNC Wilmington Seahawks
  UND: '155', // North Dakota Fighting Hawks
  UNF: '2454', // North Florida Ospreys
  UNH: '160', // New Hampshire Wildcats
  UNI: '2460', // Northern Iowa Panthers
  UNKY: '2841', // Union Commonwealth (KY) Bulldogs
  UNLV: '2439', // UNLV Rebels
  UNM: '167', // New Mexico Lobos
  UNT: '249', // North Texas Mean Green
  UNTN: '237', // Union (TN) Bulldogs
  UOO: '354', // Olivet Comets
  UPST: '2908', // South Carolina Upstate Spartans
  URI: '227', // Rhode Island Rams
  USA: '6', // South Alabama Jaguars
  USC: '30', // USC Trojans
  USCG: '2557', // Coast Guard Bears
  USD: '301', // San Diego Toreros
  USF: '58', // South Florida Bulls
  USI: '88', // Southern Indiana Screaming Eagles
  USM: '2572', // Southern Miss Golden Eagles
  USU: '328', // Utah State Aggies
  UTA: '250', // UT Arlington Mavericks
  UTAH: '254', // Utah Utes
  UTC: '236', // Chattanooga Mocs
  UTD: '2905', // UT Dallas Comets
  UTEP: '2638', // UTEP Miners
  UTIC: '390', // Utica Pioneers
  UTM: '2630', // UT Martin Skyhawks
  UTPB: '3081', // UT Permian Basin Falcons
  UTSA: '2636', // UTSA Roadrunners
  UTU: '3101', // Utah Tech Trailblazers
  UVA: '258', // Virginia Cavaliers
  UVM: '261', // Vermont Catamounts
  UVU: '3084', // Utah Valley Wolverines
  UWF: '2697', // West Florida Argonauts
  VAL: '2674', // Valparaiso Beacons
  VAN: '238', // Vanderbilt Commodores
  VCU: '2670', // VCU Rams
  VILL: '222', // Villanova Wildcats
  VMI: '2678', // VMI Keydets
  VSU: '330', // Virginia State Trojans
  VT: '259', // Virginia Tech Hokies
  'W&L': '2688', // Washington and Lee Generals
  'W&M': '2729', // William & Mary Tribe
  WAG: '2681', // Wagner Seahawks
  WAKE: '154', // Wake Forest Demon Deacons
  WASH: '264', // Washington Huskies
  WAYN: '2845', // Waynesburg Yellow Jackets
  WCU: '2717', // Western Carolina Catamounts
  WEB: '2692', // Weber State Wildcats
  WGA: '2698', // West Georgia Wolves
  WHTR: '2850', // Whittier Poets
  WICH: '2724', // Wichita State Shockers
  WIDE: '2725', // Widener Pride
  WIN: '2737', // Winthrop Eagles
  WIS: '275', // Wisconsin Badgers
  WIU: '2710', // Western Illinois Leathernecks
  WKU: '98', // Western Kentucky Hilltoppers
  WLMT: '2930', // Willamette Bearcats
  WMU: '2711', // Western Michigan Broncos
  WNMU: '2703', // Western New Mexico Mustangs
  WOF: '2747', // Wofford Terriers
  WORC: '402', // Worcester State Lancers
  WPU: '2970', // William Paterson Pioneers
  WRST: '2750', // Wright State Raiders
  WSU: '265', // Washington State Cougars
  WVU: '277', // West Virginia Mountaineers
  WVUT: '2706', // WVU Tech Golden Bears
  WVWC: '455', // West Virginia Wesleyan Bobcats
  WYO: '2751', // Wyoming Cowboys
  XAV: '2752', // Xavier Musketeers
  YALE: '43', // Yale Bulldogs
  YSU: '2754', // Youngstown State Penguins
}
