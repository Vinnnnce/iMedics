/**
 * One-time recovery for databases where the 20261016234824_facility_portfolio_staff_split
 * migration failed partway (duplicate `payments.commission_amount` column) and left the
 * schema half-applied: the enums and the `lab_staff_profiles` / `facility_services` /
 * `facility_bookings` columns exist, but `audit_logs.facility_id`, the facility tables,
 * indexes, foreign keys and the audit-log backfill were never created. A database in this
 * state makes `migrate deploy` refuse to run ("migrations found in failed state") and makes
 * registration (and every other audited write) fail with P2022 -> "Internal server error",
 * because the Prisma client expects `audit_logs.facility_id` to exist.
 *
 * This script completes the missing DDL idempotently (every statement is guarded, so it is
 * safe to re-run and safe on databases in slightly different partial states), then tells
 * you how to repair the migration bookkeeping.
 *
 * Run with:  npm run db:recover-facility
 * (Node >= 22.12; reads .env via --env-file; connects with DIRECT_URL, falling back to
 * DATABASE_URL — the same URLs `prisma migrate deploy` uses.)
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const MIGRATION = "20261016234824_facility_portfolio_staff_split";
const MIGRATION_FILE = path.join("prisma", "migrations", MIGRATION, "migration.sql");

// The failure state this script can repair, exactly as reproduced from the original
// migration run: the statements before the failing `payments` ALTER were applied, the
// statements after it were not. Anything else is refused rather than guessed at.
const PARTIAL_SIGNATURE = {
  applied: [
    ["lab_staff_profiles", "slug"],
    ["lab_staff_profiles", "is_published"],
    ["facility_services", "branch_id"],
    ["facility_bookings", "assigned_staff_id"],
  ],
  missing: [
    ["audit_logs", "facility_id"],
    ["facility_staff", null],
  ],
} as const;

// Everything the migration should have created that the failed run did not.
const REQUIRED_AFTER = [
  ["audit_logs", "facility_id"],
  ["payments", "commission_bps"],
  ["facility_services", "branch_label"],
  ["facility_staff", null],
  ["facility_branches", null],
  ["facility_departments", null],
  ["staff_credentials", null],
  ["facility_referrals", null],
  ["facility_accreditations", null],
] as const;

const connectionString =
  process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set DIRECT_URL (or DATABASE_URL) to the database you want to recover.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString, max: 1 });
const client = await pool.connect();

const columnExists = async (table: string, column: string) => {
  const res = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return res.rowCount === 1;
};

const tableExists = async (table: string) => {
  const res = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  return res.rowCount === 1;
};

try {
  // --- Inspect the migration bookkeeping (deterministically: latest attempt wins) --------
  const record = (
    await client.query(
      `SELECT finished_at, rolled_back_at FROM _prisma_migrations
       WHERE migration_name = $1 ORDER BY started_at DESC LIMIT 1`,
      [MIGRATION],
    )
  ).rows[0];

  if (!record) {
    console.log(
      `${MIGRATION} was never attempted on this database, so there is nothing half-applied to recover. Run \`npm run db:deploy\` — the fixed migration file applies cleanly to a database that never reached the failing statement.`,
    );
    process.exit(0);
  }

  if (record.finished_at && !record.rolled_back_at) {
    console.log(
      `${MIGRATION} is already recorded as applied. Nothing to recover — run \`npm run db:deploy\` to confirm no migrations are pending.`,
    );
    process.exit(0);
  }

  // --- Verify the database matches the known partial state before touching it -------------
  for (const [table, column] of PARTIAL_SIGNATURE.applied) {
    if (!(await columnExists(table, column))) {
      console.error(
        `Refusing to continue: ${table}.${column} is missing, so this database is not in the known partial state (the failed run got further or less far than expected). This script only completes the reproduced failure state — inspect the database and the failed migration record manually.`,
      );
      process.exit(1);
    }
  }
  for (const [table, column] of PARTIAL_SIGNATURE.missing) {
    const present = column ? await columnExists(table, column) : await tableExists(table);
    if (present) {
      console.error(
        `Refusing to continue: ${column ? `${table}.${column}` : table} already exists, so this database is not in the known partial state. This script only completes the reproduced failure state — inspect the database and the failed migration record manually.`,
      );
      process.exit(1);
    }
  }

  // --- Complete the migration atomically ------------------------------------------------
  await client.query("BEGIN");
  try {
      // Enum types: guarded so they are skipped when the failed attempt already created them.
      const enums: Array<[string, string]> = [
        ["OwnershipType", "('PRIVATE', 'PUBLIC', 'FAITH_BASED', 'GROUP_PRACTICE')"],
        [
          "FacilityStaffRole",
          "('OWNER', 'FACILITY_MANAGER', 'DOCTOR', 'LAB_SCIENTIST', 'LAB_TECHNICIAN', 'LAB_ASSISTANT', 'PHLEBOTOMIST', 'NURSE', 'RADIOGRAPHER', 'RECEPTIONIST', 'ACCOUNTANT', 'COMPLIANCE_OFFICER')",
        ],
        ["FacilityStaffStatus", "('INVITED', 'ACTIVE', 'SUSPENDED', 'ON_LEAVE', 'TERMINATED')"],
        ["EmploymentType", "('FULL_TIME', 'PART_TIME', 'LOCUM', 'CONTRACT', 'VOLUNTEER')"],
        [
          "StaffCredentialType",
          "('MEDICAL_LICENCE', 'NURSING_LICENCE', 'LAB_SCIENTIST_REGISTRATION', 'RADIOGRAPHER_LICENCE', 'PROFESSIONAL_CERTIFICATION', 'TRAINING_CERTIFICATE')",
        ],
        ["CredentialVerificationStatus", "('UNVERIFIED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED')"],
        ["CredentialRenewalStatus", "('CURRENT', 'RENEWAL_DUE', 'RENEWAL_IN_PROGRESS', 'LAPSED')"],
        ["ReferralStatus", "('PENDING', 'ACCEPTED', 'DECLINED', 'FULFILLED')"],
        [
          "FacilityBookingWorkflowStage",
          "('BOOKED', 'CHECKED_IN', 'SAMPLE_COLLECTED', 'SAMPLE_RECEIVED', 'PROCESSING', 'RESULT_ENTERED', 'VERIFIED', 'APPROVED', 'PROCEDURE_COMPLETED', 'IMAGES_UPLOADED', 'REPORT_DRAFTED', 'REVIEWED', 'RELEASED', 'AMENDED', 'ARCHIVED')",
        ],
        ["SettlementMode", "('PLATFORM_HELD', 'SPLIT_SUBACCOUNT')"],
      ];
      for (const [name, values] of enums) {
        await client.query(
          `DO $$ BEGIN CREATE TYPE "${name}" AS ENUM ${values}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
        );
      }

      // facility_services.branch was renamed to branch_label by the fixed migration; the
      // failed attempt never reached the rename, so it is applied here when still needed.
      if (await columnExists("facility_services", "branch")) {
        await client.query(`ALTER TABLE "facility_services" RENAME COLUMN "branch" TO "branch_label"`);
      }

      await client.query(`ALTER TABLE "facility_services"
        ADD COLUMN IF NOT EXISTS "branch_id" UUID,
        ADD COLUMN IF NOT EXISTS "department_id" UUID,
        ADD COLUMN IF NOT EXISTS "home_collection_available" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "preparation_instructions" TEXT,
        ADD COLUMN IF NOT EXISTS "referral_required" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "urgent_available" BOOLEAN NOT NULL DEFAULT false`);

      await client.query(`ALTER TABLE "facility_bookings"
        ADD COLUMN IF NOT EXISTS "assigned_staff_id" UUID,
        ADD COLUMN IF NOT EXISTS "referral_document_key" TEXT,
        ADD COLUMN IF NOT EXISTS "released_at" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "report_document_key" TEXT,
        ADD COLUMN IF NOT EXISTS "workflow_stage" "FacilityBookingWorkflowStage" NOT NULL DEFAULT 'BOOKED',
        ADD COLUMN IF NOT EXISTS "workflow_updated_at" TIMESTAMP(3)`);

      // Only the facility-specific snapshot columns: commission_amount / subaccount_code
      // already exist from the payments_platform migration (this is what broke the original
      // migration run).
      await client.query(`ALTER TABLE "payments"
        ADD COLUMN IF NOT EXISTS "commission_bps" INTEGER,
        ADD COLUMN IF NOT EXISTS "net_amount" DECIMAL(12,2),
        ADD COLUMN IF NOT EXISTS "settlementMode" "SettlementMode"`);

      await client.query(`ALTER TABLE "audit_logs"
        ADD COLUMN IF NOT EXISTS "facility_id" UUID,
        ADD COLUMN IF NOT EXISTS "outcome" VARCHAR(16),
        ADD COLUMN IF NOT EXISTS "patient_id" UUID`);

      await client.query(`CREATE TABLE IF NOT EXISTS "facility_branches" (
        "id" UUID NOT NULL,
        "facility_id" UUID NOT NULL,
        "name" TEXT NOT NULL,
        "address_line" TEXT,
        "city" TEXT,
        "state" TEXT,
        "phone" VARCHAR(40),
        "email" VARCHAR(120),
        "opening_hours" TEXT,
        "is_primary" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "facility_branches_pkey" PRIMARY KEY ("id")
      )`);

      await client.query(`CREATE TABLE IF NOT EXISTS "facility_departments" (
        "id" UUID NOT NULL,
        "facility_id" UUID NOT NULL,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "description" TEXT,
        "opening_hours" TEXT,
        "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
        "lead_staff_id" UUID,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "facility_departments_pkey" PRIMARY KEY ("id")
      )`);

      await client.query(`CREATE TABLE IF NOT EXISTS "facility_staff" (
        "id" UUID NOT NULL,
        "facility_id" UUID NOT NULL,
        "user_id" UUID,
        "email" VARCHAR(120) NOT NULL,
        "full_name" VARCHAR(120) NOT NULL,
        "facilityRole" "FacilityStaffRole" NOT NULL,
        "department_id" UUID,
        "branch_id" UUID,
        "employmentType" "EmploymentType",
        "status" "FacilityStaffStatus" NOT NULL DEFAULT 'INVITED',
        "invite_token" VARCHAR(64),
        "invite_expires_at" TIMESTAMP(3),
        "invited_by_id" UUID,
        "accepted_at" TIMESTAMP(3),
        "public_profile_visible" BOOLEAN NOT NULL DEFAULT false,
        "profile_consent" BOOLEAN NOT NULL DEFAULT false,
        "profile_consent_at" TIMESTAMP(3),
        "booking_eligible" BOOLEAN NOT NULL DEFAULT false,
        "professional_title" VARCHAR(120),
        "photo_url" VARCHAR(500),
        "qualifications" TEXT,
        "specialty" TEXT,
        "years_experience" INTEGER,
        "bio" TEXT,
        "linkedin_url" VARCHAR(300),
        "linkedin_public" BOOLEAN NOT NULL DEFAULT false,
        "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
        "last_login_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "facility_staff_pkey" PRIMARY KEY ("id")
      )`);

      await client.query(`CREATE TABLE IF NOT EXISTS "staff_credentials" (
        "id" UUID NOT NULL,
        "staff_id" UUID NOT NULL,
        "type" "StaffCredentialType" NOT NULL,
        "number" VARCHAR(80) NOT NULL,
        "authority" VARCHAR(160) NOT NULL,
        "issue_date" DATE,
        "expiry_date" DATE,
        "verification_status" "CredentialVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
        "verified_by_id" UUID,
        "verified_at" TIMESTAMP(3),
        "document_key" TEXT,
        "restrictions" TEXT,
        "renewal_status" "CredentialRenewalStatus" NOT NULL DEFAULT 'CURRENT',
        "last_reminder_stage" INTEGER,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "staff_credentials_pkey" PRIMARY KEY ("id")
      )`);

      await client.query(`CREATE TABLE IF NOT EXISTS "facility_referrals" (
        "id" UUID NOT NULL,
        "facility_id" UUID NOT NULL,
        "from_doctor_id" UUID NOT NULL,
        "patient_id" UUID NOT NULL,
        "case_id" UUID,
        "service_id" UUID,
        "note" TEXT,
        "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
        "handled_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "facility_referrals_pkey" PRIMARY KEY ("id")
      )`);

      await client.query(`CREATE TABLE IF NOT EXISTS "facility_accreditations" (
        "id" UUID NOT NULL,
        "facility_id" UUID NOT NULL,
        "name" TEXT NOT NULL,
        "issuer" TEXT NOT NULL,
        "issued_at" TIMESTAMP(3),
        "expires_at" TIMESTAMP(3),
        "document_key" TEXT,
        "verified" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "facility_accreditations_pkey" PRIMARY KEY ("id")
      )`);

      const indexes: string[] = [
        `CREATE INDEX IF NOT EXISTS "facility_branches_facility_id_idx" ON "facility_branches"("facility_id")`,
        `CREATE INDEX IF NOT EXISTS "facility_departments_facility_id_idx" ON "facility_departments"("facility_id")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "facility_departments_facility_id_slug_key" ON "facility_departments"("facility_id", "slug")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "facility_staff_user_id_key" ON "facility_staff"("user_id")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "facility_staff_invite_token_key" ON "facility_staff"("invite_token")`,
        `CREATE INDEX IF NOT EXISTS "facility_staff_facility_id_status_idx" ON "facility_staff"("facility_id", "status")`,
        `CREATE INDEX IF NOT EXISTS "facility_staff_user_id_idx" ON "facility_staff"("user_id")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "facility_staff_facility_id_email_key" ON "facility_staff"("facility_id", "email")`,
        `CREATE INDEX IF NOT EXISTS "staff_credentials_staff_id_idx" ON "staff_credentials"("staff_id")`,
        `CREATE INDEX IF NOT EXISTS "staff_credentials_expiry_date_idx" ON "staff_credentials"("expiry_date")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "staff_credentials_staff_id_type_number_key" ON "staff_credentials"("staff_id", "type", "number")`,
        `CREATE INDEX IF NOT EXISTS "facility_referrals_facility_id_status_idx" ON "facility_referrals"("facility_id", "status")`,
        `CREATE INDEX IF NOT EXISTS "facility_referrals_from_doctor_id_idx" ON "facility_referrals"("from_doctor_id")`,
        `CREATE INDEX IF NOT EXISTS "facility_referrals_patient_id_idx" ON "facility_referrals"("patient_id")`,
        `CREATE INDEX IF NOT EXISTS "facility_accreditations_facility_id_idx" ON "facility_accreditations"("facility_id")`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "lab_staff_profiles_slug_key" ON "lab_staff_profiles"("slug")`,
        `CREATE INDEX IF NOT EXISTS "lab_staff_profiles_is_published_idx" ON "lab_staff_profiles"("is_published")`,
        `CREATE INDEX IF NOT EXISTS "facility_bookings_workflow_stage_idx" ON "facility_bookings"("workflow_stage")`,
        `CREATE INDEX IF NOT EXISTS "audit_logs_facility_id_created_at_idx" ON "audit_logs"("facility_id", "created_at")`,
        `CREATE INDEX IF NOT EXISTS "audit_logs_patient_id_idx" ON "audit_logs"("patient_id")`,
      ];
      for (const stmt of indexes) await client.query(stmt);

      // Foreign keys: guarded because Postgres has no ADD CONSTRAINT IF NOT EXISTS.
      const foreignKeys: string[] = [
        `ALTER TABLE "facility_branches" ADD CONSTRAINT "facility_branches_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
        `ALTER TABLE "facility_departments" ADD CONSTRAINT "facility_departments_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
        `ALTER TABLE "facility_departments" ADD CONSTRAINT "facility_departments_lead_staff_id_fkey" FOREIGN KEY ("lead_staff_id") REFERENCES "facility_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE "facility_staff" ADD CONSTRAINT "facility_staff_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
        `ALTER TABLE "facility_staff" ADD CONSTRAINT "facility_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE "facility_staff" ADD CONSTRAINT "facility_staff_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "facility_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE "facility_staff" ADD CONSTRAINT "facility_staff_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "facility_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE "staff_credentials" ADD CONSTRAINT "staff_credentials_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "facility_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
        `ALTER TABLE "staff_credentials" ADD CONSTRAINT "staff_credentials_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "facility_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE "facility_referrals" ADD CONSTRAINT "facility_referrals_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
        `ALTER TABLE "facility_referrals" ADD CONSTRAINT "facility_referrals_from_doctor_id_fkey" FOREIGN KEY ("from_doctor_id") REFERENCES "doctor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
        `ALTER TABLE "facility_referrals" ADD CONSTRAINT "facility_referrals_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
        `ALTER TABLE "facility_referrals" ADD CONSTRAINT "facility_referrals_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "care_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE "facility_referrals" ADD CONSTRAINT "facility_referrals_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "facility_services"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE "facility_accreditations" ADD CONSTRAINT "facility_accreditations_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "lab_staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
        `ALTER TABLE "facility_services" ADD CONSTRAINT "facility_services_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "facility_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE "facility_services" ADD CONSTRAINT "facility_services_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "facility_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_assigned_staff_id_fkey" FOREIGN KEY ("assigned_staff_id") REFERENCES "facility_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
      ];
      for (const stmt of foreignKeys) {
        await client.query(
          `DO $$ BEGIN ${stmt}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
        );
      }

      // Backfill: every existing facility owner becomes an OWNER staff member of their
      // facility (same statement as the fixed migration; safe to re-run).
      await client.query(`INSERT INTO facility_staff (id, facility_id, user_id, email, full_name, "facilityRole", status, accepted_at, created_at, updated_at)
        SELECT
          gen_random_uuid(),
          p.id,
          p.user_id,
          u.email,
          COALESCE(NULLIF(p."laboratory_name", ''), u.name),
          'OWNER',
          'ACTIVE',
          p.created_at,
          NOW(),
          NOW()
        FROM lab_staff_profiles p
        JOIN users u ON u.id = p.user_id
        ON CONFLICT DO NOTHING`);

      // Audit log immutability: block UPDATE and DELETE at the database level.
      await client.query(`CREATE OR REPLACE FUNCTION medic1905_audit_logs_append_only() RETURNS trigger AS $fn$
        BEGIN
          RAISE EXCEPTION 'audit_logs is append-only (attempted %)', TG_OP;
        END;
      $fn$ LANGUAGE plpgsql`);
      await client.query(`DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs`);
      await client.query(`CREATE TRIGGER audit_logs_append_only
        BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION medic1905_audit_logs_append_only()`);

      // --- Verify the recovered schema before committing --------------------------------
      for (const [table, column] of REQUIRED_AFTER) {
        const present = column ? await columnExists(table, column) : await tableExists(table);
        if (!present) {
          throw new Error(
            `recovery incomplete: ${column ? `${table}.${column}` : table} still missing after applying the DDL`,
          );
        }
      }

      await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  // --- Report ---------------------------------------------------------------------------
  console.log("Recovery complete — the facility schema is present.");
  const fileChecksum = createHash("sha256")
    .update(readFileSync(MIGRATION_FILE))
    .digest("hex");
  console.log(
    `\nThis script only repairs the schema; it does not touch the migration bookkeeping or run deployments. Finish the recovery with:\n`,
  );
  console.log(`  npx prisma migrate resolve --applied ${MIGRATION}`);
  console.log(`  npm run db:deploy`);
  console.log(
    `\nThe --applied mark is accurate because this script applied the migration's DDL; it uses the current file's checksum (${fileChecksum.slice(0, 12)}…).`,
  );
  console.log(
    `\nFinally, verify facility registration end-to-end (create a hospital, laboratory or diagnostic centre).`,
  );
} finally {
  client.release();
  await pool.end();
}
