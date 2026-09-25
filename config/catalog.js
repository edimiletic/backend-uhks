const MEN_YOUTH = ['JUNIORI', 'KADETI', 'MLAĐI KADETI', 'DJEČACI I DJEVOJČICE'];
const WOMEN_YOUTH = ['JUNIORKE', 'KADETKINJE', 'MLAĐE KADETKINJE', 'DJEČACI I DJEVOJČICE'];

const withYouth = (seniorCompetitions, youthCompetitions) =>
  [...new Set([...seniorCompetitions, ...youthCompetitions])];

const TEAMS = [
  { name: 'KK Alkar', competitions: withYouth(['FAVBET PREMIJER LIGA'], MEN_YOUTH) },
  { name: 'KK Cibona', competitions: withYouth(['FAVBET PREMIJER LIGA'], MEN_YOUTH) },
  { name: 'KK Depolink Škrljevo', competitions: withYouth(['FAVBET PREMIJER LIGA'], MEN_YOUTH) },
  { name: 'KK Dinamo Zagreb', competitions: withYouth(['FAVBET PREMIJER LIGA'], MEN_YOUTH) },
  { name: 'KK Dubrava', competitions: withYouth(['FAVBET PREMIJER LIGA'], MEN_YOUTH) },
  { name: 'KK Dubrovnik', competitions: withYouth(['FAVBET PREMIJER LIGA'], MEN_YOUTH) },
  { name: 'KK Kvarner', competitions: withYouth(['FAVBET PREMIJER LIGA'], MEN_YOUTH) },
  { name: 'KK Samobor', competitions: withYouth(['FAVBET PREMIJER LIGA'], MEN_YOUTH) },
  { name: 'KK Split', competitions: withYouth(['FAVBET PREMIJER LIGA'], MEN_YOUTH) },
  { name: 'KK Virtus Zagreb', competitions: withYouth(['FAVBET PREMIJER LIGA'], MEN_YOUTH) },
  { name: 'KK Zabok', competitions: withYouth(['FAVBET PREMIJER LIGA'], MEN_YOUTH) },
  { name: 'KK Zadar', competitions: withYouth(['FAVBET PREMIJER LIGA'], MEN_YOUTH) },

  { name: 'ŽKK Brod na Savi', competitions: withYouth(['PREMIJER ŽENSKA LIGA'], WOMEN_YOUTH) },
  { name: 'ŽKK FSV Rijeka', competitions: withYouth(['PREMIJER ŽENSKA LIGA'], WOMEN_YOUTH) },
  { name: 'KA Žana Lelas Split', competitions: withYouth(['PREMIJER ŽENSKA LIGA'], WOMEN_YOUTH) },
  { name: 'ŽKK Medveščak', competitions: withYouth(['PREMIJER ŽENSKA LIGA'], WOMEN_YOUTH) },
  { name: 'ŽKK Plamen Požega', competitions: withYouth(['PREMIJER ŽENSKA LIGA'], WOMEN_YOUTH) },
  { name: 'ŽKK Ragusa', competitions: withYouth(['PREMIJER ŽENSKA LIGA'], WOMEN_YOUTH) },
  { name: 'ŽKK Studio Zagreb', competitions: withYouth(['PREMIJER ŽENSKA LIGA'], WOMEN_YOUTH) },
  { name: 'ŽKK Šibenik', competitions: withYouth(['PREMIJER ŽENSKA LIGA'], WOMEN_YOUTH) },
  { name: 'ŽKK Trešnjevka 2009', competitions: withYouth(['PREMIJER ŽENSKA LIGA'], WOMEN_YOUTH) },
  { name: 'ŽKK Zadar', competitions: withYouth(['PREMIJER ŽENSKA LIGA'], WOMEN_YOUTH) },
  { name: 'ŽKK Zadar Plus', competitions: withYouth(['PREMIJER ŽENSKA LIGA'], WOMEN_YOUTH) },

  { name: 'KK Aleta Puntamika', competitions: withYouth(['PRVA MUŠKA LIGA'], MEN_YOUTH) },
  { name: 'KK Crikvenica', competitions: withYouth(['PRVA MUŠKA LIGA'], MEN_YOUTH) },
  { name: 'KK Đakovo', competitions: withYouth(['PRVA MUŠKA LIGA'], MEN_YOUTH) },
  { name: 'KK Gorica', competitions: withYouth(['PRVA MUŠKA LIGA'], MEN_YOUTH) },
  { name: 'KK Hermes Analitica', competitions: withYouth(['PRVA MUŠKA LIGA'], MEN_YOUTH) },
  { name: 'KK Jazine Arbanasi', competitions: withYouth(['PRVA MUŠKA LIGA'], MEN_YOUTH) },
  { name: 'KK Marsonia', competitions: withYouth(['PRVA MUŠKA LIGA'], MEN_YOUTH) },
  { name: 'HAKK Mladost', competitions: withYouth(['PRVA MUŠKA LIGA'], MEN_YOUTH) },
  { name: 'KK Novi Zagreb', competitions: withYouth(['PRVA MUŠKA LIGA'], MEN_YOUTH) },
  { name: 'KK Omiš-Čagalj Tours', competitions: withYouth(['PRVA MUŠKA LIGA'], MEN_YOUTH) },
  { name: 'KK Radnik Križevci', competitions: withYouth(['PRVA MUŠKA LIGA'], MEN_YOUTH) },
  { name: 'KK Ribola Kaštela', competitions: withYouth(['PRVA MUŠKA LIGA'], MEN_YOUTH) },
  { name: 'GKK Šibenka', competitions: withYouth(['PRVA MUŠKA LIGA'], MEN_YOUTH) },
  { name: 'KK Zagreb', competitions: withYouth(['PRVA MUŠKA LIGA'], MEN_YOUTH) }
];

const VENUES = [
  'Košarkaški centar Dražen Petrović',
  'SŠD Boško Božić Pepsi (Trnsko)',
  'Športska dvorana Dubrava',
  'ŠŠD Peščenica',
  'SD Sutinska Vrela',
  'Dom košarke Cedevita',
  'Dvorana Krešimira Ćosića (ŠC Višnjik)',
  'Dvorana Jazine',
  'Košarkaška dvorana Split (Gripe)',
  'SC Gripe – mala dvorana',
  'Gradska športska dvorana Ivica Glavan – Ićo (Sinj)',
  'Gradska sportska dvorana Zabok',
  'Sportska dvorana Samobor',
  'Sportski centar Zamet (Rijeka)',
  'SRC 3. maj (Rijeka)',
  'Sportska dvorana Kostrena',
  'ŠD Gospino polje (Dubrovnik)',
  'SD Baldekin (Šibenik)',
  'Sportska dvorana Vijuš (Slavonski Brod)',
  'Sportska dvorana Tomislav Pirc (Požega)',
  'Sportska dvorana Velika Gorica',
  'Sportska dvorana Crikvenica',
  'Sportska dvorana Đakovo',
  'Sportska dvorana Omiš',
  'Sportska dvorana Kaštela',
  'Sportska dvorana Križevci'
];

module.exports = { TEAMS, VENUES };
