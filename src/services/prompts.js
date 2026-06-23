import { API_BASE_URL } from "./config";

export const searchSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      title: { type: "string", description: "影视作品中文名" },
      year: { type: "string", description: "首映年份" },
      director: { type: "string", description: "导演姓名" },
      tmdbId: {
        type: "number",
        description: "TMDB ID（知道的才填，不知道不填）",
      },
    },
    required: ["title", "year", "director"],
  },
};

export const buildSearchPrompt = (query) => `搜索与 "${query}" 相关的真实影视作品。

要求：
- 根据关键词联想匹配的真实影视作品名称
- 如果无法精确匹配，尝试输出标题中包含关键词的相似作品
- 每项尽量提供首映年份、导演姓名和 TMDB ID
- 有把握的字段才填，不确定的字段留空（TMDB ID 知道的才填，不知道不填）
- 最多返回5条，按匹配度排序`;

export const questionSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      description: "根据分析动态生成的问题列表",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          type: { type: "string" },
          feature: { type: "string", description: "正在测试的影视特征" },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["text", "type", "feature", "options"],
      },
    },
    questionCount: {
      type: "number",
      description: "根据影片数量与相似度动态决定的问题数量（5~8）",
    },
  },
  required: ["questions", "questionCount"],
};

export const buildQuestionPrompt = (primaryMovie, secondaryMovie) => {
  const currentYear = new Date().getFullYear();
  const props = { primaryMovie, secondaryMovie, currentYear };

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

主要参考：《${primaryMovie.title}》 (${primaryMovie.year})
${secondaryMovie?.title ? `次要参考：《${secondaryMovie.title}》 (${secondaryMovie.year})` : ""}

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

export const recommendationSchema = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      description: "恰好5部推荐，前2部热门，中间2部冷门，最后1部争议",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "影视作品中文名" },
          originalTitle: { type: "string", description: "影视作品原名或拼音" },
          year: { type: "string", description: "首映年份" },
          director: { type: "string", description: "导演姓名" },
          type: { type: "string", description: "类型，如 '电影', '剧集'" },
          reason: { type: "string", description: "详细的推荐理由" },
          matchedTags: {
            type: "array",
            items: { type: "string" },
            description: "匹配的品味标签（3-5个）",
          },
          doubanKeyword: { type: "string", description: "用于豆瓣搜索的精准关键词" },
        },
        required: ["title", "year", "director", "type", "reason", "matchedTags", "doubanKeyword"],
      },
    },
  },
  required: ["recommendations"],
};

export const buildRecommendationPrompt = (primaryMovie, secondaryMovie, answersText) => `用户最初提供的参考影视作品：
主要参考: 《${primaryMovie.title}》 (${primaryMovie.year}年)
${secondaryMovie?.title ? `次要参考: 《${secondaryMovie.title}》 (${secondaryMovie.year}年)` : ""}

以下是用户在参考作品中的偏好筛选结果：

${answersText}

请先推断：

用户真正喜欢这些作品的哪些特征。

形成一组影视标签。

例如：

强人物驱动
宏大世界观
宿命感
慢节奏
氛围优先
黑色电影气质
开放式结局
哲学思辨

然后根据这些标签推荐作品。

推荐逻辑：

第一步：总结用户核心偏好
第二步：提取影视标签
第三步：匹配作品
第四步：输出推荐

不要机械参考用户回答。要推断用户真正喜欢的影视特征。

请综合以上所有信息，为该用户精准推荐恰好 5 部影视作品。

【分流规则】
- 前2部（推荐项1、2）：综合评价最满足用户要求，豆瓣评分高、知名度大、大众评价极佳的热门佳作
- 第3、4部（推荐项3、4）：同样满足用户偏好，但必须是冷门影片（小众文艺片、独立制片、邪典Cult片等）
- 第5部（推荐项5）：同样满足用户偏好，但必须是评价存在争议的影片（口碑两极分化、影评人与观众评分差异大的作品）
- 绝对不要推荐用户输入的《${primaryMovie.title}》${secondaryMovie?.title ? `和《${secondaryMovie.title}》` : ""}

请严格按以下 JSON 格式输出：
{
  "recommendations": [
    {
      "title": "电影中文名",
      "originalTitle": "原名或拼音",
      "year": "首映年份",
      "director": "导演姓名",
      "type": "电影 或 剧集",
      "reason": "详细的推荐理由",
      "matchedTags": ["宏大世界观", "宿命感", "哲学思辨"],
      "doubanKeyword": "用于豆瓣搜索的关键词"
    }
  ]
}`;

export const buildFillPrompt = (excludeStr, position) => {
  const posDesc =
    position >= 4
      ? "【评价存在争议的影片——口碑两极分化、影评人与观众评分差异大】"
      : position >= 2
      ? "【高品质冷门/小众影片】"
      : "【高评分、高知名度的大众热门影片】";

  return `请推荐一部满足用户偏好的影视作品。

以下影片已推荐过，绝对不能再次出现：${excludeStr}

属性定位：此位置为${posDesc}，请严格匹配。

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

export const fillSchema = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          originalTitle: { type: "string" },
          year: { type: "string" },
          director: { type: "string" },
          type: { type: "string" },
          reason: { type: "string" },
          doubanKeyword: { type: "string" },
        },
        required: ["title", "year", "director", "type", "reason", "matchedTags", "doubanKeyword"],
      },
    },
  },
  required: ["recommendations"],
};

export const replaceSchema = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          originalTitle: { type: "string" },
          year: { type: "string" },
          director: { type: "string" },
          type: { type: "string" },
          reason: { type: "string" },
          doubanKeyword: { type: "string" },
        },
        required: ["title", "year", "director", "type", "reason", "matchedTags", "doubanKeyword"],
      },
    },
  },
  required: ["recommendations"],
};

export const buildReplacePrompt = (
  primaryMovie,
  secondaryMovie,
  answersText,
  excludeList,
  isNiche,
  isControversial
) => `用户最初提供的参考影视作品：
主要参考: 《${primaryMovie.title}》 (${primaryMovie.year}年)
${secondaryMovie?.title ? `次要参考: 《${secondaryMovie.title}》 (${secondaryMovie.year}年)` : ""}

用户的观影偏好问答结果：
${answersText}

请先重新推断用户影视标签，再寻找一部未出现过的新作品。

以下影片已推荐过，绝对不能再次出现：${excludeList}

属性定位：此位置为${
  isControversial
    ? "【评价存在争议的影片——口碑两极分化、影评人与观众评分差异大】"
    : isNiche
    ? "【高品质冷门/小众影片】"
    : "【高评分、高知名度的大众热门影片】"
}，请严格匹配。

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

export const repairSchema = {
  type: "object",
  properties: {
    director: { type: "string" },
    year: { type: "string" },
    originalTitle: { type: "string" },
    type: { type: "string", description: "电影 或 剧集" },
  },
};

export const buildRepairPrompt = (rec) => {
  const missingFields = [];
  if (!rec.director) missingFields.push("director");
  if (!rec.year) missingFields.push("year");
  if (!rec.originalTitle) missingFields.push("originalTitle");
  if (!rec.type) missingFields.push("type");

  return {
    missingFields,
    config: {
      prompt: `请补全以下影视信息（必须基于真实常识，不允许编造明显错误）：

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
          type: { type: "string", description: "电影 或 剧集" },
        },
      },
    },
  };
};
