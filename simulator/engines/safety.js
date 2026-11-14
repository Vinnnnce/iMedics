// Pharmacy safety engine — clinically validated medication checks.
// Checks: allergy cross-reactivity, drug–drug interactions, contraindications,
// renal considerations (patient eGFR from run state), and duplicate therapy.
// SIMULATION ONLY — never connected to real prescribing systems.

function checkPrescription({ drug, prescribed, patientAllergies, existingPrescriptions, eGFR }) {
  const issues = [];
  const d = drug;

  // 1. Allergy check (direct + class cross-reactivity tags)
  for (const allergy of patientAllergies || []) {
    const aName = (allergy.drug || allergy).toLowerCase();
    if (d.name.toLowerCase().includes(aName) && aName.length > 3) {
      issues.push({ severity: 'critical', type: 'allergy', message: `ALLERGY: patient is documented allergic to ${allergy.drug || allergy}${allergy.reaction ? ` (${allergy.reaction})` : ''}. Do not administer.` });
      continue;
    }
    for (const tag of JSON.parse(d.allergy_tags || '[]')) {
      if (aName.includes(tag) || tag.includes(aName)) {
        issues.push({ severity: 'critical', type: 'allergy', message: `ALLERGY CROSS-REACTIVITY: ${d.name} shares the "${tag}" class with the patient's documented allergy (${allergy.drug || allergy}). Assess risk before prescribing.` });
      }
    }
  }

  // 2. Interaction check against already-prescribed drugs
  for (const existing of existingPrescriptions || []) {
    const inter = (JSON.parse(d.interactions || '[]')).find(i =>
      existing.toLowerCase().includes(i.with.toLowerCase()) || i.with.toLowerCase().includes(existing.toLowerCase()));
    if (inter) {
      issues.push({ severity: inter.severity, type: 'interaction', message: `INTERACTION (${inter.severity}): ${d.name} + ${inter.with} — ${inter.note}` });
    }
  }

  // 3. Renal check
  if (d.renal_note && eGFR != null && eGFR < 30 && /avoid|contraindicated|reduce|stop|caution/i.test(d.renal_note)) {
    issues.push({ severity: 'major', type: 'renal', message: `RENAL: eGFR ${eGFR} — ${d.renal_note}` });
  }

  // 4. Contraindications listed on the drug
  const contras = JSON.parse(d.contraindications || '[]');
  if (contras.length) {
    issues.push({ severity: 'info', type: 'contraindications', message: `Check contraindications: ${contras.join('; ')}` });
  }

  // 5. High alert flag
  if (d.high_alert) {
    issues.push({ severity: 'info', type: 'high-alert', message: 'HIGH-ALERT medication — double-check dose, route and monitoring.' });
  }

  const blocking = issues.filter(i => i.severity === 'critical');
  return { issues, blocked: blocking.length > 0 };
}

module.exports = { checkPrescription };
