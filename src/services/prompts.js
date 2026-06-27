import { API_BASE_URL } from "./config";

export const searchSchema = (locale) => ({
  type: "array",
  items: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: locale === "en" ? "Movie/TV title" : "影视作品中文名",
      },
      year: {
        type: "string",
        description: locale === "en" ? "Release year" : "首映年份",
      },
      director: {
        type: "string",
        description: locale === "en" ? "Director name" : "导演姓名",
      },
      tmdbId: {
        type: "number",
        description: locale === "en"
          ? "TMDB ID (only if known)"
          : "TMDB ID（知道的才填，不知道不填）",
      },
    },
    required: ["title", "year"],
  },
});

export const buildSearchPrompt = (query, locale = "zh") => {
  if (locale === "en") {
    return `Search for real movies/TV shows related to "${query}".

Requirements:
- Find real movie/TV titles matching the keywords
- If exact match not found, suggest similar works whose titles contain the keywords
- Provide release year, director name, and TMDB ID when confident
- Only fill fields you are sure about, leave uncertain fields empty
- Return at most 5 results, sorted by relevance`;
  }
  return `搜索与 "${query}" 相关的真实影视作品。

要求：
- 根据关键词联想匹配的真实影视作品名称
- 如果无法精确匹配，尝试输出标题中包含关键词的相似作品
- 每项尽量提供首映年份、导演姓名和 TMDB ID
- 有把握的字段才填，不确定的字段留空（TMDB ID 知道的才填，不知道不填）
- 最多返回5条，按匹配度排序`;
};

export const questionSchema = (locale) => ({
  type: "object",
  properties: {
    questions: {
      type: "array",
      description: locale === "en"
        ? "Dynamically generated questions based on analysis"
        : "根据分析动态生成的问题列表",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          type: { type: "string" },
          feature: {
            type: "string",
            description: locale === "en"
              ? "Film feature being tested"
              : "正在测试的影视特征",
          },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["text", "type", "feature", "options"],
      },
    },
    questionCount: {
      type: "number",
      description: locale === "en"
        ? "Question count dynamically determined (5~8)"
        : "根据影片数量与相似度动态决定的问题数量（5~8）",
    },
  },
  required: ["questions", "questionCount"],
});

