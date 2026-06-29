import ApiError from "../../utils/apiError";
import { VISIBILITIES } from "../../constants/enums";
import ApplicantProfile from "../applicantProfiles/applicantProfile.model";
import Portfolio from "./portfolio.model";
import PortfolioItem from "./portfolioItem.model";

type PortfolioPayload = {
  title?: string;
  introduction?: string;
  visibility?: string;
  coverImageUrl?: string;
};

type PortfolioItemPayload = {
  title?: string;
  description?: string;
  imageUrl?: string;
  eventName?: string;
  eventRole?: string;
  eventDate?: string;
  location?: string;
  visibility?: string;
};

type SerializePortfolioOptions = {
  includeApplicantProfileId?: boolean;
};

const trimOptional = (value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.trim();
};

const serializePortfolio = (
  portfolio,
  options: SerializePortfolioOptions = { includeApplicantProfileId: true }
) => {
  if (!portfolio) {
    return null;
  }

  const payload: {
    id: string;
    applicantProfileId?: string;
    title: string;
    introduction: string;
    visibility: string;
    coverImageUrl: string;
    createdAt: Date;
    updatedAt: Date;
  } = {
    id: portfolio._id.toString(),
    title: portfolio.title,
    introduction: portfolio.introduction || "",
    visibility: portfolio.visibility,
    coverImageUrl: portfolio.coverImageUrl || "",
    createdAt: portfolio.createdAt,
    updatedAt: portfolio.updatedAt
  };

  if (options.includeApplicantProfileId !== false) {
    payload.applicantProfileId = portfolio.applicantProfileId.toString();
  }

  return payload;
};

const serializePortfolioItem = (portfolioItem) => {
  if (!portfolioItem) {
    return null;
  }

  return {
    id: portfolioItem._id.toString(),
    portfolioId: portfolioItem.portfolioId.toString(),
    title: portfolioItem.title,
    description: portfolioItem.description || "",
    imageUrl: portfolioItem.imageUrl || "",
    eventName: portfolioItem.eventName || "",
    eventRole: portfolioItem.eventRole || "",
    eventDate: portfolioItem.eventDate || null,
    location: portfolioItem.location || "",
    visibility: portfolioItem.visibility,
    createdFromMobile: portfolioItem.createdFromMobile,
    createdAt: portfolioItem.createdAt,
    updatedAt: portfolioItem.updatedAt
  };
};

const getApplicantProfileForAccount = async (accountId) => {
  const profile = await ApplicantProfile.findOne({ accountId });

  if (!profile) {
    throw new ApiError(
      404,
      "Applicant profile not found. Please register an applicant account first."
    );
  }

  return profile;
};

const buildDefaultPortfolioTitle = (profile) => {
  return profile.fullName ? `${profile.fullName}'s Portfolio` : "My Portfolio";
};

const getPortfolioForAccount = async (accountId) => {
  const applicantProfile = await getApplicantProfileForAccount(accountId);
  const portfolio = await Portfolio.findOne({
    applicantProfileId: applicantProfile._id
  });

  return {
    applicantProfile,
    portfolio
  };
};

const ensurePortfolioForAccount = async (accountId) => {
  const applicantProfile = await getApplicantProfileForAccount(accountId);
  let portfolio = await Portfolio.findOne({
    applicantProfileId: applicantProfile._id
  });

  if (!portfolio) {
    portfolio = await Portfolio.create({
      applicantProfileId: applicantProfile._id,
      title: buildDefaultPortfolioTitle(applicantProfile),
      visibility: VISIBILITIES.PRIVATE
    });
  }

  return {
    applicantProfile,
    portfolio
  };
};

const createPortfolio = async (accountId, payload: PortfolioPayload) => {
  const applicantProfile = await getApplicantProfileForAccount(accountId);
  const existingPortfolio = await Portfolio.findOne({
    applicantProfileId: applicantProfile._id
  });

  if (existingPortfolio) {
    throw new ApiError(409, "Portfolio already exists");
  }

  try {
    const portfolio = await Portfolio.create({
      applicantProfileId: applicantProfile._id,
      title: payload.title.trim(),
      introduction: trimOptional(payload.introduction),
      visibility: payload.visibility || VISIBILITIES.PRIVATE,
      coverImageUrl: trimOptional(payload.coverImageUrl)
    });

    return serializePortfolio(portfolio);
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, "Portfolio already exists");
    }

    throw error;
  }
};

const getMyPortfolio = async (accountId) => {
  const { portfolio } = await getPortfolioForAccount(accountId);

  return serializePortfolio(portfolio);
};

