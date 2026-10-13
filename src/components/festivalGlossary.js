/**
 * Festival Calendar —— 中文词汇表（渲染层本地化）
 *
 * 为什么放在渲染层而不是数据层：
 *   scripts/festivals/run.mjs 每次运行都会从官方源「重建」public/api/**（normalize() 重新生成
 *   films/screenings/sections/venues，且不携带任何 zh 字段），因此把中文写进 public/api 或
 *   data/festivals/editions 会在下一次日更时被冲掉。把映射放在已提交的渲染层词汇表里，
 *   既不会被日更覆盖，也不改动受授权门禁保护的公开产物，且随 deploy-frontend 即时生效。
 *
 * 覆盖范围（有限枚举，可人工核对）：
 *   城市 / 国家 / 地区 / 类型 / 单元(section) / 场馆(venue) / 官方来源标签(source label)。
 *
 * 原则：只翻译「可译外壳」。影片名、导演名、人名、场馆品牌专名一律保留原文
 *       （符合影展惯例，原名即权威标识）；无把握的官方专名保留英文，绝不臆造。
 */

// 城市
export const CITY_ZH = {
  Busan: "釜山",
  Amsterdam: "阿姆斯特丹",
  London: "伦敦",
  "Hong Kong": "香港",
  Venice: "威尼斯",
  Cannes: "戛纳",
  Rotterdam: "鹿特丹",
};

// 国家 / 地区
export const COUNTRY_ZH = {
  "Korea, Republic of": "韩国",
  Netherlands: "荷兰",
  "United Kingdom": "英国",
  "Hong Kong SAR": "中国香港",
  Italy: "意大利",
  France: "法国",
};

