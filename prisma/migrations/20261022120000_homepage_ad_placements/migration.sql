-- Add homepage ad placements: a rotating carousel slot and a single banner
-- slot on the public homepage. Additive; existing placements are untouched.
ALTER TYPE "AdPlacement" ADD VALUE 'HOMEPAGE_CAROUSEL';
ALTER TYPE "AdPlacement" ADD VALUE 'HOMEPAGE_BANNER';
