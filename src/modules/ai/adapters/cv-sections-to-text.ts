import type { FastApiCvSections } from "../clients/ai-service.client";

const SECTION_LABELS: Array<[keyof FastApiCvSections, string]> = [
  ["summary", "Summary"],
  ["experience", "Experience"],
  ["education", "Education"],
  ["skills", "Skills"],
  ["projects", "Projects"],
  ["certifications", "Certifications"],
  ["other", "Other"]
];

const cvSectionsToText = (sections: FastApiCvSections) => {
  const blocks = SECTION_LABELS
    .map(([key, label]) => {
      const values = Array.isArray(sections[key])
        ? sections[key].filter((value): value is string =>
          typeof value === "string" && value.trim().length > 0
        )
        : [];

      if (values.length === 0) {
        return "";
      }

      return label + ":\n" + values.map((value) => "- " + value.trim()).join("\n");
    })
    .filter(Boolean);

  return blocks.join("\n\n").trim();
};

export { cvSectionsToText };