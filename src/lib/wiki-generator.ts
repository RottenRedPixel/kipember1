import { prisma } from './db';
import { getEmberTitle } from './ember-title';
import { ensureImageAnalysisForImage } from './image-analysis';
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
    relationshipInference: string | null;
  };
  settingAndEnvironment: {
    locationType: string | null;
    timeOfDayAndLighting: string | null;
    weatherConditions: string | null;
    backgroundDetails: string | null;
    architectureOrLandscape: string | null;
  };
  activitiesAndContext: {
    whatAppearsToBeHappening: string | null;
    socialDynamics: string | null;
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
    socialEnergy: string | null;
  };
  storyElements: {
    storyThisImageTells: string | null;
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
    relationshipInference: null,
  },
  settingAndEnvironment: {
    locationType: null,
    timeOfDayAndLighting: null,
    weatherConditions: null,
    backgroundDetails: null,
    architectureOrLandscape: null,
  },
  activitiesAndContext: {
    whatAppearsToBeHappening: null,
    socialDynamics: null,
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
    socialEnergy: null,
  },
  storyElements: {
    storyThisImageTells: null,
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
      sportsMode: true,
      contributors: {
        include: {
          conversation: {
            where: { status: 'completed' },
            include: {
              responses: true,
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

  // Collect all responses from completed conversations
  const allResponses: {
    contributorName: string;
    questionType: string;
    question: string;
    answer: string;
  }[] = [];

  for (const contributor of image.contributors) {
    if (contributor.conversation?.responses) {
      for (const response of contributor.conversation.responses) {
        allResponses.push({
          contributorName: contributor.name || 'Anonymous',
          questionType: response.questionType,
          question: response.question,
          answer: response.answer,
        });
      }
    }
  }

  if (!image.analysis && !image.sportsMode && allResponses.length === 0 && !image.description?.trim()) {
    throw new Error('No image analysis or completed interviews available to generate a wiki');
  }

  const imageTitle = getEmberTitle(image);

  const wikiContent = await generateWiki({
    imageTitle,
    imageDescription: image.description,
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
  });

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
