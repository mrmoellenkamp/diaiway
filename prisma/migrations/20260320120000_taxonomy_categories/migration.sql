-- Taxonomy (admin-managed categories & specialties) + Expert primary + n:m

CREATE TABLE "TaxonomyCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "iconKey" TEXT NOT NULL DEFAULT 'Briefcase',
    "iconImageUrl" TEXT,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxonomyCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaxonomyCategory_slug_key" ON "TaxonomyCategory"("slug");

CREATE TABLE "TaxonomySpecialty" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxonomySpecialty_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaxonomySpecialty_categoryId_idx" ON "TaxonomySpecialty"("categoryId");

CREATE TABLE "CategoryOnExpert" (
    "expertId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "CategoryOnExpert_pkey" PRIMARY KEY ("expertId","categoryId")
);

CREATE INDEX "CategoryOnExpert_categoryId_idx" ON "CategoryOnExpert"("categoryId");

CREATE TABLE "SpecialtyOnExpert" (
    "expertId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,

    CONSTRAINT "SpecialtyOnExpert_pkey" PRIMARY KEY ("expertId","specialtyId")
);

CREATE INDEX "SpecialtyOnExpert_specialtyId_idx" ON "SpecialtyOnExpert"("specialtyId");

ALTER TABLE "Expert" ADD COLUMN "primaryCategoryId" TEXT,
ADD COLUMN "primarySpecialtyId" TEXT;

ALTER TABLE "TaxonomySpecialty" ADD CONSTRAINT "TaxonomySpecialty_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaxonomyCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CategoryOnExpert" ADD CONSTRAINT "CategoryOnExpert_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CategoryOnExpert" ADD CONSTRAINT "CategoryOnExpert_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaxonomyCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpecialtyOnExpert" ADD CONSTRAINT "SpecialtyOnExpert_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "Expert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpecialtyOnExpert" ADD CONSTRAINT "SpecialtyOnExpert_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "TaxonomySpecialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Expert" ADD CONSTRAINT "Expert_primaryCategoryId_fkey" FOREIGN KEY ("primaryCategoryId") REFERENCES "TaxonomyCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expert" ADD CONSTRAINT "Expert_primarySpecialtyId_fkey" FOREIGN KEY ("primarySpecialtyId") REFERENCES "TaxonomySpecialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
