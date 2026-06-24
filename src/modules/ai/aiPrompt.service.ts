import { AI_TYPES } from "../../constants/enums";

type MockAiOutput = {
  resultText: string;
  score?: number;
};

const stringifyResult = (payload: unknown) => {
  return JSON.stringify(payload, null, 2);
};

const buildContext = (inputText: string, targetRole?: string) => {
  return {
    targetRole: targetRole || "General role",
    cvPreview: inputText.slice(0, 500)
  };
};

const buildFeedbackResult = (inputText: string, targetRole?: string): MockAiOutput => {
  return {
    resultText: stringifyResult({
      ...buildContext(inputText, targetRole),
      overallFeedback:
        "Your CV is clear but can be improved with stronger achievement descriptions.",
      strengths: [
        "Clear education and contact information",
        "Relevant technical skills are visible"
      ],
      weaknesses: [
        "Experience descriptions are too general",
        "Missing measurable achievements"
      ],
      suggestions: [
        "Add numbers to describe impact",
        "Use action verbs at the start of bullet points",
        "Tailor skills and projects to the target role"
      ]
    })
  };
};

const buildScoringResult = (inputText: string, targetRole?: string): MockAiOutput => {
  const score = 78;

  return {
    score,
    resultText: stringifyResult({
      ...buildContext(inputText, targetRole),
      overallScore: score,
      subScores: {
        format: 80,
        clarity: 75,
        skills: 82,
        experience: 70,
        relevance: 78
      },
      explanation:
        "The CV has a good structure but needs stronger achievement-based descriptions.",
      improvementChecklist: [
        "Add measurable achievements",
        "Improve project descriptions",
        "Include keywords from the target role"
      ]
    })
  };
};

const buildTranslationResult = (inputText: string): MockAiOutput => {
  return {
    resultText: stringifyResult({
      translatedText:
        "Professional English translation of the CV content will appear here.",
      sourcePreview: inputText.slice(0, 500),
      notes: [
        "Please review the translation before using it for real job applications.",
        "AI translation may need human editing for tone and accuracy."
      ]
    })
  };
};

const buildMockAiResult = ({
  aiType,
  inputText,
  targetRole
}: {
  aiType: string;
  inputText: string;
  targetRole?: string;
}): MockAiOutput => {
  if (aiType === AI_TYPES.CV_FEEDBACK) {
    return buildFeedbackResult(inputText, targetRole);
  }

  if (aiType === AI_TYPES.CV_SCORING) {
    return buildScoringResult(inputText, targetRole);
  }

  if (aiType === AI_TYPES.CV_TRANSLATION) {
    return buildTranslationResult(inputText);
  }

  throw new Error(`Unsupported AI type: ${aiType}`);
};

export {
  buildMockAiResult
};
