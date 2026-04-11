-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE', 'SHARED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO');

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "posterFilename" TEXT,
    "durationSeconds" DOUBLE PRECISION,
    "originalName" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "smartTitleSuggestionsJson" TEXT,
    "smartTitleSuggestionsUpdatedAt" TIMESTAMP(3),
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "ownerId" TEXT NOT NULL,
    "shareToNetwork" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageAttachment" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "posterFilename" TEXT,
    "durationSeconds" DOUBLE PRECISION,
    "originalName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageAnalysis" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "summary" TEXT,
    "visualDescription" TEXT,
    "metadataSummary" TEXT,
    "mood" TEXT,
    "peopleJson" TEXT,
    "placesJson" TEXT,
    "thingsJson" TEXT,
    "activitiesJson" TEXT,
    "visibleTextJson" TEXT,
    "keywordsJson" TEXT,
    "openQuestionsJson" TEXT,
    "sceneInsightsJson" TEXT,
    "metadataJson" TEXT,
    "capturedAt" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "cameraMake" TEXT,
    "cameraModel" TEXT,
    "lensModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contributor" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "email" TEXT,
    "name" TEXT,
    "token" TEXT NOT NULL,
    "inviteSent" BOOLEAN NOT NULL DEFAULT false,
    "imageId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "currentStep" TEXT NOT NULL DEFAULT 'greeting',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wiki" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wiki_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KidsStory" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "summary" TEXT,
    "visualStyle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "errorMessage" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KidsStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KidsStoryPanel" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "imagePrompt" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KidsStoryPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SportsMode" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "sportType" TEXT,
    "subjectName" TEXT,
    "teamName" TEXT,
    "opponentName" TEXT,
    "eventName" TEXT,
    "season" TEXT,
    "outcome" TEXT,
    "finalScore" TEXT,
    "rawDetails" TEXT NOT NULL,
    "summary" TEXT,
    "statLinesJson" TEXT,
    "highlightsJson" TEXT,
    "parsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SportsMode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryCut" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "focus" TEXT,
    "durationSeconds" INTEGER NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "script" TEXT NOT NULL,
    "blocksJson" TEXT NOT NULL,
    "metadataJson" TEXT,
    "selectedMediaJson" TEXT,
    "selectedContributorJson" TEXT,
    "includeOwner" BOOLEAN NOT NULL DEFAULT true,
    "includeEmberVoice" BOOLEAN NOT NULL DEFAULT true,
    "includeNarratorVoice" BOOLEAN NOT NULL DEFAULT true,
    "emberVoiceId" TEXT,
    "emberVoiceLabel" TEXT,
    "narratorVoiceId" TEXT,
    "narratorVoiceLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryCut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessPass" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "codeHash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AccessPass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "passId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AccessSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthChallenge" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tokenHash" TEXT,
    "codeHash" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "name" TEXT,
    "metadataJson" TEXT,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "lastVisitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageTag" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "userId" TEXT,
    "contributorId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT,
    "leftPct" DOUBLE PRECISION,
    "topPct" DOUBLE PRECISION,
    "widthPct" DOUBLE PRECISION,
    "heightPct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "browserId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "personaName" TEXT,
    "personaTraits" TEXT,
    "personaVoice" TEXT,
    "personaBackstory" TEXT,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceCall" (
    "id" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "conversationId" TEXT,
    "retellCallId" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL DEFAULT 'system',
    "callType" TEXT NOT NULL DEFAULT 'phone_call',
    "direction" TEXT,
    "fromNumber" TEXT,
    "toNumber" TEXT,
    "agentId" TEXT,
    "agentVersion" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'registered',
    "lastEventType" TEXT,
    "disconnectionReason" TEXT,
    "recordingUrl" TEXT,
    "publicLogUrl" TEXT,
    "transcript" TEXT,
    "transcriptObjectJson" TEXT,
    "transcriptWithToolCallsJson" TEXT,
    "metadataJson" TEXT,
    "dynamicVariablesJson" TEXT,
    "callAnalysisJson" TEXT,
    "callSummary" TEXT,
    "callSuccessful" BOOLEAN,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "analyzedAt" TIMESTAMP(3),
    "memorySyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceCallClip" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "voiceCallId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "significance" TEXT,
    "speaker" TEXT,
    "audioUrl" TEXT,
    "startMs" INTEGER,
    "endMs" INTEGER,
    "canUseForTitle" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceCallClip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceCallEvent" (
    "id" TEXT NOT NULL,
    "voiceCallId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceCallEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Image_ownerId_createdAt_idx" ON "Image"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "Image_shareToNetwork_createdAt_idx" ON "Image"("shareToNetwork", "createdAt");

