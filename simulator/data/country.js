// The Medic1905 Republic — fictional virtual nation for the simulation platform.
// 36 regions spanning rural → metropolitan, with 72 cities across four tiers.

const COUNTRY = {
  name: 'Medic1905 Republic',
  tagline: 'The virtual nation of the Medic1905 teaching hospital network',
  currency: 'Medic Credit (MC)',
  emergencyNumber: '1905'
};

// tier: region tier | cities: [name, cityTier, population]
const REGIONS = [
  // ——— Metropolitan (8) ———
  { code: 'AUR', name: 'Aurelia Central', tier: 'metropolitan', population: 5100000, description: 'Capital region. Home to the nation\'s oldest medical school and the flagship Aurelia Central Teaching Hospital.', cities: [['Aurelia City', 'major-city', 4200000], ['Vantage Park', 'city', 610000]] },
  { code: 'MER', name: 'Meridian Bay', tier: 'metropolitan', population: 3800000, description: 'Busy port region with a high trauma load and a renowned emergency medicine residency.', cities: [['Port Meridian', 'major-city', 3100000], ['Saltcliffe', 'city', 480000]] },
  { code: 'CAV', name: 'Cavaregio', tier: 'metropolitan', population: 3200000, description: 'Cosmopolitan lake district; strong cardiology and transplant services.', cities: [['Cavaregio', 'major-city', 2700000], ['San Felice', 'city', 340000]] },
  { code: 'NRB', name: 'Northbridge', tier: 'metropolitan', population: 2900000, description: 'Industrial heartland with a large burns and plastics referral centre.', cities: [['Northbridge', 'major-city', 2400000], ['Elmswood', 'city', 380000]] },
  { code: 'KHB', name: 'Kingsharbor', tier: 'metropolitan', population: 2600000, description: 'Deep-water harbour city; major maritime medicine and diving medicine unit.', cities: [['Kingsharbor', 'major-city', 2100000], ['Fairwater', 'city', 360000]] },
  { code: 'SOL', name: 'Solaria Plains', tier: 'metropolitan', population: 2400000, description: 'Sunbelt region with the national cancer institute.', cities: [['Solaria City', 'major-city', 1900000], ['Easton Fields', 'city', 420000]] },
  { code: 'GRV', name: 'Grand Vale', tier: 'metropolitan', population: 2200000, description: 'Fertile valley conurbation; large obstetric and neonatal network.', cities: [['Grandvale', 'major-city', 1700000], ['Millbrook', 'city', 390000]] },
  { code: 'TEC', name: 'Techridge', tier: 'metropolitan', population: 2000000, description: 'Research and biotech hub; robotic surgery and simulation R&D campus.', cities: [['Techridge', 'major-city', 1600000], ['Circuit Falls', 'city', 310000]] },

  // ——— Urban (10) ———
  { code: 'AMB', name: 'Amberfield', tier: 'urban', population: 1500000, description: 'Wheat-belt regional centre with a busy district general hospital.', cities: [['Amberfield', 'city', 1100000], ['Stonegate', 'town', 260000]] },
  { code: 'RVM', name: 'Rivermoor', tier: 'urban', population: 1400000, description: 'River delta region; endemic mosquito-borne disease in summer months.', cities: [['Rivermoor', 'city', 980000], ['Fenwick', 'town', 280000]] },
  { code: 'HIG', name: 'Highgarden', tier: 'urban', population: 1300000, description: 'Hill city known for its respiratory research institute.', cities: [['Highgarden', 'city', 900000], ['Rosedale', 'town', 250000]] },
  { code: 'IRV', name: 'Ironvale', tier: 'urban', population: 1200000, description: 'Mining region — occupational lung disease and trauma cases are common.', cities: [['Ironvale', 'city', 840000], ['Copperhill', 'town', 230000]] },
  { code: 'WSM', name: 'Westmere', tier: 'urban', population: 1200000, description: 'Lakeside region with a large elderly population and rehab services.', cities: [['Westmere', 'city', 810000], ['Lakeshore', 'town', 300000]] },
  { code: 'ECL', name: 'Eastcliff', tier: 'urban', population: 1100000, description: 'Coastal cliff towns; surf-rescue and drowning emergencies in summer.', cities: [['Eastcliff', 'city', 760000], ['Seabrook', 'town', 240000]] },
  { code: 'SLB', name: 'Silverbrook', tier: 'urban', population: 1000000, description: 'Silver-mining heritage; strong community health programmes.', cities: [['Silverbrook', 'city', 700000], ['Aldergate', 'town', 210000]] },
  { code: 'PIN', name: 'Pinecrest', tier: 'urban', population: 980000, description: 'Mountain region; avalanche and hypothermia rescue service.', cities: [['Pinecrest', 'city', 660000], ['Frostlake', 'town', 250000]] },
  { code: 'DUN', name: 'Dunmore', tier: 'urban', population: 940000, description: 'Farming and food-processing region with frequent machinery injuries.', cities: [['Dunmore', 'city', 640000], ['Ashvale', 'town', 220000]] },
  { code: 'COR', name: 'Coralstrand', tier: 'urban', population: 900000, description: 'Coral coast; hyperbaric medicine unit and marine envenomation expertise.', cities: [['Coralstrand', 'city', 610000], ['Reefside', 'town', 200000]] },

  // ——— Suburban (10) ———
  { code: 'MDH', name: 'Meadowhall', tier: 'suburban', population: 620000, description: 'Commuter belt with expanding young-family population.', cities: [['Meadowhall', 'town', 340000], ['Greenford', 'town', 180000]] },
  { code: 'WIL', name: 'Willowdale', tier: 'suburban', population: 590000, description: 'Garden suburbs; strong GP training scheme.', cities: [['Willowdale', 'town', 320000], ['Birchington', 'town', 190000]] },
  { code: 'HRT', name: 'Hartsville', tier: 'suburban', population: 560000, description: 'Market-town region with an ageing rural catchment.', cities: [['Hartsville', 'town', 300000], ['Oakrun', 'village', 45000]] },
  { code: 'LRK', name: 'Larkfield', tier: 'suburban', population: 540000, description: 'Rolling farmland; limited specialist services — transfers are common.', cities: [['Larkfield', 'town', 290000], ['Swanton', 'village', 38000]] },
  { code: 'CDR', name: 'Cedar Falls', tier: 'suburban', population: 510000, description: 'Waterfall tourist region; seasonal trauma peaks.', cities: [['Cedar Falls', 'town', 270000], ['Maplewick', 'village', 41000]] },
  { code: 'THB', name: 'Thornbury', tier: 'suburban', population: 480000, description: 'Orchard country with community hospital networks.', cities: [['Thornbury', 'town', 260000], ['Brackenridge', 'village', 36000]] },
  { code: 'WND', name: 'Windmere', tier: 'suburban', population: 460000, description: 'Windy moorland; ambulance response times can be long.', cities: [['Windmere', 'town', 240000], ['Rushmoor', 'village', 34000]] },
  { code: 'FXG', name: 'Foxglove', tier: 'suburban', population: 430000, description: 'Botanical region — plant toxicity and foraging exposures.', cities: [['Foxglove', 'town', 230000], ['Haresden', 'village', 30000]] },
  { code: 'STB', name: 'Stonebridge', tier: 'suburban', population: 410000, description: 'Quarrying heritage; silica exposure screening programme.', cities: [['Stonebridge', 'town', 220000], ['Quarrytown', 'village', 32000]] },
  { code: 'BLU', name: 'Bluehollow', tier: 'suburban', population: 390000, description: 'Bluebell woodland region with small community hospitals.', cities: [['Bluehollow', 'town', 210000], ['Fernglen', 'village', 28000]] },

  // ——— Rural (8) ———
  { code: 'FRH', name: 'Farhaven', tier: 'rural', population: 210000, description: 'Remote farmland; telemedicine-supported rural clinics.', cities: [['Farhaven', 'town', 95000], ['Lower Marsh', 'village', 18000]] },
  { code: 'GRN', name: 'Greenhills', tier: 'rural', population: 190000, description: 'Hill farming country; long transfer distances to surgical care.', cities: [['Greenhills', 'town', 88000], ['Dry Creek', 'village', 15000]] },
  { code: 'NRM', name: 'Northmoor', tier: 'rural', population: 170000, description: 'Wild moorland; search-and-rescue linked casualty care.', cities: [['Northmoor', 'town', 80000], ['Wolfden', 'village', 12000]] },
  { code: 'RDS', name: 'Redstone Valley', tier: 'rural', population: 160000, description: 'Red-rock canyon country; road traffic collisions on valley roads.', cities: [['Redstone', 'town', 74000], ['Pinewood', 'village', 14000]] },
  { code: 'GDP', name: 'Golden Plains', tier: 'rural', population: 150000, description: 'Endless wheat fields; harvest-season machinery trauma.', cities: [['Golden Plains', 'town', 68000], ['Wheatley', 'village', 12000]] },
  { code: 'STP', name: 'Stormpoint', tier: 'rural', population: 140000, description: 'Exposed headland; storm injuries and power outages affect transfers.', cities: [['Stormpoint', 'town', 62000], ['Harbourlight', 'village', 11000]] },
  { code: 'WSP', name: 'Whispering Pines', tier: 'rural', population: 120000, description: 'Deep forest region; the most remote clinics in the republic.', cities: [['Pinedale', 'town', 54000], ['Silent Lake', 'village', 9000]] },
  { code: 'OLDF', name: 'Old Frontier', tier: 'rural', population: 100000, description: 'Frontier borderland; air-ambulance dependent, single-doctor clinics.', cities: [['Frontier Falls', 'town', 46000], ['Lastwater', 'village', 8000]] }
];

module.exports = { COUNTRY, REGIONS };
