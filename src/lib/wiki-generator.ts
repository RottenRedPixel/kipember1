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

async function fetchImageForWiki(imageId: string) {
  return prisma.image.findUnique({
    where: { id: imageId },
    include: {
      analysis: true,
      attachments: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          originalName: true,
          mediaType: true,
          description: true,
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
          conversation: {
            include: {
              responses: true,
            },
          },
          voiceCalls: {
            where: {
              callSummary: {
                not: null,
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: {
              callSummary: true,
            },
          },
        },
      },
    },
  });
}

function appendAttachmentNotes(
  wikiContent: string,
  attachments: Array<{
    originalName: string;
    mediaType: 'IMAGE' | 'VIDEO';
    description: string | null;
  }>
) {
  const describedAttachments = attachments.filter(
    (attachment) => attachment.description && attachment.description.trim().length > 0
  );

  if (describedAttachments.length === 0) {
    return wikiContent;
  }

  const sectionLines = describedAttachments.map((attachment, index) => {
    const mediaLabel = attachment.mediaType === 'VIDEO' ? 'Video' : 'Photo';
    return `${index + 1}. **${mediaLabel} ${index + 1}** (${attachment.originalName})\n   ${attachment.description?.trim()}`;
  });

  return `${wikiContent.trim()}\n\n## Added Photos And Notes\n\n${sectionLines.join('\n\n')}`;
}

export async function generateWikiForImage(imageId: string): Promise<string> {
  await ensureImageAnalysisForImage(imageId).catch((error) => {
    console.error('Image analysis failed during wiki generation:', error);
  });

  const image = await fetchImageForWiki(imageId);

  if (!image) {
    throw new Error('Image not found');
  }

  // Collect all saved contributor responses, including follow-up additions.
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

  for (const contributor of image.contributors) {
    if (contributor.conversation?.responses) {
      for (const response of contributor.conversation.responses) {
        allResponses.push({
          contributorName: contributor.name || 'Anonymous',
          questionType: response.questionType,
          question: response.question,
          answer: response.answer,
          source: response.source,
        });
      }
    }

    for (const voiceCall of contributor.voiceCalls) {
      const summary = voiceCall.callSummary?.trim();
      if (!summary) {
        continue;
      }

      callSummaries.push({
        contributorName: contributor.name || 'Anonymous',
        summary,
      });
    }
  }

  if (
    !image.analysis &&
    !image.sportsMode &&
    allResponses.length === 0 &&
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

  const wikiContent = await generateWiki({
    imageTitle,
    imageDescription: image.description,
    confirmedPeople,
    confirmedTags,
    confirmedLocation,
    analysis: image.analysis
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
      : null,
    sportsMode: image.sportsMode
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
      : null,
    responses: allResponses,
    callSummaries,
  });
  const wikiWithAttachmentNotes = appendAttachmentNotes(wikiContent, image.attachments);

  // Save or update wiki
  const existingWiki = await prisma.wiki.findUnique({
    where: { imageId },
  });

  if (existingWiki) {
    await prisma.wiki.update({
      where: { id: existingWiki.id },
      data: {
        content: wikiWithAttachmentNotes,
        version: existingWiki.version + 1,
      },
    });
  } else {
    await prisma.wiki.create({
      data: {
        imageId,
        content: wikiWithAttachmentNotes,
      },
    });
  }

  return wikiWithAttachmentNotes;
}
