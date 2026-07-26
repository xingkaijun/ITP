# 设计风格指南 · Deep Teal Elegance

> 本文档描述 ITP 前端的完整视觉体系，目标是让任何项目都能照此复刻同一风格。
> 风格关键词：**墨绿（Deep Teal）· 典雅 · 圆润 · 轻盈动效 · 高信息密度但不拥挤**。

---

## 1. 设计哲学

1. **一条主色线贯穿全站**：所有强调、交互、品牌表达都收敛到"墨绿 → 翠绿"这一条色相带上（teal 700 ~ teal 500）。红/黄/绿等语义色只用于状态反馈，绝不参与品牌表达。
2. **深色横幅 + 浅色内容**：页面唯一的深色块是顶部 banner，其余全部是近白的浅色面板。深浅对比制造层级，避免全页深色的压抑或全页浅色的寡淡。
3. **克制的动效**：动效只做三类——进场（上浮淡入）、悬停（轻微上浮）、装饰（缓慢流光）。时长短、幅度小、缓动柔和；并且必须尊重 `prefers-reduced-motion`。
4. **典雅而非机械**：标题保留正常大小写（不要满屏 uppercase）；小标签（eyebrow/表头）才用大写+宽字距。圆角大而柔（12–18px），阴影带主色色相而非纯黑。

---

## 2. 字体

```html
<!-- index.html -->
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=Inter:wght@300..700&display=swap" rel="stylesheet" />
```

```css
:root {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
h1, h2, h3, h4, h5, h6, .brand {
  font-family: 'Space Grotesk', 'Inter', sans-serif;
}
```

- **正文 = Inter**：中性、清晰，适合表格与表单密集的业务界面。
- **标题 = Space Grotesk**：几何感、有个性，用于 h1–h6、品牌字、数字大屏。
- 字重使用习惯：正文 400–500；标题 600（不要 900，会显得机械粗暴）；小标签 600–700。
- 大数字（指标卡）用 Space Grotesk 700、28px。
- 小标签（eyebrow）规格：`font-size: 11px; font-weight: 600; letter-spacing: 0.14em–0.22em; text-transform: uppercase;`。

---

## 3. 色彩体系

### 3.1 设计令牌（直接复制）

```css
:root {
  /* 文字 */
  color: #1c2422;                       /* 主文字：近黑的墨绿灰 */
  --text-muted: #64716e;                /* 次要文字：带绿相的灰 */

  /* 品牌主色（teal 色带） */
  --accent: #0f766e;                    /* 主色 teal-700 */
  --accent-deep: #06544e;               /* 深主色，渐变终点/标题强调 */
  --accent-soft: #ccfbf1;              /* 主色浅底（选中、徽标底） */
  --accent-glow: #9cf2e8;              /* 高光青，深色底上的点缀字色 */

  /* 面板与边框 */
  --panel: #ffffff;
  --border: rgba(167, 186, 182, 0.45);  /* 边框永远用带绿相的半透明灰 */
  --border-soft: rgba(190, 205, 202, 0.4);

  /* 阴影：带主色色相，不用纯黑 */
  --shadow-soft: 0 10px 30px rgba(21, 62, 58, 0.06);

  /* 版心 */
  --page-width: 1560px;
}
```

### 3.2 页面背景

背景不是纯色，而是"极浅的绿白 + 两团固定光晕"，营造纵深：

```css
body {
  background:
    radial-gradient(1100px 480px at 12% -8%, rgba(15, 118, 110, 0.09), transparent 62%),
    radial-gradient(900px 420px at 88% -6%, rgba(156, 242, 232, 0.18), transparent 58%),
    linear-gradient(180deg, #eef8f4 0%, #f6faf8 320px, #f6faf8 100%);
  background-attachment: fixed;
  margin: 0;
}
```

### 3.3 常用衍生色速查

| 用途 | 值 |
|---|---|
| 交互高亮边框 / focus | `#0d9488`（teal-600） |
| 渐变亮端 | `#14b8a6`（teal-500） |
| 悬停行底色 | `#f0fdfa`（teal-50） |
| 按钮渐变 | `linear-gradient(135deg, #005c55 0%, #0f766e 100%)` |
| 深色胶囊（toast） | `rgba(9, 62, 57, 0.92)` |
| 成功 | 底 `#dcfce7` 字 `#166534` |
| 警告 | 底 `#fef3c7` 字 `#92400e` |
| 危险 | 底 `#fee2e2` 字 `#991b1b`，实心键 `#b91c1c` |

**原则**：语义色（红黄绿）只出现在状态徽标、告警条、危险按钮上；页面其余一切强调色都必须是 teal。

---

## 4. 布局

- **统一版心**：banner、内容区、通栏面板全部 `max-width: var(--page-width); margin: 0 auto;`。**绝不允许 banner 比内容窄**——这是本风格最容易翻车的点。
- 页面外边距：`padding: 20px`（移动端 12px）。
- 栅格间距节奏：卡片间 `gap: 14–16px`；卡片内 `padding: 14px`；大面板 `padding: 28–34px`。
- 圆角体系：
  - 大容器（banner、面板、弹窗）：**12–18px**
  - 中元素（输入框、按钮、小卡）：**8px**
  - 胶囊（导航、徽标、toast、进度条）：**999px**

