# 邮件订阅与每日精选数据管道打通方案

## 现状分析

| 组件 | 现状 | 问题 |
|------|------|------|
| `SubscribeSection` | 独立表单，仅收集邮箱 → `/intelligence/subscribe` | 与每日精选（`/api/discover-daily.json`）无关联 |
| `useDiscoverData` | 从 `/api/discover-daily.json` / `/api/overview.json` 拉取 6 条编辑精选 | 无周级去重，无用户偏好记录 |
| 邮件发送 | Worker 定时任务 `send-digest` | 内容固定，不根据用户历史个性化 |

## 目标

1. **周级去重**：同一用户一周内不重复收到相同精选
2. **偏好感知**：根据用户点赞/浏览历史，调整邮件推荐权重
3. **管道打通**：订阅 → 偏好画像 → 每日精选筛选 → 邮件发送

---

## 方案架构

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│  订阅入口   │────▶│  用户画像表   │◀───│  行为采集       │     │  每日精选池   │
│  (Subscribe)│     │  (KV/R2)     │     │  (点赞/浏览/分享)│     │  (discover.json)│
└─────────────┘     └──────┬───────┘     └────────┬────────┘     └──────┬───────┘
                           │                      │                    │
                           ▼                      ▼                    ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │              邮件内容组装 Worker (send-digest)          │
                    │  1. 读取用户画像                                        │
                    │  2. 从精选池排除「本周已推送」+「低偏好类型」            │
                    │  3. 按偏好权重排序，取 Top 6                           │
                    │  4. 渲染模板 → 发送                                     │
                    └─────────────────────────────────────────────────────────┘