-- CreateIndex
CREATE INDEX "ImageAttachment_imageId_createdAt_idx" ON "ImageAttachment"("imageId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImageAnalysis_imageId_key" ON "ImageAnalysis"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "Contributor_token_key" ON "Contributor"("token");

-- CreateIndex
CREATE INDEX "Contributor_imageId_createdAt_idx" ON "Contributor"("imageId", "createdAt");

-- CreateIndex
CREATE INDEX "Contributor_userId_createdAt_idx" ON "Contributor"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contributor_imageId_userId_key" ON "Contributor"("imageId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_contributorId_key" ON "Conversation"("contributorId");

-- CreateIndex
CREATE UNIQUE INDEX "Wiki_imageId_key" ON "Wiki"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "KidsStory_imageId_key" ON "KidsStory"("imageId");

-- CreateIndex
CREATE INDEX "KidsStoryPanel_storyId_position_idx" ON "KidsStoryPanel"("storyId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "KidsStoryPanel_storyId_position_key" ON "KidsStoryPanel"("storyId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "SportsMode_imageId_key" ON "SportsMode"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryCut_imageId_key" ON "StoryCut"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessSession_token_key" ON "AccessSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_createdAt_idx" ON "UserSession"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthChallenge_tokenHash_key" ON "AuthChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthChallenge_type_createdAt_idx" ON "AuthChallenge"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AuthChallenge_type_email_createdAt_idx" ON "AuthChallenge"("type", "email", "createdAt");

-- CreateIndex
CREATE INDEX "AuthChallenge_type_phoneNumber_createdAt_idx" ON "AuthChallenge"("type", "phoneNumber", "createdAt");

-- CreateIndex
CREATE INDEX "AuthChallenge_userId_createdAt_idx" ON "AuthChallenge"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShortLink_code_key" ON "ShortLink"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ShortLink_targetUrl_key" ON "ShortLink"("targetUrl");

-- CreateIndex
CREATE INDEX "Friendship_requesterId_status_idx" ON "Friendship"("requesterId", "status");

-- CreateIndex
CREATE INDEX "Friendship_addresseeId_status_idx" ON "Friendship"("addresseeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "ImageTag_imageId_createdAt_idx" ON "ImageTag"("imageId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageTag_userId_createdAt_idx" ON "ImageTag"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageTag_contributorId_createdAt_idx" ON "ImageTag"("contributorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSession_browserId_imageId_key" ON "ChatSession"("browserId", "imageId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceCall_retellCallId_key" ON "VoiceCall"("retellCallId");

-- CreateIndex
CREATE INDEX "VoiceCall_contributorId_createdAt_idx" ON "VoiceCall"("contributorId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCall_conversationId_createdAt_idx" ON "VoiceCall"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCallClip_imageId_createdAt_idx" ON "VoiceCallClip"("imageId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCallClip_contributorId_createdAt_idx" ON "VoiceCallClip"("contributorId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCallClip_voiceCallId_createdAt_idx" ON "VoiceCallClip"("voiceCallId", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceCallEvent_voiceCallId_createdAt_idx" ON "VoiceCallEvent"("voiceCallId", "createdAt");

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageAttachment" ADD CONSTRAINT "ImageAttachment_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageAnalysis" ADD CONSTRAINT "ImageAnalysis_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contributor" ADD CONSTRAINT "Contributor_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contributor" ADD CONSTRAINT "Contributor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wiki" ADD CONSTRAINT "Wiki_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KidsStory" ADD CONSTRAINT "KidsStory_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KidsStoryPanel" ADD CONSTRAINT "KidsStoryPanel_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "KidsStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SportsMode" ADD CONSTRAINT "SportsMode_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryCut" ADD CONSTRAINT "StoryCut_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessSession" ADD CONSTRAINT "AccessSession_passId_fkey" FOREIGN KEY ("passId") REFERENCES "AccessPass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthChallenge" ADD CONSTRAINT "AuthChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageTag" ADD CONSTRAINT "ImageTag_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageTag" ADD CONSTRAINT "ImageTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageTag" ADD CONSTRAINT "ImageTag_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageTag" ADD CONSTRAINT "ImageTag_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCall" ADD CONSTRAINT "VoiceCall_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCall" ADD CONSTRAINT "VoiceCall_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCallClip" ADD CONSTRAINT "VoiceCallClip_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCallClip" ADD CONSTRAINT "VoiceCallClip_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCallClip" ADD CONSTRAINT "VoiceCallClip_voiceCallId_fkey" FOREIGN KEY ("voiceCallId") REFERENCES "VoiceCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCallEvent" ADD CONSTRAINT "VoiceCallEvent_voiceCallId_fkey" FOREIGN KEY ("voiceCallId") REFERENCES "VoiceCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;
