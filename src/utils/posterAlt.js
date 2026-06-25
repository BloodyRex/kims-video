/**
 * Generate SEO-friendly alt text for movie poster images.
 * @param {string} title - Movie title in current locale
 * @param {string} year - Release year
 * @param {string} originalTitle - Original/English title
 * @param {string} locale - "zh" or "en"
 * @returns {string} Descriptive alt text
 */
export function posterAlt(title, year, originalTitle, locale = "zh") {
  const yr = year ? ` (${year})` : "";
  if (locale === "en") {
    const displayName = originalTitle || title;
    return `Movie poster for ${displayName}${yr}`;
  }
  // Chinese: include original title for richer keyword coverage
  const enPart = originalTitle && originalTitle !== title
    ? ` / ${originalTitle}`
    : "";
  return `《${title}》${yr}${enPart} 电影海报`;
}