import { prisma } from './db';
import { getEmberTitle } from './ember-title';
import { ensureImageAnalysisForImage } from './image-analysis';
import { parseConfirmedLocationContext } from './location-suggestions';
import { generateWiki } from './claude';
import { parseSportsHighlightsJson, parseSportsModeJson } from './sports-mode';

type ParsedEntity = {
  label: string;
  details: string;
  confidence: string;
};

type ParsedSceneInsights = {
  peopleAndDemographics: {
    numberOfPeopleVisible: number | null;
    estimatedAgeRanges: string[];
    genderPresentation: string | null;
    clothingAndStyle: string | null;
    bodyLanguageAndExpressions: string | null;
    spatialRelationships: string | null;
    relationshipInference: string | null;
  };
  settingAndEnvironment: {
    environmentType: string | null;
    locationType: string | null;
    timeOfDayAndLighting: string | null;
    lightingDescription: string | null;
    weatherConditions: string | null;
    backgroundDetails: string | null;
    architectureOrLandscape: string | null;
  };
  activitiesAndContext: {
    whatAppearsToBeHappening: string | null;
    socialDynamics: string | null;
    interactionsBetweenPeople: string | null;
    eventType: string | null;
    visibleActivities: string[];
  };
  technicalDetails: {
    photoQualityAndComposition: string | null;
    lightingAnalysis: string | null;
    notablePhotographicElements: string | null;
    objectsOfInterest: string[];
  };
  emotionalContext: {
    overallMoodAndAtmosphere: string | null;
    emotionalExpressions: string | null;
    individualEmotions: string | null;
    energyLevel: string | null;
    socialEnergy: string | null;
  };
  storyElements: {
    storyThisImageTells: string | null;
    emberStory: string | null;
    whyThisMomentMightMatter: string | null;
    whatMakesThisPhotoSpecial: string | null;
    meaningfulDetails: string | null;
    whatMightHaveHappenedBefore: string | null;
    whatMightHappenNext: string | null;
  };
};

const EMPTY_SCENE_INSIGHTS: ParsedSceneInsights = {
  peopleAndDemographics: {
    numberOfPeopleVisible: null,
    estimatedAgeRanges: [],
    genderPresentation: null,
    clothingAndStyle: null,
    bodyLanguageAndExpressions: null,
    spatialRelationships: null,
    relationshipInference: null,
  },
  settingAndEnvironment: {
    environmentType: null,
    locationType: null,
    timeOfDayAndLighting: null,
    lightingDescription: null,
    weatherConditions: null,
    backgroundDetails: null,
    architectureOrLandscape: null,
  },
  activitiesAndContext: {
    whatAppearsToBeHappening: null,
    socialDynamics: null,
    interactionsBetweenPeople: null,
    eventType: null,
    visibleActivities: [],
  },
  technicalDetails: {
    photoQualityAndComposition: null,
    lightingAnalysis: null,
    notablePhotographicElements: null,
    objectsOfInterest: [],
  },
  emotionalContext: {
    overallMoodAndAtmosphere: null,
    emotionalExpressions: null,
    individualEmotions: null,
    energyLevel: null,
    socialEnergy: null,
  },
  storyElements: {
    storyThisImageTells: null,
    emberStory: null,
    whyThisMomentMightMatter: null,
    whatMakesThisPhotoSpecial: null,
    meaningfulDetails: null,
    whatMightHaveHappenedBefore: null,
    whatMightHappenNext: null,
  },
};

