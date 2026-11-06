-- Super Admin Control Centre: platform administrative organization, granular
-- roles/permissions, approval workflows, security incidents, global specialty
-- catalogue and platform settings. Additive only — no existing table or row is
-- rewritten, and none of these entities ever grants clinical privileges.

CREATE TABLE "admin_departments" (
  "id" UUID PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '',
  "parent_id" UUID REFERENCES "admin_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "rank" INTEGER NOT NULL DEFAULT 0, "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "admin_departments_parent_id_idx" ON "admin_departments"("parent_id");

CREATE TABLE "admin_teams" (
  "id" UUID PRIMARY KEY, "department_id" UUID REFERENCES "admin_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '',
  "leader_membership_id" UUID,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "admin_memberships" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "department_id" UUID REFERENCES "admin_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "team_id" UUID REFERENCES "admin_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "reports_to_id" UUID,
  "title" TEXT NOT NULL, "responsibilities" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE','SUSPENDED','ENDED')),
  "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "ends_at" TIMESTAMP(3),
  "created_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at")
);
CREATE INDEX "admin_memberships_user_id_idx" ON "admin_memberships"("user_id");
CREATE INDEX "admin_memberships_status_ends_at_idx" ON "admin_memberships"("status", "ends_at");
ALTER TABLE "admin_memberships" ADD CONSTRAINT "admin_memberships_reports_to_id_fkey"
  FOREIGN KEY ("reports_to_id") REFERENCES "admin_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admin_teams" ADD CONSTRAINT "admin_teams_leader_membership_id_fkey"
  FOREIGN KEY ("leader_membership_id") REFERENCES "admin_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "admin_roles" (
  "id" UUID PRIMARY KEY, "key" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '',
  "department_id" UUID REFERENCES "admin_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "system" BOOLEAN NOT NULL DEFAULT false, "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "admin_role_permissions" (
  "id" UUID PRIMARY KEY, "role_id" UUID NOT NULL REFERENCES "admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "permission_key" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("role_id", "permission_key")
);

CREATE TABLE "admin_role_assignments" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "role_id" UUID NOT NULL REFERENCES "admin_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "membership_id" UUID REFERENCES "admin_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "assigned_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "reason" TEXT NOT NULL, "expires_at" TIMESTAMP(3), "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "admin_role_assignments_user_id_idx" ON "admin_role_assignments"("user_id");

CREATE TABLE "admin_permission_overrides" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "permission_key" TEXT NOT NULL,
  "effect" TEXT NOT NULL CHECK ("effect" IN ('GRANT','DENY')),
  "reason" TEXT NOT NULL, "expires_at" TIMESTAMP(3),
  "created_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "admin_permission_overrides_user_id_permission_key_idx" ON "admin_permission_overrides"("user_id", "permission_key");