export const buildQuestionPrompt = (primaryMovie, secondaryMovie, locale = "zh") => {
  const currentYear = new Date().getFullYear();

  if (locale === "en") {
    const twoMovieConfig = `Case: 2 films

🟢 Tier 1 (Quick convergence): 1-2 questions
Rapidly pinpoint direction preference, e.g.: niche vs story-driven, intellectual vs emotional, reality vs imagination
type="simple", 2-3 options, must include "Doesn't matter"
feature suggestion: direction

🟡 Tier 2 (Intersection confirmation): ${
      "2 questions if films differ significantly, 1 if highly similar"
    }
Generate "common trait confirmation" questions to find what both films share, e.g.:
- Do you like both films' pacing?
- Do you like both films' genre elements?
- Do you like both films' world-building?
Goal: find intersection, not expansion
type="simple", 2-3 options, must include "Doesn't matter"
feature suggestion: intersection_rhythm / intersection_genre / intersection_world

🔵 Tier 3 (Refined preference): ${
      "3-4 questions if films differ significantly, 3 if highly similar"
    }
Pick 3-4 dimensions from:
1. World-building preference (feature: worldbuilding)
2. Pacing preference (feature: pacing)
3. Genre preference (feature: genre)
4. Theme inclination (feature: theme)
type="deep", 4-5 options, last must be "Doesn't matter"`;

    const oneMovieConfig = `Case: 1 film

🟢 Tier 1 (Quick convergence): 2 questions
Rapidly eliminate irrelevant directions, e.g.: niche vs story-driven, intellectual vs emotional, reality vs imagination
type="simple", 2-3 options, must include "Doesn't matter"
feature suggestion: direction

🔵 Tier 3 (Refined preference): 3-4 questions
Pick 3-4 dimensions from:
1. World-building preference (feature: worldbuilding)
2. Pacing preference (feature: pacing)
3. Genre preference (feature: genre)
4. Theme inclination (feature: theme)
type="deep", 4-5 options, last must be "Doesn't matter"`;

    const step2QuestionCount = secondaryMovie?.title
      ? `Input: 2 films
- Highly similar → total questions = 6
- Significantly different → total questions = 8`
      : "Input: 1 film → total questions = 6";

    return `## LANGUAGE CONSTRAINT: ENGLISH ONLY

You MUST output ALL text in English. Zero Chinese characters allowed.

### ❌ FORBIDDEN:
- NEVER use "无所谓" in any option — use "Doesn't matter"
- NEVER use any Chinese text in questions, options, or JSON fields
- If you include ANY Chinese character, the output will be rejected

---

The user entered the following favorite films/TV shows:

Primary: "${primaryMovie.title}" (${primaryMovie.year})
${secondaryMovie?.title ? `Secondary: "${secondaryMovie.title}" (${secondaryMovie.year})` : ""}

─── Step 1: Film feature analysis (internal reasoning, do not output) ───

Analyze the core features of the above works:

1. Type (Movie / Documentary / Animation / TV Series / Other)
2. Narrative pacing (Fast / Slow / Mixed)
3. Emotional tone (Dark / Uplifting / Cerebral / Lighthearted / Other)
4. Production scale (Blockbuster / Indie / Experimental / Other)
5. World-building complexity (Low / Medium / High)
${secondaryMovie?.title ? "6. Similarity judgment: How similar are the two films in genre/pacing/tone (High / Medium / Very Different)" : ""}

─── Step 2: Determine question count (strictly follow) ───

${step2QuestionCount}

questionCount must be a specific number${secondaryMovie?.title ? " (6 or 8)" : " (6)"}, not a range.

─── Step 3: Generate questions in three tiers ───

Question allocation:
${secondaryMovie?.title ? twoMovieConfig : oneMovieConfig}

─── Output requirements ───

Output strict JSON format:
{
  "questions": [
    {
      "text": "Question content",
      "type": "simple or deep",
      "feature": "feature identifier",
      "options": ["Option 1", "Option 2", "Doesn't matter"]
    }
  ],
  "questionCount": 8
}

Each question must include: text, type, feature, options
No generic movie psychology test questions.
Questions must target the input films specifically.

REMINDER: ALL text in English. No Chinese characters.`;
  }

  // ---- Chinese version (original) ----
  const twoMovieConfig = `情况：2部影片

🟢 第一层（快速收敛）：1~2题
用于在类型/方向上快速定位用户偏好，例如：猎奇 vs 剧情、信息 vs 情绪、现实 vs 想象
type="simple"，2~3个选项，必须包含"无所谓"
feature 建议值：direction

🟡 第二层（交集确认）：${
    "如果两部影片差异明显则为2题，高度相似则为1题"
  }
生成"共同特征确认问题"，确认两部影片之间的交集，例如：
- 是否同时喜欢两者的节奏特点
- 是否同时喜欢两者的类型元素
- 是否同时喜欢两者的世界观
目的是找到交集特征，而非扩展问题
type="simple"，2~3个选项，必须包含"无所谓"
feature 建议值：intersection_rhythm / intersection_genre / intersection_world

🔵 第三层（细分偏好）：${
    "如果两部影片差异明显则为3~4题，高度相似则为3题"
  }
从以下4个维度中选取3~4个生成问题（压缩版，不超4题）：
1. 世界观偏好（feature: worldbuilding）
2. 节奏偏好（feature: pacing）
3. 类型偏好（feature: genre）
4. 主题倾向（feature: theme）
type="deep"，4~5个选项，最后一个必须是"无所谓"`;

  const oneMovieConfig = `情况：1部影片

🟢 第一层（快速收敛）：2题
快速排除无关方向，例如：猎奇 vs 剧情、信息 vs 情绪、现实 vs 想象
type="simple"，2~3个选项，必须包含"无所谓"
feature 建议值：direction

🔵 第三层（细分偏好）：3~4题
从以下4个维度中选取3~4个生成问题（压缩版，不超4题）：
1. 世界观偏好（feature: worldbuilding）
2. 节奏偏好（feature: pacing）
3. 类型偏好（feature: genre）
4. 主题倾向（feature: theme）
type="deep"，4~5个选项，最后一个必须是"无所谓"`;

  const step2QuestionCount = secondaryMovie?.title
    ? `输入2部影片：
- 两部影片高度相似 → 总问题数 = 6
- 两部影片差异明显 → 总问题数 = 8`
    : "输入1部影片 → 总问题数 = 6";

  return `用户输入了以下喜欢的影视作品：

主要参考：《${primaryMovie.title}》(${primaryMovie.year})
${secondaryMovie?.title ? `次要参考：《${secondaryMovie.title}》(${secondaryMovie.year})` : ""}

─── 第一步：影片特征分析（内部推理，不直接输出）───

请先分析以上影片的核心特征：

1. 影片类型（电影 / 纪录片 / 动画 / 剧集 / 其他）
2. 叙事节奏（快节奏 / 慢节奏 / 混合节奏）
3. 情绪基调（猎奇 / 压抑 / 热血 / 轻松 / 思辨 / 其他）
4. 制作属性（商业大片 / 小众独立 / 实验艺术 / 其他）
5. 世界观复杂度（低 / 中 / 高）
${secondaryMovie?.title ? "6. 相似度判断：两部影片在类型/节奏/基调上的相似度（高相似 / 中等 / 强分歧）" : ""}

─── 第二步：确定问题数量（严格遵循）───

${step2QuestionCount}

questionCount 必须是具体数字${secondaryMovie?.title ? "（6 或 8）" : "（6）"}，不能是范围。

─── 第三步：按三层结构生成问题───

问题数量分配：
${secondaryMovie?.title ? twoMovieConfig : oneMovieConfig}

─── 输出要求───

输出严格 JSON 格式，questionCount 必须是具体数字（8 或 6 或 5，不要写成范围）：
{
  "questions": [
    {
      "text": "问题内容",
      "type": "simple 或 deep",
      "feature": "对应特征标识",
      "options": ["选项1", "选项2", "无所谓"]
    }
  ],
  "questionCount": 8
}

每个问题必须包含：text, type, feature, options
禁止生成通用影视心理测试。
禁止忽略影片类型差异。
问题必须针对输入影片本身。`;
};