function parseJsonArray<T>(value: string | null): T[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseSceneInsights(value: string | null): ParsedSceneInsights {
  if (!value) {
    return EMPTY_SCENE_INSIGHTS;
  }

  try {
    const parsed = JSON.parse(value) as ParsedSceneInsights;
    return {
      peopleAndDemographics: {
        ...EMPTY_SCENE_INSIGHTS.peopleAndDemographics,
        ...parsed.peopleAndDemographics,
        estimatedAgeRanges: Array.isArray(parsed.peopleAndDemographics?.estimatedAgeRanges)
          ? parsed.peopleAndDemographics.estimatedAgeRanges
          : [],
      },
      settingAndEnvironment: {
        ...EMPTY_SCENE_INSIGHTS.settingAndEnvironment,
        ...parsed.settingAndEnvironment,
      },
      activitiesAndContext: {
        ...EMPTY_SCENE_INSIGHTS.activitiesAndContext,
        ...parsed.activitiesAndContext,
        visibleActivities: Array.isArray(parsed.activitiesAndContext?.visibleActivities)
          ? parsed.activitiesAndContext.visibleActivities
          : [],
      },
      technicalDetails: {
        ...EMPTY_SCENE_INSIGHTS.technicalDetails,
        ...parsed.technicalDetails,
        objectsOfInterest: Array.isArray(parsed.technicalDetails?.objectsOfInterest)
          ? parsed.technicalDetails.objectsOfInterest
          : [],
      },
      emotionalContext: {
        ...EMPTY_SCENE_INSIGHTS.emotionalContext,
        ...parsed.emotionalContext,
      },
      storyElements: {
        ...EMPTY_SCENE_INSIGHTS.storyElements,
        ...parsed.storyElements,
      },
    };
  } catch {
    return EMPTY_SCENE_INSIGHTS;
  }
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
}

function cleanInlineText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() || null;
}

function toBulletList(items: Array<string | null | undefined>) {
  const filtered = items
    .map((item) => cleanInlineText(item))
    .filter((item): item is string => Boolean(item));

  if (filtered.length === 0) {
    return null;
  }

  return filtered.map((item) => `- ${item}`).join('\n');
}

