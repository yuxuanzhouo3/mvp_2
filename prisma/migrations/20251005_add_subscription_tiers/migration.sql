-- AlterTable: Add new subscription columns and migrate isPro data
-- Step 1: Add new columns
ALTER TABLE `User` ADD COLUMN `subscriptionTier` TEXT NOT NULL DEFAULT 'free';
ALTER TABLE `User` ADD COLUMN `subscriptionId` TEXT;
ALTER TABLE `User` ADD COLUMN `paymentMethod` TEXT;

-- Step 2: Migrate existing isPro data to subscriptionTier
UPDATE `User` SET `subscriptionTier` = 'pro' WHERE `isPro` = 1;
UPDATE `User` SET `subscriptionTier` = 'free' WHERE `isPro` = 0;

-- Step 3: Drop the old isPro column
PRAGMA foreign_keys=off;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'free',
    "subscriptionId" TEXT,
    "paymentMethod" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("id", "name", "email", "password", "subscriptionTier", "subscriptionId", "paymentMethod", "createdAt", "updatedAt") SELECT "id", "name", "email", "password", "subscriptionTier", "subscriptionId", "paymentMethod", "createdAt", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=on;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
