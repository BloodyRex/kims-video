import { API_BASE_URL } from "./config";
import { parseJSON } from "../utils/parseJSON";

export const generateAIContent = async (
  prompt,
  systemInstruction,
  responseSchema = null,
  locale = "zh"
) => {
  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      systemInstruction,
      responseSchema,
      language: locale === "en" ? "en-US" : "zh-CN",
    }),
  });

  if (!response.ok) {
    throw new Error(`API Error ${response.status}`);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(result.error);
  }

  return result.content;
};

export const fetchMovieByTmdbId = async (tmdbId, locale = "zh") => {
  try {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tmdbId: Number(tmdbId),
        language: locale === "en" ? "en-US" : "zh-CN",
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.content || null;
  } catch (e) {
    return null;
  }
};

export const verifyMovieTmdbId = async (title, year, locale = "zh") => {
  try {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchTitle: title,
        searchYear: year || "",
        language: locale === "en" ? "en-US" : "zh-CN",
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.content || null;
  } catch (_) {
    return null;
  }
};

export const repairRecommendationFields = async (rec, generateAIContent, locale = "zh") => {
  const missingFields = [];

  if (!rec.director) missingFields.push("director");
  if (!rec.year) missingFields.push("year");
  if (!rec.originalTitle) missingFields.push("originalTitle");
  if (!rec.type) missingFields.push("type");

  if (missingFields.length === 0) return rec;

  const prompt = locale === "en"
    ? `Please fill in the following movie/TV information (must be based on real knowledge, do not fabricate):

Film: ${rec.title}
${rec.reason ? "Description: " + rec.reason : ""}
${rec.year ? "Year: " + rec.year : ""}
${rec.type ? "Known type: " + rec.type : ""}

Missing fields: ${missingFields.join(",")}

Use the "Description" above to accurately identify which work this is, do not guess based on title only.

Output strict JSON only:
{
  "director": "",
  "year": "",
  "originalTitle": "",
  "type": ""
}`
    : `请补全以下影视信息（必须基于真实常识，不允许编造明显错误）：

影片：${rec.title}
${rec.reason ? "背景描述：" + rec.reason : ""}
${rec.year ? "年份：" + rec.year : ""}
${rec.type ? "已知类型：" + rec.type : ""}

缺失字段：${missingFields.join(",")}

根据以上"背景描述"准确定位是哪一部作品，不要仅根据中文名联想。

只输出严格JSON：
{
  "director": "",
  "year": "",
  "originalTitle": "",
  "type": ""
}`;

  const responseText = await generateAIContent(
    prompt,
    locale === "en" ? "You are a film information verification system. Output JSON only." : "你是影视信息校对系统，只输出JSON。",
    {
      type: "object",
      properties: {
        director: { type: "string" },
        year: { type: "string" },
        originalTitle: { type: "string" },
        type: { type: "string", description: locale === "en" ? "Movie or TV Series" : "电影 或 剧集" },
      },
    },
    locale
  );

  const fixed = parseJSON(responseText);

  const result = { ...rec };
  if (fixed && typeof fixed === "object") {
    if (missingFields.includes("director") && fixed.director)
      result.director = fixed.director;
    if (missingFields.includes("year") && fixed.year) result.year = fixed.year;
    if (missingFields.includes("originalTitle") && fixed.originalTitle)
      result.originalTitle = fixed.originalTitle;
    if (missingFields.includes("type") && fixed.type) result.type = fixed.type;
  }
  return result;
};