CREATE TABLE "approval_workflows" (
  "id" UUID PRIMARY KEY, "action_key" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "approver_role_key" TEXT NOT NULL, "second_approver_role_key" TEXT,
  "requires_reauth" BOOLEAN NOT NULL DEFAULT true, "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "approval_requests" (
  "id" UUID PRIMARY KEY,
  "workflow_id" UUID NOT NULL REFERENCES "approval_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "action_key" TEXT NOT NULL, "requester_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "payload" JSONB NOT NULL, "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  "decided_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "approval_requests_status_created_at_idx" ON "approval_requests"("status", "created_at");

CREATE TABLE "approval_decisions" (
  "id" UUID PRIMARY KEY,
  "request_id" UUID NOT NULL REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "decider_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "decision" TEXT NOT NULL CHECK ("decision" IN ('APPROVE','REJECT')), "reason" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("request_id", "decider_id")
);

CREATE TABLE "security_incidents" (
  "id" UUID PRIMARY KEY,
  "kind" TEXT NOT NULL, "severity" TEXT NOT NULL CHECK ("severity" IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  "title" TEXT NOT NULL, "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN','INVESTIGATING','CONTAINED','RESOLVED')),
  "reported_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "assigned_to_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "resolution" TEXT, "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "security_incidents_status_created_at_idx" ON "security_incidents"("status", "created_at");

CREATE TABLE "global_specialties" (
  "id" UUID PRIMARY KEY, "name" TEXT NOT NULL UNIQUE,
  "category" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "platform_settings" (
  "key" TEXT PRIMARY KEY, "value" JSONB NOT NULL, "description" TEXT NOT NULL DEFAULT '',
  "updated_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed: recommended departments, roles with permission sets, approval gates and
-- the standard specialty catalogue (spec §2.1, §3, §7, §18). Idempotent — the
-- Super Admin can rename, combine or remove any of these afterwards.
INSERT INTO "admin_departments" ("id","name","description","rank") VALUES ('4f9bb6d3-90ef-4e96-96c2-b2f637e4057f','Executive Leadership','Platform owner, deputy, chief officers and master governance.',0) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "admin_departments" ("id","name","description","rank") VALUES ('2fee56c3-258f-4a69-9bd5-698b366fb137','Platform Administration','Platform configuration and operations.',10) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "admin_departments" ("id","name","description","rank") VALUES ('38bcd37c-469d-41e2-9e89-50c2b62f3150','Technical Support','Technical support and troubleshooting.',20) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "admin_departments" ("id","name","description","rank") VALUES ('46085ddc-ddc7-4a71-baa1-c262d3d44baf','User & Facility Management','Accounts, verification and facility registration.',30) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "admin_departments" ("id","name","description","rank") VALUES ('8b0267d4-e7c4-4ce5-b633-7f14ceb3d71d','Clinical Governance','Clinical standards, informatics and governance.',40) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "admin_departments" ("id","name","description","rank") VALUES ('ca744ba8-b775-4b1f-a459-2c76771d45c6','Finance & Subscriptions','Billing, subscriptions and payments.',50) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "admin_departments" ("id","name","description","rank") VALUES ('ee35aefa-c494-4802-91f2-5f874723b9de','Security & Compliance','Security policies, privacy and compliance reviews.',60) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "admin_departments" ("id","name","description","rank") VALUES ('aacde6dc-fff5-4167-a207-5288d99bb5a6','Data & Analytics','Reports, usage statistics and analytics.',70) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "admin_departments" ("id","name","description","rank") VALUES ('43212e82-c071-435d-b8fd-4ac3759074e9','Training & Onboarding','User onboarding and training.',80) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "admin_departments" ("id","name","description","rank") VALUES ('865dc40c-608b-4986-a7f5-03f8973e7851','Quality Assurance','Testing, quality and issue tracking.',90) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "admin_departments" ("id","name","description","rank") VALUES ('e2967dd9-ae73-4b08-9db0-2f63b97177a0','Integrations & API Management','API and external system integrations.',100) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('767dbc2e-f117-4d57-9a62-9e145445b4a2','SUPER_ADMIN','Super Admin','Global platform governance and master settings. Requires an explicit Super Administrator grant; the role alone is directory metadata.','4f9bb6d3-90ef-4e96-96c2-b2f637e4057f',true,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('9cb1f39e-23e0-4315-9a27-3742770c8fd2','DEPUTY_SUPER_ADMIN','Deputy Super Admin','Delegated platform administration across teams, facilities and operations.','4f9bb6d3-90ef-4e96-96c2-b2f637e4057f',false,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('d60b8f9d-6e98-4598-970d-99cd1c187f29','CTO','Chief Technology Officer','Technical architecture and infrastructure. No default clinical-record access.','4f9bb6d3-90ef-4e96-96c2-b2f637e4057f',false,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('83efdf1e-3cb0-4282-b8bd-5eef66e518eb','PLATFORM_ADMIN','Platform Administrator','Platform configuration and operations within an assigned scope.','2fee56c3-258f-4a69-9bd5-698b366fb137',false,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('1573e5d0-e292-4ada-9cde-69ada72fc8af','FACILITY_ADMIN','Facility Administrator','Facility registration and account administration.','46085ddc-ddc7-4a71-baa1-c262d3d44baf',false,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('062dc32b-da5f-4f79-8dc7-86c9ec25e0ce','USER_MGMT_OFFICER','User Management Officer','User accounts and verification. Cannot view patient medical records.','46085ddc-ddc7-4a71-baa1-c262d3d44baf',false,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('830c5bb9-69f6-42f2-bf1d-d8d706a00bde','CLINICAL_GOVERNANCE','Clinical Governance Officer','Clinical standards and governance. Clinical-record access only within an approved, audited scope.','8b0267d4-e7c4-4ce5-b633-7f14ceb3d71d',false,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('adaca43c-1e8a-4cf8-baa2-d6bfe044a4f5','MEDICAL_INFORMATICS','Medical Informatics Officer','Clinical workflows and medical terminology.','8b0267d4-e7c4-4ce5-b633-7f14ceb3d71d',false,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('e7fefff7-fd73-44d0-b634-fb051f877134','DATA_PROTECTION_OFFICER','Data Protection Officer','Privacy, data protection and access reviews.','ee35aefa-c494-4802-91f2-5f874723b9de',false,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('da1c112f-83a7-49e1-9fc8-8213eb1c0615','SECURITY_ADMIN','Security Administrator','Security policies and incident management.','ee35aefa-c494-4802-91f2-5f874723b9de',false,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('f0e51130-dd33-44cc-9607-5cfed841f33b','TECH_SUPPORT_OFFICER','Technical Support Officer','Technical support and troubleshooting. Account status only — no patient records.','38bcd37c-469d-41e2-9e89-50c2b62f3150',false,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('73e66013-acb6-476d-8734-9ed0651797e7','FINANCE_ADMIN','Finance Administrator','Billing, subscriptions and payments. Cannot edit clinical reports.','ca744ba8-b775-4b1f-a459-2c76771d45c6',false,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('07f6781c-dff9-4508-90af-4695efd5f359','COMPLIANCE_OFFICER','Compliance Officer','Compliance documentation and reviews.','ee35aefa-c494-4802-91f2-5f874723b9de',false,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('36088172-1be2-4bbb-9437-42bd2bd1a439','QA_OFFICER','Quality Assurance Officer','Testing, quality and issue tracking.','865dc40c-608b-4986-a7f5-03f8973e7851',false,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('4833dc57-7346-413b-9437-db8562df8b85','INTEGRATION_ADMIN','Integration Administrator','API and external system integrations.','e2967dd9-ae73-4b08-9db0-2f63b97177a0',false,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('da0da2b0-3145-4047-b49d-d87b81db14e3','TRAINING_ADMIN','Training Administrator','User onboarding and training.','43212e82-c071-435d-b8fd-4ac3759074e9',false,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_roles" ("id","key","name","description","department_id","system","active") VALUES ('4098ac2b-dddd-4fb8-8d4c-74f5b4de643a','ANALYTICS_ADMIN','Analytics Administrator','Reports, usage statistics and analytics. De-identified data by default.','aacde6dc-fff5-4167-a207-5288d99bb5a6',false,true) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('e313e0b1-14c7-48ec-8301-d8c00dc1f0dc','767dbc2e-f117-4d57-9a62-9e145445b4a2','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('196e80bb-8bd1-4ed2-8322-4c6323c5b63a','767dbc2e-f117-4d57-9a62-9e145445b4a2','OVERVIEW:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('95493bf0-3e03-498c-87d5-e52b639d2dfa','767dbc2e-f117-4d57-9a62-9e145445b4a2','USERS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('cdcecf4e-2d6b-410e-ba86-961dd4ff3365','767dbc2e-f117-4d57-9a62-9e145445b4a2','USERS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('5fb6ea47-4c7e-4467-aca2-a318209ec862','767dbc2e-f117-4d57-9a62-9e145445b4a2','USERS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('2a7b1fab-de30-4330-a546-805ec8548ea8','767dbc2e-f117-4d57-9a62-9e145445b4a2','USERS:DELETE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('714b2532-a05d-49e3-a88b-dd865aa72a23','767dbc2e-f117-4d57-9a62-9e145445b4a2','USERS:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('5486053a-c7d8-4209-94c6-d5476015af2a','767dbc2e-f117-4d57-9a62-9e145445b4a2','USERS:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('e6c555b9-fc6f-43a9-ab3e-ca5e6b0ea453','767dbc2e-f117-4d57-9a62-9e145445b4a2','TEAM:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('0ec5179b-ad78-46f9-a7bc-6b7a69ab95dc','767dbc2e-f117-4d57-9a62-9e145445b4a2','TEAM:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('d8595198-089a-4a15-96c1-99b78efb3fe3','767dbc2e-f117-4d57-9a62-9e145445b4a2','TEAM:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('54c6b014-9b84-4183-876a-8d22d54cae8b','767dbc2e-f117-4d57-9a62-9e145445b4a2','TEAM:DELETE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('0b9e1e53-e055-4c9b-96e8-4e79a7590533','767dbc2e-f117-4d57-9a62-9e145445b4a2','TEAM:ASSIGN') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('36001aad-2694-45e3-8774-c3f50cdcb626','767dbc2e-f117-4d57-9a62-9e145445b4a2','TEAM:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('04856567-4a5f-49b3-bc44-8eaf5147a8fd','767dbc2e-f117-4d57-9a62-9e145445b4a2','TEAM:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('f5d8a0aa-a613-4835-8655-b5ca58c25e24','767dbc2e-f117-4d57-9a62-9e145445b4a2','ROLES:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('1c498ee9-768a-4e8f-98a8-5e44c8326a16','767dbc2e-f117-4d57-9a62-9e145445b4a2','ROLES:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('61d74f0d-b7e0-4394-8b6b-1689da874eb1','767dbc2e-f117-4d57-9a62-9e145445b4a2','ROLES:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('28ef0af8-a9c5-4601-8727-ac46f96bc67e','767dbc2e-f117-4d57-9a62-9e145445b4a2','ROLES:DELETE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('6814e8ca-ded5-441b-aa12-d796314555f2','767dbc2e-f117-4d57-9a62-9e145445b4a2','ROLES:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('6150c254-c4c8-482e-bf4c-88dc3073af88','767dbc2e-f117-4d57-9a62-9e145445b4a2','ROLES:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('929a9f60-6932-41bb-a9f7-2b2219dd8915','767dbc2e-f117-4d57-9a62-9e145445b4a2','ROLES:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('72a051ec-bc2a-4c5a-a5f7-190d525c5d8b','767dbc2e-f117-4d57-9a62-9e145445b4a2','APPROVALS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('431fdafd-1dd3-4c03-bfb8-8be4153893f9','767dbc2e-f117-4d57-9a62-9e145445b4a2','APPROVALS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('8bb225da-33ca-4c7c-896d-3787a755eb8f','767dbc2e-f117-4d57-9a62-9e145445b4a2','APPROVALS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('69615446-5c2a-45e2-b712-867885e30d65','767dbc2e-f117-4d57-9a62-9e145445b4a2','APPROVALS:APPROVE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('3d5e813e-a37d-4742-9f01-d127c88ccde0','767dbc2e-f117-4d57-9a62-9e145445b4a2','APPROVALS:REJECT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('fcae6793-eeac-44f2-8263-99e443b34e4c','767dbc2e-f117-4d57-9a62-9e145445b4a2','APPROVALS:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('0cb07517-e4a5-4567-aebe-f664224fa887','767dbc2e-f117-4d57-9a62-9e145445b4a2','FACILITIES:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('101f90c4-5061-48c9-a24e-fe94485fd872','767dbc2e-f117-4d57-9a62-9e145445b4a2','FACILITIES:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('cd5daf19-23ec-402c-bebd-b286d1d0f704','767dbc2e-f117-4d57-9a62-9e145445b4a2','FACILITIES:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('48af4890-7d75-4deb-8ec0-4165e5355153','767dbc2e-f117-4d57-9a62-9e145445b4a2','FACILITIES:DELETE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b57f2375-e0b8-40d2-a4c4-b194796cb00c','767dbc2e-f117-4d57-9a62-9e145445b4a2','FACILITIES:APPROVE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b78b5fa1-6a71-4111-9354-7f4dce527b0d','767dbc2e-f117-4d57-9a62-9e145445b4a2','FACILITIES:REJECT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('aed5952e-e931-4fb9-b491-ce2e3164405e','767dbc2e-f117-4d57-9a62-9e145445b4a2','FACILITIES:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('4494fcf6-8a97-48a7-a0a6-9aeb91b227a9','767dbc2e-f117-4d57-9a62-9e145445b4a2','FACILITIES:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('65c4813f-c564-4d8e-b186-81f7a0edb744','767dbc2e-f117-4d57-9a62-9e145445b4a2','DEPARTMENTS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('d580d25a-5f3d-47c3-ba8b-c41b741c7e83','767dbc2e-f117-4d57-9a62-9e145445b4a2','DEPARTMENTS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('d3163107-2e6f-4a03-9775-0a53d4bfb0dd','767dbc2e-f117-4d57-9a62-9e145445b4a2','DEPARTMENTS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('a66da20f-4f99-4974-b166-84268bbe66a2','767dbc2e-f117-4d57-9a62-9e145445b4a2','DEPARTMENTS:DELETE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('1c479fdc-ca15-4d94-9b9b-8bcc47020b7f','767dbc2e-f117-4d57-9a62-9e145445b4a2','DEPARTMENTS:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('112c608c-669c-4d42-a76c-7566fa3445c3','767dbc2e-f117-4d57-9a62-9e145445b4a2','DEPARTMENTS:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('58d218b6-5af6-478f-a51e-3e3ea0306966','767dbc2e-f117-4d57-9a62-9e145445b4a2','GOVERNANCE:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('5b28baae-dfc6-4d69-92ae-c39c9452ca90','767dbc2e-f117-4d57-9a62-9e145445b4a2','GOVERNANCE:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('49b10f90-07b7-452d-aa57-7895903be072','767dbc2e-f117-4d57-9a62-9e145445b4a2','GOVERNANCE:APPROVE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('76b8372d-0e43-4323-aef0-0a6d6f56cc93','767dbc2e-f117-4d57-9a62-9e145445b4a2','GOVERNANCE:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('38bc6f61-e937-466e-a035-8d630ee881a9','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCUMENTS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('273fa60b-245b-454f-86b7-2ac5baae5bdc','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCUMENTS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('fd7bd699-4d31-49cd-8d9d-16e35a05f773','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCUMENTS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('229ab45a-bba5-45a1-813b-2ed6a6f8e473','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCUMENTS:DELETE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('fdbc9984-a66a-45d4-bece-b2f9b5acb3c9','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCUMENTS:APPROVE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('c77de599-6f42-4d15-a97b-256ba257cafc','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCUMENTS:SIGN') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('13275ef3-9215-4935-858a-bbe5b3e41636','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCUMENTS:RELEASE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('aea0f66b-cdf5-4f05-90d0-6744ac444632','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCUMENTS:DOWNLOAD') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('6035b4cf-d323-4730-a3ef-20a6e848e6c2','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCUMENTS:PRINT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('40c44dde-06cc-4845-b092-c94cb4429b13','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCUMENTS:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('6fa04f5e-b29c-4495-b3fb-0d37a8fc9ad9','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCUMENTS:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('2997b0e7-8394-43cd-b325-c8f0d86dc5d3','767dbc2e-f117-4d57-9a62-9e145445b4a2','PATIENT_ACCOUNTS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('87ade5d1-6b80-42c3-8fc2-224ba32a812d','767dbc2e-f117-4d57-9a62-9e145445b4a2','PATIENT_ACCOUNTS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('714a5637-6a06-4c17-bedb-377badc3852f','767dbc2e-f117-4d57-9a62-9e145445b4a2','PATIENT_ACCOUNTS:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('64721327-e3f0-4e5d-a1c2-c7740ec170d3','767dbc2e-f117-4d57-9a62-9e145445b4a2','PATIENT_ACCOUNTS:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('9d67bcc4-a36c-4fcc-8f5b-0a45419e405b','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCTORS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('c6eeabfc-cca7-4ea1-82a5-21010216b9ab','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCTORS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('03de479e-7add-4794-ac8b-df624765df23','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCTORS:APPROVE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('1cea6104-f4c3-4d5e-841b-b81d4dac46a2','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCTORS:REJECT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('5f68af5d-8fbc-451f-8d0f-00ef6ccc6482','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCTORS:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('7cfb35f5-bbdb-489d-9dcd-ce72eb35e155','767dbc2e-f117-4d57-9a62-9e145445b4a2','DOCTORS:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('db729cd5-c42f-43b2-a63b-60e956dc193f','767dbc2e-f117-4d57-9a62-9e145445b4a2','NURSING:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('dcae5931-e296-4109-b050-e71053af2f27','767dbc2e-f117-4d57-9a62-9e145445b4a2','NURSING:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('799b59f5-17de-4100-b562-20644b3c4f7e','767dbc2e-f117-4d57-9a62-9e145445b4a2','LABORATORY:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('1af3ffd4-95c4-48d7-81ee-9bb8ad0688e6','767dbc2e-f117-4d57-9a62-9e145445b4a2','LABORATORY:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('6bb6a405-48ae-4c38-8d13-6b5e934ab880','767dbc2e-f117-4d57-9a62-9e145445b4a2','RADIOLOGY:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('cf641d35-fe1e-47d2-84e2-5a1eb4a9d8d9','767dbc2e-f117-4d57-9a62-9e145445b4a2','RADIOLOGY:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('dce79c6f-0630-4b97-9795-1040215a9106','767dbc2e-f117-4d57-9a62-9e145445b4a2','PHARMACY:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('882f5047-51d0-48bc-8b0c-802154d18483','767dbc2e-f117-4d57-9a62-9e145445b4a2','PHARMACY:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('9f2f5351-0729-44a3-a4a6-a1f1e73c2b00','767dbc2e-f117-4d57-9a62-9e145445b4a2','MODULES:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('db7d3c49-6eab-4015-81e5-cd979a5da715','767dbc2e-f117-4d57-9a62-9e145445b4a2','MODULES:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('d3f7634e-9491-4bba-a0ca-aa2d78406adf','767dbc2e-f117-4d57-9a62-9e145445b4a2','MODULES:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('09604c17-3778-42c0-bce4-35db3529cafa','767dbc2e-f117-4d57-9a62-9e145445b4a2','SUBSCRIPTIONS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('9e1f95b8-ae10-48da-9d40-fb47a0953198','767dbc2e-f117-4d57-9a62-9e145445b4a2','SUBSCRIPTIONS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('649cd20c-0411-4511-93d1-551d28656e5c','767dbc2e-f117-4d57-9a62-9e145445b4a2','SUBSCRIPTIONS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('7da97364-6543-4877-93b8-51de2b8cde68','767dbc2e-f117-4d57-9a62-9e145445b4a2','SUBSCRIPTIONS:DELETE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('79ac8ec4-5b75-4b80-92c2-79e9b61a56c4','767dbc2e-f117-4d57-9a62-9e145445b4a2','SUBSCRIPTIONS:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('99dabd01-2c54-4b40-921b-dc122cc8bc28','767dbc2e-f117-4d57-9a62-9e145445b4a2','SUBSCRIPTIONS:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('6eccbcfa-5226-44cc-b319-6cd32ae28455','767dbc2e-f117-4d57-9a62-9e145445b4a2','AI:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('62fc6240-6995-44b6-ac5f-d99b490efb6c','767dbc2e-f117-4d57-9a62-9e145445b4a2','AI:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('9180d939-3670-47c0-8352-d842ab38739b','767dbc2e-f117-4d57-9a62-9e145445b4a2','AI:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('0d1eb5ac-5fc4-4f61-8ce5-48fd118ac6c6','767dbc2e-f117-4d57-9a62-9e145445b4a2','INTEGRATIONS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('0191b2b5-6c8d-4bec-aa11-8d2ffd87c294','767dbc2e-f117-4d57-9a62-9e145445b4a2','INTEGRATIONS:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('829c9f9f-9c46-4521-a605-7d61ef1c701d','767dbc2e-f117-4d57-9a62-9e145445b4a2','INTEGRATIONS:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('7c7f6811-c755-48b7-b236-bdcb3a43bb05','767dbc2e-f117-4d57-9a62-9e145445b4a2','ANALYTICS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('c9a3ec41-c382-4568-a59d-a35ea02f0b13','767dbc2e-f117-4d57-9a62-9e145445b4a2','ANALYTICS:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('057669ec-7193-49ce-9123-55c5123fba38','767dbc2e-f117-4d57-9a62-9e145445b4a2','SECURITY:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('3eb052cf-240a-4ae1-9799-c32b788aba23','767dbc2e-f117-4d57-9a62-9e145445b4a2','SECURITY:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('8493e3fe-b8e7-4517-be02-f126460396d8','767dbc2e-f117-4d57-9a62-9e145445b4a2','SECURITY:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('f1737060-d864-42e7-a490-3165e83e92bc','767dbc2e-f117-4d57-9a62-9e145445b4a2','SECURITY:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('dfe4c21e-83aa-4cb1-a074-a485171a7664','767dbc2e-f117-4d57-9a62-9e145445b4a2','SECURITY:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('7c334158-13f4-4014-b6a2-26b412460b7e','767dbc2e-f117-4d57-9a62-9e145445b4a2','AUDIT:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('aca9fb12-2e14-4c61-9c4b-b005d8bac629','767dbc2e-f117-4d57-9a62-9e145445b4a2','AUDIT:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('d3c8d02e-656a-463d-a871-55bf8b8558c9','767dbc2e-f117-4d57-9a62-9e145445b4a2','DATA_GOVERNANCE:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('a7ac2590-8573-4358-bfbf-2d70c84d1e0b','767dbc2e-f117-4d57-9a62-9e145445b4a2','DATA_GOVERNANCE:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('2e0155a8-2a07-4004-9542-3fd97d7f8a49','767dbc2e-f117-4d57-9a62-9e145445b4a2','DATA_GOVERNANCE:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('e6bc4fa2-dd57-4865-93c0-db7bed39f918','767dbc2e-f117-4d57-9a62-9e145445b4a2','DATA_GOVERNANCE:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('757379ae-7f13-468c-8b5c-4fa4ba9b3b1d','767dbc2e-f117-4d57-9a62-9e145445b4a2','NOTIFICATIONS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('42fa80b3-98f1-47b0-978a-7ea915cea2a1','767dbc2e-f117-4d57-9a62-9e145445b4a2','NOTIFICATIONS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('77b75a20-3861-46b6-8253-fc4f3d66efa4','767dbc2e-f117-4d57-9a62-9e145445b4a2','NOTIFICATIONS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('f6aad8f0-3dab-4995-a198-6e6d2d1b3223','767dbc2e-f117-4d57-9a62-9e145445b4a2','NOTIFICATIONS:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('ff79e2dc-b713-4df1-b5cd-b1b3edbb6a90','767dbc2e-f117-4d57-9a62-9e145445b4a2','SYSTEM_HEALTH:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('71dbe229-b448-47cc-8c86-5700724066a3','767dbc2e-f117-4d57-9a62-9e145445b4a2','SYSTEM_HEALTH:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('4ca6401a-7b30-4c6f-b2d9-e2f3b9633f8e','767dbc2e-f117-4d57-9a62-9e145445b4a2','SETTINGS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b711c2da-9f10-4fa4-87da-b3bc9752fab2','767dbc2e-f117-4d57-9a62-9e145445b4a2','SETTINGS:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('1ec08299-c6d4-4995-b160-42d79a6b8603','9cb1f39e-23e0-4315-9a27-3742770c8fd2','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('764418b5-1a25-45b2-8691-c34ffc96ac33','9cb1f39e-23e0-4315-9a27-3742770c8fd2','OVERVIEW:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('7da1426a-07a9-4eab-9e01-49d8cfb72090','9cb1f39e-23e0-4315-9a27-3742770c8fd2','USERS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('dbc5da78-ac60-41a0-a411-1469e5677d6e','9cb1f39e-23e0-4315-9a27-3742770c8fd2','USERS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('4973cafa-f840-4fb8-9422-8e9c0cc6393d','9cb1f39e-23e0-4315-9a27-3742770c8fd2','USERS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('4f884a30-cea4-4b10-9c57-2ba443874dcb','9cb1f39e-23e0-4315-9a27-3742770c8fd2','USERS:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('460e73d5-80e3-454b-9cb4-6b4986b50309','9cb1f39e-23e0-4315-9a27-3742770c8fd2','USERS:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('fa1b368f-6179-4581-b349-3330e419c330','9cb1f39e-23e0-4315-9a27-3742770c8fd2','TEAM:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('83db00ff-1604-4975-a675-a2507c7eafb2','9cb1f39e-23e0-4315-9a27-3742770c8fd2','TEAM:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('8dce36aa-cf51-422a-b791-cc189404eada','9cb1f39e-23e0-4315-9a27-3742770c8fd2','TEAM:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('ac139823-7388-4005-a6f7-04aaff2b8fcc','9cb1f39e-23e0-4315-9a27-3742770c8fd2','TEAM:ASSIGN') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b9240359-2eda-42a4-b453-00e04cc4e66e','9cb1f39e-23e0-4315-9a27-3742770c8fd2','TEAM:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('c84c6693-f2bb-4e5e-b380-96b9f0cd41b1','9cb1f39e-23e0-4315-9a27-3742770c8fd2','TEAM:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('cd071bb0-85ef-4517-8f22-b56190252a65','9cb1f39e-23e0-4315-9a27-3742770c8fd2','ROLES:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('71ab412c-a59e-44e7-b139-4dfac8957bf8','9cb1f39e-23e0-4315-9a27-3742770c8fd2','ROLES:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('77a6353c-848b-4dc1-af6f-56e90b3028df','9cb1f39e-23e0-4315-9a27-3742770c8fd2','ROLES:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('e5504c2b-aa4f-4973-89b2-8c3af84dec21','9cb1f39e-23e0-4315-9a27-3742770c8fd2','ROLES:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('d1f433dd-9ee7-463e-8ffd-52b344bd76d0','9cb1f39e-23e0-4315-9a27-3742770c8fd2','ROLES:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('cd9fab78-5df5-4f70-af16-ed0bff5c6b49','9cb1f39e-23e0-4315-9a27-3742770c8fd2','ROLES:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('c3552b54-f395-4ccc-a5ce-7791951a8153','9cb1f39e-23e0-4315-9a27-3742770c8fd2','APPROVALS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('95740367-9c2d-4db2-836a-0eada5c11ea4','9cb1f39e-23e0-4315-9a27-3742770c8fd2','APPROVALS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('41e6b02d-8b03-4705-b44d-611d01f96c62','9cb1f39e-23e0-4315-9a27-3742770c8fd2','APPROVALS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('e1b6160e-af91-468d-9e0d-26654078288a','9cb1f39e-23e0-4315-9a27-3742770c8fd2','APPROVALS:APPROVE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('3b59d008-542a-4724-b676-1e073ba74ddf','9cb1f39e-23e0-4315-9a27-3742770c8fd2','APPROVALS:REJECT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('c0121f29-e225-4703-8f70-28094544a54c','9cb1f39e-23e0-4315-9a27-3742770c8fd2','APPROVALS:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('eb944f65-b7a0-4aa7-9304-0d3c04ac1fd9','9cb1f39e-23e0-4315-9a27-3742770c8fd2','FACILITIES:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('efba5c50-3a6e-42f9-bbd9-680dbfc04715','9cb1f39e-23e0-4315-9a27-3742770c8fd2','FACILITIES:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('81a6c7a4-cc8b-4659-9450-e75288bf9547','9cb1f39e-23e0-4315-9a27-3742770c8fd2','FACILITIES:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('627169d8-609a-46b6-878c-e36af9f15987','9cb1f39e-23e0-4315-9a27-3742770c8fd2','FACILITIES:APPROVE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('c116ee2d-48d8-42a7-a1b7-154d9505978b','9cb1f39e-23e0-4315-9a27-3742770c8fd2','FACILITIES:REJECT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('471ccdc9-ca22-4f8e-8b37-40190b7f606a','9cb1f39e-23e0-4315-9a27-3742770c8fd2','FACILITIES:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('f9812a4c-7aff-4c2a-8233-d9875e43087d','9cb1f39e-23e0-4315-9a27-3742770c8fd2','FACILITIES:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('cd41a4ba-e620-41ca-ae11-f2bd4c773672','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DEPARTMENTS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('bf8cd638-cd0a-4d9d-871c-9cf9138a16d8','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DEPARTMENTS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('e1f2ddd7-6862-4e93-8eba-53a53e648bc0','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DEPARTMENTS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('08c46340-1967-4bb9-b13b-9134a8f72cee','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DEPARTMENTS:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b0695bdc-aff9-485b-9cb3-a8605390c8cb','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DEPARTMENTS:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('35434d15-b00c-49d7-83f5-88dcc6910d6b','9cb1f39e-23e0-4315-9a27-3742770c8fd2','GOVERNANCE:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('415651c3-87d0-488b-b4dd-0a5eb865b871','9cb1f39e-23e0-4315-9a27-3742770c8fd2','GOVERNANCE:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('1b5cffc0-aeb4-45e0-9333-9e8225ee71ca','9cb1f39e-23e0-4315-9a27-3742770c8fd2','GOVERNANCE:APPROVE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('04322c28-495c-4a94-9538-386cb14f02d5','9cb1f39e-23e0-4315-9a27-3742770c8fd2','GOVERNANCE:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('26bbcd3a-157f-4795-80d0-54f625b4831c','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DOCUMENTS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('0989af28-b7a4-4e30-a6cb-794016b59097','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DOCUMENTS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('2d4415ed-48e9-4e81-be1a-bca2f326a649','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DOCUMENTS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('67807033-631d-424a-af60-b22ac89e5e54','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DOCUMENTS:APPROVE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('ddec8438-1c25-4ae5-9350-5eee31111853','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DOCUMENTS:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('68650d94-621a-4403-8ff8-f8cf79d4946a','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DOCUMENTS:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('9e68e0cb-9520-447f-891a-708eebd34a94','9cb1f39e-23e0-4315-9a27-3742770c8fd2','PATIENT_ACCOUNTS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('ba4c1017-2607-4ec0-b2f6-84445f1313b8','9cb1f39e-23e0-4315-9a27-3742770c8fd2','PATIENT_ACCOUNTS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('f486697e-e086-47a5-af1b-cc7db26115bb','9cb1f39e-23e0-4315-9a27-3742770c8fd2','PATIENT_ACCOUNTS:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('6cf6e599-8a0a-4364-8bc2-82fce9818f3a','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DOCTORS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('d0724c79-4305-4544-b36a-d7c01a7fad3e','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DOCTORS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('a5cabbd5-7da7-4808-ae6c-ff9dc6f535a2','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DOCTORS:APPROVE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('f1126530-323e-4594-83b9-7964de5fdb7b','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DOCTORS:REJECT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('a7e5f1c8-db11-4f5f-ae91-568657a71ac4','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DOCTORS:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('543cb925-1dbd-472f-ae51-403d40eb5d4d','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DOCTORS:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('eb447f9c-8712-400b-a0d8-313c56c16f7a','9cb1f39e-23e0-4315-9a27-3742770c8fd2','NURSING:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('d13b4d5b-434b-49c9-bd4a-66683197f79d','9cb1f39e-23e0-4315-9a27-3742770c8fd2','LABORATORY:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('706b2517-0eab-47cb-a378-dfed2daf20d8','9cb1f39e-23e0-4315-9a27-3742770c8fd2','RADIOLOGY:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('5ae26b70-520e-4cb1-bcd6-8c653e67eb74','9cb1f39e-23e0-4315-9a27-3742770c8fd2','PHARMACY:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('4e90d5fa-d0ed-4d0e-bf2e-1bf912836070','9cb1f39e-23e0-4315-9a27-3742770c8fd2','MODULES:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('c6c9ab2f-343f-4d28-97d4-0946b0b42fbd','9cb1f39e-23e0-4315-9a27-3742770c8fd2','MODULES:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('355993cb-977d-4049-82a9-18383310a683','9cb1f39e-23e0-4315-9a27-3742770c8fd2','SUBSCRIPTIONS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('4519994e-3153-40e9-8cc5-c37b5ef455b9','9cb1f39e-23e0-4315-9a27-3742770c8fd2','SUBSCRIPTIONS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('2bea31db-70cc-4477-84f3-d580832e7f22','9cb1f39e-23e0-4315-9a27-3742770c8fd2','SUBSCRIPTIONS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('35595729-a79f-4299-ae42-584f23d1b9c9','9cb1f39e-23e0-4315-9a27-3742770c8fd2','SUBSCRIPTIONS:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('4b18f270-0cf4-433c-a308-57f0c5d65d98','9cb1f39e-23e0-4315-9a27-3742770c8fd2','SUBSCRIPTIONS:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('70a07fa4-025b-4561-95be-d352eecd9611','9cb1f39e-23e0-4315-9a27-3742770c8fd2','AI:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('38c33db2-5f1e-4ebb-9544-8063ea7dfdf0','9cb1f39e-23e0-4315-9a27-3742770c8fd2','AI:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('57c4bff9-08f5-43ce-9d4a-0e28cf18aa56','9cb1f39e-23e0-4315-9a27-3742770c8fd2','INTEGRATIONS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('216357af-a2ce-4155-85b8-2e5f982ca553','9cb1f39e-23e0-4315-9a27-3742770c8fd2','ANALYTICS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('d99e176e-8ea7-45be-b210-54f0db63d886','9cb1f39e-23e0-4315-9a27-3742770c8fd2','ANALYTICS:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('6cf53b01-963c-41d1-a3aa-b4c9b05913d7','9cb1f39e-23e0-4315-9a27-3742770c8fd2','SECURITY:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('44de5d9f-2448-4972-8bb2-b842a38215cb','9cb1f39e-23e0-4315-9a27-3742770c8fd2','SECURITY:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('2beb15df-faea-4a51-b170-0c6fbab0cf2f','9cb1f39e-23e0-4315-9a27-3742770c8fd2','SECURITY:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('67d01941-1ffd-4746-97e8-f734cd9b7e07','9cb1f39e-23e0-4315-9a27-3742770c8fd2','AUDIT:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('e824a99b-a9bd-45bf-b3ae-26c7e8ac4c8c','9cb1f39e-23e0-4315-9a27-3742770c8fd2','AUDIT:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('51d85ac6-3ed7-4a79-baec-e1d9ee76c614','9cb1f39e-23e0-4315-9a27-3742770c8fd2','DATA_GOVERNANCE:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('6fa1f735-83cb-4799-bb48-d62df10f02e9','9cb1f39e-23e0-4315-9a27-3742770c8fd2','NOTIFICATIONS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('54f48286-a091-4a6f-a53a-4001bc9461a5','9cb1f39e-23e0-4315-9a27-3742770c8fd2','NOTIFICATIONS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('777281f2-e805-480f-9ef0-b376c3e267f1','9cb1f39e-23e0-4315-9a27-3742770c8fd2','NOTIFICATIONS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('d48d9897-2760-4456-9981-dd9196e716c6','9cb1f39e-23e0-4315-9a27-3742770c8fd2','NOTIFICATIONS:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('60139714-9393-4ab8-b13c-4e0af6e96fc3','9cb1f39e-23e0-4315-9a27-3742770c8fd2','SYSTEM_HEALTH:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('9c2010fa-3df1-4a65-99ad-489852e34916','9cb1f39e-23e0-4315-9a27-3742770c8fd2','SETTINGS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('8ffeb8d0-f182-4f27-b8a4-2cdcfd10ded6','d60b8f9d-6e98-4598-970d-99cd1c187f29','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('f583af0b-c048-4149-a1ab-d18c8c6bcb21','d60b8f9d-6e98-4598-970d-99cd1c187f29','USERS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('177c8cce-69c6-4b3f-b669-d35dc3614c64','d60b8f9d-6e98-4598-970d-99cd1c187f29','SYSTEM_HEALTH:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('55e2e4b3-6f01-4216-a18a-c8900c6a39b5','d60b8f9d-6e98-4598-970d-99cd1c187f29','SYSTEM_HEALTH:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('49eed35d-fdd2-4226-85cf-64350d35550f','d60b8f9d-6e98-4598-970d-99cd1c187f29','INTEGRATIONS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('95a1a8e9-8990-406c-899f-ae7b350d14ca','d60b8f9d-6e98-4598-970d-99cd1c187f29','INTEGRATIONS:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('f3d807cd-5406-40ab-9d14-1312db95f919','d60b8f9d-6e98-4598-970d-99cd1c187f29','INTEGRATIONS:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('46ddeb9e-720f-4b50-abf9-47f215577f83','d60b8f9d-6e98-4598-970d-99cd1c187f29','MODULES:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('f7e1c86f-6d87-429e-93c7-0c447ac30c08','d60b8f9d-6e98-4598-970d-99cd1c187f29','MODULES:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('6f67ad4b-84e8-4c08-ac49-5da38e97bd27','d60b8f9d-6e98-4598-970d-99cd1c187f29','MODULES:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b97e6a01-8750-4ad3-99fd-3ad507bbca04','d60b8f9d-6e98-4598-970d-99cd1c187f29','ANALYTICS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('6e9f5675-4696-40c4-9f6b-1f0f414b20e3','d60b8f9d-6e98-4598-970d-99cd1c187f29','SECURITY:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('9b24456d-cf1b-4776-b9c3-ef356bbb08d5','d60b8f9d-6e98-4598-970d-99cd1c187f29','SECURITY:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('2fe7784a-37c5-460d-8d2b-6c63dbcc730c','d60b8f9d-6e98-4598-970d-99cd1c187f29','AUDIT:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('3fb48078-b530-48cd-9ba3-7f16643798de','d60b8f9d-6e98-4598-970d-99cd1c187f29','AI:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('1143b455-fcd3-4250-9721-3c5937984e14','d60b8f9d-6e98-4598-970d-99cd1c187f29','AI:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('eed7c847-32dd-42b7-90e1-944777b36576','d60b8f9d-6e98-4598-970d-99cd1c187f29','AI:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('dc4090b6-45d4-4d15-b208-ea285cf0a99a','83efdf1e-3cb0-4282-b8bd-5eef66e518eb','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('ab17398d-ee3a-4afd-ab55-3ad7d1aeb3c5','83efdf1e-3cb0-4282-b8bd-5eef66e518eb','USERS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('9157318a-3cfc-45c4-a6cb-7b30ebbca7c3','83efdf1e-3cb0-4282-b8bd-5eef66e518eb','USERS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('f69da3ee-e69f-4f91-95f1-fee1afae189f','83efdf1e-3cb0-4282-b8bd-5eef66e518eb','USERS:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('afb5101f-d987-4642-85ee-3b5e92bffa04','83efdf1e-3cb0-4282-b8bd-5eef66e518eb','FACILITIES:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('dcd014c7-e654-4944-9833-a45a69cf59e5','83efdf1e-3cb0-4282-b8bd-5eef66e518eb','FACILITIES:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('c87cba50-8561-4830-affd-89822fe11c89','83efdf1e-3cb0-4282-b8bd-5eef66e518eb','FACILITIES:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('0b7d7144-86b5-4f9b-8b28-98aac844b12b','83efdf1e-3cb0-4282-b8bd-5eef66e518eb','MODULES:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('c1bae860-94b2-4bca-9ad7-d52d464f211d','83efdf1e-3cb0-4282-b8bd-5eef66e518eb','MODULES:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('008cd64a-4936-46d0-9897-efd9b2e5386c','83efdf1e-3cb0-4282-b8bd-5eef66e518eb','NOTIFICATIONS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('ac5390c7-69f7-4f99-b35c-1cde594bf051','83efdf1e-3cb0-4282-b8bd-5eef66e518eb','NOTIFICATIONS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('e398e9bf-10f5-4125-b77d-7dfaa4425456','83efdf1e-3cb0-4282-b8bd-5eef66e518eb','NOTIFICATIONS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('0d98d3b1-5e88-4d50-a45a-2a8e118f57dc','83efdf1e-3cb0-4282-b8bd-5eef66e518eb','ANALYTICS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('382e67fd-fc4e-4935-9f73-854003e188fd','83efdf1e-3cb0-4282-b8bd-5eef66e518eb','SYSTEM_HEALTH:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('efc954f5-d16f-4bbd-a987-a803f9b3512a','83efdf1e-3cb0-4282-b8bd-5eef66e518eb','SETTINGS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('4569823f-7dfc-41b0-ac3e-19aa3f03a9d7','1573e5d0-e292-4ada-9cde-69ada72fc8af','FACILITIES:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('060d2888-2985-41a2-8558-63c9b750552c','1573e5d0-e292-4ada-9cde-69ada72fc8af','FACILITIES:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('bd1038d5-3ed9-43ed-b33d-31090fcb375d','1573e5d0-e292-4ada-9cde-69ada72fc8af','FACILITIES:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('96e892c8-94b9-484a-91fc-5596e531a3ef','1573e5d0-e292-4ada-9cde-69ada72fc8af','FACILITIES:APPROVE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('6f588aea-b943-44c9-9478-aa8c6bee3560','1573e5d0-e292-4ada-9cde-69ada72fc8af','FACILITIES:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('fcb63206-5ff5-4e50-a0b7-8c15da6bd19a','1573e5d0-e292-4ada-9cde-69ada72fc8af','FACILITIES:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b7e8faec-d6e6-4cc8-8513-01462b48021e','1573e5d0-e292-4ada-9cde-69ada72fc8af','USERS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('7eacf958-29c8-44f5-824b-5d24f70672bc','1573e5d0-e292-4ada-9cde-69ada72fc8af','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('4fd314fe-6095-4e22-8e94-5f7e2b6265e5','062dc32b-da5f-4f79-8dc7-86c9ec25e0ce','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b823a475-f663-44e1-b960-3fd593b0c360','062dc32b-da5f-4f79-8dc7-86c9ec25e0ce','USERS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('0392c416-bfd8-44e9-994e-42da09a25927','062dc32b-da5f-4f79-8dc7-86c9ec25e0ce','USERS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('74cf1256-88f3-4a03-b7fe-1bd79c303a42','062dc32b-da5f-4f79-8dc7-86c9ec25e0ce','USERS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('a1005389-5d95-4f62-818a-21fc45f358a6','062dc32b-da5f-4f79-8dc7-86c9ec25e0ce','USERS:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('f9228a77-1b7f-4f9f-9226-2be577aede38','062dc32b-da5f-4f79-8dc7-86c9ec25e0ce','USERS:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('23d1de6a-a700-43f0-a4ff-6964b0039698','062dc32b-da5f-4f79-8dc7-86c9ec25e0ce','PATIENT_ACCOUNTS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('33b6c944-9937-42d1-8750-8e7749e1e090','062dc32b-da5f-4f79-8dc7-86c9ec25e0ce','PATIENT_ACCOUNTS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('9c986990-db8a-4bb7-8a0b-b7cde94cd6ed','062dc32b-da5f-4f79-8dc7-86c9ec25e0ce','PATIENT_ACCOUNTS:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('0a8c5ef3-08df-4dd6-84f9-20be1f3d2092','062dc32b-da5f-4f79-8dc7-86c9ec25e0ce','DOCTORS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('67915515-531a-488b-90dc-322f7d27ce62','062dc32b-da5f-4f79-8dc7-86c9ec25e0ce','DOCTORS:APPROVE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('d3a19601-d9c8-4736-a377-8d28f23f18d5','062dc32b-da5f-4f79-8dc7-86c9ec25e0ce','DOCTORS:REJECT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('22fac8cb-78cd-46e2-8084-b07f47d634c5','062dc32b-da5f-4f79-8dc7-86c9ec25e0ce','DOCTORS:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('c8dccf97-8167-4256-99f9-70c5bcfbbccb','830c5bb9-69f6-42f2-bf1d-d8d706a00bde','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('d547d7ae-e8eb-4b50-b575-8bcb457b1f67','830c5bb9-69f6-42f2-bf1d-d8d706a00bde','GOVERNANCE:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('ad658c12-8f8d-4a94-9bad-6774782e258c','830c5bb9-69f6-42f2-bf1d-d8d706a00bde','GOVERNANCE:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('c8b1b34b-27c9-4360-9d63-b64547553c4a','830c5bb9-69f6-42f2-bf1d-d8d706a00bde','GOVERNANCE:APPROVE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b50850f0-ce93-4bd4-b2ba-76b678e8b19a','830c5bb9-69f6-42f2-bf1d-d8d706a00bde','GOVERNANCE:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('bd9e8cfc-107a-423f-90b2-5e16ff4eef7a','830c5bb9-69f6-42f2-bf1d-d8d706a00bde','DOCUMENTS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b2baf585-34cf-40b2-aed1-c57a070a26b4','830c5bb9-69f6-42f2-bf1d-d8d706a00bde','DOCUMENTS:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('962907bd-488f-4ce6-abbf-b28e800e9998','830c5bb9-69f6-42f2-bf1d-d8d706a00bde','DOCUMENTS:APPROVE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('2382581f-2b95-425e-b9a5-bf035f3098db','830c5bb9-69f6-42f2-bf1d-d8d706a00bde','DOCUMENTS:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('8aa43cd4-2287-4526-83a6-05921da93343','830c5bb9-69f6-42f2-bf1d-d8d706a00bde','DOCTORS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b55a5a32-22d8-47e3-9495-2ddbd4e790b0','830c5bb9-69f6-42f2-bf1d-d8d706a00bde','DOCTORS:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('264a8f00-2df2-4f89-9b37-c6c8860a9fb1','830c5bb9-69f6-42f2-bf1d-d8d706a00bde','DEPARTMENTS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('4f96ab9f-4c85-4071-8fe7-0d505c542f10','830c5bb9-69f6-42f2-bf1d-d8d706a00bde','DEPARTMENTS:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('a10ca7da-1e89-403a-aaa6-698ad4edd5d8','adaca43c-1e8a-4cf8-baa2-d6bfe044a4f5','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('4db088a3-267e-4894-8500-fefd091f92a2','adaca43c-1e8a-4cf8-baa2-d6bfe044a4f5','GOVERNANCE:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('70666bd9-27d3-47ab-9689-08094db62485','adaca43c-1e8a-4cf8-baa2-d6bfe044a4f5','GOVERNANCE:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('0f7a74ad-7ebf-4a27-92d5-d00662df8f02','adaca43c-1e8a-4cf8-baa2-d6bfe044a4f5','DOCUMENTS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('8d38b60c-df24-4bb2-a590-cbe10f242882','adaca43c-1e8a-4cf8-baa2-d6bfe044a4f5','DOCUMENTS:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('ca989d96-c356-41a2-b2b5-f2a505903349','adaca43c-1e8a-4cf8-baa2-d6bfe044a4f5','DEPARTMENTS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('6e1bc51b-ffa7-4330-9a56-c35731627f87','adaca43c-1e8a-4cf8-baa2-d6bfe044a4f5','DEPARTMENTS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('7975333e-d01c-4239-8b64-334c16299111','adaca43c-1e8a-4cf8-baa2-d6bfe044a4f5','DEPARTMENTS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('655dd0ab-1442-4cd7-b11a-e8a1d750b4eb','adaca43c-1e8a-4cf8-baa2-d6bfe044a4f5','DEPARTMENTS:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('fb60a530-0c63-488a-9726-5b62a3fee582','e7fefff7-fd73-44d0-b634-fb051f877134','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('73476303-5a65-4162-947f-a3b44e7e5250','e7fefff7-fd73-44d0-b634-fb051f877134','DATA_GOVERNANCE:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('d462530c-e4da-4845-9390-3183076396c4','e7fefff7-fd73-44d0-b634-fb051f877134','DATA_GOVERNANCE:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('0cb1502d-366b-466f-a8a4-1ae9fe008b76','e7fefff7-fd73-44d0-b634-fb051f877134','DATA_GOVERNANCE:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b656b815-9d82-4e40-bcdf-7866ae9c354b','e7fefff7-fd73-44d0-b634-fb051f877134','SECURITY:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('78053eb4-dbbf-420f-a8c5-c2f56e51830c','e7fefff7-fd73-44d0-b634-fb051f877134','SECURITY:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('f6244caf-e378-4e38-9f23-e853db0cc4ad','e7fefff7-fd73-44d0-b634-fb051f877134','AUDIT:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('9a942546-8ffc-4b7c-98a9-0120d38888cd','e7fefff7-fd73-44d0-b634-fb051f877134','AUDIT:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('fca9e15e-8ea2-4fe7-897b-17c661d6404e','e7fefff7-fd73-44d0-b634-fb051f877134','USERS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b10c10cf-2050-488e-a4df-2bd6b64010bb','da1c112f-83a7-49e1-9fc8-8213eb1c0615','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('e01565f5-896e-465f-a15c-2f6199b9c45f','da1c112f-83a7-49e1-9fc8-8213eb1c0615','SECURITY:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('2dbc8877-8fa9-4b93-b40d-d7018bbcb483','da1c112f-83a7-49e1-9fc8-8213eb1c0615','SECURITY:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('5b1e549e-189d-4056-93cf-501bd7851b5e','da1c112f-83a7-49e1-9fc8-8213eb1c0615','SECURITY:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('3b48bd7c-06f9-4af4-ad9c-866f0da8e08e','da1c112f-83a7-49e1-9fc8-8213eb1c0615','SECURITY:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('3bd8b4e7-0397-43de-b24d-9917822b8bd1','da1c112f-83a7-49e1-9fc8-8213eb1c0615','SECURITY:AUDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('7020d14d-2ca8-446a-9cfc-57cfffc036eb','da1c112f-83a7-49e1-9fc8-8213eb1c0615','AUDIT:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('5ae0d58b-14d2-49b5-abc3-a2f0faf86987','da1c112f-83a7-49e1-9fc8-8213eb1c0615','SYSTEM_HEALTH:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('45ce3390-6daa-497a-ad2e-098fc832a3c4','da1c112f-83a7-49e1-9fc8-8213eb1c0615','USERS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('894ed277-bbbb-4349-aff1-fec298efa145','f0e51130-dd33-44cc-9607-5cfed841f33b','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('5144963b-10bc-42d6-a9c0-9f8d116379d2','f0e51130-dd33-44cc-9607-5cfed841f33b','SYSTEM_HEALTH:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('aa76e54e-2a3a-4eb3-b423-5e8ad36667af','f0e51130-dd33-44cc-9607-5cfed841f33b','USERS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('a68fc269-a183-48e7-8735-e8fce598a37d','f0e51130-dd33-44cc-9607-5cfed841f33b','FACILITIES:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('eb3cb348-56eb-4d98-abd1-4d0a1a866cd0','73e66013-acb6-476d-8734-9ed0651797e7','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('66c22d91-f597-46d2-b3e5-6097a8bae1ed','73e66013-acb6-476d-8734-9ed0651797e7','SUBSCRIPTIONS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('e866dfa1-98a0-4986-9bea-354ac8214a85','73e66013-acb6-476d-8734-9ed0651797e7','SUBSCRIPTIONS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('181f7472-7a4d-46ca-82e3-a998093efcdb','73e66013-acb6-476d-8734-9ed0651797e7','SUBSCRIPTIONS:EDIT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('dc604c44-292a-4fb3-8c51-faafb922008f','73e66013-acb6-476d-8734-9ed0651797e7','SUBSCRIPTIONS:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('e44cd03a-a380-4285-a3e4-f669e78c2f69','73e66013-acb6-476d-8734-9ed0651797e7','SUBSCRIPTIONS:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('9a8b72bb-a688-4d82-a56c-06ced45fcec6','73e66013-acb6-476d-8734-9ed0651797e7','ANALYTICS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('fcfca98f-5274-4b0f-bacd-f11371164fcb','73e66013-acb6-476d-8734-9ed0651797e7','ANALYTICS:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('657d8508-e52b-4603-92c3-23549f90d7ed','07f6781c-dff9-4508-90af-4695efd5f359','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('8f460e2b-0283-4fac-a7c7-015065cba6b3','07f6781c-dff9-4508-90af-4695efd5f359','GOVERNANCE:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('fbc6157b-6142-4eef-8cb0-74c0c33073a5','07f6781c-dff9-4508-90af-4695efd5f359','AUDIT:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('ecc2a706-0356-4aea-9141-b1484e952b34','07f6781c-dff9-4508-90af-4695efd5f359','AUDIT:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('eca05052-ac8e-462e-a5ae-b49d722085ff','07f6781c-dff9-4508-90af-4695efd5f359','DATA_GOVERNANCE:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('038d9315-2b88-40c5-99dd-0e4aca980cfe','07f6781c-dff9-4508-90af-4695efd5f359','SECURITY:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('857b4038-b979-4502-9d93-5121e6a432b8','07f6781c-dff9-4508-90af-4695efd5f359','USERS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('03d4138a-00f9-4679-ae9e-ba63c15b86af','36088172-1be2-4bbb-9437-42bd2bd1a439','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('5610b303-9ed0-455f-bafd-5623eb7ea91d','36088172-1be2-4bbb-9437-42bd2bd1a439','ANALYTICS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('3071263e-1692-4810-abac-f136b7b36d37','36088172-1be2-4bbb-9437-42bd2bd1a439','SYSTEM_HEALTH:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b4908620-2561-4e48-84b6-04ea17ddd68d','36088172-1be2-4bbb-9437-42bd2bd1a439','MODULES:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('452b6afe-4657-449c-8c44-e794a0cdb98f','4833dc57-7346-413b-9437-db8562df8b85','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('d5517c68-a352-4663-8d9f-d1e8f97f84d6','4833dc57-7346-413b-9437-db8562df8b85','INTEGRATIONS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('2144cf4c-6a7d-4cf4-89be-45e63f46351f','4833dc57-7346-413b-9437-db8562df8b85','INTEGRATIONS:CONFIGURE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b4b58866-48b9-496a-bac8-64907619d5f1','4833dc57-7346-413b-9437-db8562df8b85','INTEGRATIONS:MANAGE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b716ebeb-3283-4ca7-8f7c-03836bd17596','4833dc57-7346-413b-9437-db8562df8b85','SYSTEM_HEALTH:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('b1eb0bef-8554-49a4-bfe1-f7260125abed','da0da2b0-3145-4047-b49d-d87b81db14e3','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('e5216c8b-77fc-4ea7-a13f-f3c2059343b0','da0da2b0-3145-4047-b49d-d87b81db14e3','USERS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('a3a451cf-7191-4af3-bb41-eccbbb8f97ff','da0da2b0-3145-4047-b49d-d87b81db14e3','NOTIFICATIONS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('e53fa871-10d8-4837-9044-b71414852c53','da0da2b0-3145-4047-b49d-d87b81db14e3','NOTIFICATIONS:CREATE') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('8c467c63-d11e-4fcd-972d-d69d0110ae17','4098ac2b-dddd-4fb8-8d4c-74f5b4de643a','OVERVIEW:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('5130f63b-3c35-4eb3-9987-bb924d2fa8b6','4098ac2b-dddd-4fb8-8d4c-74f5b4de643a','OVERVIEW:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('58655283-eeb5-4dc8-850b-af63c2aaaf92','4098ac2b-dddd-4fb8-8d4c-74f5b4de643a','ANALYTICS:VIEW') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "admin_role_permissions" ("id","role_id","permission_key") VALUES ('3b0b50e2-fd04-4ab5-9fd6-3b199b2405dc','4098ac2b-dddd-4fb8-8d4c-74f5b4de643a','ANALYTICS:EXPORT') ON CONFLICT ("role_id","permission_key") DO NOTHING;
INSERT INTO "approval_workflows" ("id","action_key","name","description","approver_role_key","second_approver_role_key","requires_reauth","active") VALUES ('181d1770-fc3e-49ba-94a2-c8b1b51618a4','CREATE_ADMIN_ACCOUNT','Create ordinary admin account','A team manager must approve new internal administrator accounts before activation.','DEPUTY_SUPER_ADMIN',NULL,true,true) ON CONFLICT ("action_key") DO NOTHING;
INSERT INTO "approval_workflows" ("id","action_key","name","description","approver_role_key","second_approver_role_key","requires_reauth","active") VALUES ('625f7c99-f33d-41df-8733-8014655ee4b5','ASSIGN_PRIVILEGED_ROLE','Assign privileged admin role','Only the Super Admin may approve assignment of privileged administrative roles.','SUPER_ADMIN',NULL,true,true) ON CONFLICT ("action_key") DO NOTHING;
INSERT INTO "approval_workflows" ("id","action_key","name","description","approver_role_key","second_approver_role_key","requires_reauth","active") VALUES ('991f083d-65fd-47b6-9312-97d3e0a0d112','CHANGE_GLOBAL_PERMISSIONS','Change global permissions','Dual approval: Super Admin plus a second approver.','SUPER_ADMIN','DEPUTY_SUPER_ADMIN',true,true) ON CONFLICT ("action_key") DO NOTHING;
INSERT INTO "approval_workflows" ("id","action_key","name","description","approver_role_key","second_approver_role_key","requires_reauth","active") VALUES ('e3c6bdc2-6cce-4b17-899f-5570df2e129d','SUSPEND_FACILITY','Suspend a healthcare facility','An authorised administrator approves; the suspension is reviewed afterwards.','DEPUTY_SUPER_ADMIN',NULL,true,true) ON CONFLICT ("action_key") DO NOTHING;
INSERT INTO "approval_workflows" ("id","action_key","name","description","approver_role_key","second_approver_role_key","requires_reauth","active") VALUES ('6fcf8cea-6f94-4c30-844e-68a8923203f1','CHANGE_SECURITY_POLICY','Change security policy','Dual approval: Security Administrator plus Super Admin.','SECURITY_ADMIN','SUPER_ADMIN',true,true) ON CONFLICT ("action_key") DO NOTHING;
INSERT INTO "approval_workflows" ("id","action_key","name","description","approver_role_key","second_approver_role_key","requires_reauth","active") VALUES ('8db1362e-8258-4d46-83d1-f84068eaf244','EXPORT_SENSITIVE_DATA','Export sensitive data','An authorised data officer approves any sensitive export.','DATA_PROTECTION_OFFICER',NULL,true,true) ON CONFLICT ("action_key") DO NOTHING;
INSERT INTO "approval_workflows" ("id","action_key","name","description","approver_role_key","second_approver_role_key","requires_reauth","active") VALUES ('2cf0ad91-4f2c-4f23-b142-8900a222ea99','CHANGE_CLINICAL_TEMPLATES','Change global clinical templates','Clinical governance approval is required for global template changes.','CLINICAL_GOVERNANCE',NULL,true,true) ON CONFLICT ("action_key") DO NOTHING;
INSERT INTO "approval_workflows" ("id","action_key","name","description","approver_role_key","second_approver_role_key","requires_reauth","active") VALUES ('7ce0ff5d-1ad9-4056-858c-0571fcf1e86a','DELETE_ADMIN_RECORDS','Delete administrative records','An authorised approver decides; the deletion is audited.','DEPUTY_SUPER_ADMIN',NULL,true,true) ON CONFLICT ("action_key") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('fc017f64-8b0e-40f9-bf03-10ca3f380569','General Medicine','CLINICAL') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('0fcc4464-215c-4481-a2f5-90f43e9443c2','Internal Medicine','CLINICAL') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('b958d5d1-787b-4e68-8395-10461995739e','Surgery','CLINICAL') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('a4d72ca5-c6f0-4448-9a99-b167790c314e','Paediatrics','CLINICAL') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('5fea33a2-0701-4b5a-b699-f7167d0201b7','Obstetrics and Gynaecology','CLINICAL') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('26557315-fd05-41a8-ac24-3038721408de','Emergency Medicine','CLINICAL') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('b75b5c34-79bb-49b8-a1cd-9454196c32ba','Intensive Care','CLINICAL') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('0bc0b30c-f8a5-4f85-9a74-b8f6ab66e61b','Oncology','CLINICAL') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('c7be4ea0-457d-4441-9507-b57f6196327e','Cardiology','CLINICAL') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('cb575098-cf31-4b9b-823f-3557b9aed3c9','Neurology','CLINICAL') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('7827149a-89b3-4f15-8195-2e70e68fd4ed','Psychiatry','CLINICAL') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('219cf668-ee96-43b7-bec3-38912e027948','Dermatology','CLINICAL') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('14e36eca-b2b7-4639-80af-afcdf424fa24','Orthopaedics','CLINICAL') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('532b2899-e614-4335-85a4-b1f95a358fa3','Urology','CLINICAL') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('e4488f73-7daa-4d31-8ad9-ffa2e3203275','Ophthalmology','CLINICAL') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('7a425afd-b2d9-45ad-a2ad-9ad3b7f89569','Anaesthesiology','CLINICAL') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('db5ab6de-3d2d-4528-a652-79186652496f','Microbiology','LABORATORY') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('4dc07a3e-7083-4c08-b394-f38d6eb9fd5f','Haematology','LABORATORY') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('b676e003-4ec3-4fb4-9c2e-107e31e98b04','Histopathology','LABORATORY') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('1cada803-5018-4e8c-8693-b051f22cce4e','Chemical Pathology','LABORATORY') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('d29bb180-28ea-4500-91b5-4d949509cf2e','Immunology','LABORATORY') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('c91e3590-9504-493c-a8a6-aa190d6103aa','Molecular Diagnostics','LABORATORY') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('2484dc72-31ce-4269-80e7-9096f51c1316','Blood Bank and Transfusion Medicine','LABORATORY') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('dd6921c2-065e-4b8c-821e-368d4ced7429','Radiology','DIAGNOSTIC') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('016d6751-edaf-409f-ad59-cb0c2a0ebd75','Ultrasound','DIAGNOSTIC') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('26b66f49-e92f-467e-965c-7e82b167ad80','CT','DIAGNOSTIC') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('e0d63a16-a24b-4cca-8a22-5d1ed64a63d6','MRI','DIAGNOSTIC') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('baa90f04-52fa-426e-be00-1d175d470026','X-ray','DIAGNOSTIC') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('5dbadeb7-e185-4eef-a609-78fd6ebc6827','Mammography','DIAGNOSTIC') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('2dd31294-d144-4fb7-bb65-25f10884a225','Nuclear Medicine','DIAGNOSTIC') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('6566c760-245f-478a-ad01-68de61768124','Echocardiography','DIAGNOSTIC') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('eb944633-2f37-4a2f-bb59-f5c8fc6f8605','Endoscopy','DIAGNOSTIC') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('3d1bb748-af77-4ee9-a530-f784d439e5c2','Electrocardiography','DIAGNOSTIC') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('1e9c7a2f-c93c-4ac4-a558-ebffb316b90e','Electroencephalography','DIAGNOSTIC') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('ff809029-0884-43d7-903b-8f261a0f3517','Nursing Administration','NURSING') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('ada0a9c9-f54e-4a6c-91ae-add782fa07f7','Outpatient Nursing','NURSING') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('9e5c270a-0d5f-4d99-a8b7-26a985c4d355','Inpatient Nursing','NURSING') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('e00cbcd4-b7a1-42fe-b035-45200dbc103a','Emergency Nursing','NURSING') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('2d938df7-f3bb-4977-9998-3aff0ba0f1d6','ICU Nursing','NURSING') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('0c8c789e-cdb4-4f6f-b2af-d40c8db52405','Theatre Nursing','NURSING') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('0c01b2bd-ae00-4e85-89d1-a0f09a1d95c3','Community Nursing','NURSING') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('6532cd0f-938d-4c6e-9cf2-37fa6ce455a1','Clinical Pharmacy','PHARMACY') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('4547a76c-fcb7-4442-8dea-5dd76825edba','Retail Pharmacy','PHARMACY') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('57e282e0-68ff-4529-9c89-aec6448e63a5','Finance and Accounts','ADMINISTRATIVE') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('58be69f4-5e07-458f-85b0-7f042796a667','Human Resources','ADMINISTRATIVE') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('c3f254e2-46c6-4bf8-bb64-944e77eae484','Medical Records','ADMINISTRATIVE') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('da8f25b2-e0b4-4d6a-be5f-b49b1c145a51','Quality Assurance','ADMINISTRATIVE') ON CONFLICT ("name") DO NOTHING;
INSERT INTO "global_specialties" ("id","name","category") VALUES ('26a22caa-0f4a-41ba-b800-8d2d508a90dc','Information Technology','ADMINISTRATIVE') ON CONFLICT ("name") DO NOTHING;

