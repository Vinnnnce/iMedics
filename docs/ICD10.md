# ICD-10 coding

## What clinicians see

On **Write Consultation**, the *Diagnosis (ICD-10)* field is a searchable single-select:

- Search by code (`I10`, `e11.9`, `E119` all work) or by words (`hypertension`, `type 2 diabetes`).
- Results show `code — description`, e.g. `I10 — Essential (primary) hypertension`, ranked: exact code, code prefix, then description matches.
- Select one diagnosis; selecting another replaces the current one. A diagnosis is required to finalise a report.
- Only **assignable** (leaf-level) codes can be selected. Parent categories such as `E11` are searchable for navigation but not selectable.

`consultations.diagnosis` keeps the diagnosis wording for lists and the AI pipeline; the code and its description snapshot are in `consultation_diagnoses`.

## Which list is used

Every imported list is a row in `code_system_releases` (system, edition, jurisdiction, label, source, code count, import time, `is_active`). Exactly one ICD-10 release is active; clinicians search only that one. The default is **WHO ICD-10, 2019 edition** (12,246 codes, 10,658 assignable), converted from the WHO classification.

Each saved diagnosis stores the `release_id`, the code and the description as they were at the time, so importing a newer edition never changes existing records.

> Licensing: ICD-10 is published by the World Health Organization. Check WHO's terms of use for your deployment (commercial use may require permission) before going live.

## Keeping it up to date

1. Convert the new release to the JSON shape below (e.g. a newer WHO edition, or a national modification such as ICD-10-CM).
2. Import and activate it:

   ```bash
   npm run icd10:import -- --file path/to/icd10-2025.json --edition 2025 --jurisdiction WHO \
     --label "ICD-10 (WHO, 2025 edition)" --source-url https://... --activate
   ```

3. Clinicians pick from the new list immediately. Importing the same edition and jurisdiction again replaces that release's codes (safe to repeat).

Without `--activate`, the release is imported but the current one stays active (the very first import is activated automatically).

### JSON shape

```json
[
  { "code": "I10", "description": "Essential (primary) hypertension",
    "chapter": "IX", "chapterTitle": "Diseases of the circulatory system",
    "block": "I10-I15", "parent": null, "selectable": true }
]
```

`code` is unique within a file; `selectable` is true for leaf codes; `parent`, `chapter`, `chapterTitle` and `block` are optional.

## Search design

`icd10_codes.code_normalized` holds the code without the dot, upper-case, so `A000` finds `A00.0`. Search uses that column for code prefixes and a case-insensitive `contains` on the description for words, restricted to the active release and assignable codes, and is served by `GET /api/icd10?q=` (doctors and admins only). For very large national lists, add a `pg_trgm` index on `description`.
