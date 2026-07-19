import ApiError from "../../utils/apiError";
import { PORTFOLIO_EXPERIENCE_STATUSES, PORTFOLIO_EXPERIENCE_VISIBILITIES, PORTFOLIO_MOMENT_STATUSES } from "../../constants/enums";
import Portfolio from "./portfolio.model";
import PortfolioAsset from "./portfolioAsset.model";
import PortfolioEvidence from "./portfolioEvidence.model";
import PortfolioExperience from "./portfolioExperience.model";
import { serializeExperience } from "./portfolioExperience.service";
import PortfolioMoment from "./portfolioMoment.model";
import { serializeMoment } from "./portfolioMoment.service";
import { serializePortfolio } from "./portfolioCollection.service";
import { serializeEvidence } from "./portfolioEvidence.service";

const toId = (value) => value?.toString();

const getPublicPortfolio = async (slug: string) => {
  const portfolio = await Portfolio.findOne({
    slug,
    $or: [
      { visibility: "PUBLIC" },
      { isPublic: true }
    ]
  }).lean();

  if (!portfolio) {
    throw new ApiError(404, "Public portfolio not found");
  }

  const experiences = await PortfolioExperience.find({
    applicantId: portfolio.applicantId,
    portfolioId: portfolio._id,
    status: PORTFOLIO_EXPERIENCE_STATUSES.PUBLISHED,
    visibility: PORTFOLIO_EXPERIENCE_VISIBILITIES.PORTFOLIO
  })
    .sort({ createdAt: -1 })
    .lean();
  const experienceIds = experiences.map((experience) => experience._id);
  const moments = await PortfolioMoment.find({
    applicantId: portfolio.applicantId,
    portfolioId: portfolio._id,
    status: PORTFOLIO_MOMENT_STATUSES.READY,
    visibility: PORTFOLIO_EXPERIENCE_VISIBILITIES.PORTFOLIO,
    $or: [{ experienceId: { $in: experienceIds } }, { experienceId: null }]
  })
    .sort({ capturedAt: -1 })
    .lean();
  const evidence = await PortfolioEvidence.find({
    applicantId: portfolio.applicantId,
    experienceId: { $in: experienceIds }
  })
    .sort({ createdAt: -1 })
    .lean();

  const assetIds = [
    ...experiences.map((experience) => experience.coverAssetId).filter(Boolean),
    ...moments.flatMap((moment) => moment.mediaAssetIds || []),
    ...evidence.map((item) => item.assetId).filter(Boolean)
  ];
  const assets = await PortfolioAsset.find({
    _id: { $in: assetIds },
    applicantId: portfolio.applicantId,
    portfolioId: portfolio._id
  }).lean();
  const assetsById = new Map(assets.map((asset) => [asset._id.toString(), asset]));

  const publicExperiences = experiences.map((experience) => {
    return serializeExperience(
      experience,
      assetsById.get(toId(experience.coverAssetId)),
      false
    );
  });

  const publicMoments = moments.map((moment) =>
    serializeMoment(
      moment,
      (moment.mediaAssetIds || []).map((assetId) => assetsById.get(toId(assetId))).filter(Boolean),
      false
    )
  );
  const momentsByExperience = publicMoments.reduce((groups, moment) => {
    const key = moment.experienceId || "unassigned";
    const group = groups.find((item) => item.experienceId === (moment.experienceId || null));
    if (group) {
      group.moments.push(moment);
    } else {
      groups.push({ experienceId: moment.experienceId || null, moments: [moment] });
    }
    return groups;
  }, []);

  const publicEvidence = evidence.map((item) =>
    serializeEvidence(item, assetsById.get(toId(item.assetId)), false)
  );
  const featuredIds = new Set((portfolio.featuredExperienceIds || []).map(toId));
  const featuredExperiences = publicExperiences.filter((experience) => featuredIds.has(experience.id));

  return {
    portfolio: serializePortfolio(
      portfolio,
      {
        experienceCount: publicExperiences.length,
        momentCount: publicMoments.length
      },
      false
    ),
    featuredExperiences,
    experiences: publicExperiences,
    moments: publicMoments,
    momentsByExperience,
    evidence: publicEvidence
  };
};

export { getPublicPortfolio };
