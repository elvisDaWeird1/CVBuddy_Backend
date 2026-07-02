import {
  deleteCloudinaryResource,
  uploadPortfolioPhoto as uploadPortfolioPhotoFile
} from "../uploads/upload.service";
import { createPortfolioItem } from "../portfolios/portfolio.service";

const uploadPortfolioPhoto = async ({ accountId, file, payload }) => {
  let uploadedFile: Awaited<ReturnType<typeof uploadPortfolioPhotoFile>> | undefined;

  try {
    uploadedFile = await uploadPortfolioPhotoFile({ file });

    const portfolioItem = await createPortfolioItem(
      accountId,
      {
        ...payload,
        imageUrl: uploadedFile.url,
        imagePublicId: uploadedFile.publicId
      },
      { createdFromMobile: true }
    );

    return portfolioItem;
  } catch (error) {
    if (uploadedFile) {
      await deleteCloudinaryResource(
        uploadedFile.publicId,
        uploadedFile.resourceType
      ).catch(() => undefined);
    }

    throw error;
  }
};

export {
  uploadPortfolioPhoto
};