export const recommendationSchema = (locale) => ({
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      description: locale === "en"
        ? "Exactly 5 recommendations: first 2 popular, middle 2 hidden gems, last 1 controversial"
        : "恰好5部推荐，前2部热门，中间2部冷门，最后1部争议",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: locale === "en" ? "Movie/TV title" : "影视作品中文名",
          },
          originalTitle: {
            type: "string",
            description: locale === "en" ? "Original title or romanization" : "影视作品原名或拼音",
          },
          year: {
            type: "string",
            description: locale === "en" ? "Release year" : "首映年份",
          },
          director: {
            type: "string",
            description: locale === "en" ? "Director name" : "导演姓名",
          },
          type: {
            type: "string",
            description: locale === "en" ? "Type: 'Movie' or 'TV Series'" : "类型，如 '电影', '剧集'",
          },
          reason: {
            type: "string",
            description: locale === "en"
              ? "Detailed recommendation reason (max 100 words)"
              : "详细的推荐理由（最长150字）",
          },
          matchedTags: {
            type: "array",
            items: { type: "string" },
            description: locale === "en" ? "Matched taste tags (3-5 tags)" : "匹配的品味标签（3-5个）",
          },
          doubanKeyword: {
            type: "string",
            description: locale === "en"
              ? "Precise keyword for search"
              : "用于豆瓣搜索的精准关键词",
          },
        },
        required: ["title", "year", "director", "type", "reason", "matchedTags", "doubanKeyword"],
      },
    },
  },
  required: ["recommendations"],
});

export const buildRecommendationPrompt = (primaryMovie, secondaryMovie, answersText, locale = "zh") => {
  if (locale === "en") {
    return `## LANGUAGE CONSTRAINT: ENGLISH ONLY

All output must be in English. No Chinese characters.

User's reference works:
Primary: ${primaryMovie.title} (${primaryMovie.year})
${secondaryMovie?.title ? `Secondary: ${secondaryMovie.title} (${secondaryMovie.year})` : ""}

User preference Q&A results:
${answersText}

Based on the above, recommend exactly 5 films/TV shows for this user. Output the recommendations directly, each with matching taste tags.

Division rules:
- #1-2: High-rated, well-known popular hits
- #3-4: Must be niche/indie/cult works that still match preferences
- #5: Must be a controversial work (polarizing reviews)
- Do NOT recommend ${primaryMovie.title}${secondaryMovie?.title ? ` or ${secondaryMovie.title}` : ""}

Each reason max 100 words.

JSON format:
{
  "recommendations": [
    {
      "title": "",
      "originalTitle": "",
      "year": "",
      "director": "",
      "type": "Movie or TV Series",
      "reason": "",
      "matchedTags": [],
      "doubanKeyword": ""
    }
  ]
}`;
  }
  return `用户参考作品：
主要参考：《${primaryMovie.title}》(${primaryMovie.year}年)
${secondaryMovie?.title ? `次要参考：《${secondaryMovie.title}》(${secondaryMovie.year}年)` : ""}

用户偏好问答结果：
${answersText}

综合以上信息，为该用户推荐恰好 5 部影视作品。直接输出推荐结果，每部附带匹配的影视标签。

分流规则：
- 第 1-2 部：高评分、高知名度的大众热门
- 第 3-4 部：同样满足偏好，但必须是冷门/小众/独立/邪典
- 第 5 部：同样满足偏好，但评价存在争议（口碑两极分化）
- 禁止推荐《${primaryMovie.title}》${secondaryMovie?.title ? `和《${secondaryMovie.title}》` : ""}

推荐理由不要超过 150 字。

JSON 格式：
{
  "recommendations": [
    {
      "title": "",
      "originalTitle": "",
      "year": "",
      "director": "",
      "type": "电影 或 剧集",
      "reason": "",
      "matchedTags": [],
      "doubanKeyword": ""
    }
  ]
}`;
};

