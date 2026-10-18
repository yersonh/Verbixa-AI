-- Dueño de cada organización: la cuenta autorizada en la Consola SGP que la creó.
ALTER TABLE "Organization" ADD COLUMN "ownerEmail" TEXT;

-- Organizaciones que ya existían: queda como dueño su primer usuario (quien la creó).
UPDATE "Organization" o
SET "ownerEmail" = lower(u.email)
FROM (
  SELECT DISTINCT ON ("organizationId") "organizationId", email
  FROM "User"
  ORDER BY "organizationId", "createdAt" ASC, id ASC
) u
WHERE u."organizationId" = o.id;
