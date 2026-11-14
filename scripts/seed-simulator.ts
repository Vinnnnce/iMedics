// Seeds the Medic1905 Virtual Hospital simulator: the Republic (regions,
// cities, hospitals, departments), the drug formulary, lab & imaging
// catalogs, the clinical case library and demo learner accounts.
// Uses bulk createMany (skipDuplicates) so it stays fast over the network.
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { REGIONS } = require("../simulator/data/country") as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DEPARTMENTS, TIER_DEPARTMENTS, HOSPITAL_NAME_POOLS } = require("../simulator/data/departments") as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DRUGS } = require("../simulator/data/drugs") as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { LABS, IMAGING } = require("../simulator/data/catalog") as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CASES = [
  ...require("../simulator/data/cases1").CASES_PART1,
  ...require("../simulator/data/cases2").CASES_PART2,
  ...require("../simulator/data/cases3").CASES_PART3,
  ...require("../simulator/data/cases4").CASES_PART4,
] as any[];

async function main() {
  console.log("Seeding Medic1905 Republic (simulator)...");

  // ——— Departments ———
  await prisma.simDepartment.createMany({
    data: DEPARTMENTS.map(([key, name, category]: [string, string, string]) => ({ key, name, category })),
    skipDuplicates: true,
  });
  const deptIdByKey = new Map(
    (await prisma.simDepartment.findMany()).map((d: any) => [d.key, d.id]),
  );

  // ——— Regions & cities ———
  if (await prisma.simRegion.count() === 0) {
    for (const r of REGIONS) {
      const region = await prisma.simRegion.create({
        data: { code: r.code, name: r.name, tier: r.tier, population: r.population, description: r.description },
      });
      await prisma.simCity.createMany({
        data: r.cities.map(([name, tier, population]: [string, string, number]) => ({ regionId: region.id, name, tier, population })),
      });
    }
  }
  const regions = await prisma.simRegion.findMany({ include: { cities: true } });

  // ——— Hospitals per city (deterministic, bulk) ———
  if (await prisma.simHospital.count() === 0) {
    const pools: Record<string, string[]> = {
      "major-city": ["teaching-hospital", "specialist-centre", "general-hospital"],
      city: ["general-hospital", "specialist-centre"],
      town: ["district-hospital", "health-centre"],
      village: ["rural-clinic"],
    };
    const bedsByTier: Record<string, number> = { "rural-clinic": 12, "health-centre": 40, "district-hospital": 180, "general-hospital": 450, "teaching-hospital": 1200, "specialist-centre": 300 };
    const hospitalRows: { cityId: number; name: string; tier: string; beds: number; hasEd: boolean; hasIcu: boolean; hasTheatre: boolean }[] = [];
    let nameCursor = 0;
    for (const region of regions) {
      for (const city of region.cities) {
        for (const tier of pools[city.tier]) {
          const pool = HOSPITAL_NAME_POOLS[tier];
          const name = `${city.name} ${pool[nameCursor++ % pool.length]}`;
          hospitalRows.push({
            cityId: city.id, name, tier, beds: bedsByTier[tier],
            hasEd: ["rural-clinic", "health-centre", "district-hospital", "general-hospital", "teaching-hospital"].includes(tier),
            hasIcu: ["district-hospital", "general-hospital", "teaching-hospital", "specialist-centre"].includes(tier),
            hasTheatre: ["district-hospital", "general-hospital", "teaching-hospital", "specialist-centre"].includes(tier),
          });
        }
      }
    }
    await prisma.simHospital.createMany({ data: hospitalRows });

    // hospital_departments (bulk)
    const hospitals = await prisma.simHospital.findMany();
    const base = ["administration", "medical-records", "billing", "nursing", "mortuary"];
    const hdRows: { hospitalId: number; departmentId: number }[] = [];
    for (const h of hospitals) {
      let deptKeys: string[] | string = TIER_DEPARTMENTS[h.tier];
      if (deptKeys === "*") deptKeys = DEPARTMENTS.map((d: any) => d[0]);
      for (const k of new Set([...(deptKeys as string[]), ...base])) {
        const deptId = deptIdByKey.get(k);
        if (deptId) hdRows.push({ hospitalId: h.id, departmentId: deptId });
      }
    }
    await prisma.simHospitalDepartment.createMany({ data: hdRows, skipDuplicates: true });
  }

  // ——— Formulary, lab & imaging catalogs ———
  await prisma.simDrug.createMany({
    data: DRUGS.map((d: any) => ({
      name: d.name, generic: d.generic, drugClass: d.drug_class, forms: d.forms,
      adultDose: d.adult_dose, maxDose: d.max_dose ?? null, renalNote: d.renal_note ?? null,
      hepaticNote: d.hepatic_note ?? null, pregnancyCategory: d.pregnancy_category ?? null,
      interactions: JSON.stringify(d.interactions ?? []), contraindications: JSON.stringify(d.contraindications ?? []),
      allergyTags: JSON.stringify(d.allergy_tags ?? []), highAlert: !!d.high_alert,
    })),
    skipDuplicates: true,
  });
  await prisma.simLabItem.createMany({
    data: LABS.map(([key, name, category, unit, refRange, turnaround, container]: any[]) => ({
      key, name, category, unit: unit ?? null, refRange, turnaroundMin: turnaround ?? 45, container: container ?? null,
    })),
    skipDuplicates: true,
  });
  await prisma.simImagingItem.createMany({
    data: IMAGING.map(([key, name, modality, category, turnaround, requiresJustify]: any[]) => ({
      key, name, modality, category, turnaroundMin: turnaround ?? 30, requiresJustify: !!requiresJustify,
    })),
    skipDuplicates: true,
  });

  // ——— Cases ———
  await prisma.simCase.createMany({
    data: CASES.map((c: any) => ({
      key: c.key, title: c.title, specialty: c.specialty, difficulty: c.difficulty,
      scenarioType: c.scenario_type, description: c.description, status: "published",
      scenario: JSON.stringify(c.scenario),
    })),
    skipDuplicates: true,
  });

  // ——— Demo users (password: medic1905) ———
  const pw = bcrypt.hashSync("medic1905", 10);
  const demoUsers: [string, string, string, string][] = [
    ["admin@medic1905.sim", "Dr. Adaora Nkemelu", "admin", "master"],
    ["instructor@medic1905.sim", "Prof. Marcus Aurelius Reyes", "instructor", "consultant"],
    ["student@medic1905.sim", "Yuki Tanaka", "student", "year 3"],
    ["intern@medic1905.sim", "Karim Aziz", "intern", "foundation year 1"],
    ["resident@medic1905.sim", "Elena Petrova", "resident", "IMT2"],
    ["nurse@medic1905.sim", "Sister Mary Ochieng", "nurse", "senior"],
    ["pharmacist@medic1905.sim", "Dr. Jonas Weber", "pharmacist", "senior"],
    ["surgeon@medic1905.sim", "Mr. Rafael Delgado", "surgeon", "consultant"],
    ["radiologist@medic1905.sim", "Dr. Aisha Mbeki", "radiologist", "consultant"],
    ["lab@medic1905.sim", "Dr. Stefan Novak", "lab_scientist", "consultant"],
  ];
  await prisma.simUser.createMany({
    data: demoUsers.map(([email, fullName, role, level]) => ({ email, passwordHash: pw, fullName, role, level })),
    skipDuplicates: true,
  });

  const counts = {
    regions: await prisma.simRegion.count(),
    cities: await prisma.simCity.count(),
    hospitals: await prisma.simHospital.count(),
    departments: await prisma.simDepartment.count(),
    drugs: await prisma.simDrug.count(),
    labs: await prisma.simLabItem.count(),
    imaging: await prisma.simImagingItem.count(),
    cases: await prisma.simCase.count(),
    users: await prisma.simUser.count(),
  };
  console.log("Seeded:", JSON.stringify(counts));
  console.log("Demo login: student@medic1905.sim / medic1905 (also instructor, resident, nurse, pharmacist, surgeon, radiologist, lab, intern, admin)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