export const fillSchema = (locale) => ({
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: locale === "en" ? "Movie/TV title" : "电影中文名",
          },
          originalTitle: {
            type: "string",
            description: locale === "en" ? "Original title or romanization" : "电影原名或拼音",
          },
          year: {
            type: "string",
            description: locale === "en" ? "Release year" : "首映年份",
          },
          director: {
            type: "string",
            description: locale === "en" ? "Director name" : "导演姓名",
          },
          type: {
            type: "string",
            description: locale === "en" ? "Type: 'Movie' or 'TV Series'" : "类型，如 '电影', '剧集'",
          },
          reason: {
            type: "string",
            description: locale === "en"
              ? "Detailed recommendation reason (max 100 words)"
              : "详细的推荐理由（最长150字）",
          },
          doubanKeyword: {
            type: "string",
            description: locale === "en"
              ? "Precise keyword for search"
              : "用于豆瓣搜索的关键词",
          },
        },
        required: ["title", "year", "director", "type", "reason", "matchedTags", "doubanKeyword"],
      },
    },
  },
  required: ["recommendations"],
});

export const buildFillPrompt = (excludeStr, position, locale = "zh") => {
  const posDescEn =
    position >= 4
      ? "[Controversial work — polarizing reviews, big gap between critic and audience scores]"
      : position >= 2
      ? "[High-quality niche/indie work]"
      : "[High-rated, well-known popular hit]";

  const posDescZh =
    position >= 4
      ? "【评价存在争议的影片——口碑两极分化、影评人与观众评分差异大】"
      : position >= 2
      ? "【高品质冷门/小众影片】"
      : "【高评分、高知名度的大众热门影片】";

  if (locale === "en") {
    return `## LANGUAGE CONSTRAINT: ENGLISH ONLY

Recommend a film/TV show that matches the user's preferences.

Already recommended (do NOT repeat): ${excludeStr}

Position: ${posDescEn}, match strictly.

Each reason max 100 words.

Output strict JSON only (English only, no Chinese):
{
  "recommendations": [
    {
      "title": "",
      "originalTitle": "",
      "year": "",
      "director": "",
      "type": "Movie or TV Series",
      "reason": "",
      "matchedTags": ["epic worldbuilding", "fate", "philosophical"],
      "doubanKeyword": ""
    }
  ]
}`;
  }
  return `请推荐一部满足用户偏好的影视作品。

以下影片已推荐过，绝对不能再次出现：${excludeStr}

属性定位：此位置为${posDescZh}，请严格匹配。

推荐理由不要超过 150 字。

只输出严格JSON，格式如下：
{
  "recommendations": [
    {
      "title": "电影中文名",
      "originalTitle": "电影原名或拼音",
      "year": "首映年份",
      "director": "导演姓名",
      "type": "电影 或 剧集",
      "reason": "详细推荐理由",
      "matchedTags": ["宏大世界观", "宿命感", "哲学思辨"],
      "doubanKeyword": "用于豆瓣搜索的关键词"
    }
  ]
}`;
};