const updateMyPortfolio = async (accountId, payload: PortfolioPayload) => {
  const { portfolio } = await getPortfolioForAccount(accountId);

  if (!portfolio) {
    throw new ApiError(404, "Portfolio not found");
  }

  if (payload.title !== undefined) {
    portfolio.title = payload.title.trim();
  }

  if (payload.introduction !== undefined) {
    portfolio.introduction = trimOptional(payload.introduction);
  }

  if (payload.visibility !== undefined) {
    portfolio.visibility = payload.visibility as "PRIVATE" | "PUBLIC";
  }

  if (payload.coverImageUrl !== undefined) {
    portfolio.coverImageUrl = trimOptional(payload.coverImageUrl);
  }

  await portfolio.save();

  return serializePortfolio(portfolio);
};

const getPublicPortfolio = async (portfolioId: string) => {
  const portfolio = await Portfolio.findOne({
    _id: portfolioId,
    visibility: VISIBILITIES.PUBLIC
  });

  if (!portfolio) {
    throw new ApiError(404, "Public portfolio not found");
  }

  const items = await PortfolioItem.find({
    portfolioId: portfolio._id,
    visibility: VISIBILITIES.PUBLIC
  }).sort({ createdAt: -1 });

  return {
    portfolio: serializePortfolio(portfolio, { includeApplicantProfileId: false }),
    items: items.map((item) => serializePortfolioItem(item))
  };
};

const toEventDate = (value?: string) => {
  if (!value) {
    return undefined;
  }

  return new Date(value);
};

const createPortfolioItem = async (
  accountId,
  payload: PortfolioItemPayload,
  options: { createdFromMobile?: boolean } = {}
) => {
  const { portfolio } = await ensurePortfolioForAccount(accountId);
  const title = trimOptional(payload.title) || trimOptional(payload.eventName) || "Portfolio Photo";

  const portfolioItem = await PortfolioItem.create({
    portfolioId: portfolio._id,
    title,
    description: trimOptional(payload.description),
    imageUrl: trimOptional(payload.imageUrl),
    eventName: trimOptional(payload.eventName),
    eventRole: trimOptional(payload.eventRole),
    eventDate: toEventDate(payload.eventDate),
    location: trimOptional(payload.location),
    visibility: payload.visibility || VISIBILITIES.PUBLIC,
    createdFromMobile: Boolean(options.createdFromMobile)
  });

  return serializePortfolioItem(portfolioItem);
};

const getMyPortfolioItems = async (accountId) => {
  const { portfolio } = await getPortfolioForAccount(accountId);

  if (!portfolio) {
    return [];
  }

  const items = await PortfolioItem.find({ portfolioId: portfolio._id }).sort({
    createdAt: -1
  });

  return items.map((item) => serializePortfolioItem(item));
};

const getOwnedPortfolioItem = async (accountId, portfolioItemId: string) => {
  const { portfolio } = await getPortfolioForAccount(accountId);

  if (!portfolio) {
    throw new ApiError(404, "Portfolio item not found");
  }

  const portfolioItem = await PortfolioItem.findOne({
    _id: portfolioItemId,
    portfolioId: portfolio._id
  });

  if (!portfolioItem) {
    throw new ApiError(404, "Portfolio item not found");
  }

  return portfolioItem;
};

const getMyPortfolioItemById = async (accountId, portfolioItemId: string) => {
  const portfolioItem = await getOwnedPortfolioItem(accountId, portfolioItemId);

  return serializePortfolioItem(portfolioItem);
};

const updatePortfolioItem = async (
  accountId,
  portfolioItemId: string,
  payload: PortfolioItemPayload
) => {
  const portfolioItem = await getOwnedPortfolioItem(accountId, portfolioItemId);

  if (payload.title !== undefined) {
    portfolioItem.title = payload.title.trim();
  }

  if (payload.description !== undefined) {
    portfolioItem.description = trimOptional(payload.description);
  }

  if (payload.imageUrl !== undefined) {
    portfolioItem.imageUrl = trimOptional(payload.imageUrl);
  }

  if (payload.eventName !== undefined) {
    portfolioItem.eventName = trimOptional(payload.eventName);
  }

  if (payload.eventRole !== undefined) {
    portfolioItem.eventRole = trimOptional(payload.eventRole);
  }

  if (payload.eventDate !== undefined) {
    portfolioItem.eventDate = toEventDate(payload.eventDate);
  }

  if (payload.location !== undefined) {
    portfolioItem.location = trimOptional(payload.location);
  }

  if (payload.visibility !== undefined) {
    portfolioItem.visibility = payload.visibility as "PRIVATE" | "PUBLIC";
  }

  await portfolioItem.save();

  return serializePortfolioItem(portfolioItem);
};

const deletePortfolioItem = async (accountId, portfolioItemId: string) => {
  const portfolioItem = await getOwnedPortfolioItem(accountId, portfolioItemId);

  await PortfolioItem.deleteOne({ _id: portfolioItem._id });
};

export {
  createPortfolio,
  getMyPortfolio,
  updateMyPortfolio,
  getPublicPortfolio,
  createPortfolioItem,
  getMyPortfolioItems,
  getMyPortfolioItemById,
  updatePortfolioItem,
  deletePortfolioItem,
  ensurePortfolioForAccount,
  serializePortfolio,
  serializePortfolioItem
};
