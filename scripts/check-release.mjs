// Real publisher facts cannot be inferred or fabricated by the build.
const errors = [];
if (process.env.SITE_PUBLIC === "true") {
  if (!process.env.SITE_PUBLISHER?.trim())
    errors.push("SITE_PUBLISHER is required for public release");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.SITE_CONTACT_EMAIL ?? ""))
    errors.push("SITE_CONTACT_EMAIL is required for corrections");
  try {
    const u = new URL(process.env.SITE_URL);
    if (u.protocol !== "https:" || /localhost|127\.0\.0\.1/.test(u.hostname)) throw Error();
  } catch {
    errors.push("SITE_URL must be the final public HTTPS URL");
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  process.env.SITE_PUBLIC === "true"
    ? "Public release configuration checked"
    : "Preview build: search indexing disabled",
);
