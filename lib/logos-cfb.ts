// ESPN's numeric team ids for college football, keyed by the abbreviation the
// sync writes into nfl_games.home_abbrev / away_abbrev.
//
// GENERATED, NOT HAND-WRITTEN. Swept from every game ESPN served for the 2025
// season (regular weeks 1-16 plus the bowl and playoff slate) and 2026 weeks
// 1-5: 1,324 games, 243 distinct teams, and ZERO abbreviation
// collisions across the whole set, which is what makes an abbreviation-keyed
// map safe here. Every one of the 243 logo URLs was verified against
// the CDN (200, image/png) on 2026-09-05.
//
// Unlike the NFL -- where the abbreviation IS the path -- ESPN keys college
// logos by numeric id, so this table is the only way to build the URL from
// what we store. A team missing from it renders as the typographic tile, the
// same graceful fallback every unsupported league uses.
//
// TO REGENERATE: sweep cdn.espn.com/core/college-football/schedule for a full
// season, collect competitors[].team.{abbreviation,id}, and check for
// collisions before trusting the result. A newly promoted or rebranded program
// simply renders as type until this is refreshed.
export const CFB_TEAM_IDS: Record<string, string> = {
  AAMU: '2010', // Alabama A&M Bulldogs
  ACU: '2000', // Abilene Christian Wildcats
  AFA: '2005', // Air Force Falcons
  AKR: '2006', // Akron Zips
  ALA: '333', // Alabama Crimson Tide
  ALB: '399', // UAlbany Great Danes
  ALCN: '2016', // Alcorn State Braves
  ALST: '2011', // Alabama State Hornets
  APP: '2026', // App State Mountaineers
  APSU: '2046', // Austin Peay Governors
  ARIZ: '12', // Arizona Wildcats
  ARK: '8', // Arkansas Razorbacks
  ARMY: '349', // Army Black Knights
  ARST: '2032', // Arkansas State Red Wolves
  ASU: '9', // Arizona State Sun Devils
  AUB: '2', // Auburn Tigers
  BALL: '2050', // Ball State Cardinals
  BAY: '239', // Baylor Bears
  BC: '103', // Boston College Eagles
  BCU: '2065', // Bethune-Cookman Wildcats
  BGSU: '189', // Bowling Green Falcons
  BOIS: '68', // Boise State Broncos
  BRY: '2803', // Bryant Bulldogs
  BUCK: '2083', // Bucknell Bison
  BUFF: '2084', // Buffalo Bulls
  BYU: '252', // BYU Cougars
  CAL: '25', // California Golden Bears
  CAM: '2097', // Campbell Fighting Camels
  CARK: '2110', // Central Arkansas Bears
  CCSU: '2115', // Central Connecticut Blue Devils
  CCU: '324', // Coastal Carolina Chanticleers
  CHSO: '2127', // Charleston Southern Buccaneers
  CIN: '2132', // Cincinnati Bearcats
  CIT: '2643', // The Citadel Bulldogs
  CLEM: '228', // Clemson Tigers
  CLT: '2429', // Charlotte 49ers
  CMU: '2117', // Central Michigan Chippewas
  COLG: '2142', // Colgate Raiders
  COLO: '38', // Colorado Buffaloes
  CONN: '41', // UConn Huskies
  CP: '13', // Cal Poly Mustangs
  CSU: '36', // Colorado State Rams
  DEL: '48', // Delaware Blue Hens
  DSU: '2169', // Delaware State Hornets
  DUKE: '150', // Duke Blue Devils
  DUQ: '2184', // Duquesne Dukes
  ECU: '151', // East Carolina Pirates
  EIU: '2197', // Eastern Illinois Panthers
  EKU: '2198', // Eastern Kentucky Colonels
  ELON: '2210', // Elon Phoenix
  EMU: '2199', // Eastern Michigan Eagles
  ETAM: '2837', // East Texas A&M Lions
  ETSU: '2193', // East Tennessee State Buccaneers
  EWU: '331', // Eastern Washington Eagles
  FAMU: '50', // Florida A&M Rattlers
  FAU: '2226', // Florida Atlantic Owls
  FIU: '2229', // Florida International Panthers
  FLA: '57', // Florida Gators
  FOR: '2230', // Fordham Rams
  FRES: '278', // Fresno State Bulldogs
  FSU: '52', // Florida State Seminoles
  FUR: '231', // Furman Paladins
  GASO: '290', // Georgia Southern Eagles
  GAST: '2247', // Georgia State Panthers
  GRAM: '2755', // Grambling Tigers
  GT: '59', // Georgia Tech Yellow Jackets
  GWEB: '2241', // Gardner-Webb Runnin' Bulldogs
  HAMP: '2261', // Hampton Pirates
  HAW: '62', // Hawai'i Rainbow Warriors
  HC: '107', // Holy Cross Crusaders
  HCU: '2277', // Houston Christian Huskies
  HOU: '248', // Houston Cougars
  HOW: '47', // Howard Bison
  IDHO: '70', // Idaho Vandals
  IDST: '304', // Idaho State Bengals
  ILL: '356', // Illinois Fighting Illini
  ILST: '2287', // Illinois State Redbirds
  INST: '282', // Indiana State Sycamores
  IOWA: '2294', // Iowa Hawkeyes
  ISU: '66', // Iowa State Cyclones
  IU: '84', // Indiana Hoosiers
  JKST: '2296', // Jackson State Tigers
  JMU: '256', // James Madison Dukes
  JVST: '55', // Jacksonville State Gamecocks
  KENN: '338', // Kennesaw State Owls
  KENT: '2309', // Kent State Golden Flashes
  KSU: '2306', // Kansas State Wildcats
  KU: '2305', // Kansas Jayhawks
  LAF: '322', // Lafayette Leopards
  LAM: '2320', // Lamar Cardinals
  LIB: '2335', // Liberty Flames
  LIN: '2815', // Lindenwood Lions
  LIU: '2341', // Long Island University Sharks
  LOU: '97', // Louisville Cardinals
  LSU: '99', // LSU Tigers
  LT: '2348', // Louisiana Tech Bulldogs
  "M-OH": '193', // Miami (OH) RedHawks
  MASS: '113', // Massachusetts Minutemen
  MCN: '2377', // McNeese Cowboys
  MD: '120', // Maryland Terrapins
  ME: '311', // Maine Black Bears
  MEM: '235', // Memphis Tigers
  MER: '2382', // Mercer Bears
  MERC: '2385', // Mercyhurst Lakers
  MIA: '2390', // Miami Hurricanes
  MICH: '130', // Michigan Wolverines
  MINN: '135', // Minnesota Golden Gophers
  MISS: '145', // Ole Miss Rebels
  MIZ: '142', // Missouri Tigers
  MONM: '2405', // Monmouth Hawks
  MONT: '149', // Montana Grizzlies
  MORG: '2415', // Morgan State Bears
  MOST: '2623', // Missouri State Bears
  MRMK: '2771', // Merrimack Warriors
  MRSH: '276', // Marshall Thundering Herd
  MSST: '344', // Mississippi State Bulldogs
  MSU: '127', // Michigan State Spartans
  MTST: '147', // Montana State Bobcats
  MTSU: '2393', // Middle Tennessee Blue Raiders
  MUR: '93', // Murray State Racers
  MVSU: '2400', // Mississippi Valley State Delta Devils
  NAU: '2464', // Northern Arizona Lumberjacks
  NAVY: '2426', // Navy Midshipmen
  NCAT: '2448', // North Carolina A&T Aggies
  NCCU: '2428', // North Carolina Central Eagles
  NCSU: '152', // NC State Wolfpack
  ND: '87', // Notre Dame Fighting Irish
  NDSU: '2449', // North Dakota State Bison
  NEB: '158', // Nebraska Cornhuskers
  NEV: '2440', // Nevada Wolf Pack
  NICH: '2447', // Nicholls Colonels
  NIU: '2459', // Northern Illinois Huskies
  NMSU: '166', // New Mexico State Aggies
  NORF: '2450', // Norfolk State Spartans
  NU: '77', // Northwestern Wildcats
  NWST: '2466', // Northwestern State Demons
  ODU: '295', // Old Dominion Monarchs
  OHIO: '195', // Ohio Bobcats
  OKST: '197', // Oklahoma State Cowboys
  ORE: '2483', // Oregon Ducks
  ORST: '204', // Oregon State Beavers
  OSU: '194', // Ohio State Buckeyes
  OU: '201', // Oklahoma Sooners
  PITT: '221', // Pittsburgh Panthers
  PRST: '2502', // Portland State Vikings
  PSU: '213', // Penn State Nittany Lions
  PUR: '2509', // Purdue Boilermakers
  PV: '2504', // Prairie View A&M Panthers
  RGV: '292', // UT Rio Grande Valley Vaqueros
  RICE: '242', // Rice Owls
  RICH: '257', // Richmond Spiders
  RMU: '2523', // Robert Morris Colonials
  RUTG: '164', // Rutgers Scarlet Knights
  SAC: '16', // Sacramento State Hornets
  SAM: '2535', // Samford Bulldogs
  SC: '2579', // South Carolina Gamecocks
  SCST: '2569', // South Carolina State Bulldogs
  SDAK: '233', // South Dakota Coyotes
  SDST: '2571', // South Dakota State Jackrabbits
  SDSU: '21', // San Diego State Aztecs
  SELA: '2545', // SE Louisiana Lions
  SEMO: '2546', // Southeast Missouri State Redhawks
  SFA: '2617', // Stephen F. Austin Lumberjacks
  SFPA: '2598', // Saint Francis Red Flash
  SHSU: '2534', // Sam Houston Bearkats
  SHU: '2529', // Sacred Heart Pioneers
  SIU: '79', // Southern Illinois Salukis
  SJSU: '23', // San José State Spartans
  SMU: '2567', // SMU Mustangs
  SOU: '2582', // Southern Jaguars
  STAN: '24', // Stanford Cardinal
  STBK: '2619', // Stony Brook Seawolves
  STO: '284', // Stonehill Skyhawks
  SUU: '253', // Southern Utah Thunderbirds
  SYR: '183', // Syracuse Orange
  "TA&M": '245', // Texas A&M Aggies
  TAR: '2627', // Tarleton State Texans
  TCU: '2628', // TCU Horned Frogs
  TEM: '218', // Temple Owls
  TENN: '2633', // Tennessee Volunteers
  TEX: '251', // Texas Longhorns
  TLSA: '202', // Tulsa Golden Hurricane
  TNST: '2634', // Tennessee State Tigers
  TNTC: '2635', // Tennessee Tech Golden Eagles
  TOL: '2649', // Toledo Rockets
  TOW: '119', // Towson Tigers
  TROY: '2653', // Troy Trojans
  TTU: '2641', // Texas Tech Red Raiders
  TULN: '2655', // Tulane Green Wave
  TXSO: '2640', // Texas Southern Tigers
  TXST: '326', // Texas State Bobcats
  UAB: '5', // UAB Blazers
  UAPB: '2029', // Arkansas-Pine Bluff Golden Lions
  UCD: '302', // UC Davis Aggies
  UCF: '2116', // UCF Knights
  UCLA: '26', // UCLA Bruins
  UGA: '61', // Georgia Bulldogs
  UIW: '2916', // Incarnate Word Cardinals
  UK: '96', // Kentucky Wildcats
  UL: '309', // Louisiana Ragin' Cajuns
  ULM: '2433', // UL Monroe Warhawks
  UNA: '2453', // North Alabama Lions
  UNC: '153', // North Carolina Tar Heels
  UNCO: '2458', // Northern Colorado Bears
  UND: '155', // North Dakota Fighting Hawks
  UNH: '160', // New Hampshire Wildcats
  UNI: '2460', // Northern Iowa Panthers
  UNLV: '2439', // UNLV Rebels
  UNM: '167', // New Mexico Lobos
  UNT: '249', // North Texas Mean Green
  URI: '227', // Rhode Island Rams
  USA: '6', // South Alabama Jaguars
  USC: '30', // USC Trojans
  USF: '58', // South Florida Bulls
  USM: '2572', // Southern Miss Golden Eagles
  USU: '328', // Utah State Aggies
  UTAH: '254', // Utah Utes
  UTC: '236', // Chattanooga Mocs
  UTEP: '2638', // UTEP Miners
  UTM: '2630', // UT Martin Skyhawks
  UTSA: '2636', // UTSA Roadrunners
  UTU: '3101', // Utah Tech Trailblazers
  UVA: '258', // Virginia Cavaliers
  VAN: '238', // Vanderbilt Commodores
  VILL: '222', // Villanova Wildcats
  VMI: '2678', // VMI Keydets
  VT: '259', // Virginia Tech Hokies
  "W&M": '2729', // William & Mary Tribe
  WAG: '2681', // Wagner Seahawks
  WAKE: '154', // Wake Forest Demon Deacons
  WASH: '264', // Washington Huskies
  WCU: '2717', // Western Carolina Catamounts
  WEB: '2692', // Weber State Wildcats
  WES: '2698', // West Georgia Wolves
  WIS: '275', // Wisconsin Badgers
  WIU: '2710', // Western Illinois Leathernecks
  WKU: '98', // Western Kentucky Hilltoppers
  WMU: '2711', // Western Michigan Broncos
  WOF: '2747', // Wofford Terriers
  WSU: '265', // Washington State Cougars
  WVU: '277', // West Virginia Mountaineers
  WYO: '2751', // Wyoming Cowboys
  YSU: '2754', // Youngstown State Penguins
}
