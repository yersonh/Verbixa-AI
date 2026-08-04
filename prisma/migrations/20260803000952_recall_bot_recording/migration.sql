-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "recordingUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_recallBotId_key" ON "Meeting"("recallBotId");
