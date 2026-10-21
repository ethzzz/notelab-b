// 把仓库里的课程 JSON 合并同步到线上 ui_config.learning（B 端接口 POST /api/learning）。
//
// 背景：课程内容存在数据库里，后台页面**没有编辑器**；Java 的 LearningSeed 只在库为空时生效。
// 所以内容改成「仓库 JSON 为写作真相源 + 本脚本显式同步」，可 diff、可回滚、可 review。
//
// 用法：
//   node scripts/sync-learning.mjs                 # 干跑：登录、拉当前内容、算差异，不写
//   node scripts/sync-learning.mjs --write         # 真写（先备份到系统临时目录）
//   node scripts/sync-learning.mjs --write --only javascript,typescript
//
// 凭据：默认读本仓 account.json（{account,password}，已 gitignore）；也可用
//       NOTELAB_ACCOUNT / NOTELAB_PASSWORD 环境变量覆盖。站点默认 https://haolo.cloud，
//       用 NOTELAB_BASE 覆盖。
//
// ⚠️ 这是**生产写入**：save 是整包覆盖（只提交 tracks，runners 只读）。脚本会先把线上
//    当前内容备份到 os.tmpdir() 并打印路径；要回滚就用备份里的 tracks 再 --write 一次。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chineseChars, loadTracks, validateAll } from "./learning-lib.mjs";

const args = process.argv.slice(2);
const write = args.includes("--write");
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",").filter(Boolean)) : null;
const base = (process.env.NOTELAB_BASE || "https://haolo.cloud").replace(/\/$/, "");

function fail(msg) {
	console.error(`✗ ${msg}`);
	process.exit(1);
}

const errs = validateAll();
if (errs.length) {
	console.error(`✗ 内容校验未通过（${errs.length} 条），先修再同步：`);
	for (const e of errs) console.error(`  - ${e}`);
	process.exit(1);
}

const entries = loadTracks();
const repo = new Map(entries.map(({ data }) => [data.code, data]));
for (const code of only || []) {
	if (!repo.has(code)) fail(`--only 指定的课程不在仓库里：${code}`);
}

function credentials() {
	if (process.env.NOTELAB_ACCOUNT && process.env.NOTELAB_PASSWORD) {
		return { account: process.env.NOTELAB_ACCOUNT, password: process.env.NOTELAB_PASSWORD };
	}
	const p = path.join(process.cwd(), "account.json");
	if (!fs.existsSync(p)) fail(`找不到凭据：${p} 或 NOTELAB_ACCOUNT/NOTELAB_PASSWORD`);
	const j = JSON.parse(fs.readFileSync(p, "utf8"));
	if (!j.account || !j.password) fail("account.json 缺 account/password");
	return j;
}

const { account, password } = credentials();

async function login() {
	const res = await fetch(`${base}/api/login`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ username: account, password }),
		redirect: "manual",
	});
	if (!res.ok) fail(`登录失败：HTTP ${res.status}`);
	const cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
	if (!cookie) fail("登录成功但没有拿到会话 Cookie");
	return cookie;
}

function stats(track) {
	let lessons = 0;
	let quiz = 0;
	let zh = 0;
	for (const s of track.stages || []) {
		for (const l of s.lessons || []) {
			lessons++;
			quiz += (l.quiz || []).length;
			zh += chineseChars(l.content);
		}
	}
	return { lessons, quiz, zh };
}

const cookie = await login();
const curRes = await fetch(`${base}/api/learning`, { headers: { cookie }, redirect: "manual" });
if (!curRes.ok) fail(`拉取当前课程失败：HTTP ${curRes.status}`);
const cur = await curRes.json();
const current = Array.isArray(cur.tracks) ? cur.tracks : [];

const next = current.map((t) => t);
for (const { data } of entries) {
	if (only && !only.has(data.code)) continue;
	const i = next.findIndex((t) => t.code === data.code);
	if (i >= 0) next[i] = data;
	else next.push(data);
}

console.log(`站点：${base}`);
console.log(`线上现有：${current.length} 门课；仓库：${repo.size} 门；本次提交：${only ? [...only].join(",") : "全部"}`);
for (const { data } of entries) {
	if (only && !only.has(data.code)) continue;
	const before = current.find((t) => t.code === data.code);
	const b = before ? stats(before) : { lessons: 0, quiz: 0, zh: 0 };
	const a = stats(data);
	console.log(
		`  ${data.code.padEnd(10)} ${b.lessons}→${a.lessons} 节，${b.quiz}→${a.quiz} 题，中文 ${b.zh}→${a.zh} 字`,
	);
}

if (!write) {
	console.log("\n[干跑] 未写入。确认差异后加 --write。");
	process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = path.join(os.tmpdir(), `notelab-learning-backup-${stamp}.json`);
fs.writeFileSync(backup, JSON.stringify({ runners: cur.runners, tracks: current }, null, 2));
console.log(`\n已备份线上内容：${backup}`);

const res = await fetch(`${base}/api/learning`, {
	method: "POST",
	headers: { "content-type": "application/json", cookie },
	body: JSON.stringify({ tracks: next }),
	redirect: "manual",
});
const text = await res.text();
if (!res.ok) fail(`写入失败：HTTP ${res.status} ${text.slice(0, 300)}`);
console.log(`写入成功：${text.slice(0, 300)}`);

const verify = await (await fetch(`${base}/api/learning`, { headers: { cookie } })).json();
const got = new Map((verify.tracks || []).map((t) => [t.code, stats(t)]));
let bad = 0;
for (const { data } of entries) {
	if (only && !only.has(data.code)) continue;
	const a = stats(data);
	const g = got.get(data.code);
	if (!g || g.lessons !== a.lessons || g.zh !== a.zh) {
		bad++;
		console.error(`✗ ${data.code} 回读不一致：期望 ${a.lessons} 节/${a.zh} 字，实际 ${g?.lessons}/${g?.zh}`);
	}
}
if (bad) process.exit(1);
console.log("回读校验通过");
