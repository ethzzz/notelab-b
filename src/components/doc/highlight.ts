// 文档代码高亮：highlight.js 的按需语言注册 + 统一出口。
//
// 只注册课程/路线里实际出现的语言，避免把 190+ 语言包全打进客户端。
// 服务端渲染（study-render.ts）另有一份同等语言的注册表：两边都只做「确定性着色」，
// 不共享 import 是因为一边跑在 Node、一边跑在浏览器。
import hljs from "highlight.js/lib/core"
import bash from "highlight.js/lib/languages/bash"
import c from "highlight.js/lib/languages/c"
import cpp from "highlight.js/lib/languages/cpp"
import css from "highlight.js/lib/languages/css"
import go from "highlight.js/lib/languages/go"
import ini from "highlight.js/lib/languages/ini"
import java from "highlight.js/lib/languages/java"
import javascript from "highlight.js/lib/languages/javascript"
import json from "highlight.js/lib/languages/json"
import lua from "highlight.js/lib/languages/lua"
import plaintext from "highlight.js/lib/languages/plaintext"
import python from "highlight.js/lib/languages/python"
import rust from "highlight.js/lib/languages/rust"
import sql from "highlight.js/lib/languages/sql"
import typescript from "highlight.js/lib/languages/typescript"
import xml from "highlight.js/lib/languages/xml"
import yaml from "highlight.js/lib/languages/yaml"

const LANGS = {
  bash, c, cpp, css, go, ini, java, javascript, json, lua, plaintext, python, rust, sql, typescript, xml, yaml,
}
for (const [name, lang] of Object.entries(LANGS)) hljs.registerLanguage(name, lang)

/** 课程内容里常见的别名 → highlight.js 语言名 */
const ALIAS: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  text: "plaintext",
  txt: "plaintext",
  html: "xml",
  vue: "xml",
  conf: "ini",
  nginx: "ini",
  "c++": "cpp",
}

export function resolveLang(lang?: string): string {
  const raw = String(lang || "").trim().toLowerCase()
  return ALIAS[raw] || raw
}

/** 把源码染成可插入 <pre><code> 的 HTML；未知语言按纯文本转义，不抛错 */
export function highlightToHtml(code: string, lang?: string): { html: string; lang: string } {
  const key = resolveLang(lang)
  const source = String(code ?? "")
  if (key && hljs.getLanguage(key)) {
    try {
      return { html: hljs.highlight(source, { language: key, ignoreIllegals: true }).value, lang: key }
    } catch {
      /* 落到纯文本 */
    }
  }
  return { html: hljs.highlight(source, { language: "plaintext", ignoreIllegals: true }).value, lang: "" }
}
