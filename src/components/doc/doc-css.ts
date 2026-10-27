// 文档阅读层的唯一配色 / 排版 / 组件样式源。
//
// 作用域固定在 `.doc-scope` 内：学习路线、周计划、实践项目三处页面共用，
// 但不会影响笔记、练习等仍然使用 MD_BODY_CSS 的页面。
// 深浅色只靠两组 CSS 变量切换，组件本身不写死颜色。
export const DOC_CSS = `
.doc-scope{
  --doc-line:rgba(128,128,128,.18);
  --doc-line-strong:rgba(128,128,128,.3);
  --doc-soft:rgba(128,128,128,.06);
  --doc-code:rgba(128,128,128,.09);
  --doc-card:#ffffff;
  --doc-text:#3f3f46;
  --doc-head:#111827;
  --doc-muted:#6b7280;
  --doc-accent:var(--app-accent,#6366f1);
  --doc-ok:#237804;
  --doc-active-bg:color-mix(in srgb,var(--app-accent,#6366f1) 8%,transparent);
  --doc-active-border:color-mix(in srgb,var(--app-accent,#6366f1) 45%,transparent);
}
.dark .doc-scope{
  --doc-line:rgba(255,255,255,.12);
  --doc-line-strong:rgba(255,255,255,.22);
  --doc-soft:rgba(255,255,255,.06);
  --doc-code:rgba(255,255,255,.07);
  --doc-card:#1f1f1f;
  --doc-text:#d4d4d8;
  --doc-head:#f4f4f5;
  --doc-muted:#a1a1aa;
  --doc-accent:var(--app-accent,#818cf8);
  --doc-ok:#95de64;
  --doc-active-bg:color-mix(in srgb,var(--app-accent,#6366f1) 18%,transparent);
  --doc-active-border:color-mix(in srgb,var(--app-accent,#818cf8) 55%,transparent);
}

/* ---- 布局：左侧大纲 + 正文 ---- */
.doc-layout{display:flex;align-items:flex-start;gap:34px}
.doc-aside{position:sticky;top:72px;flex:none;width:254px;max-height:calc(100vh - 88px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;padding-right:16px;border-right:1px solid var(--doc-line)}
.doc-main{min-width:0;flex:1}
.doc-mobile-aside{display:none;margin-bottom:18px;border:1px solid var(--doc-line);border-radius:10px;padding:8px 12px;background:var(--doc-card)}
.doc-mobile-aside summary{cursor:pointer;font-size:13px;color:var(--doc-text)}
.doc-mobile-aside-body{padding-top:10px}
.doc-mobile-toc{margin-top:14px;padding-top:12px;border-top:1px solid var(--doc-line)}

/* ---- 右栏：本页目录（实践项目详情专用；DocShell 传了 toc 才出现） ---- */
.doc-layout.has-toc{gap:28px}
.doc-toc{position:sticky;top:72px;flex:none;width:190px;max-height:calc(100vh - 88px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;padding-left:16px;border-left:1px solid var(--doc-line)}
.doc-toc .doc-nav-section:last-child{margin-bottom:0}
/* 右栏只有 190px：沿用左栏 24px 的缩进会把标题挤到只剩几个字 */
.doc-toc .doc-nav-item.is-sub{padding-left:14px}

@media(max-width:1439px){
  /* 1280–1439 这一档：三栏会把正文挤得太窄，右栏收窄而不是消失（否则这一档没有入口） */
  .doc-toc{width:168px}
}
@media(max-width:1279px){
  .doc-aside{display:none}
  .doc-toc{display:none}
  .doc-mobile-aside{display:block}
}

/* ---- 大纲导航 ---- */
.doc-nav-title{font-size:11px;font-weight:600;letter-spacing:.09em;color:var(--doc-muted);padding:0 10px;margin-bottom:10px}
.doc-nav-section{margin-bottom:16px}
.doc-nav-heading{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;letter-spacing:.08em;color:var(--doc-muted);padding:0 10px;margin:0 0 6px}
.doc-nav-heading::after{content:"";flex:1;height:1px;background:var(--doc-line)}
.doc-nav-list{display:flex;flex-direction:column;gap:1px}
.doc-nav-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border-radius:8px;border:0;border-left:2px solid transparent;background:none;color:var(--doc-text);text-decoration:none;font-size:13px;line-height:1.5;text-align:left;cursor:pointer;transition:background .12s,color .12s,border-color .12s}
.doc-nav-item:hover{background:var(--doc-soft);color:var(--doc-accent)}
.doc-nav-item.is-active{color:var(--doc-accent);background:var(--doc-active-bg);border-left-color:var(--doc-accent);font-weight:600}
.doc-nav-item.is-sub{padding-left:24px;font-size:12.5px}
.doc-nav-item.is-flat{padding-left:10px}
.doc-nav-num{flex:none;min-width:22px;font-size:11px;font-variant-numeric:tabular-nums;color:var(--doc-muted);font-weight:500}
.doc-nav-item.is-active .doc-nav-num{color:inherit;opacity:.85}
.doc-nav-icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:18px;font-size:14px;line-height:1}
.doc-nav-text{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.doc-nav-meta{flex:none;font-size:10.5px;color:var(--doc-muted);font-variant-numeric:tabular-nums}
.doc-nav-sub{margin:1px 0 6px}
.doc-nav-empty{padding:4px 10px;font-size:11.5px;color:var(--doc-muted)}
.doc-nav-stage{padding:6px 10px 3px;font-size:11.5px;font-weight:600;color:var(--doc-muted)}

/* ---- 正文排版 ---- */
.doc-body{max-width:860px;font-size:15.5px;line-height:1.85;letter-spacing:.005em;color:var(--doc-text);word-break:break-word}
.doc-body h1{font-size:1.72em;font-weight:700;letter-spacing:-.02em;color:var(--doc-head);margin:1.6em 0 .6em;padding-bottom:.28em;border-bottom:1px solid var(--doc-line)}
.doc-body h2{font-size:1.38em;font-weight:650;letter-spacing:-.01em;color:var(--doc-head);margin:2.1em 0 .7em;padding-bottom:.3em;border-bottom:1px solid var(--doc-line);scroll-margin-top:76px}
.doc-body h3{font-size:1.14em;font-weight:650;color:var(--doc-head);margin:1.8em 0 .5em;scroll-margin-top:76px}
.doc-body h4{font-size:1em;font-weight:650;color:var(--doc-head);margin:1.4em 0 .4em}
.doc-body h1:first-child,.doc-body h2:first-child,.doc-body h3:first-child{margin-top:.3em}
.doc-body p{margin:.7em 0}
.doc-body ul,.doc-body ol{padding-left:1.45em;margin:.55em 0}
.doc-body ul{list-style:disc}
.doc-body ol{list-style:decimal}
.doc-body ul ul{list-style:circle}
.doc-body li{margin:.3em 0}
.doc-body li>p{margin:.2em 0}
.doc-body li::marker{color:var(--doc-accent);opacity:.75}
.doc-body strong{font-weight:650;color:var(--doc-head)}
.doc-body a{color:var(--doc-accent);text-decoration:none}
.doc-body a:hover{text-decoration:underline}
.doc-body code{background:var(--doc-code);padding:.16em .4em;border-radius:5px;font-size:.875em;font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace;color:var(--doc-accent)}
.doc-body pre{background:var(--doc-code);border:1px solid var(--doc-line);padding:14px 16px;border-radius:10px;overflow:auto;margin:.9em 0;line-height:1.62}
.doc-body pre code{background:none;padding:0;font-size:.86em;color:inherit}
.doc-body blockquote{margin:1.1em 0;padding:12px 16px;border-left:3px solid var(--doc-accent);background:color-mix(in srgb,var(--app-accent,#6366f1) 5%,transparent);border-radius:0 10px 10px 0;color:var(--doc-muted)}
.doc-body blockquote p{margin:.25em 0}
.doc-body table{width:100%;border-collapse:collapse;margin:1em 0;font-size:.93em}
.doc-body th,.doc-body td{border:1px solid var(--doc-line);padding:.5em .78em;text-align:left;vertical-align:top}
.doc-body thead th{background:var(--doc-soft);font-weight:600;white-space:nowrap}
.doc-body tbody tr:nth-child(2n){background:rgba(128,128,128,.04)}
.doc-body hr{border:none;border-top:1px solid var(--doc-line);margin:2em 0}
.doc-body img{max-width:100%;border-radius:8px}
.doc-body input[type=checkbox]{margin-right:.4em}

/* ---- 代码块：语言标签 + 复制 ---- */
.doc-code{margin:.9em 0;border:1px solid var(--doc-line);border-radius:10px;overflow:hidden;background:var(--doc-code)}
.doc-code-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 12px;border-bottom:1px solid var(--doc-line);background:rgba(128,128,128,.05)}
.doc-code-lang{font-size:11px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--doc-muted);text-transform:lowercase;letter-spacing:.04em}
.doc-code-copy{border:1px solid var(--doc-line);background:transparent;color:var(--doc-text);border-radius:6px;padding:1px 9px;font-size:11px;line-height:1.7;cursor:pointer;transition:border-color .12s,color .12s}
.doc-code-copy:hover{border-color:var(--doc-accent);color:var(--doc-accent)}
.doc-code-copy.is-run{color:var(--doc-accent);border-color:var(--doc-active-border);background:var(--doc-active-bg)}
.doc-code pre{margin:0;border:0;border-radius:0;padding:14px 16px;overflow:auto;background:transparent;line-height:1.62}
.doc-code pre code{background:none;padding:0;font-size:.86em;color:inherit;font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace}
.doc-code-extra{display:inline-flex;align-items:center;gap:6px}

/* ---- 折叠块：思路 / 答案 / 报错 / 验收 ---- */
.doc-fold{margin:0;padding:0;border:0;background:none}
.doc-fold-head{display:flex;align-items:center;gap:10px;width:100%;padding:11px 0;border:0;border-top:1px solid var(--doc-line);background:none;cursor:pointer;text-align:left;color:inherit;font-size:13.5px;line-height:1.5}
.doc-fold:first-child .doc-fold-head{border-top:0}
.doc-fold-head:hover .doc-fold-title{opacity:1;color:var(--doc-accent)}
.doc-fold-tag{flex:none;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:600;border:1px solid transparent;letter-spacing:.02em}
.doc-fold-hint .doc-fold-tag{color:var(--app-accent,#4f46e5);background:color-mix(in srgb,var(--app-accent,#6366f1) 10%,transparent);border-color:color-mix(in srgb,var(--app-accent,#6366f1) 22%,transparent)}
.doc-fold-solution .doc-fold-tag{color:#237804;background:rgba(82,196,26,.12);border-color:rgba(82,196,26,.26)}
.doc-fold-error .doc-fold-tag{color:#ad4e00;background:rgba(250,140,22,.12);border-color:rgba(250,140,22,.28)}
.doc-fold-check .doc-fold-tag{color:#0e7490;background:rgba(6,182,212,.12);border-color:rgba(6,182,212,.3)}
.doc-fold-title{flex:1;min-width:0;opacity:.82;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:color .12s,opacity .12s}
.doc-fold-arrow{flex:none;font-size:12px;color:var(--doc-accent);opacity:.85}
.doc-fold-body{padding:2px 0 12px}

/* ---- 上一篇 / 下一篇 ---- */
.doc-pager{display:flex;justify-content:space-between;gap:14px;max-width:900px;margin:34px 0 8px}
.doc-pager-btn{display:flex;flex-direction:column;align-items:flex-start;gap:2px;max-width:46%;padding:11px 16px;border:1px solid var(--doc-line);border-radius:12px;background:var(--doc-card);color:inherit;cursor:pointer;text-align:left;transition:border-color .16s,transform .16s}
.doc-pager-btn:hover{border-color:var(--doc-active-border)}
.doc-pager-btn.is-next{align-items:flex-end;text-align:right;margin-left:auto}
.doc-pager-dir{font-size:11px;letter-spacing:.06em;color:var(--doc-muted)}
.doc-pager-title{font-size:13px;font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ---- 进度 / 状态小件 ---- */
.doc-chip{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;background:var(--doc-soft);font-size:11.5px;color:var(--doc-muted);white-space:nowrap}
a.doc-chip{text-decoration:none;transition:background .14s,color .14s}
a.doc-chip:hover{background:var(--doc-active-bg);color:var(--doc-accent)}
.doc-chip.is-ok{background:rgba(82,196,26,.13);color:var(--doc-ok)}
a.doc-chip{text-decoration:none}
a.doc-chip:hover{color:var(--doc-accent)}
.doc-bar{height:6px;border-radius:999px;background:rgba(128,128,128,.16);overflow:hidden}
.doc-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--doc-accent),#52c41a);transition:width .3s}
.doc-actions{display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap}
.doc-title{display:inline-flex;align-items:center;gap:10px;min-width:0}
.doc-title-icon{font-size:1.1em;line-height:1}

/* ---- 页面头：课程首页 / 课时 / 周 ---- */
.doc-hero{max-width:860px;padding:4px 0 26px;border-bottom:1px solid var(--doc-line);margin-bottom:24px}
.doc-kicker{font-size:11.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--doc-accent)}
.doc-hero-title{font-size:32px;line-height:1.25;letter-spacing:-.02em;font-weight:700;color:var(--doc-head);margin:8px 0 10px}
.doc-hero-desc{max-width:660px;margin:0;font-size:15px;line-height:1.8;color:var(--doc-muted)}
.doc-hero-meta{display:flex;align-items:center;gap:8px 16px;flex-wrap:wrap;margin-top:14px;font-size:12.5px;color:var(--doc-muted)}
.doc-article-head{max-width:860px;padding:4px 0 18px;border-bottom:1px solid var(--doc-line);margin-bottom:22px}
.doc-article-title{font-size:29px;line-height:1.32;letter-spacing:-.02em;font-weight:700;color:var(--doc-head);margin:6px 0 0}
.doc-article-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px}
.doc-section{max-width:900px;margin-top:34px}
.doc-section-head{display:flex;align-items:baseline;gap:10px;margin:0 0 10px}
.doc-section-title{margin:0;font-size:16px;font-weight:650;color:var(--doc-head)}
.doc-section-count{font-size:12px;color:var(--doc-muted)}
.doc-section-note{margin-left:auto;font-size:12px;color:var(--doc-muted)}
.doc-lesson-section{max-width:860px;margin-top:28px}
.doc-lesson-section-title{display:flex;align-items:center;gap:10px;margin:0 0 12px;font-size:14px;font-weight:650;color:var(--doc-head)}
.doc-lesson-section-title::after{content:"";flex:1;height:1px;background:var(--doc-line)}

/* ---- 续学卡片 ---- */
.doc-continue{display:flex;align-items:center;gap:14px;width:100%;max-width:860px;margin:0 0 30px;padding:14px 18px;border:1px solid var(--doc-active-border);border-radius:14px;background:var(--doc-active-bg);color:inherit;text-align:left;cursor:pointer;transition:transform .16s,border-color .16s}
.doc-continue:hover{transform:translateY(-1px);border-color:var(--doc-accent)}
.doc-continue-icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:11px;background:var(--doc-card);border:1px solid var(--doc-line);font-size:20px;line-height:1}
.doc-continue-main{flex:1;min-width:0}
.doc-continue-kicker{font-size:11px;font-weight:600;letter-spacing:.08em;color:var(--doc-accent)}
.doc-continue-title{display:block;margin-top:2px;font-size:15px;font-weight:650;color:var(--doc-head);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.doc-continue-sub{display:block;margin-top:2px;font-size:12.5px;color:var(--doc-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.doc-continue-go{flex:none;font-size:12.5px;font-weight:600;color:var(--doc-accent);white-space:nowrap}

/* ---- 路线索引（不是卡片墙：一行一门课，进度在右侧） ---- */
.doc-track-list{display:flex;flex-direction:column;border-top:1px solid var(--doc-line);max-width:900px}
.doc-track-row{display:flex;align-items:center;gap:14px;width:100%;padding:15px 10px;border:0;border-bottom:1px solid var(--doc-line);background:none;color:inherit;text-align:left;cursor:pointer;transition:background .14s,padding .14s}
.doc-track-row:hover{background:var(--doc-soft);padding-left:16px}
.doc-track-icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:11px;background:var(--doc-soft);border:1px solid var(--doc-line);font-size:20px;line-height:1}
.doc-track-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.doc-track-name{display:flex;align-items:center;gap:8px;font-size:15.5px;font-weight:650;color:var(--doc-head)}
.doc-track-desc{margin-top:2px;font-size:12.8px;line-height:1.6;color:var(--doc-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.doc-track-meta{margin-top:4px;font-size:11.5px;color:var(--doc-muted)}
.doc-track-progress{flex:none;width:132px;display:flex;flex-direction:column;align-items:flex-end;gap:5px}
.doc-track-pct{font-size:11.5px;color:var(--doc-muted);font-variant-numeric:tabular-nums}
.doc-track-progress .doc-bar{width:100%}
.doc-track-arrow{flex:none;font-size:14px;color:var(--doc-accent);opacity:0;transform:translateX(-4px);transition:.16s}
.doc-track-row:hover .doc-track-arrow{opacity:1;transform:none}
@media(max-width:640px){.doc-track-progress{display:none}}

/* ---- 运行能力表 ---- */
.doc-runners{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;max-width:900px}
.doc-runner{padding:12px 15px;border:1px solid var(--doc-line);border-radius:10px;background:var(--doc-card)}
.doc-runner-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.doc-runner-name{font-size:14px;font-weight:600;color:var(--doc-head)}
.doc-runner-engine{margin-top:3px;font-size:11.5px;color:var(--doc-muted)}
.doc-runner-note{margin:6px 0 0;font-size:12.5px;line-height:1.65;color:var(--doc-muted)}

/* ---- 随堂测试 ---- */
.doc-quiz{max-width:860px;margin-top:30px;padding-top:20px;border-top:1px solid var(--doc-line)}
.doc-quiz-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:12.5px;color:var(--doc-muted)}
.doc-quiz-title{font-size:14px;font-weight:650;color:var(--doc-head)}
.doc-quiz-list{display:flex;flex-direction:column;gap:20px;margin-top:16px}
.doc-quiz-q{display:flex;gap:8px;font-size:14.5px;line-height:1.7;color:var(--doc-head)}
.doc-quiz-q .doc-body{max-width:none;font-size:14.5px;line-height:1.7}
.doc-quiz-q .doc-body>:first-child{margin-top:0}
.doc-quiz-q .doc-body>:last-child{margin-bottom:0}
.doc-quiz-no{flex:none;font-weight:600;color:var(--doc-accent);font-variant-numeric:tabular-nums}
.doc-quiz-options{display:flex;flex-direction:column;gap:7px;margin-top:9px}
.doc-option{display:flex;align-items:flex-start;gap:9px;width:100%;padding:9px 13px;border:1px solid var(--doc-line);border-radius:9px;background:var(--doc-card);color:var(--doc-text);font-size:13.5px;line-height:1.65;text-align:left;cursor:pointer;transition:border-color .14s,background .14s}
.doc-option:hover:not(:disabled){border-color:var(--doc-active-border);background:var(--doc-active-bg)}
.doc-option:disabled{cursor:default}
.doc-option.is-right{border-color:rgba(82,196,26,.5);background:rgba(82,196,26,.1);color:var(--doc-ok)}
.doc-option.is-wrong{border-color:rgba(255,77,79,.5);background:rgba(255,77,79,.08);color:#cf1322}
.dark .doc-option.is-wrong{color:#ff7875}
.doc-option.is-muted{opacity:.55}
.doc-option-key{flex:none;min-width:17px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;opacity:.65;padding-top:1px}
.doc-quiz-explain{margin-top:9px;padding:10px 14px;border-radius:9px;font-size:12.5px;line-height:1.7;background:var(--doc-soft);color:var(--doc-text)}
.doc-quiz-explain.is-right{background:rgba(82,196,26,.1);color:var(--doc-ok)}
.doc-quiz-explain-title{font-weight:650}
.doc-quiz-explain .doc-body{max-width:none;font-size:12.5px;line-height:1.7}
.doc-quiz-explain .doc-body>:first-child{margin-top:4px}
.doc-quiz-explain .doc-body>:last-child{margin-bottom:0}
.doc-quiz-summary{display:flex;align-items:center;gap:8px;margin-top:2px;padding:10px 14px;border-radius:9px;font-size:13px;background:var(--doc-soft);color:var(--doc-text)}
.doc-quiz-summary.is-ok{background:rgba(82,196,26,.1);color:var(--doc-ok)}

/* ---- 周计划：概览 / 周行 / 步骤 / 返回 ---- */
.doc-overview-top{display:flex;align-items:center;gap:14px;max-width:900px;margin:0 0 26px}
.doc-overview-top .doc-bar{flex:1;max-width:420px}
.doc-overview-pct{font-size:12px;color:var(--doc-muted);white-space:nowrap}
.doc-stage{margin-bottom:28px}
.doc-stage-name{display:flex;align-items:center;gap:12px;margin:0 0 10px;font-size:11.5px;font-weight:600;letter-spacing:.08em;color:var(--doc-muted)}
.doc-stage-name::after{content:"";flex:1;height:1px;background:var(--doc-line)}
.doc-stage-intro{max-width:900px;margin:0 0 14px;padding:2px 0 2px 12px;border-left:2px solid var(--doc-line-strong)}
.doc-stage-intro .doc-body{max-width:none;font-size:13.5px;line-height:1.7;color:var(--doc-muted)}
.doc-stage-intro .doc-body p{margin:.45em 0}
.doc-stage-intro .doc-body table{font-size:12.5px;margin:.5em 0}
.doc-stage-intro .doc-body th,.doc-stage-intro .doc-body td{padding:.35em .6em}
.doc-week-list{display:flex;flex-direction:column;gap:9px;max-width:900px}
.doc-week-row{display:flex;align-items:center;gap:14px;width:100%;padding:12px 16px;border:1px solid var(--doc-line);border-radius:11px;background:var(--doc-card);color:inherit;text-align:left;cursor:pointer;transition:border-color .16s,transform .16s}
.doc-week-row:hover{border-color:var(--doc-active-border);transform:translateY(-1px)}
.doc-week-no{flex:none;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:var(--doc-soft);color:var(--doc-accent);font-size:13.5px;font-weight:650;font-variant-numeric:tabular-nums}
.doc-week-no.is-done{background:rgba(82,196,26,.14);color:var(--doc-ok)}
.doc-week-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.doc-week-title{font-size:14.5px;font-weight:600;color:var(--doc-head);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.doc-week-goal{font-size:12.5px;color:var(--doc-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.doc-week-side{flex:none;display:flex;align-items:center;gap:10px;font-size:12px;color:var(--doc-muted)}
.doc-week-count{font-size:11.5px;color:var(--doc-muted);font-variant-numeric:tabular-nums}
.doc-week-count.is-done{color:var(--doc-ok)}
.doc-week-arrow{color:var(--doc-accent);opacity:0;transform:translateX(-4px);transition:.16s;font-size:14px}
.doc-week-row:hover .doc-week-arrow{opacity:1;transform:none}
.doc-week-head{display:flex;align-items:flex-start;gap:16px;max-width:900px;padding-bottom:16px;border-bottom:1px solid var(--doc-line);margin-bottom:20px}
.doc-week-head-goal{flex:1;margin:0;font-size:14px;line-height:1.75;color:var(--doc-text)}
.doc-week-goal-label{display:inline-block;margin-right:8px;padding:1px 7px;border-radius:6px;background:var(--doc-active-bg);color:var(--doc-accent);font-size:11px;font-weight:600;letter-spacing:.04em;vertical-align:1px}
.doc-week-head .doc-chip{flex:none;margin-top:2px}
.doc-step{max-width:900px;padding:20px 0 8px;border-top:1px solid var(--doc-line);scroll-margin-top:76px}
.doc-step:first-of-type{border-top:0;padding-top:4px}
.doc-step-head{display:flex;align-items:center;gap:10px}
.doc-step-no{flex:none;display:inline-flex;align-items:center;justify-content:center;height:23px;min-width:38px;padding:0 8px;border-radius:6px;background:var(--doc-active-bg);color:var(--doc-accent);font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums}
.doc-step-title{flex:1;margin:0;font-size:17px;line-height:1.5;font-weight:650;color:var(--doc-head)}
.doc-step-check{flex:none;font-size:12px;opacity:.85}
.doc-step-check .ant-checkbox-wrapper,.doc-step-check.ant-checkbox-wrapper{font-size:12px}
.doc-step-body{padding-top:4px;max-width:860px}
.doc-step-body .doc-body{font-size:14.8px;line-height:1.82}
.doc-week-outro{margin-top:26px}
.doc-flow{max-width:860px}
.doc-fab{position:fixed;right:24px;bottom:24px;z-index:30;display:inline-flex;align-items:center;gap:.35em;padding:.55em 1em;border-radius:999px;border:1px solid color-mix(in srgb,var(--app-accent,#6366f1) 40%,transparent);background:var(--app-accent,#6366f1);color:#fff;font-size:13px;line-height:1.4;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.2)}
.doc-fab:hover{background:var(--app-accent,#4f46e5)}
.doc-back-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border-radius:8px;border:1px solid var(--doc-line);background:var(--doc-soft);color:inherit;font-size:15px;line-height:1;cursor:pointer;transition:border-color .15s,color .15s}
.doc-back-btn:hover{border-color:var(--doc-active-border);color:var(--doc-accent)}

/* ---- 实践项目：筛选 / 索引 / 详情 ---- */
.doc-filters{display:flex;flex-direction:column;gap:10px;max-width:900px;margin:0 0 24px}
.doc-filter-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.doc-filter-label{min-width:32px;font-size:12px;color:var(--doc-muted)}
.doc-filter{border:1px solid var(--doc-line);background:transparent;color:var(--doc-text);border-radius:999px;padding:4px 12px;font-size:12px;line-height:1.6;cursor:pointer;transition:border-color .14s,background .14s,color .14s}
.doc-filter:hover{border-color:var(--doc-active-border)}
.doc-filter.is-active{background:var(--doc-active-bg);border-color:var(--doc-active-border);color:var(--doc-accent);font-weight:600}
.doc-project-list{display:flex;flex-direction:column;max-width:900px;border-top:1px solid var(--doc-line)}
.doc-project-row{display:flex;align-items:flex-start;gap:14px;width:100%;padding:15px 10px;border:0;border-bottom:1px solid var(--doc-line);background:none;color:inherit;text-align:left;cursor:pointer;transition:background .14s,padding .14s}
.doc-project-row:hover{background:var(--doc-soft);padding-left:16px}
.doc-project-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.doc-project-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.doc-project-title{font-size:15.5px;font-weight:650;color:var(--doc-head)}
.doc-project-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px;font-size:11.5px;color:var(--doc-muted)}
.doc-project-summary{display:block;margin:5px 0 0;font-size:13px;line-height:1.65;color:var(--doc-muted)}
.doc-project-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}
.doc-project-arrow{flex:none;align-self:center;font-size:14px;color:var(--doc-accent);opacity:0;transform:translateX(-4px);transition:.16s}
.doc-project-row:hover .doc-project-arrow{opacity:1;transform:none}
.doc-tag{font-size:11px;padding:1px 7px;border-radius:5px;background:var(--doc-soft);color:var(--doc-muted)}
.doc-route{font-size:11px;font-weight:600;padding:1px 7px;border-radius:6px;background:var(--doc-soft);white-space:nowrap}
.doc-route-java{color:#b45309}
.doc-route-go{color:#0891b2}
.doc-route-react{color:#7c3aed}
.doc-route-nextjs{color:#0f172a}
.dark .doc-route-nextjs{color:#e5e7eb}
.doc-lead{max-width:860px;margin:0 0 20px;padding:12px 16px;border-left:3px solid var(--doc-accent);background:color-mix(in srgb,var(--app-accent,#6366f1) 5%,transparent);border-radius:0 10px 10px 0;font-size:14.5px;line-height:1.85;color:var(--doc-text)}
.doc-prereq{display:flex;align-items:center;gap:8px;flex-wrap:wrap;max-width:860px;margin:0 0 20px;font-size:12px}
.doc-prereq-label{font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--doc-muted)}
.doc-proj-body{max-width:860px;padding-top:20px;border-top:1px solid var(--doc-line)}
.doc-proj-footer{display:flex;align-items:center;gap:8px;flex-wrap:wrap;max-width:860px;margin-top:28px;padding-top:16px;border-top:1px solid var(--doc-line)}
.doc-proj-footer-label{font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--doc-muted)}
.doc-empty{max-width:900px;padding:48px 20px;text-align:center;border:1px dashed var(--doc-line-strong);border-radius:14px}
.doc-empty-title{margin:0;font-size:15px;font-weight:600;color:var(--doc-head)}
.doc-empty-desc{margin:6px 0 14px;font-size:13px;line-height:1.7;color:var(--doc-muted)}
.doc-empty-btn{border:1px solid var(--doc-active-border);background:var(--doc-active-bg);color:var(--doc-accent);border-radius:8px;padding:6px 14px;font-size:12.5px;cursor:pointer}
.doc-head-row{display:flex;align-items:center;gap:10px}
.doc-hint{max-width:900px;margin-top:26px;font-size:12.5px;line-height:1.85;color:var(--doc-muted)}
.doc-hint code{background:var(--doc-code);padding:.12em .35em;border-radius:4px;font-size:.92em;color:var(--doc-accent)}
.doc-fold summary{list-style:none}
.doc-fold summary::-webkit-details-marker{display:none}
.doc-fold[open] .doc-fold-arrow{transform:rotate(90deg)}
.doc-fold-arrow{display:inline-block;transition:transform .15s}

/* ---- highlight.js token（亮色） ---- */
.doc-scope .hljs-comment,.doc-scope .hljs-quote{color:#6e7781;font-style:italic}
.doc-scope .hljs-keyword,.doc-scope .hljs-selector-tag,.doc-scope .hljs-literal,.doc-scope .hljs-doctag{color:#cf222e}
.doc-scope .hljs-string,.doc-scope .hljs-regexp,.doc-scope .hljs-addition{color:#0a3069}
.doc-scope .hljs-number,.doc-scope .hljs-symbol,.doc-scope .hljs-bullet{color:#0550ae}
.doc-scope .hljs-title,.doc-scope .hljs-section,.doc-scope .hljs-name{color:#8250df}
.doc-scope .hljs-attr,.doc-scope .hljs-attribute,.doc-scope .hljs-variable,.doc-scope .hljs-template-variable{color:#953800}
.doc-scope .hljs-type,.doc-scope .hljs-built_in,.doc-scope .hljs-class .hljs-title{color:#953800}
.doc-scope .hljs-tag{color:#116329}
.doc-scope .hljs-meta{color:#6e7781}
.doc-scope .hljs-deletion{color:#82071e;background:rgba(255,129,130,.1)}
.doc-scope .hljs-emphasis{font-style:italic}
.doc-scope .hljs-strong{font-weight:700}

/* ---- highlight.js token（深色） ---- */
.dark .doc-scope .hljs-comment,.dark .doc-scope .hljs-quote{color:#8b949e}
.dark .doc-scope .hljs-keyword,.dark .doc-scope .hljs-selector-tag,.dark .doc-scope .hljs-literal,.dark .doc-scope .hljs-doctag{color:#ff7b72}
.dark .doc-scope .hljs-string,.dark .doc-scope .hljs-regexp,.dark .doc-scope .hljs-addition{color:#a5d6ff}
.dark .doc-scope .hljs-number,.dark .doc-scope .hljs-symbol,.dark .doc-scope .hljs-bullet{color:#79c0ff}
.dark .doc-scope .hljs-title,.dark .doc-scope .hljs-section,.dark .doc-scope .hljs-name{color:#d2a8ff}
.dark .doc-scope .hljs-attr,.dark .doc-scope .hljs-attribute,.dark .doc-scope .hljs-variable,.dark .doc-scope .hljs-template-variable{color:#ffa657}
.dark .doc-scope .hljs-type,.dark .doc-scope .hljs-built_in,.dark .doc-scope .hljs-class .hljs-title{color:#ffa657}
.dark .doc-scope .hljs-tag{color:#7ee787}
.dark .doc-scope .hljs-meta{color:#8b949e}
`
