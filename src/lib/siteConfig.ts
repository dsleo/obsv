export const publisher = process.env.SITE_PUBLISHER?.trim() ?? "";
export const contactEmail = process.env.SITE_CONTACT_EMAIL?.trim() ?? "";
export const publicRelease = process.env.SITE_PUBLIC === "true";