---

## 5. 核心组件规范

### 5.1 顶部 Banner（本风格的灵魂）

深墨绿渐变 + 双光晕 + 内侧高光 + 周期流光，圆角悬浮于页面顶部：

```css
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  max-width: var(--page-width);
  margin: 0 auto 16px;
  padding: 18px 26px;
  position: relative;
  overflow: hidden;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  background:
    radial-gradient(620px 220px at 88% -40%, rgba(156, 242, 232, 0.28), transparent 70%),
    radial-gradient(480px 200px at 4% 130%, rgba(4, 61, 56, 0.55), transparent 72%),
    linear-gradient(128deg, #084c46 0%, #0d6b63 48%, #12857a 100%);
  box-shadow:
    0 24px 48px -16px rgba(8, 76, 70, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);   /* 上缘高光，制造玻璃感 */
  animation: riseIn 420ms ease-out both;
}

/* 每 7 秒扫过一道流光 */
.topbar::after {
  content: "";
  position: absolute;
  top: 0; bottom: 0; left: 0;
  width: 38%;
  background: linear-gradient(100deg, transparent 12%, rgba(255,255,255,0.08) 50%, transparent 88%);
  transform: translateX(-120%) skewX(-18deg);
  animation: sheen 7s ease-in-out 1.2s infinite;
  pointer-events: none;
}
```

Banner 内部构成（从左到右）：
1. **Logo 白底小卡**：白底、12px 圆角、带主色阴影 `0 8px 20px rgba(4,47,43,0.25)`；
2. **标题组**：h1 用 Space Grotesk 600 / 22px / 正常大小写；下方 eyebrow 副标题用 `rgba(204,251,241,0.72)`、11px、大写、0.22em 字距；
3. **胶囊导航**（见 5.2）。

### 5.2 胶囊导航（Pill Nav）

深色底上的半透明胶囊组，选中项"翻白"：

```css
.nav-panel {
  display: flex;
  gap: 3px;
  padding: 5px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);   /* 内凹感 */
}
.nav-panel button {
  background: transparent;
  border-radius: 999px;
  color: rgba(204, 251, 241, 0.75);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.nav-panel button:hover  { background: rgba(255,255,255,0.08); color: #fff; }
.nav-panel button.active { background: #fff; color: var(--accent-deep);
                           box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
```

### 5.3 卡片 / 面板

```css
.card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-soft);
  padding: 14px;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}
.card:hover {                       /* 仅可交互卡片加 hover */
  border-color: rgba(13, 148, 136, 0.4);
  box-shadow: 0 14px 34px rgba(13, 148, 136, 0.1);
  transform: translateY(-2px);
}
.card.selected {
  border-color: #0d9488;
  box-shadow: 0 0 0 2px var(--accent-soft), var(--shadow-soft);
}
```

指标卡（KPI）额外加左缘饰条：

```css
.metric-card::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: linear-gradient(180deg, #14b8a6, var(--accent-deep));
  opacity: 0.75;
}
```

### 5.4 面板标题

h2 左侧一条渐变小竖条作为视觉锚点：

```css
h2 {
  position: relative;
  padding-left: 14px;
  font-size: 16px;
  font-weight: 600;
}
h2::before {
  content: "";
  position: absolute;
  left: 0; top: 50%;
  transform: translateY(-50%);
  width: 4px; height: 16px;
  border-radius: 999px;
  background: linear-gradient(180deg, #14b8a6, var(--accent-deep));
}
```

### 5.5 按钮

```css
/* 主按钮：墨绿渐变 */
button {
  background: linear-gradient(135deg, #005c55 0%, #0f766e 100%);
  border: 0;
  border-radius: 8px;
  color: #fff;
  font-weight: 600;
  min-height: 36px;
  padding: 0 12px;
  transition: box-shadow 140ms, transform 120ms, filter 140ms;
}
button:hover:not(:disabled) {
  box-shadow: 0 5px 14px rgba(13, 148, 136, 0.22);
  filter: brightness(1.08);
  transform: translateY(-1px);
}
button:active:not(:disabled) { transform: translateY(0); box-shadow: none; }

/* 禁用态：明确变灰，绝不用半透明主色（会显得"病恹恹"） */
button:disabled {
  background: rgba(148, 163, 173, 0.28);
  color: rgba(60, 74, 71, 0.55);
  box-shadow: none;
  cursor: not-allowed;
}

/* 次要按钮 */
.soft-button { background: #e2e8f0; color: #1f2933; }
/* 危险按钮 */
.danger-button { background: #b91c1c; }

/* 键盘焦点环 */
button:focus-visible, input:focus-visible, select:focus-visible {
  outline: 2px solid #14b8a6;
  outline-offset: 2px;
}
```

### 5.6 表单控件