export const replaceSchema = (locale) => ({
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: locale === "en" ? "Movie/TV title" : "电影中文名",
          },
          originalTitle: {
            type: "string",
            description: locale === "en" ? "Original title or romanization" : "电影原名或拼音",
          },
          year: {
            type: "string",
            description: locale === "en" ? "Release year" : "首映年份",
          },
          director: {
            type: "string",
            description: locale === "en" ? "Director name" : "导演姓名",
          },
          type: {
            type: "string",
            description: locale === "en" ? "Type: 'Movie' or 'TV Series'" : "类型，如 '电影', '剧集'",
          },
          reason: {
            type: "string",
            description: locale === "en"
              ? "Detailed recommendation reason (max 100 words)"
              : "详细的推荐理由（最长150字）",
          },
          doubanKeyword: {
            type: "string",
            description: locale === "en"
              ? "Precise keyword for search"
              : "用于豆瓣搜索的关键词",
          },
        },
        required: ["title", "year", "director", "type", "reason", "matchedTags", "doubanKeyword"],
      },
    },
  },
  required: ["recommendations"],
});

export const buildReplacePrompt = (
  primaryMovie,
  secondaryMovie,
  answersText,
  excludeList,
  isNiche,
  isControversial,
  locale = "zh"
) => {
  const posDescEn = isControversial
    ? "[Controversial work — polarizing reviews, big gap between critic and audience scores]"
    : isNiche
    ? "[High-quality niche/indie work]"
    : "[High-rated, well-known popular hit]";

  const posDescZh = isControversial
    ? "【评价存在争议的影片——口碑两极分化、影评人与观众评分差异大】"
    : isNiche
    ? "【高品质冷门/小众影片】"
    : "【高评分、高知名度的大众热门影片】";

  if (locale === "en") {
    return `## LANGUAGE CONSTRAINT: ENGLISH ONLY

User's original reference works:
Primary: ${primaryMovie.title} (${primaryMovie.year})
${secondaryMovie?.title ? `Secondary: ${secondaryMovie.title} (${secondaryMovie.year})` : ""}

User preference Q&A results:
${answersText}

First re-infer the user's taste tags, then find a new work that hasn't appeared before.

Already recommended (do NOT repeat): ${excludeList}

Position: ${posDescEn}, match strictly.

Each reason max 100 words.

Output strict JSON only (English only, no Chinese):
{
  "recommendations": [
    {
      "title": "",
      "originalTitle": "",
      "year": "",
      "director": "",
      "type": "Movie or TV Series",
      "reason": "",
      "matchedTags": ["epic worldbuilding", "fate", "philosophical"],
      "doubanKeyword": ""
    }
  ]
}`;
  }
  return `用户最初提供的参考影视作品：
主要参考: 《${primaryMovie.title}》(${primaryMovie.year}年)
${secondaryMovie?.title ? `次要参考: 《${secondaryMovie.title}》(${secondaryMovie.year}年)` : ""}

用户的观影偏好问答结果：
${answersText}

请先重新推断用户影视标签，再寻找一部未出现过的新作品。

以下影片已推荐过，绝对不能再次出现：${excludeList}

属性定位：此位置为${posDescZh}，请严格匹配。

推荐理由不要超过 150 字。

只输出严格JSON，格式如下：
{
  "recommendations": [
    {
      "title": "电影中文名",
      "originalTitle": "电影原名或拼音",
      "year": "首映年份",
      "director": "导演姓名",
      "type": "电影 或 剧集",
      "reason": "详细推荐理由",
      "matchedTags": ["宏大世界观", "宿命感", "哲学思辨"],
      "doubanKeyword": "用于豆瓣搜索的关键词"
    }
  ]
}`;
};

export const repairSchema = (locale) => ({
  type: "object",
  properties: {
    director: { type: "string" },
    year: { type: "string" },
    originalTitle: { type: "string" },
    type: {
      type: "string",
      description: locale === "en" ? "Movie or TV Series" : "电影 或 剧集",
    },
  },
});

export const buildRepairPrompt = (rec, locale = "zh") => {
  const missingFields = [];
  if (!rec.director) missingFields.push("director");
  if (!rec.year) missingFields.push("year");
  if (!rec.originalTitle) missingFields.push("originalTitle");
  if (!rec.type) missingFields.push("type");

  return {
    missingFields,
    config: {
      prompt: locale === "en"
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
}`,
      schema: {
        type: "object",
        properties: {
          director: { type: "string" },
          year: { type: "string" },
          originalTitle: { type: "string" },
          type: {
            type: "string",
            description: locale === "en" ? "Movie or TV Series" : "电影 或 剧集",
          },
        },
      },
    },
  };
};
