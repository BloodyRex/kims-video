import React, { createContext, useContext, useState, useCallback } from "react";

const messages = {
  zh: {
    // ---- SplashPage ----
    "tagline": "The movies were calling",
    "splash.desc": "输入你喜欢的影视作品，AI 通过渐进式问答精准分析你的审美口味，为你推荐量身定制的电影与剧集。",
    "splash.feature1.title": "双作品输入",
    "splash.feature1.desc": "可输入 1-2 部参考作品，AI 分析共同特征与差异，精准定位你的品味坐标。",
    "splash.feature2.title": "渐进式问答",
    "splash.feature2.desc": "基于参考作品动态生成 6-8 个分层问题，快速收敛到你的偏好区间。",
    "splash.feature3.title": "精准智能推荐",
    "splash.feature3.desc": "DeepSeek 驱动：2 部精选热门 + 2 部独家冷门 + 1 部争议之选。",
    "splash.feature4.title": "分享与保存",
    "splash.feature4.desc": "推荐结果可通过链接分享，一键保存为高清 PNG 图片。",
    "splash.contact": "Contact:",
    "splash.start": "开始探索",
    "splash.got_it": "知道了",

    // ---- App ----
    "app.info": "说明",

    // ---- InputPage ----
    "input.back": "返回主导航",
    "input.primary_label": "主参考作品",
    "input.secondary_label": "附加参考作品 (可选)",
    "input.primary_placeholder": "例如：星际穿越",
    "input.secondary_placeholder": "例如：银翼杀手2049",
    "input.year_placeholder": "年份",
    "input.year_hint": "年份必填，支持手动修改",
    "input.searching": "正在从豆瓣影库调卷...",
    "input.no_results": "未能匹配到结果，请尝试精确输入。",
    "input.submit": "开始剖析基因",
    "input.browse_discover": "浏览精选推荐合辑",
    "input.suggestion_format": "（{year}，{director}）",
    "input.quotes": [
      "金的音像店就是我们的电影学院",
      "实体媒介仍然至上",
      "影迷的圣殿",
      "55000部电影，一个执念",
      "每一盘录像带都有故事",
    ],

    // ---- ResultsPage ----
    "results.genome_match": "《{primary}》{secondary} 基因碰撞匹配",
    "results.diagnosis": "匹配诊断报告",
    "results.director": "导演: {director}",
    "results.full_info": "完整资料",
    "results.replace_btn": "换一换",
    "results.searching_dots": "寻找中...",
    "results.no_results": "未匹配到结果",
    "results.badge_hot": "🔥 精选热门",
    "results.badge_niche": "🕵️ 独家冷门",
    "results.badge_controversial": "⚡ 争议之选",
    "results.reboot": "重新输入",

    // ---- MovieDetail ----
    "detail.source_prefix": "这部推荐源自你对《{title}》({year}) 的偏好",
    "detail.back": "← 返回结果页",
    "detail.share": "分享此页",
    "detail.reboot": "重新输入",
    "detail.taste_match": "◆ 品味匹配",
    "detail.view_tmdb": "在 TMDB 查看完整资料 ↗",
    "detail.no_poster": "无海报",
    "detail.load_error": "无法加载电影资料",
    "detail.runtime": "⏱ {minutes} 分钟",
    "detail.director": "导演: {director}",

    // ---- Loading ----
    "loading.quotes": [
      "租一部电影",
      "记录一切",
      "录像带在对我说话",
      "去试试，看会发生什么",
      "有些收藏不会消失",
      "电影在呼唤",
    ],
    "loading.eta": "一般需要 3-8s",

    // ---- Share / Alert ----
    "share.text": "AI为我推荐了电影！基于《{primary}》{secondary}，来看看你的品味基因检测报告 →",
    "share.copied": "链接已复制到剪贴板，分享给朋友吧！",
    "share.prompt": "复制以下链接分享：",

    // ---- Errors ----
    "error.required": "主参考影视作品的名称和首映年份为必填项！",
    "error.year": "请输入有效的年份。",
    "error.qa_failed": "生成问答失败，请重试。",
    "error.rec_failed": "生成推荐失败，请重试。",
    "error.gen_failed": "生成失败，请重试。",

    // ---- SaveContent ----
    "save.recommended_for": "基于《{title}》的推荐",
    "save.hot": "热门精选",
    "save.niche": "冷门发现",
    "save.controversial": "争议之选",
    "save.subtitle": "AI驱动，基于影视喜好，《{primary}》{secondary}基因突变匹配结果",
    "save.footer": "bloodyrex.xyz | Kim's Video — AI Movie Recommender",

    // ---- DiscoverPage ----
    "discover.title": "DISCOVER",
    "discover.desc": "每一部你热爱的电影，都通往另一场未知的冒险。浏览这些精选推荐对，点击即可查看完整影片资料。",
    "discover.view_detail": "查看详情",
    "discover.if_like": "如果你喜欢",
    "discover.arrow": "",

    // ---- SEO ----
    "seo.hub.title": "AI 电影推荐发现页",
    "seo.hub.intro": "本页面基于用户输入的电影，使用 AI 进行情绪、主题与风格匹配，生成相似电影推荐组合。",
    "seo.hub.genres": "覆盖类型包括：科幻、剧情、悬疑、动画、犯罪与独立电影等。",
    "seo.hub.desc": "每一组推荐都是基于情绪相似性 + 主题延展 + 风格对照生成的结果。",
    "seo.footer.title": "关于本页的推荐逻辑",
    "seo.footer.p1": "本系统通过分析电影的类型标签、剧情结构与观众情绪反馈，构建跨影片的相似性网络。",
    "seo.footer.p2": "推荐结果并不依赖单一评分，而是综合叙事结构与观影体验进行匹配。",
    "seo.link.home": "返回首页",

    // ---- WallPage ----
    "wall.desc": "每日收录全球新片，按上线日期排布，累积成一面持续生长的电影墙。",
    "wall.loading": "正在加载影视墙...",
    "wall.error": "影视墙加载失败，请重试。",
    "wall.empty": "暂无符合条件的影片",
    "wall.prev": "← 上一页",
    "wall.next": "下一页 →",

    // ---- Footer ----
    "footer.home": "AI 推荐",
    "footer.discover": "社区发现",
    "footer.intel": "全球影音",
    "footer.wall": "影视墙",
    "footer.festivals": "电影节日历",
    "festivals.title": "全球电影节排片日历",
    "festivals.subtitle": "全球电影节排片日历 · 官方一手数据",
    "footer.mydata": "我的数据",

    // ---- MyDataPage ----
    "mydata.title": "我的数据",
    "mydata.subtitle": "全部保存在这台设备上，不需要注册账号。你可以随时导出、导入、迁移或删除。",
    "mydata.back": "← 返回首页",
    "mydata.stats.title": "存储概览",
    "mydata.stats.recos": "推荐记录",
    "mydata.stats.searches": "搜索记录",
    "mydata.stats.size": "占用空间",
    "mydata.stats.persisted": "已开启持久化存储",
    "mydata.stats.not_persisted": "未开启持久化存储",
    "mydata.persist.btn": "请求持久化存储",
    "mydata.persist.ok": "已开启：浏览器不会在空间紧张时优先清掉你的数据。",
    "mydata.persist.fail": "浏览器拒绝了持久化请求。数据仍会保留，但空间不足时可能被清理，建议定期导出备份。",
    "mydata.recos.title": "推荐历史",
    "mydata.recos.empty": "还没有推荐记录。去 AI 搜索生成一次推荐吧。",
    "mydata.recos.count": "{n} 部推荐",
    "mydata.recos.expand": "查看片单",
    "mydata.recos.collapse": "收起",
    "mydata.recos.delete": "删除",
    "mydata.recos.clear": "清空推荐历史",
    "mydata.searches.title": "搜索历史",
    "mydata.searches.empty": "还没有搜索记录。",
    "mydata.searches.clear": "清空搜索历史",
    "mydata.export.title": "导出备份",
    "mydata.export.desc": "导出为 JSON 文件保存到电脑或网盘——这就是你的完整备份。",
    "mydata.export.btn": "导出备份文件",
    "mydata.export.pass_ph": "可选密码，留空则不加密",
    "mydata.import.title": "导入恢复",
    "mydata.import.desc": "选择之前导出的 JSON 文件，或粘贴迁移码。导入会去重合并，不会覆盖你现有的数据。",
    "mydata.import.file": "选择文件",
    "mydata.import.paste_ph": "粘贴迁移码（KV1: / KV1G: 开头，或 10 位云端短码）",
    "mydata.import.btn": "导入并合并",
    "mydata.import.pass_ph": "备份有密码时填写",
    "mydata.import.ok": "导入完成：新增 {added} 条，更新 {updated} 条，搜索记录 {searches} 条。",
    "mydata.import.fail": "导入失败：{error}",
    "mydata.migrate.title": "跨设备迁移",
    "mydata.migrate.desc": "生成一段迁移码，在另一台设备的这个页面粘贴即可。它不是账号，用完即弃。",
    "mydata.migrate.gen": "生成迁移码",
    "mydata.migrate.copy": "复制",
    "mydata.migrate.copied": "已复制",
    "mydata.migrate.len": "约 {n} 字符",
    "mydata.migrate.remote_code": "生成云端迁移码",
    "mydata.migrate.remote_hint": "在服务器上临时存一份，生成一个短码；24 小时内可在其他设备领取，领取后立即失效，无需粘贴长码。",
    "mydata.migrate.remote_done": "云端迁移码已生成，请在 24 小时内领取。",
    "mydata.migrate.remote_fail": "云端操作失败：{msg}",
    "mydata.migrate.fallback": "网络不可用，已降级为本地长码",
    "mydata.danger.title": "清空全部数据",
    "mydata.danger.desc": "删除这台设备上保存的所有推荐与搜索记录，不可恢复。建议先导出备份。",
    "mydata.danger.btn": "清空全部数据",
    "mydata.danger.confirm": "确定要清空全部个人数据吗？此操作不可撤销。",
    "mydata.danger.done": "已清空。",
    "mydata.delete.confirm": "删除这条记录？",
    "mydata.clear_recos.confirm": "确定清空全部推荐历史？",
    "mydata.clear_searches.confirm": "确定清空全部搜索历史？",
    "mydata.not_supported": "当前浏览器不支持本地存储（例如隐私模式），数据不会被保存。",
    "mydata.device": "设备标识",
    "mydata.export.ok": "已导出备份：{recos} 条推荐 / {searches} 条搜索。",
    "mydata.migrate.done": "迁移码已生成，复制或保存到另一台设备。",
    "mydata.migrate.bad_code": "操作失败：代码无效、文件损坏或口令不正确。",
    // ---- 主页「我的数据」大框（内嵌首页最下方） ----
    "panel.title": "My Data",
    "panel.subtitle": "我的数据",
    "panel.desc": "收藏、推荐历史都存在这台设备上，不需要账号；可随时迁移到另一台设备，或一键清除。",
    "panel.favs.title": "我收藏的卡片",
    "panel.favs.empty": "还没有收藏。在影视墙、发现页或推荐结果里点星星即可收藏。",
    "panel.favs.remove": "取消收藏",
    "panel.favs.count": "{n} 张",
    "panel.favs.short": "收藏",
    "panel.recos.title": "我的推荐历史",
    "panel.recos.empty": "还没有推荐记录。用 AI 推荐生成一次结果，就会出现在这里。",
    "panel.transfer": "转移数据",
    "panel.clear": "清除数据",
    "panel.transfer.title": "转移数据",
    "panel.transfer.desc": "两种方式二选一：把这份数据带去另一台设备，或从别处汇入到这台设备。",
    "panel.transfer.send.title": "传送这个浏览器的纪录",
    "panel.transfer.send.desc": "生成一段迁移码，在另一台设备粘贴即可导入。会尝试在云端存一份并生成短码（10 位）；网络不可用时自动降级为本地长码。",
    "panel.transfer.recv.title": "汇入其他地方的纪录",
    "panel.transfer.recv.desc": "把另一台设备生成的迁移码粘贴到下面，导入会去重合并，不覆盖现有数据。",
    "panel.transfer.done_short": "迁移码已生成，复制到另一台设备即可。",
    "panel.close": "关闭",
    "panel.clear.title": "确定清除全部数据？",
    "panel.clear.desc": "这台设备上的收藏、推荐历史与搜索记录会被永久删除，无法恢复。",
    "panel.clear.confirm": "确认清除",
    "panel.clear.back": "返回",
    "panel.clear.done": "已清除全部数据。",
    "panel.import.ok": "导入完成：新增 {added} 条，更新 {updated} 条，搜索 {searches} 条，收藏 {favorites} 张。",
    "panel.persist.on": "已自动开启",
    "panel.persist.pending": "已自动申请",
    "panel.persist.label": "持久化存储",
    "panel.working": "处理中…",
  },
  en: {
    // ---- SplashPage ----
    "tagline": "The movies were calling",
    "splash.desc": "Tell us what you love. AI-powered progressive Q&A pinpoints your taste and recommends films & shows tailored to you.",
    "splash.feature1.title": "Dual Input",
    "splash.feature1.desc": "Enter 1-2 reference works. AI analyzes commonalities and differences to pinpoint your taste coordinates.",
    "splash.feature2.title": "Adaptive Q&A",
    "splash.feature2.desc": "6-8 progressive questions dynamically generated from your picks, quickly converging on your preferences.",
    "splash.feature3.title": "Precision Picks",
    "splash.feature3.desc": "Powered by DeepSeek: 2 popular hits + 2 hidden gems + 1 controversial wildcard.",
    "splash.feature4.title": "Share & Save",
    "splash.feature4.desc": "Share recommendations via link or save as a high-res PNG image.",
    "splash.contact": "Contact:",
    "splash.start": "EXPLORE",
    "splash.got_it": "GOT IT",

    // ---- App ----
    "app.info": "INFO",

    // ---- InputPage ----
    "input.back": "Back to Home",
    "input.primary_label": "Primary Reference",
    "input.secondary_label": "Additional Reference (Optional)",
    "input.primary_placeholder": "e.g. Interstellar",
    "input.secondary_placeholder": "e.g. Blade Runner 2049",
    "input.year_placeholder": "Year",
    "input.year_hint": "Year required, editable",
    "input.searching": "Searching the movie vault...",
    "input.no_results": "No matches found. Try a more precise title.",
    "input.submit": "ANALYZE DNA",
    "input.browse_discover": "Browse curated picks",
    "input.suggestion_format": "（{year}，{director}）",
    "input.quotes": [
      "Kim's Video was our film school",
      "Physical media reigns supreme",
      "A temple for movie lovers",
      "55,000 movies. One obsession",
      "Every tape tells a story",
    ],

    // ---- ResultsPage ----
    "results.genome_match": "《{primary}》{secondary} Genome Match",
    "results.diagnosis": "MATCH DIAGNOSIS",
    "results.director": "Dir: {director}",
    "results.full_info": "FULL INFO",
    "results.replace_btn": "REPLACE",
    "results.searching_dots": "Searching...",
    "results.no_results": "No results found",
    "results.badge_hot": "🔥 Popular Pick",
    "results.badge_niche": "🕵️ Hidden Gem",
    "results.badge_controversial": "⚡ Wild Card",
    "results.reboot": "REBOOT",

    // ---- MovieDetail ----
    "detail.source_prefix": "Recommended based on your love for 《{title}》({year})",
    "detail.back": "← Back to Results",
    "detail.share": "Share",
    "detail.reboot": "REBOOT",
    "detail.taste_match": "◆ TASTE MATCH",
    "detail.view_tmdb": "View on TMDB ↗",
    "detail.no_poster": "NO POSTER",
    "detail.load_error": "Unable to load movie data",
    "detail.runtime": "⏱ {minutes} min",
    "detail.director": "Dir: {director}",

    // ---- Loading ----
    "loading.quotes": [
      "Rent a movie",
      "Film everything",
      "The videos spoke to me",
      "Go for it. See what happens",
      "Some collections refuse to disappear",
      "The movies were calling",
    ],
    "loading.eta": "Usually takes 3-8s",

    // ---- Share / Alert ----
    "share.text": "AI picked movies for me! Based on 《{primary}》{secondary}, check out my taste DNA report →",
    "share.copied": "Link copied to clipboard, share it with friends!",
    "share.prompt": "Copy this link to share:",

    // ---- Errors ----
    "error.required": "The title and year of the primary reference are required!",
    "error.year": "Please enter a valid year.",
    "error.qa_failed": "Failed to generate questions. Please try again.",
    "error.rec_failed": "Failed to generate recommendations. Please try again.",
    "error.gen_failed": "Generation failed. Please try again.",

    // ---- SaveContent ----
    "save.recommended_for": "Recommended for fans of {title}",
    "save.hot": "Popular Pick",
    "save.niche": "Hidden Gem",
    "save.controversial": "Wild Card",
    "save.subtitle": "AI-powered recommendations based on 《{primary}》{secondary}",
    "save.footer": "bloodyrex.xyz | Kim's Video — AI Movie Recommender",

    // ---- DiscoverPage ----
    "discover.title": "DISCOVER",
    "discover.desc": "Every film you love leads to another adventure. Browse curated pairings and click to explore full details.",
    "discover.view_detail": "DETAILS",
    "discover.if_like": "If you like",
    "discover.arrow": "",

    // ---- SEO ----
    "seo.hub.title": "AI Movie Recommendation Discovery Hub",
    "seo.hub.intro": "This page uses AI to match movies by mood, theme, and style, generating curated recommendation pairs based on your preferences.",
    "seo.hub.genres": "Covered genres include: Sci-Fi, Drama, Mystery, Animation, Crime, Independent Films and more.",
    "seo.hub.desc": "Each recommendation is the result of emotional similarity analysis, thematic extension, and stylistic comparison.",
    "seo.footer.title": "About the Recommendation Logic",
    "seo.footer.p1": "This system analyzes film genre tags, narrative structure, and audience emotional feedback to build a cross-film similarity network.",
    "seo.footer.p2": "Recommendations are not based on a single rating, but combine narrative structure and viewing experience for matching.",
    "seo.link.home": "Back to Home",

    // ---- WallPage ----
    "wall.desc": "New films collected daily, arranged by release date — a wall that keeps growing.",
    "wall.loading": "Loading the movie wall...",
    "wall.error": "Failed to load the wall. Please retry.",
    "wall.empty": "No films match your filters",
    "wall.prev": "← PREV",
    "wall.next": "NEXT →",

    // ---- Footer ----
    // EN labels mirror the four home-grid card TITLES (AI Search / Discover /
    // Intelligence / Movie Wall) — only Intelligence abbreviates to Intel.
    "footer.home": "AI Search",
    "footer.discover": "Discover",
    "footer.intel": "Intel",
    "footer.wall": "Movie Wall",
    "footer.festivals": "Festivals",
    "festivals.title": "Global Festival Calendar",
    "festivals.subtitle": "GLOBAL FESTIVAL CALENDAR · OFFICIAL SOURCES",
    "footer.mydata": "My Data",

    // ---- MyDataPage ----
    "mydata.title": "My Data",
    "mydata.subtitle": "Everything is stored on this device. No account required. Export, import, migrate or delete it any time.",
    "mydata.back": "← Back home",
    "mydata.stats.title": "Storage overview",
    "mydata.stats.recos": "Recommendations",
    "mydata.stats.searches": "Searches",
    "mydata.stats.size": "Storage used",
    "mydata.stats.persisted": "Persistent storage granted",
    "mydata.stats.not_persisted": "Persistent storage not granted",
    "mydata.persist.btn": "Request persistent storage",
    "mydata.persist.ok": "Done — the browser won't evict your data under storage pressure.",
    "mydata.persist.fail": "The browser declined the request. Your data stays, but it may be cleared when space runs low — export a backup regularly.",
    "mydata.recos.title": "Recommendation history",
    "mydata.recos.empty": "No recommendations yet. Run a search to generate one.",
    "mydata.recos.count": "{n} films",
    "mydata.recos.expand": "Show picks",
    "mydata.recos.collapse": "Collapse",
    "mydata.recos.delete": "Delete",
    "mydata.recos.clear": "Clear recommendation history",
    "mydata.searches.title": "Search history",
    "mydata.searches.empty": "No searches yet.",
    "mydata.searches.clear": "Clear search history",
    "mydata.export.title": "Export backup",
    "mydata.export.desc": "Export a JSON file to your computer or cloud drive — that's your full backup.",
    "mydata.export.btn": "Export backup file",
    "mydata.export.pass_ph": "Optional password; leave blank for plain JSON",
    "mydata.import.title": "Import & restore",
    "mydata.import.desc": "Pick a previously exported JSON file, or paste a migration code. Imports are merged and de-duplicated — existing data is never overwritten.",
    "mydata.import.file": "Choose file",
    "mydata.import.paste_ph": "Paste a migration code (KV1:/KV1G: blob, or 10-char cloud short code)",
    "mydata.import.btn": "Import & merge",
    "mydata.import.pass_ph": "Fill in if the backup is password-protected",
    "mydata.import.ok": "Imported: {added} added, {updated} updated, {searches} searches.",
    "mydata.import.fail": "Import failed: {error}",
    "mydata.migrate.title": "Move to another device",
    "mydata.migrate.desc": "Generate a migration code and paste it into this page on your other device. It's not an account — use it once.",
    "mydata.migrate.gen": "Generate migration code",
    "mydata.migrate.copy": "Copy",
    "mydata.migrate.copied": "Copied",
    "mydata.migrate.len": "~{n} characters",
    "mydata.migrate.remote_code": "Generate cloud migration code",
    "mydata.migrate.remote_hint": "Stores a copy on the server temporarily and issues a short code. Redeem it on another device within 24h; it's destroyed on redemption, no need to paste the long code.",
    "mydata.migrate.remote_done": "Cloud migration code generated — redeem it within 24 hours.",
    "mydata.migrate.remote_fail": "Cloud operation failed: {msg}",
    "mydata.migrate.fallback": "Network unavailable, fell back to local long code",
    "mydata.danger.title": "Erase everything",
    "mydata.danger.desc": "Deletes every recommendation and search stored on this device. This cannot be undone — export a backup first.",
    "mydata.danger.btn": "Erase all data",
    "mydata.danger.confirm": "Erase all personal data? This cannot be undone.",
    "mydata.danger.done": "Erased.",
    "mydata.delete.confirm": "Delete this record?",
    "mydata.clear_recos.confirm": "Clear all recommendation history?",
    "mydata.clear_searches.confirm": "Clear all search history?",
    "mydata.not_supported": "This browser doesn't support local storage (private mode?). Nothing will be saved.",
    "mydata.device": "Device ID",
    "mydata.export.ok": "Backup exported: {recos} recommendations / {searches} searches.",
    "mydata.migrate.bad_code": "Operation failed: bad code, corrupt file, or wrong passphrase.",
    // ---- Home「My Data」panel (embedded at the bottom of the home page) ----
    "panel.title": "My Data",
    "panel.subtitle": "My Data",
    "panel.desc": "Favorites and recommendation history live on this device — no account needed. Migrate to another device or wipe it in one click.",
    "panel.favs.title": "My Favorite Cards",
    "panel.favs.empty": "No favorites yet. Tap the star on the wall, discover page or AI results to save one.",
    "panel.favs.remove": "Remove favorite",
    "panel.favs.count": "{n} saved",
    "panel.favs.short": "Favorites",
    "panel.recos.title": "My Recommendation History",
    "panel.recos.empty": "No recommendations yet. Run one AI recommendation and it will show up here.",
    "panel.transfer": "Transfer Data",
    "panel.clear": "Clear Data",
    "panel.transfer.title": "Transfer Data",
    "panel.transfer.desc": "Two options: carry this data to another device, or bring data in from somewhere else.",
    "panel.transfer.send.title": "Send this browser's records",
    "panel.transfer.send.desc": "Generate a migration code and paste it on the other device. Tries cloud relay for a short token (10 chars); falls back to the local long code if the network is unavailable.",
    "panel.transfer.recv.title": "Bring in records from elsewhere",
    "panel.transfer.recv.desc": "Paste a migration code generated on the other device. Import merges and dedupes, never overwrites.",
    "panel.transfer.done_short": "Migration code generated — copy it to the other device.",
    "panel.close": "Close",
    "panel.clear.title": "Clear all data?",
    "panel.clear.desc": "Favorites, recommendation history and search history on this device will be permanently deleted.",
    "panel.clear.confirm": "Yes, clear it",
    "panel.clear.back": "Back",
    "panel.clear.done": "All data cleared.",
    "panel.import.ok": "Imported: {added} added, {updated} updated, {searches} searches, {favorites} favorites.",
    "panel.persist.on": "On by default",
    "panel.persist.pending": "Auto-requested",
    "panel.persist.label": "Persistent storage",
    "panel.working": "Working…",
    "mydata.migrate.done": "Migration code generated. Copy it or save it for your other device.",
  },
};

