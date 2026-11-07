-- Add the pharmacy facility type: a standalone pharmacy account, distinct from
-- the in-hospital pharmacy module. Mirrors the existing facility kinds so the
-- registration wizard, facility portal and module guards can scope access.
ALTER TYPE "AccountType" ADD VALUE 'PHARMACY';
ALTER TYPE "FacilityKind" ADD VALUE 'PHARMACY';
ALTER TYPE "ProviderType" ADD VALUE 'PHARMACY';