function excerptText(value: string | null | undefined, maxLength = 280) {
  const cleaned = cleanInlineText(value);
  if (!cleaned) {
    return null;
  }

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength).trimEnd()}...`;
}

function normalizeMemoryText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim().toLowerCase() || '';
}

function extractAskVoiceNoteText(description: string | null | undefined) {
  const cleaned = cleanInlineText(description);
  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(/^ask ember voice note:?[\s-]*(.+)$/i);
  if (match?.[1]) {
    return cleanInlineText(match[1]);
  }

  return null;
}

function buildFallbackStorySnapshot({
  imageTitle,
  imageDescription,
  confirmedPeople,
  responses,
  callSummaries,
  callHighlights,
}: {
  imageTitle: string;
  imageDescription: string | null;
  confirmedPeople: string[];
  responses: Array<{
    contributorName: string;
    questionType: string;
    question: string;
    answer: string;
    source: string;
  }>;
  callSummaries: Array<{
    contributorName: string;
    summary: string;
  }>;
  callHighlights: Array<{
    contributorName: string;
    title: string;
    quote: string;
    significance: string | null;
    speaker: string | null;
    canUseForTitle: boolean;
  }>;
}) {
  const contextAnswer =
    responses.find((response) => response.questionType === 'context')?.answer ||
    responses.find((response) => response.questionType === 'what')?.answer ||
    callSummaries[0]?.summary ||
    callHighlights[0]?.quote ||
    cleanInlineText(imageDescription) ||
    null;

  const whereAnswer =
    responses.find((response) => response.questionType === 'where')?.answer || null;
  const whenAnswer =
    responses.find((response) => response.questionType === 'when')?.answer || null;
  const whyAnswer =
    responses.find((response) => response.questionType === 'why')?.answer ||
    callHighlights.find((highlight) => highlight.significance)?.significance ||
    null;

  const parts = [
    contextAnswer ? excerptText(contextAnswer, 320) : null,
    confirmedPeople.length > 0 ? `People identified: ${confirmedPeople.join(', ')}` : null,
    whereAnswer ? `Location noted: ${excerptText(whereAnswer, 140)}` : null,
    whenAnswer ? `Timing noted: ${excerptText(whenAnswer, 140)}` : null,
    whyAnswer ? `Why it mattered: ${excerptText(whyAnswer, 180)}` : null,
  ].filter((part): part is string => Boolean(part));

  if (parts.length > 0) {
    return parts.join('\n\n');
  }

  return `${imageTitle} is being assembled from the current Ember record. Regenerate again after more details are added to deepen the snapshot.`;
}

function formatAudioTimestamp(ms: number | null | undefined) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) {
    return null;
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatAudioRange(startMs: number | null | undefined, endMs: number | null | undefined) {
  const start = formatAudioTimestamp(startMs);
  const end = formatAudioTimestamp(endMs);

  if (start && end) {
    return `${start}-${end}`;
  }

  return start || end || null;
}

async function fetchImageForWiki(imageId: string) {
  return prisma.image.findUnique({
    where: { id: imageId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      analysis: true,
      attachments: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          originalName: true,
          mediaType: true,
          description: true,
          analysisText: true,
          createdAt: true,
        },
      },
      sportsMode: true,
      tags: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          contributor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      contributors: {
        include: {
          emberSession: {
            include: {
              messages: {
                orderBy: { createdAt: 'asc' },
              },
            },
          },
          voiceCalls: {
            where: {
              OR: [
                {
                  callSummary: {
                    not: null,
                  },
                },
                {
                  transcript: {
                    not: null,
                  },
                },
              ],
            },
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: {
              id: true,
              createdAt: true,
              callSummary: true,
              transcript: true,
              recordingUrl: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

export async function generateWikiForImage(imageId: string): Promise<string> {
  await ensureImageAnalysisForImage(imageId).catch((error) => {
    console.error('Image analysis failed during wiki generation:', error);
  });

  const image = await fetchImageForWiki(imageId);

  if (!image) {
    throw new Error('Image not found');
  }

  const getContributorLabel = (contributor: (typeof image.contributors)[number]) =>
    cleanInlineText(contributor.name) ||
    cleanInlineText(contributor.user?.name) ||
    cleanInlineText(contributor.email) ||
    cleanInlineText(contributor.phoneNumber) ||
    'Contributor';

  const getContributorKind = (contributor: (typeof image.contributors)[number]) => {
    if (contributor.userId && contributor.userId === image.ownerId) {
      return 'owner' as const;
    }

    if (contributor.userId) {
      return 'contributor' as const;
    }

    return 'guest' as const;
  };

  const renderSection = (title: string, body: string) => `## ${title}\n\n${body}`;

  const voiceCallIds = image.contributors.flatMap((contributor) =>
    contributor.voiceCalls.map((voiceCall) => voiceCall.id)
  );
  const voiceCallClipsByVoiceCallId = new Map<
    string,
    Array<{
      title: string;
      quote: string;
      significance: string | null;
      speaker: string | null;
      startMs: number | null;
      endMs: number | null;
      canUseForTitle: boolean;
    }>
  >();

  if (voiceCallIds.length > 0) {
    try {
      const clips = await prisma.voiceCallClip.findMany({
        where: {
          voiceCallId: {
            in: voiceCallIds,
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          voiceCallId: true,
          title: true,
          quote: true,
          significance: true,
          speaker: true,
          startMs: true,
          endMs: true,
          canUseForTitle: true,
        },
      });

      for (const clip of clips) {
        const existing = voiceCallClipsByVoiceCallId.get(clip.voiceCallId) || [];
        existing.push({
          title: clip.title,
          quote: clip.quote,
          significance: clip.significance,
          speaker: clip.speaker,
          startMs: clip.startMs,
          endMs: clip.endMs,
          canUseForTitle: clip.canUseForTitle,
        });
        voiceCallClipsByVoiceCallId.set(clip.voiceCallId, existing);
      }
    } catch (voiceClipError) {
      console.error('Voice clip load failed during wiki generation:', voiceClipError);
    }
  }

  const allResponses: {
    contributorName: string;
    questionType: string;
    question: string;
    answer: string;
    source: string;
  }[] = [];
  const callSummaries: {
    contributorName: string;
    summary: string;
  }[] = [];
  const callHighlights: {
    contributorName: string;
    title: string;
    quote: string;
    significance: string | null;
    speaker: string | null;
    canUseForTitle: boolean;
  }[] = [];
  const storyCircleEntries: Array<{
    contributorLabel: string;
    kind: 'owner' | 'contributor' | 'guest';
    createdAt: Date;
    summary: string | null;
    transcript: string | null;
    recordingUrl: string | null;
    sourceLabel: string;
    askConversationExcerpt: string | null;
    clips: Array<{
      title: string;
      quote: string;
      significance: string | null;
      speaker: string | null;
      timeRange: string | null;
      canUseForTitle: boolean;
    }>;
    askNotes: Array<{
      topic: string;
      answer: string;
      source: string;
      createdAt: Date;
    }>;
  }> = [];
  const ownerStoryLabel = cleanInlineText(image.owner.name) || image.owner.email || 'Owner';

  for (const contributor of image.contributors) {
    const contributorLabel = getContributorLabel(contributor);
    const conversationResponses = (contributor.emberSession?.messages || []).filter(
      (m) => m.role === 'user' && m.questionType
    );

    if (conversationResponses.length > 0) {
      for (const response of conversationResponses) {
        allResponses.push({
          contributorName: contributorLabel,
          questionType: response.questionType!,
          question: response.question || '',
          answer: response.content,
          source: response.source,
        });
      }
    }

    for (const voiceCall of contributor.voiceCalls) {
      const summary = cleanInlineText(voiceCall.callSummary);
      const transcript = cleanInlineText(voiceCall.transcript);
      const voiceCallClips = voiceCallClipsByVoiceCallId.get(voiceCall.id) || [];

      storyCircleEntries.push({
        contributorLabel,
        kind: getContributorKind(contributor),
        createdAt: voiceCall.createdAt,
        summary,
        transcript,
        recordingUrl: voiceCall.recordingUrl,
        sourceLabel:
          getContributorKind(contributor) === 'owner'
            ? 'Owner voice interview'
            : getContributorKind(contributor) === 'guest'
              ? 'Guest voice interview'
              : 'Contributor voice interview',
        askConversationExcerpt: null,
        clips: voiceCallClips.map((clip) => ({
          title: cleanInlineText(clip.title) || 'Voice Highlight',
          quote: cleanInlineText(clip.quote) || '',
          significance: cleanInlineText(clip.significance),
          speaker: cleanInlineText(clip.speaker),
          timeRange: formatAudioRange(clip.startMs, clip.endMs),
          canUseForTitle: clip.canUseForTitle,
        })),
        askNotes: [],
      });

      if (summary) {
        callSummaries.push({
          contributorName: contributorLabel,
          summary,
        });
      }

      for (const clip of voiceCallClips) {
        const quote = cleanInlineText(clip.quote);
        if (!quote) {
          continue;
        }

        callHighlights.push({
          contributorName: contributorLabel,
          title: cleanInlineText(clip.title) || 'Voice Highlight',
          quote,
          significance: cleanInlineText(clip.significance),
          speaker: cleanInlineText(clip.speaker),
          canUseForTitle: clip.canUseForTitle,
        });
      }
    }

    const askDerivedNotes = conversationResponses
      .filter((response) => {
        const source = cleanInlineText(response.source)?.toLowerCase();
        return source === 'web' || source === 'voice';
      })
      .slice(-4)
      .map((response) => ({
        questionType: response.questionType!,
        answer: cleanInlineText(response.content),
        source: cleanInlineText(response.source) || 'web',
        createdAt: response.createdAt,
      }))
      .filter(
        (note): note is {
          questionType: string;
          answer: string;
          source: string;
          createdAt: Date;
        } => Boolean(note.answer)
      );

    const allSessionMessages = contributor.emberSession?.messages || [];
    const askConversationTextSet = new Set(
      allSessionMessages
        .filter((message) => {
          const source = cleanInlineText(message.source)?.toLowerCase();
          return source === 'web' || source === 'voice';
        })
        .map((message) => normalizeMemoryText(message.content))
        .filter((text) => Boolean(text))
    );

    const dedupedAskNotes = askDerivedNotes.filter((note) => {
      const normalizedAnswer = normalizeMemoryText(note.answer);
      return normalizedAnswer ? !askConversationTextSet.has(normalizedAnswer) : true;
    });

    const askConversationMessages =
      allSessionMessages
        .filter((message) => {
          const source = cleanInlineText(message.source)?.toLowerCase();
          return source === 'web' || source === 'voice';
        })
        .slice(-6)
        .map((message) => {
          const speaker = message.role === 'assistant' ? 'Ember' : contributorLabel;
          const text = cleanInlineText(message.content);
          return text ? `- **${speaker}:** ${text}` : null;
        })
        .filter((line): line is string => Boolean(line))
        .join('\n') || null;

    if (dedupedAskNotes.length > 0 || askConversationMessages) {
      storyCircleEntries.push({
        contributorLabel,
        kind: getContributorKind(contributor),
        createdAt:
          dedupedAskNotes[dedupedAskNotes.length - 1]?.createdAt ||
          contributor.emberSession?.updatedAt ||
          contributor.createdAt,
        summary: null,
        transcript: null,
        recordingUrl: null,
        sourceLabel: 'Ask Ember memory notes',
        askConversationExcerpt: askConversationMessages,
        clips: [],
        askNotes: dedupedAskNotes.map((note) => ({
          topic: note.questionType,
          answer: note.answer,
          source: note.source,
          createdAt: note.createdAt,
        })),
      });
    }
  }

  const knownAskMemoryTexts = new Set(
    allResponses
      .map((response) => normalizeMemoryText(response.answer))
      .filter((value) => Boolean(value))
  );

  const askVoiceAttachmentNotes = image.attachments
    .filter((attachment) => attachment.mediaType === 'AUDIO')
    .map((attachment) => {
      const transcript = extractAskVoiceNoteText(attachment.description);
      return transcript
        ? {
            originalName: attachment.originalName,
            transcript,
            createdAt: attachment.createdAt,
          }
        : null;
    })
    .filter(
      (note): note is { originalName: string; transcript: string; createdAt: Date } => Boolean(note)
    )
    .filter((note) => {
      const normalized = normalizeMemoryText(note.transcript);
      if (!normalized || knownAskMemoryTexts.has(normalized)) {
        return false;
      }

      knownAskMemoryTexts.add(normalized);
      return true;
    });

  if (askVoiceAttachmentNotes.length > 0) {
    for (const note of askVoiceAttachmentNotes) {
      allResponses.push({
        contributorName: ownerStoryLabel,
        questionType: 'followup',
        question: 'What else would you like Ember to remember about this moment?',
        answer: note.transcript,
        source: 'audio',
      });

      callHighlights.push({
        contributorName: ownerStoryLabel,
        title: 'Ask voice note',
        quote: note.transcript,
        significance: 'Shared directly through Ask Ember voice input.',
        speaker: ownerStoryLabel,
        canUseForTitle: true,
      });
    }

    storyCircleEntries.push({
      contributorLabel: ownerStoryLabel,
      kind: 'owner',
      createdAt: askVoiceAttachmentNotes[askVoiceAttachmentNotes.length - 1]?.createdAt || image.createdAt,
      summary: 'Additional memory details captured through Ask Ember voice notes.',
      transcript: null,
      recordingUrl: null,
      sourceLabel: 'Ask Ember voice notes',
      askConversationExcerpt: null,
      clips: askVoiceAttachmentNotes.map((note) => ({
        title: note.originalName || 'Ask voice note',
        quote: note.transcript,
        significance: 'Saved from Ask Ember voice input.',
        speaker: ownerStoryLabel,
        timeRange: null,
        canUseForTitle: true,
      })),
      askNotes: [],
    });
  }

  if (
    !image.analysis &&
    !image.sportsMode &&
    allResponses.length === 0 &&
    callHighlights.length === 0 &&
    !image.description?.trim() &&
    image.attachments.every((attachment) => !attachment.description?.trim())
  ) {
    throw new Error('No image analysis or contributor memories available to generate a wiki');
  }

  const imageTitle = getEmberTitle(image);
  const confirmedPeople = Array.from(
    new Set(
      image.tags
        .map((tag) => tag.user?.name || tag.contributor?.name || tag.label)
        .map((label) => label?.trim())
        .filter((label): label is string => Boolean(label))
    )
  );
  const confirmedTags = image.tags
    .map((tag) => ({
      label: (tag.user?.name || tag.contributor?.name || tag.label || '').trim(),
      userId: tag.userId,
      contributorId: tag.contributorId,
      leftPct: tag.leftPct,
      topPct: tag.topPct,
      widthPct: tag.widthPct,
      heightPct: tag.heightPct,
    }))
    .filter((tag) => tag.label);
  const confirmedLocation = parseConfirmedLocationContext(image.analysis?.metadataJson);
  const analysisContext = image.analysis
    ? {
        status: image.analysis.status,
        errorMessage: image.analysis.errorMessage,
        summary: image.analysis.summary,
        visualDescription: image.analysis.visualDescription,
        metadataSummary: image.analysis.metadataSummary,
        mood: image.analysis.mood,
        capturedAt: image.analysis.capturedAt?.toISOString() || null,
        latitude: image.analysis.latitude,
        longitude: image.analysis.longitude,
        cameraMake: image.analysis.cameraMake,
        cameraModel: image.analysis.cameraModel,
        lensModel: image.analysis.lensModel,
        people: parseJsonArray<ParsedEntity>(image.analysis.peopleJson),
        places: parseJsonArray<ParsedEntity>(image.analysis.placesJson),
        things: parseJsonArray<ParsedEntity>(image.analysis.thingsJson),
        activities: parseJsonArray<string>(image.analysis.activitiesJson),
        visibleText: parseJsonArray<string>(image.analysis.visibleTextJson),
        keywords: parseJsonArray<string>(image.analysis.keywordsJson),
        openQuestions: parseJsonArray<string>(image.analysis.openQuestionsJson),
        sceneInsights: parseSceneInsights(image.analysis.sceneInsightsJson),
      }
    : null;
  const sportsContext = image.sportsMode
    ? {
        sportType: image.sportsMode.sportType,
        subjectName: image.sportsMode.subjectName,
        teamName: image.sportsMode.teamName,
        opponentName: image.sportsMode.opponentName,
        eventName: image.sportsMode.eventName,
        season: image.sportsMode.season,
        outcome: image.sportsMode.outcome,
        finalScore: image.sportsMode.finalScore,
        rawDetails: image.sportsMode.rawDetails,
        summary: image.sportsMode.summary,
        statLines: parseSportsModeJson(image.sportsMode.statLinesJson),
        highlights: parseSportsHighlightsJson(image.sportsMode.highlightsJson),
      }
    : null;

  let storySnapshot = '';
  try {
    storySnapshot = await generateWiki({
      imageTitle,
      imageDescription: image.description,
      confirmedPeople,
      confirmedTags,
      confirmedLocation,
      analysis: analysisContext,
      sportsMode: sportsContext,
      responses: allResponses,
      callSummaries,
      callHighlights,
    });
  } catch (storySnapshotError) {
    console.error('Story snapshot generation failed, using fallback snapshot:', storySnapshotError);
    storySnapshot = buildFallbackStorySnapshot({
      imageTitle,
      imageDescription: image.description,
      confirmedPeople,
      responses: allResponses,
      callSummaries,
      callHighlights,
    });
  }

  const ownerLabel = cleanInlineText(image.owner.name) || image.owner.email;
  const linkedContributors = image.contributors.filter(
    (contributor) => getContributorKind(contributor) === 'contributor'
  );
  const guestContributors = image.contributors.filter(
    (contributor) => getContributorKind(contributor) === 'guest'
  );

  const contributorsSection =
    toBulletList([
      `Owner: ${ownerLabel}`,
      `Contributors: ${
        linkedContributors.length > 0
          ? linkedContributors.map((contributor) => getContributorLabel(contributor)).join(', ')
          : 'None yet'
      }`,
      `Guests: ${
        guestContributors.length > 0
          ? guestContributors.map((contributor) => getContributorLabel(contributor)).join(', ')
          : 'None yet'
      }`,
    ]) || 'No contributors have been added yet.';

  const storyCircleSection =
    storyCircleEntries.length > 0
      ? storyCircleEntries
          .map((entry) => {
            const lines = [
              `### ${entry.contributorLabel}`,
              `- Source: ${entry.sourceLabel}`,
              entry.createdAt ? `- Recorded: ${formatDateTime(entry.createdAt)}` : null,
              entry.summary ? `- Summary: ${entry.summary}` : null,
              entry.transcript ? `- Transcript excerpt: ${excerptText(entry.transcript, 360)}` : null,
              entry.askConversationExcerpt ? `- Ask excerpt:\n${entry.askConversationExcerpt}` : null,
              ...entry.clips
                .filter((clip) => clip.quote)
                .map((clip) =>
                  [
                    `- Highlight clip: ${clip.title}`,
                    clip.timeRange ? `(${clip.timeRange})` : null,
                    clip.speaker ? `from ${clip.speaker}` : null,
                    `— "${clip.quote}"`,
                    clip.significance ? `(${clip.significance})` : null,
                    clip.canUseForTitle ? '[smart title option]' : null,
                  ]
                    .filter(Boolean)
                    .join(' ')
                ),
              ...entry.askNotes.map((note) =>
                `- Memory note (${note.topic}${note.source ? `, ${note.source}` : ''}): ${note.answer}`
              ),
              entry.recordingUrl ? '- Recording: available' : null,
            ]
              .filter((line): line is string => Boolean(line))
              .join('\n');

            return lines;
          })
          .join('\n\n')
      : 'No voice recording or transcript has been added to the story circle yet.';

  const renderConversationSection = (
    contributors: (typeof image.contributors),
    emptyMessage: string
  ) => {
    const blocks = contributors.flatMap((contributor) => {
      const label = getContributorLabel(contributor);
      const allMessages = contributor.emberSession?.messages || [];
      const conversationMessages = allMessages
        .map((message) => ({
          speaker: message.role === 'assistant' ? 'Ember' : label,
          text: cleanInlineText(message.content),
        }))
        .filter((message): message is { speaker: string; text: string } => Boolean(message.text));

      const fallbackResponses =
        conversationMessages.length === 0
          ? allMessages
              .filter((m) => m.role === 'user' && m.questionType)
              .flatMap((response) => {
                const question = cleanInlineText(response.question);
                const answer = cleanInlineText(response.content);

                return [
                  question ? { speaker: 'Ember', text: question } : null,
                  answer ? { speaker: label, text: answer } : null,
                ].filter((entry): entry is { speaker: string; text: string } => Boolean(entry));
              })
          : [];

      const transcript = (conversationMessages.length > 0 ? conversationMessages : fallbackResponses).slice(-8);
      if (transcript.length === 0) {
        return [];
      }

      return [
        `### ${label}\n\n${transcript
          .map((entry) => `- **${entry.speaker}:** ${entry.text}`)
          .join('\n')}`,
      ];
    });

    return blocks.length > 0 ? blocks.join('\n\n') : emptyMessage;
  };

  const taggedPeopleSection =
    image.tags.length > 0
      ? image.tags
          .map((tag) => {
            const details: string[] = [];
            const contact = cleanInlineText(tag.user?.email || tag.contributor?.email || tag.email);
            if (contact) {
              details.push(contact);
            }

            return `- ${tag.label}${details.length ? ` (${details.join(', ')})` : ''}`;
          })
          .join('\n')
      : 'No people have been tagged yet.';

  const mediaSection =
    toBulletList([
      `Main media: ${image.mediaType === 'VIDEO' ? 'Video' : 'Photo'} (${image.originalName})`,
      `Story title: ${imageTitle}`,
      `Caption: ${cleanInlineText(image.description) || 'No caption added yet.'}`,
    ]) || 'No primary media details are available yet.';

  const supportingMediaSection =
    image.attachments.length > 0
      ? image.attachments
          .map((attachment, index) => {
            const typeLabel =
              attachment.mediaType === 'VIDEO'
                ? 'Video'
                : attachment.mediaType === 'AUDIO'
                  ? 'Audio'
                  : 'Photo';
            const note = cleanInlineText(attachment.description);
            const listLine = `- ${typeLabel} ${index + 1}: ${attachment.originalName}${note ? ` — ${note}` : ''}`;
            const analysis = attachment.mediaType !== 'AUDIO' && attachment.analysisText?.trim()
              ? `\n\n### ${typeLabel} ${index + 1}: ${attachment.originalName}\n\n${attachment.analysisText.trim()}`
              : '';
            return listLine + analysis;
          })
          .join('\n')
      : 'No supporting media has been added yet.';

  const geolocationSection =
    toBulletList([
      confirmedLocation
        ? `Confirmed location: ${confirmedLocation.label}${
            confirmedLocation.detail ? `, ${confirmedLocation.detail}` : ''
          }`
        : null,
      analysisContext?.latitude != null && analysisContext?.longitude != null
        ? `Coordinates: ${analysisContext.latitude}, ${analysisContext.longitude}`
        : null,
    ]) || 'No geolocation has been confirmed yet.';

  const timeAndDateSection =
    toBulletList([
      analysisContext?.capturedAt
        ? `Captured: ${formatDateTime(analysisContext.capturedAt)}`
        : 'Captured: No photo timestamp available.',
      `Ember created: ${formatDateTime(image.createdAt) || 'Unknown'}`,
    ]) || 'No time or date details are available yet.';

  const imageAnalysisSection =
    toBulletList([
      analysisContext?.visualDescription,
      analysisContext?.summary,
      analysisContext?.metadataSummary,
      analysisContext?.mood ? `Mood: ${analysisContext.mood}` : null,
      analysisContext?.activities?.length
        ? `Activities: ${analysisContext.activities.slice(0, 6).join(', ')}`
        : null,
      analysisContext?.keywords?.length
        ? `Keywords: ${analysisContext.keywords.slice(0, 8).join(', ')}`
        : null,
    ]) || 'No image analysis is available yet.';

  const wikiContent = [
    renderSection('Story Title', imageTitle),
    renderSection(
      'Story Snapshot',
      storySnapshot.trim() || 'No story snapshot has been generated yet.'
    ),
    renderSection('Contributors', contributorsSection),
    renderSection('Story Circle (Voice Recorded and or Transcribed)', storyCircleSection),
    renderSection(
      'Convos Between Owner & Ember',
      renderConversationSection(
        image.contributors.filter((contributor) => getContributorKind(contributor) === 'owner'),
        'No owner conversation with Ember has been recorded yet.'
      )
    ),
    renderSection(
      'Convos Between Contributors & Ember',
      renderConversationSection(
        linkedContributors,
        'No contributor conversations with Ember have been recorded yet.'
      )
    ),
    renderSection(
      'Convos Between Guests & Ember',
      renderConversationSection(
        guestContributors,
        'No guest conversations with Ember have been recorded yet.'
      )
    ),
    renderSection('Tagged People', taggedPeopleSection),
    renderSection('Media', mediaSection),
    renderSection('Supporting Media', supportingMediaSection),
    renderSection('Geolocation', geolocationSection),
    renderSection('Time & Date', timeAndDateSection),
    renderSection('Image Analysis', imageAnalysisSection),
  ].join('\n\n');

  // Save or update wiki
  const existingWiki = await prisma.wiki.findUnique({
    where: { imageId },
  });

  if (existingWiki) {
    await prisma.wiki.update({
      where: { id: existingWiki.id },
      data: {
        content: wikiContent,
        version: existingWiki.version + 1,
      },
    });
  } else {
    await prisma.wiki.create({
      data: {
        imageId,
        content: wikiContent,
      },
    });
  }

  return wikiContent;
}