function interpolate(str, params = {}) {
  return str.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? params[key] : `{${key}}`
  );
}

function t(locale, key, params) {
  const msg = messages[locale]?.[key] ?? messages.en?.[key] ?? key;
  return interpolate(msg, params);
}

function getArray(locale, key) {
  const arr = messages[locale]?.[key] ?? messages.en?.[key] ?? [];
  return Array.isArray(arr) ? arr : [];
}

const LocaleContext = createContext(null);

function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    const urlLang = new URLSearchParams(window.location.search).get("lang");
    if (urlLang === "zh" || urlLang === "en") return urlLang;
    const stored = localStorage.getItem("kims_video_lang");
    if (stored === "zh" || stored === "en") return stored;
    return navigator.language?.startsWith("zh") ? "zh" : "en";
  });

  const setLocale = useCallback((newLocale) => {
    setLocaleState(newLocale);
    localStorage.setItem("kims_video_lang", newLocale);
    const url = new URL(window.location);
    url.searchParams.set("lang", newLocale);
    window.history.replaceState(null, "", url);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "zh" ? "en" : "zh");
  }, [locale, setLocale]);

  const translate = useCallback(
    (key, params) => t(locale, key, params),
    [locale]
  );

  const tArray = useCallback(
    (key) => getArray(locale, key),
    [locale]
  );

  return (
    <LocaleContext.Provider
      value={{ locale, setLocale, toggleLocale, t: translate, tArray }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

export { LocaleProvider, useLocale };