```css
input, select {
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  min-height: 36px;
  padding: 0 10px;
  transition: border-color 140ms, box-shadow 140ms;
}
input:focus, select:focus {
  border-color: #0d9488;
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.14);
  outline: 0;
}
```

### 5.7 进度条

胶囊轨道 + 渐变填充 + 流光：

```css
.progress-track {
  background: rgba(148, 163, 184, 0.22);
  border-radius: 999px;
  height: 9px;
  overflow: hidden;
}
.progress-fill {
  position: relative;
  overflow: hidden;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #0f766e, #14b8a6);
  transition: width 480ms cubic-bezier(0.22, 1, 0.36, 1);  /* 弹性缓出 */
}
.progress-fill::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.35) 50%, transparent 80%);
  transform: translateX(-120%) skewX(-18deg);
  animation: sheen 3.6s ease-in-out 0.6s infinite;
}
```

### 5.8 Toast（消息提示）

顶部居中悬浮的深绿毛玻璃胶囊，不做通栏色条：

```css
.toast {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  padding: 11px 22px;
  border-radius: 999px;
  background: rgba(9, 62, 57, 0.92);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(156, 242, 232, 0.25);
  box-shadow: 0 18px 44px rgba(6, 48, 44, 0.35);
  color: #f0fdfa;
  font-size: 13px;
  max-width: min(640px, calc(100vw - 48px));
  animation: toastDrop 260ms ease-out both;
}
```

### 5.9 弹窗

```css
.modal-backdrop {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center;
  background: rgba(10, 40, 37, 0.45);   /* 深绿黑而非纯黑 */
  backdrop-filter: blur(5px);
}
.modal-panel {
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.2);
  animation: riseIn 240ms ease-out both;
}
```

### 5.10 表格 / 列表行

- 表头：`font-size: 13px; font-weight: 600; color: var(--text-muted);`（大表格可用 uppercase + 0.08em 字距）。
- 行分隔线：`1px solid #edf2f7`。
- 悬停行：`background: #f0fdfa;`（teal-50，全站统一）。
- 状态行底色：完成 `#f1fbf4`、待办 `#fff7f7`——饱和度极低，仅作暗示。

---

## 6. 动效体系

三个关键帧走天下：

```css
/* 进场：上浮淡入 */
@keyframes riseIn {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* toast：下落 */
@keyframes toastDrop {
  from { opacity: 0; transform: translate(-50%, -14px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}
/* 流光：斜切扫过 */
@keyframes sheen {
  0%        { transform: translateX(-120%) skewX(-18deg); }
  60%, 100% { transform: translateX(340%)  skewX(-18deg); }
}
```

使用规则：

| 场景 | 参数 |
|---|---|
| Banner 进场 | `riseIn 420ms ease-out both` |
| 页面内容进场 | `riseIn 460ms ease-out 60ms both`（比 banner 晚 60ms，形成层次） |
| 弹窗进场 | `riseIn 240ms ease-out both` |
| 悬停上浮 | `transform: translateY(-1px ~ -2px)`，160ms |
| Banner 流光 | 7s 一轮，透明度 ≤ 0.08（要"若有若无"） |
| 进度条流光 | 3.6s 一轮，白光 0.35 |
| 进度填充 | `width 480ms cubic-bezier(0.22, 1, 0.36, 1)` |

**强制项**：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

---

## 7. 响应式

- 断点：`1180px`（三栏→单栏、banner 换行）与 `720px`（网格全部单列、外边距 20px→12px）。
- 移动端 banner 允许纵向堆叠（`flex-direction: column`），但保持渐变与圆角。

---

## 8. 复刻检查清单

- [ ] 引入 Inter + Space Grotesk，标题字体族生效
- [ ] 复制 `:root` 令牌，全站无裸写的蓝色/紫色强调
- [ ] Banner 与内容区同一个 `--page-width`，左右完全对齐
- [ ] Banner 使用三层渐变 + 内侧高光 + 流光伪元素
- [ ] 导航是深底胶囊组，选中项白底墨绿字
- [ ] 所有面板 12px+ 圆角、带绿相半透明边框、主色阴影
- [ ] 按钮为墨绿渐变，禁用态变灰（不是半透明）
- [ ] focus 有青绿焦点环（键盘可达性）
- [ ] 悬停行 / 悬停卡片统一 `#f0fdfa` / 上浮 2px
- [ ] toast 为悬浮胶囊，弹窗背景为深绿毛玻璃
- [ ] 三个 keyframes + reduced-motion 兜底

---

## 9. 禁忌（踩过的坑）

1. **banner 比内容窄** → 立即显得廉价，版心必须统一。
2. **满屏大写 + 900 字重** → 机械感，典雅风格里 uppercase 只留给 11px 小标签。
3. **禁用按钮用半透明主色** → 看起来像"坏掉的绿"，必须明确变灰。
4. **纯黑阴影 / 纯灰边框** → 和绿色系不融合，阴影边框都要带主色色相。
5. **动效过量**：不要给表格行加进场动画、不要让流光透明度超过 0.1、不要用弹跳缓动。
6. **语义色滥用**：红黄绿只做状态，一旦用来装饰，主色线就散了。