// 单元（section）—— 官方单元名；有通用译名的用译名，专名（人名/机构/品牌）保留原文
export const SECTION_ZH = {
  // Cannes
  "Cannes Classics": "戛纳经典",
  "Cannes Premiere": "戛纳首映",
  "Cinéma de la Plage": "海滩电影院",
  "In Competition — Feature films": "主竞赛 — 长片",
  "In Competition — Short films": "主竞赛 — 短片",
  "La Cinef": "电影基石",
  "Out of Competition": "非竞赛展映",
  "Special Screenings": "特别展映",
  "Un Certain Regard": "一种关注",
  // Venice
  "Biennale College Cinema": "电影学院",
  Orizzonti: "地平线",
  "Special Screening": "特别放映",
  "Venezia 83 Competition": "威尼斯 83 竞赛",
  "Venice Classics": "威尼斯经典",
  "Venice Open – Out of Competition": "威尼斯开放 — 非竞赛",
  "Venice Spotlight": "威尼斯焦点",
  // IFFR
  "Art Directions: immersive media": "艺术方向：沉浸式媒体",
  "Art Directions: installations": "艺术方向：装置",
  "Art Directions: sound//vision": "艺术方向：声音//视觉",
  "Big Screen Competition": "大银幕竞赛",
  "Bright Future": "光明未来",
  "Cinema Regained": "电影重现",
  "Displacement Film Fund": "流离失所电影基金",
  Education: "教育",
  "Focus: Collectif Faire-Part": "焦点：Collectif Faire-Part",
  "Focus: Marwan Hamed": "焦点：Marwan Hamed",
  "Focus: Tetsuya Maruyama": "焦点：Tetsuya Maruyama",
  "Focus: the Future Is NOW": "焦点：未来即现在",
  "Focus: V-cinema": "焦点：V-cinema",
  Harbour: "港湾",
  Limelight: "聚光灯",
  Preludes: "序曲",
  RTM: "RTM",
  "Short & Mid-length": "短片与中长片",
  Specials: "特别单元",
  "Tiger Competition": "老虎竞赛",
  "Tiger Short Competition": "老虎短片竞赛",
  // IDFA
  "Best of Fests": "影展精选",
  "Dead Angle: Common Ground": "死角：共同立场",
  "IDFA Competition for Short Documentary": "IDFA 短片纪录片竞赛",
  "IDFA DocLab Program & Competition": "IDFA DocLab 节目与竞赛",
  Paradocs: "Paradocs",
  "Retrospective: Tatiana Huezo": "回顾展：Tatiana Huezo",
  Signed: "Signed",
  "Spotlight on William Greaves": "聚焦 William Greaves",
  "Top 10": "十佳影片",
  // BFI LFF
  Create: "创作",
  Cult: "邪典",
  Dare: "挑战",
  Debate: "辩论",
  Experimenta: "实验",
  Family: "家庭",
  Galas: "首映礼",
  Journey: "旅程",
  Laugh: "喜剧",
  LFF: "LFF",
  "LFF for Free": "LFF 免费单元",
  LFFAWARDS: "LFF 颁奖",
  LFFEVENTS: "LFF 活动",
  LFFSCREENTALKS: "LFF 映后谈",
  Love: "爱情",
  Shorts: "短片",
  "Special Presentations": "特别展映",
  Thrill: "惊悚",
  // BIFF
  "A Window on Asian Cinema": "亚洲电影之窗",
  Competition: "竞赛",
  "Flash Forward": "前瞻单元",
  "Gala Presentation": "盛典展映",
  Icons: "偶像单元",
  "Korean Cinema Today - Panorama": "今日韩国电影 — 全景",
  "Midnight Passion": "午夜激情",
  "On Screen": "银幕单元",
  "Open Cinema": "开放影院",
  "Opening Film": "开幕影片",
  "Special Program in Focus - Everything Everywhere All for Michelle":
    "焦点特别节目 — Everything Everywhere All for Michelle",
  "Special Screenings & Carte Blanche": "特别展映与自由单元",
  "Vision - Asia": "亚洲视野",
  "Wide Angle - Asian Short Film Competition": "广角 — 亚洲短片竞赛",
  "World Cinema": "世界电影",
  // HKIFF Cine Fan
  "ACROSS THE RIVER OF SORROW: THE CINEMA OF RITWIK GHATAK": "悲伤之河彼岸：Ritwik Ghatak 的电影",
  "BACK TO THE SCREEN": "重返银幕",
  "CLINT EASTWOOD, A HERO DECONSTRUCTED": "克林特·伊斯特伍德：被解构的英雄",
  "RESTORED CLASSICS": "修复经典",
  "THE GOLDEN AGE": "黄金时代",
  // 补漏：真实数据中出现但首版遗漏的单元名
  "Giornate degli Autori": "导演双周",
  "Korean Cinema Today - Special Premiere": "今日韩国电影 — 特别首映",
  "Orizzonti Short Films": "地平线短片",
  "Orizzonti Short Films - Out of Competition": "地平线短片 — 非竞赛",
  "Settimana internazionale della critica": "国际影评人周",
  "Special Program in Focus - Japanese Animation Special: Masterpieces of Madness, Exhilarating Prospects 12+1": "焦点特别节目 — 日本动画特辑：疯狂杰作，精彩前瞻 12+1",
  "Special Program in Focus - Those Beautiful Years, Ahn Sung-ki": "焦点特别节目 — 那些美丽的岁月，安圣基",
  "Vision - Korea": "韩国视野",
  "Wide Angle - Documentary Competition": "广角 — 纪录片竞赛",
  "Wide Angle - Documentary Showcase": "广角 — 纪录片展映",
  "Wide Angle - Korean Short Film Competition": "广角 — 韩国短片竞赛",
  // 官方「节目变更」分节标题
  "LATE ADDITIONS": "最新新增",
  "ACCESS UPDATES": "无障碍更新",
};

