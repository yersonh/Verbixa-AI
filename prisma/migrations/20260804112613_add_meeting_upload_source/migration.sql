-- CreateEnum
CREATE TYPE "MeetingSource" AS ENUM ('RECALL_BOT', 'UPLOAD');

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "source" "MeetingSource" NOT NULL DEFAULT 'RECALL_BOT',
ALTER COLUMN "meetingUrl" DROP NOT NULL;
