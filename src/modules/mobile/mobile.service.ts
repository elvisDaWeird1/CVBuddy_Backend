import { removeFileIfExists } from "../../utils/file";
import { getStoredPortfolioImageUrl } from "../../middlewares/upload.middleware";
import { createPortfolioItem } from "../portfolios/portfolio.service";

const uploadPortfolioPhoto = async ({ accountId, file, payload }) => {
  try {
    const portfolioItem = await createPortfolioItem(
      accountId,
      {
        ...payload,
        imageUrl: getStoredPortfolioImageUrl(file.filename)
      },
      { createdFromMobile: true }
    );

    return portfolioItem;
  } catch (error) {
    await removeFileIfExists(file?.path).catch(() => undefined);
    throw error;
  }
};

export {
  uploadPortfolioPhoto
};