// 场馆（venue）—— 翻译结构性词（厅/影院/剧场/中心），保留品牌与建筑专名
export const VENUE_ZH = {
  // BIFF
  "Book Cafe Lounge, 4F, DSU-KIT Centum Campus": "DSU-KIT Centum 校区 4F Book Cafe Lounge",
  "Busan Cinema Center Cinema 1": "釜山电影殿堂 1 号厅",
  "Busan Cinema Center Cinema 2": "釜山电影殿堂 2 号厅",
  "Busan Cinema Center Cinematheque": "釜山电影殿堂 电影资料馆",
  "Busan Cinema Center Haneulyeon Theatre": "釜山电影殿堂 天空剧场",
  "Busan Cinema Center Roof Theater": "釜山电影殿堂 屋顶剧场",
  "Busan Community Media Center Open Hall": "釜山社区媒体中心 开放剧场",
  "CGV Centum City 1": "CGV Centum City 1 号厅",
  "CGV Centum City 2": "CGV Centum City 2 号厅",
  "CGV Centum City 3": "CGV Centum City 3 号厅",
  "CGV Centum City 4": "CGV Centum City 4 号厅",
  "CGV Centum City 5": "CGV Centum City 5 号厅",
  "CGV Centum City 6": "CGV Centum City 6 号厅",
  "CGV Centum City IMAX": "CGV Centum City IMAX 厅",
  "Culture Hall (9F), Shinsegae Centum City": "新世界 Centum City 文化厅（9F）",
  "KOFIC Theater": "KOFIC 影院",
  "LOTTE CINEMA Centum City 2": "乐天影院 Centum City 2 号厅",
  "LOTTE CINEMA Centum City 3": "乐天影院 Centum City 3 号厅",
  "LOTTE CINEMA Centum City 4": "乐天影院 Centum City 4 号厅",
  "LOTTE CINEMA Centum City 5": "乐天影院 Centum City 5 号厅",
  "LOTTE CINEMA Centum City 6": "乐天影院 Centum City 6 号厅",
  "LOTTE CINEMA Centum City 7": "乐天影院 Centum City 7 号厅",
  "LOTTE CINEMA Centum City 8": "乐天影院 Centum City 8 号厅",
  "LOTTE CINEMA Centum City 9": "乐天影院 Centum City 9 号厅",
  "LOTTE CINEMA Centum City 10": "乐天影院 Centum City 10 号厅",
  "Sohyang Theatre Woori Bank Hall": "Sohyang 剧场 Woori Bank 厅",
  // IDFA
  "Carré": "Carré",
  "Eye: Cinema 1": "Eye 电影博物馆 1 号厅",
  "Pathé Noord 1": "Pathé Noord 1 号厅",
  "Pathé Noord 2": "Pathé Noord 2 号厅",
  "Pathé Noord 3": "Pathé Noord 3 号厅",
  "Pathé Noord 4": "Pathé Noord 4 号厅",
  "Pathé Noord 5": "Pathé Noord 5 号厅",
  "Pathé Noord 6": "Pathé Noord 6 号厅",
  "Pathé Noord 8": "Pathé Noord 8 号厅",
  "Pathé Noord 10": "Pathé Noord 10 号厅",
  "Pathé Noord 11": "Pathé Noord 11 号厅",
  "Pathé Noord 12": "Pathé Noord 12 号厅",
  "Tuschinski 1": "Tuschinski 1 号厅",
  // BFI LFF
  "BFI IMAX, Waterloo": "BFI IMAX（Waterloo）",
  "BFI Southbank, BFI Bar": "BFI 南岸 BFI 酒吧",
  "BFI Southbank, BFI Reuben Library": "BFI 南岸 BFI Reuben 图书馆",
  "BFI Southbank, Mezzanine": "BFI 南岸 夹层",
  "BFI Southbank, NFT4": "BFI 南岸 NFT4",
  "BFI Southbank, Screen NFT1": "BFI 南岸 NFT1 厅",
  "BFI Southbank, Screen NFT2": "BFI 南岸 NFT2 厅",
  "BFI Southbank, Screen NFT3": "BFI 南岸 NFT3 厅",
  "BFI Southbank, Screen NFT4": "BFI 南岸 NFT4 厅",
  "BFI Southbank, The Blue Room": "BFI 南岸 蓝厅",
  "Curzon Soho Cinema, Screen 1": "Curzon Soho 影院 1 号厅",
  "Curzon Soho Cinema, Screen 2": "Curzon Soho 影院 2 号厅",
  "Curzon Soho Cinema, Screen 3": "Curzon Soho 影院 3 号厅",
  "ICA Cinema, Screen 1": "ICA 影院 1 号厅",
  "LFF 2026 HOME, Manchester": "LFF 2026 HOME（曼彻斯特）",
  "Prince Charles Cinema, Downstairs Screen": "Prince Charles 影院 楼下影厅",
  "Southbank Centre, Royal Festival Hall": "南岸中心 皇家节日大厅",
  "The Southbank Centre's Royal Festival Hall": "南岸中心 皇家节日大厅",
  "Vue West End, EPIC 1": "Vue West End EPIC 1 号厅",
  "Vue West End, EPIC 2": "Vue West End EPIC 2 号厅",
  // HKIFF Cine Fan
  "EMP Cinemas iSQUARE": "英皇戏院 iSQUARE",
  "EMP Cinemas Times Square": "英皇戏院 时代广场",
  "Hong Kong Arts Centre Louis Koo Cinema": "香港艺术中心 古天乐电影院",
  "PREMIERE Elements": "PREMIERE Elements",
  // Venice
  "Astra 1": "Astra 1 号厅",
  "Astra 2": "Astra 2 号厅",
  "PalaBiennale": "PalaBiennale",
  "Sala Casinò": "Casinò 放映厅",
  "Sala Corinto": "Corinto 放映厅",
  "Sala Darsena": "Darsena 放映厅",
  "Sala Giardino": "Giardino 放映厅",
  "Sala Grande": "大放映厅",
  "Sala Perla": "Perla 放映厅",
  "Sala Volpi": "Volpi 放映厅",
};

