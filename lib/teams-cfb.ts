// The school each college team plays for, keyed by the abbreviation the sync
// writes into nfl_games.home_abbrev / away_abbrev.
//
// This exists because nfl_games stores only ESPN's displayName, "Georgia
// Bulldogs", and the Desk board wants the school rather than the mascot: this
// table holds nine Wildcats, nine Tigers and eight Bulldogs, so a board leading
// with the mascot cannot be read at a glance. The split cannot be done on the
// string.
// "Alabama Crimson Tide" is Alabama and "Alabama State Hornets" is Alabama
// State, identically shaped and different answers, and dropping the last word
// is wrong for 37 of the 243 teams here: Notre Dame Fighting Irish, Georgia
// Tech Yellow Jackets, North Carolina Tar Heels, Penn State Nittany Lions and
// so on.
//
// GENERATED, NOT HAND-WRITTEN. Swept from ESPN's own competitors[].team.location
// over the same games as CFB_TEAM_IDS -- 2025 regular weeks 1-16 plus the bowl
// and playoff slate, and 2026 weeks 1-5: 1,324 games, 243 distinct teams, and
// ZERO abbreviations mapping to more than one school, which is what makes an
// abbreviation-keyed map safe here. Verified 2026-09-05.
//
// TO REGENERATE: sweep cdn.espn.com/core/college-football/schedule for a full
// season collecting competitors[].team.{abbreviation,location}, and check for
// collisions before trusting the result, exactly as lib/logos-cfb.ts warns. A
// team missing from this table falls back to its stored displayName, so the
// board stays readable rather than blank. All 238 abbreviations present in the
// production cfb rows are covered as of 2026-09-05.
export const CFB_SCHOOLS: Record<string, string> = {
  AAMU:    'Alabama A&M',
  ACU:     'Abilene Christian', // Abilene Christian Wildcats
  AFA:     'Air Force', // Air Force Falcons
  AKR:     'Akron', // Akron Zips
  ALA:     'Alabama', // Alabama Crimson Tide
  ALB:     'UAlbany', // UAlbany Great Danes
  ALCN:    'Alcorn State', // Alcorn State Braves
  ALST:    'Alabama State', // Alabama State Hornets
  APP:     'App State', // App State Mountaineers
  APSU:    'Austin Peay', // Austin Peay Governors
  ARIZ:    'Arizona', // Arizona Wildcats
  ARK:     'Arkansas', // Arkansas Razorbacks
  ARMY:    'Army', // Army Black Knights
  ARST:    'Arkansas State', // Arkansas State Red Wolves
  ASU:     'Arizona State', // Arizona State Sun Devils
  AUB:     'Auburn', // Auburn Tigers
  BALL:    'Ball State', // Ball State Cardinals
  BAY:     'Baylor', // Baylor Bears
  BC:      'Boston College', // Boston College Eagles
  BCU:     'Bethune-Cookman', // Bethune-Cookman Wildcats
  BGSU:    'Bowling Green', // Bowling Green Falcons
  BOIS:    'Boise State', // Boise State Broncos
  BRY:     'Bryant', // Bryant Bulldogs
  BUCK:    'Bucknell', // Bucknell Bison
  BUFF:    'Buffalo', // Buffalo Bulls
  BYU:     'BYU', // BYU Cougars
  CAL:     'California', // California Golden Bears
  CAM:     'Campbell', // Campbell Fighting Camels
  CARK:    'Central Arkansas', // Central Arkansas Bears
  CCSU:    'Central Connecticut', // Central Connecticut Blue Devils
  CCU:     'Coastal Carolina', // Coastal Carolina Chanticleers
  CHSO:    'Charleston Southern', // Charleston Southern Buccaneers
  CIN:     'Cincinnati', // Cincinnati Bearcats
  CIT:     'The Citadel', // The Citadel Bulldogs
  CLEM:    'Clemson', // Clemson Tigers
  CLT:     'Charlotte', // Charlotte 49ers
  CMU:     'Central Michigan', // Central Michigan Chippewas
  COLG:    'Colgate', // Colgate Raiders
  COLO:    'Colorado', // Colorado Buffaloes
  CONN:    'UConn', // UConn Huskies
  CP:      'Cal Poly', // Cal Poly Mustangs
  CSU:     'Colorado State', // Colorado State Rams
  DEL:     'Delaware', // Delaware Blue Hens
  DSU:     'Delaware State', // Delaware State Hornets
  DUKE:    'Duke', // Duke Blue Devils
  DUQ:     'Duquesne', // Duquesne Dukes
  ECU:     'East Carolina', // East Carolina Pirates
  EIU:     'Eastern Illinois', // Eastern Illinois Panthers
  EKU:     'Eastern Kentucky', // Eastern Kentucky Colonels
  ELON:    'Elon', // Elon Phoenix
  EMU:     'Eastern Michigan', // Eastern Michigan Eagles
  ETAM:    'East Texas A&M', // East Texas A&M Lions
  ETSU:    'East Tennessee State', // East Tennessee State Buccaneers
  EWU:     'Eastern Washington', // Eastern Washington Eagles
  FAMU:    'Florida A&M', // Florida A&M Rattlers
  FAU:     'Florida Atlantic', // Florida Atlantic Owls
  FIU:     'Florida International', // Florida International Panthers
  FLA:     'Florida', // Florida Gators
  FOR:     'Fordham', // Fordham Rams
  FRES:    'Fresno State', // Fresno State Bulldogs
  FSU:     'Florida State', // Florida State Seminoles
  FUR:     'Furman', // Furman Paladins
  GASO:    'Georgia Southern', // Georgia Southern Eagles
  GAST:    'Georgia State', // Georgia State Panthers
  GRAM:    'Grambling', // Grambling Tigers
  GT:      'Georgia Tech', // Georgia Tech Yellow Jackets
  GWEB:    'Gardner-Webb', // Gardner-Webb Runnin' Bulldogs
  HAMP:    'Hampton', // Hampton Pirates
  HAW:     'Hawai\x27i', // Hawai'i Rainbow Warriors
  HC:      'Holy Cross', // Holy Cross Crusaders
  HCU:     'Houston Christian', // Houston Christian Huskies
  HOU:     'Houston', // Houston Cougars
  HOW:     'Howard', // Howard Bison
  IDHO:    'Idaho', // Idaho Vandals
  IDST:    'Idaho State', // Idaho State Bengals
  ILL:     'Illinois', // Illinois Fighting Illini
  ILST:    'Illinois State', // Illinois State Redbirds
  INST:    'Indiana State', // Indiana State Sycamores
  IOWA:    'Iowa', // Iowa Hawkeyes
  ISU:     'Iowa State', // Iowa State Cyclones
  IU:      'Indiana', // Indiana Hoosiers
  JKST:    'Jackson State',
  JMU:     'James Madison', // James Madison Dukes
  JVST:    'Jacksonville State', // Jacksonville State Gamecocks
  KENN:    'Kennesaw State', // Kennesaw State Owls
  KENT:    'Kent State', // Kent State Golden Flashes
  KSU:     'Kansas State', // Kansas State Wildcats
  KU:      'Kansas', // Kansas Jayhawks
  LAF:     'Lafayette', // Lafayette Leopards
  LAM:     'Lamar', // Lamar Cardinals
  LIB:     'Liberty', // Liberty Flames
  LIN:     'Lindenwood', // Lindenwood Lions
  LIU:     'Long Island University', // Long Island University Sharks
  LOU:     'Louisville', // Louisville Cardinals
  LSU:     'LSU', // LSU Tigers
  LT:      'Louisiana Tech', // Louisiana Tech Bulldogs
  'M-OH':  'Miami (OH)', // Miami (OH) RedHawks
  MASS:    'Massachusetts', // Massachusetts Minutemen
  MCN:     'McNeese', // McNeese Cowboys
  MD:      'Maryland', // Maryland Terrapins
  ME:      'Maine', // Maine Black Bears
  MEM:     'Memphis', // Memphis Tigers
  MER:     'Mercer', // Mercer Bears
  MERC:    'Mercyhurst', // Mercyhurst Lakers
  MIA:     'Miami', // Miami Hurricanes
  MICH:    'Michigan', // Michigan Wolverines
  MINN:    'Minnesota', // Minnesota Golden Gophers
  MISS:    'Ole Miss', // Ole Miss Rebels
  MIZ:     'Missouri', // Missouri Tigers
  MONM:    'Monmouth', // Monmouth Hawks
  MONT:    'Montana', // Montana Grizzlies
  MORG:    'Morgan State', // Morgan State Bears
  MOST:    'Missouri State', // Missouri State Bears
  MRMK:    'Merrimack', // Merrimack Warriors
  MRSH:    'Marshall', // Marshall Thundering Herd
  MSST:    'Mississippi State', // Mississippi State Bulldogs
  MSU:     'Michigan State', // Michigan State Spartans
  MTST:    'Montana State', // Montana State Bobcats
  MTSU:    'Middle Tennessee', // Middle Tennessee Blue Raiders
  MUR:     'Murray State', // Murray State Racers
  MVSU:    'Mississippi Valley State', // Mississippi Valley State Delta Devils
  NAU:     'Northern Arizona', // Northern Arizona Lumberjacks
  NAVY:    'Navy', // Navy Midshipmen
  NCAT:    'North Carolina A&T', // North Carolina A&T Aggies
  NCCU:    'North Carolina Central', // North Carolina Central Eagles
  NCSU:    'NC State', // NC State Wolfpack
  ND:      'Notre Dame', // Notre Dame Fighting Irish
  NDSU:    'North Dakota State', // North Dakota State Bison
  NEB:     'Nebraska', // Nebraska Cornhuskers
  NEV:     'Nevada', // Nevada Wolf Pack
  NICH:    'Nicholls', // Nicholls Colonels
  NIU:     'Northern Illinois', // Northern Illinois Huskies
  NMSU:    'New Mexico State', // New Mexico State Aggies
  NORF:    'Norfolk State', // Norfolk State Spartans
  NU:      'Northwestern', // Northwestern Wildcats
  NWST:    'Northwestern State', // Northwestern State Demons
  ODU:     'Old Dominion', // Old Dominion Monarchs
  OHIO:    'Ohio', // Ohio Bobcats
  OKST:    'Oklahoma State', // Oklahoma State Cowboys
  ORE:     'Oregon', // Oregon Ducks
  ORST:    'Oregon State', // Oregon State Beavers
  OSU:     'Ohio State', // Ohio State Buckeyes
  OU:      'Oklahoma', // Oklahoma Sooners
  PITT:    'Pittsburgh', // Pittsburgh Panthers
  PRST:    'Portland State', // Portland State Vikings
  PSU:     'Penn State', // Penn State Nittany Lions
  PUR:     'Purdue', // Purdue Boilermakers
  PV:      'Prairie View A&M', // Prairie View A&M Panthers
  RGV:     'UT Rio Grande Valley', // UT Rio Grande Valley Vaqueros
  RICE:    'Rice', // Rice Owls
  RICH:    'Richmond', // Richmond Spiders
  RMU:     'Robert Morris', // Robert Morris Colonials
  RUTG:    'Rutgers', // Rutgers Scarlet Knights
  SAC:     'Sacramento State', // Sacramento State Hornets
  SAM:     'Samford', // Samford Bulldogs
  SC:      'South Carolina', // South Carolina Gamecocks
  SCST:    'South Carolina State',
  SDAK:    'South Dakota', // South Dakota Coyotes
  SDST:    'South Dakota State', // South Dakota State Jackrabbits
  SDSU:    'San Diego State', // San Diego State Aztecs
  SELA:    'SE Louisiana', // SE Louisiana Lions
  SEMO:    'Southeast Missouri State', // Southeast Missouri State Redhawks
  SFA:     'Stephen F. Austin',
  SFPA:    'Saint Francis',
  SHSU:    'Sam Houston', // Sam Houston Bearkats
  SHU:     'Sacred Heart', // Sacred Heart Pioneers
  SIU:     'Southern Illinois', // Southern Illinois Salukis
  SJSU:    'San José State', // San José State Spartans
  SMU:     'SMU', // SMU Mustangs
  SOU:     'Southern', // Southern Jaguars
  STAN:    'Stanford', // Stanford Cardinal
  STBK:    'Stony Brook', // Stony Brook Seawolves
  STO:     'Stonehill', // Stonehill Skyhawks
  SUU:     'Southern Utah', // Southern Utah Thunderbirds
  SYR:     'Syracuse', // Syracuse Orange
  'TA&M':  'Texas A&M', // Texas A&M Aggies
  TAR:     'Tarleton State', // Tarleton State Texans
  TCU:     'TCU', // TCU Horned Frogs
  TEM:     'Temple', // Temple Owls
  TENN:    'Tennessee', // Tennessee Volunteers
  TEX:     'Texas', // Texas Longhorns
  TLSA:    'Tulsa', // Tulsa Golden Hurricane
  TNST:    'Tennessee State', // Tennessee State Tigers
  TNTC:    'Tennessee Tech', // Tennessee Tech Golden Eagles
  TOL:     'Toledo', // Toledo Rockets
  TOW:     'Towson', // Towson Tigers
  TROY:    'Troy', // Troy Trojans
  TTU:     'Texas Tech', // Texas Tech Red Raiders
  TULN:    'Tulane', // Tulane Green Wave
  TXSO:    'Texas Southern', // Texas Southern Tigers
  TXST:    'Texas State', // Texas State Bobcats
  UAB:     'UAB', // UAB Blazers
  UAPB:    'Arkansas-Pine Bluff', // Arkansas-Pine Bluff Golden Lions
  UCD:     'UC Davis', // UC Davis Aggies
  UCF:     'UCF', // UCF Knights
  UCLA:    'UCLA', // UCLA Bruins
  UGA:     'Georgia', // Georgia Bulldogs
  UIW:     'Incarnate Word', // Incarnate Word Cardinals
  UK:      'Kentucky', // Kentucky Wildcats
  UL:      'Louisiana', // Louisiana Ragin' Cajuns
  ULM:     'UL Monroe', // UL Monroe Warhawks
  UNA:     'North Alabama', // North Alabama Lions
  UNC:     'North Carolina', // North Carolina Tar Heels
  UNCO:    'Northern Colorado', // Northern Colorado Bears
  UND:     'North Dakota', // North Dakota Fighting Hawks
  UNH:     'New Hampshire', // New Hampshire Wildcats
  UNI:     'Northern Iowa', // Northern Iowa Panthers
  UNLV:    'UNLV', // UNLV Rebels
  UNM:     'New Mexico', // New Mexico Lobos
  UNT:     'North Texas', // North Texas Mean Green
  URI:     'Rhode Island', // Rhode Island Rams
  USA:     'South Alabama', // South Alabama Jaguars
  USC:     'USC', // USC Trojans
  USF:     'South Florida', // South Florida Bulls
  USM:     'Southern Miss', // Southern Miss Golden Eagles
  USU:     'Utah State', // Utah State Aggies
  UTAH:    'Utah', // Utah Utes
  UTC:     'Chattanooga', // Chattanooga Mocs
  UTEP:    'UTEP', // UTEP Miners
  UTM:     'UT Martin', // UT Martin Skyhawks
  UTSA:    'UTSA', // UTSA Roadrunners
  UTU:     'Utah Tech', // Utah Tech Trailblazers
  UVA:     'Virginia', // Virginia Cavaliers
  VAN:     'Vanderbilt', // Vanderbilt Commodores
  VILL:    'Villanova', // Villanova Wildcats
  VMI:     'VMI', // VMI Keydets
  VT:      'Virginia Tech', // Virginia Tech Hokies
  'W&M':   'William & Mary', // William & Mary Tribe
  WAG:     'Wagner', // Wagner Seahawks
  WAKE:    'Wake Forest', // Wake Forest Demon Deacons
  WASH:    'Washington', // Washington Huskies
  WCU:     'Western Carolina', // Western Carolina Catamounts
  WEB:     'Weber State', // Weber State Wildcats
  WES:     'West Georgia', // West Georgia Wolves
  WIS:     'Wisconsin', // Wisconsin Badgers
  WIU:     'Western Illinois', // Western Illinois Leathernecks
  WKU:     'Western Kentucky', // Western Kentucky Hilltoppers
  WMU:     'Western Michigan', // Western Michigan Broncos
  WOF:     'Wofford', // Wofford Terriers
  WSU:     'Washington State', // Washington State Cougars
  WVU:     'West Virginia', // West Virginia Mountaineers
  WYO:     'Wyoming', // Wyoming Cowboys
  YSU:     'Youngstown State', // Youngstown State Penguins
}