```

---

## 数据结构设计

### 1. 用户画像 (KV: `user_profile:{emailHash}`)
```json
{
  "email": "user@example.com",
  "emailHash": "sha256...",
  "subscribedAt": "2026-11-19T08:00:00Z",
  "preferences": {
    "genres": { "Action": 0.8, "Sci-Fi": 0.6, "Drama": 0.3 },
    "likedTmdbIds": [123, 456],
    "dislikedTmdbIds": [789]
  },
  "weeklySent": {
    "2026-W47": [123, 456, 789, 101, 112, 131],
    "2026-W48": [222, 333]
  },
  "lastDigestSent": "2026-11-19T08:00:00Z"
}
```

### 2. 每日精选池 (R2/静态 JSON: `discover-daily.json`)
```json
{
  "date": "2026-11-19",
  "picks": [
    { "tmdbId": 123, "title": "...", "genres": ["Action", "Sci-Fi"], "reason": "...", "category": "editors" },
    { "tmdbId": 456, "title": "...", "genres": ["Drama"], "reason": "...", "category": "gem" }
  ]
}
```

---

## 实施步骤

### Phase 1: 订阅入口增强（前端 + Worker）
**文件**：`src/components/SubscribeSection.jsx`、`workers-1.4.js`

1. **前端**：订阅成功后，把 `emailHash` 写入 `localStorage`（键 `kims_sub_email_hash`），便于后续行为归因
2. **Worker `/intelligence/subscribe`**：
   - 生成 `emailHash = sha256(email + salt)`
   - 在 KV 写入初始画像（`preferences.genres` 为空，`weeklySent` 为空）
   - 返回 `emailHash` 给前端

### Phase 2: 行为采集（前端埋点）
**文件**：`src/hooks/useDiscoverData.js`、新建 `src/services/analytics.js`

1. **点赞**：`handleLike` 成功后，调用 `analytics.track('like', { tmdbId, emailHash })`
2. **打开详情**：`setDetailPair`/`setDetailPick` 时，`track('view', { tmdbId, emailHash })`
3. **分享/点击外链**：`TrailerButtons` 等点击时 `track('click', { tmdbId, target: 'tmdb|imdb|youtube', emailHash })`

**Worker `/intelligence/track`**：
- 接收事件，更新 KV `user_profile` 的 `preferences.genres`（按类型加权）与 `likedTmdbIds`

### Phase 3: 邮件组装逻辑重写（Worker `send-digest`）
**文件**：`workers-1.4.js` 中的 `send-digest` 定时任务

```javascript
async function assembleDigest(emailHash, profile) {
  // 1. 获取本周已发送 ID 集合
  const weekKey = getISOWeekKey(); // "2026-W47"
  const sentThisWeek = new Set(profile.weeklySent[weekKey] || []);
  
  // 2. 拉取未来 7 天精选池（或从 discover.json 取足量候选）
  const candidates = await fetchCandidates(50); // 取 50 条候选
  
  // 3. 过滤：排除已发送 + 低偏好类型
  const filtered = candidates.filter(c => 
    !sentThisWeek.has(c.tmdbId) &&
    (profile.preferences.genres[c.genres[0]] ?? 0.5) > 0.3
  );
  
  // 4. 评分：偏好权重 * 新鲜度 * 多样性惩罚
  const scored = filtered.map(c => ({
    ...c,
    score: genreWeight(c, profile) * freshness(c) * diversityPenalty(c, filtered)
  })).sort((a, b) => b.score - a.score);
  
  // 5. 取 Top 6，记录本周已发送
  const picks = scored.slice(0, 6);
  profile.weeklySent[weekKey] = [...(profile.weeklySent[weekKey] || []), ...picks.map(p => p.tmdbId)];
  await KV.put(`user_profile:${emailHash}`, JSON.stringify(profile));
  
  return picks;
}
```

### Phase 4: 模板渲染与发送
- 复用现有邮件模板，注入 `picks` 数组
- 每条精选包含：海报、标题、理由、TMDB/IMDb/预告片链接
- 页脚加「管理偏好」链接（指向 `/discover?emailHash=...`）

---

## 前端配合改动清单

| 文件 | 改动 |
|------|------|
| `SubscribeSection.jsx` | 订阅成功存 `emailHash` 到 localStorage |
| `useDiscoverData.js` | `handleLike`/`setDetailPair`/`setDetailPick` 后调用 `analytics.track()` |
| `src/services/analytics.js` (新建) | 统一上报函数，批量发送、失败重试、本地队列 |
| `DiscoverPage.jsx` | URL 携带 `?emailHash=` 时，预填偏好、高亮推荐理由 |

---

## Worker 新增/改动端点

| 端点 | 方法 | 用途 |
|------|------|------|
| `/intelligence/subscribe` | POST | 现有，新增返回 `emailHash` |
| `/intelligence/track` | POST | 新建，接收行为事件，更新画像 |
| `/intelligence/preferences` | GET | 新建，前端查询当前偏好（用于 Discover 页个性化） |
| `send-digest` (cron) | 定时 | 重写组装逻辑，按用户画像个性化发送 |

---

## 部署顺序

1. **Worker 先行**：部署 `/intelligence/track`、`/intelligence/preferences`、重写 `send-digest`
2. **前端接入**：`analytics.js` + `SubscribeSection` + `useDiscoverData` 埋点
3. **灰度验证**：小比例用户开启个性化，对比打开率/点击率
4. **全量切换**

---

## 回滚策略

- Worker 保留旧版 `send-digest` 逻辑，通过环境变量 `DIGEST_VERSION=legacy|personalized` 切换
- 前端 `analytics.track` 失败静默降级，不影响主流程

---

## 预期收益

| 指标 | 现状 | 目标 |
|------|------|------|
| 邮件打开率 | 基线 | +15-20% |
| 精选点击率 (CTR) | 基线 | +25-30% |
| 周留存 (7-day) | 基线 | +10% |
| 重复推荐投诉 | 偶发 | 0 |

---

## 风险与对策

| 风险 | 对策 |
|------|------|
| KV 读写延迟导致发送超时 | `send-digest` 分批处理，每批 50 用户，异步并发 |
| 偏好数据稀疏（新用户） | 冷启动用「编辑精选」兜底，权重 0.5 |
| 邮件模板渲染报错 | try-catch 单用户隔离，失败记录不阻塞批次 |
| 隐私合规 | 仅存 `emailHash` 不存明文，提供 `/intelligence/unsubscribe` 彻底删除 |