// 官方来源标签（通用项，精确匹配）
export const SOURCE_LABEL_ZH = {
  "Cine Fan official programme (periods + sections)": "Cine Fan 官方节目（时段 + 单元）",
  "Cine Fan official schedule (current & upcoming screenings)": "Cine Fan 官方排程（当前与即将放映）",
  "Festival de Cannes official site": "戛纳电影节官网",
  "IFFR official site": "IFFR 官网",
  "Official IFFR film catalogue (static JSON feed)": "IFFR 官方影片目录（静态 JSON 数据源）",
  "Official film detail pages (150/150)": "官方影片详情页（150/150）",
  "Official lineup": "官方片单",
  "Official programme (GraphQL, searchFestivalFilms)": "官方节目（GraphQL，searchFestivalFilms）",
  "Official programme (all films)": "官方节目（全部影片）",
  "Official programme changes (offline snapshot)": "官方节目变更（离线快照）",
  "Official schedule (GraphQL, DAY × 6)": "官方排程（GraphQL，DAY × 6）",
  "Official selection (all films & sections)": "官方入选（全部影片与单元）",
};

const DICTS = [SECTION_ZH, VENUE_ZH, CITY_ZH, COUNTRY_ZH, SOURCE_LABEL_ZH];

/** 渲染层中文映射：locale==='zh' 且命中词汇表时返回中文，否则原样返回。 */
export function gloss(text, locale) {
  if (locale !== "zh" || text == null) return text;
  const s = String(text);
  for (const d of DICTS) if (d[s] != null) return d[s];
  return s;
}

/** 官方来源标签：先精确匹配，再按前缀规则（影片详情 / 官方排程 等）。 */
export function glossSourceLabel(label, locale) {
  if (locale !== "zh" || !label) return label;
  const s = String(label);
  if (SOURCE_LABEL_ZH[s] != null) return SOURCE_LABEL_ZH[s];
  const rules = [
    [/^Film detail — (.+)$/, (m) => `影片详情 — ${m[1]}`],
    [/^Official schedule \(offline snapshot\) — (.+)$/, (m) => `官方排程（离线快照）— ${m[1]}`],
    [/^Official schedule — (.+)$/, (m) => `官方排程 — ${m[1]}`],
  ];
  for (const [re, fn] of rules) {
    const m = s.match(re);
    if (m) return fn(m);
  }
  return s;
}
