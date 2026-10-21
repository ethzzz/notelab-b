// 编程学习课程内容（src/content/learning/*.json）的读取与校验。
//
// 为什么要有这一层：课程内容不再只存在数据库里，仓库里的 JSON 是**写作真相源**，
// 由 scripts/sync-learning.mjs 合并写入 ui_config.learning。没有校验就同步，等于让
// 一个手滑的 JSON 直接把线上九门课打回原形 —— 所以同步前必须先过这里。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..");
export const CONTENT_DIR = path.join(REPO_ROOT, "src", "content", "learning");

/** 中文正文字符数（不含标点/代码），用来判断“是不是真的写深了” */
export function chineseChars(text) {
	return (String(text || "").match(/[\u4e00-\u9fa5]/g) || []).length;
}

/** 读取全部课程文件，按文件名排序；不存在的目录返回空数组 */
export function loadTracks() {
	if (!fs.existsSync(CONTENT_DIR)) return [];
	return fs
		.readdirSync(CONTENT_DIR)
		.filter((f) => f.endsWith(".json") && !f.startsWith("."))
		.sort()
		.map((f) => {
			const file = path.join(CONTENT_DIR, f);
			let data;
			try {
				data = JSON.parse(fs.readFileSync(file, "utf8"));
			} catch (e) {
				throw new Error(`${f} 不是合法 JSON：${e.message}`);
			}
			return { file: f, data };
		});
}

const STAGE_SUFFIX = ["basic", "adv", "pro", "expert"];
const LANGS = new Set([
	"js",
	"jsx",
	"ts",
	"tsx",
	"python",
	"sql",
	"lua",
	"c",
	"cpp",
	"java",
	"go",
	"rust",
	"bash",
	"html",
	"css",
	"json",
	"jsonc",
	"yaml",
	"text",
]);

/**
 * 校验一门课的完整数据。返回错误字符串数组，空数组 = 通过。
 *
 * @param {{file:string,data:any}} entry
 * @param {{expectedLessons?:number}} [opts]
 */
export function validateTrack(entry, opts = {}) {
	const { file, data } = entry;
	const errs = [];
	const push = (m) => errs.push(`${file}: ${m}`);

	if (!data || typeof data !== "object") return [`${file}: 顶层不是对象`];
	for (const k of ["code", "name", "icon", "desc", "runner"]) {
		if (typeof data[k] !== "string" || !data[k].trim()) push(`缺少字段 ${k}`);
	}
	if (!Array.isArray(data.stages) || data.stages.length !== 4) {
		push(`stages 必须是 4 个阶段（实际 ${data.stages?.length ?? 0}）`);
		return errs;
	}

	const expected = opts.expectedLessons ?? 12;
	const ids = new Set();
	let lessons = 0;

	data.stages.forEach((stage, si) => {
		const suffix = STAGE_SUFFIX[si];
		if (!String(stage.id || "").endsWith(`-${suffix}`)) {
			push(`阶段 ${si + 1} id 应以 -${suffix} 结尾（实际 ${stage.id}）`);
		}
		if (!stage.name || !stage.goal) push(`阶段 ${wantId} 缺 name/goal`);
		if (!Array.isArray(stage.lessons) || stage.lessons.length !== 3) {
			push(`阶段 ${wantId} 必须有 3 节课（实际 ${stage.lessons?.length ?? 0}）`);
			return;
		}
		for (const l of stage.lessons) {
			lessons++;
			const tag = l.id || "(无 id)";
			if (!/^[a-z]{1,4}-\d{2}$/.test(tag)) push(`课时 id 形状不对：${tag}`);
			if (ids.has(tag)) push(`课时 id 重复：${tag}`);
			ids.add(tag);
			if (!l.title || l.title.length < 4) push(`${tag} 标题太短`);
			if (typeof l.minutes !== "number" || l.minutes < 30) push(`${tag} minutes 应 ≥ 30`);
			if (!LANGS.has(l.lang)) push(`${tag} lang 不合法：${l.lang}`);
			if (typeof l.code !== "string" || l.code.trim().length < 40) push(`${tag} code 太短/为空`);
			if (String(l.content).length > 40_000) push(`${tag} content 超过后端 40k 上限`);
			if (String(l.code).length > 20_000) push(`${tag} code 超过后端 20k 上限`);

			const zh = chineseChars(l.content);
			if (zh < 2200) push(`${tag} 正文中文 ${zh} 字，少于 2200`);
			if (zh > 3600) push(`${tag} 正文中文 ${zh} 字，超过 3600（别灌水）`);

			const heads = (String(l.content).match(/^##\s+/gm) || []).length;
			if (heads < 7) push(`${tag} 二级标题只有 ${heads} 个，应 ≥ 7 段`);

			if (!Array.isArray(l.quiz) || l.quiz.length !== 4) {
				push(`${tag} quiz 必须恰好 4 题（实际 ${l.quiz?.length ?? 0}）`);
			} else {
				l.quiz.forEach((q, qi) => {
					const qt = `${tag} 第 ${qi + 1} 题`;
					if (!q.q || q.q.length < 4) push(`${qt} 题干太短`);
					if (String(q.q).length > 1000) push(`${qt} 题干超过后端 1000 字上限`);
					if (String(q.explain || "").length > 2000) push(`${qt} explain 超过后端 2000 字上限`);
					if (!Array.isArray(q.options) || q.options.length !== 4) push(`${qt} 必须有 4 个选项`);
					else {
						if (q.options.some((o) => typeof o !== "string" || !o.trim())) push(`${qt} 存在空选项`);
						if (q.options.some((o) => String(o).length > 500)) push(`${qt} 选项超过后端 500 字上限`);
						if (new Set(q.options.map((o) => o.trim())).size !== 4) push(`${qt} 选项重复`);
					}
					if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) push(`${qt} answer 下标不合法`);
					if (!q.explain || q.explain.length < 20) push(`${qt} explain 太短`);
				});
			}

			for (const m of String(l.content).matchAll(/^```(\w+)/gm)) {
				if (!LANGS.has(m[1])) push(`${tag} 代码块语言不合法：${m[1]}`);
			}
		}
	});

	if (lessons !== expected) push(`课时数应为 ${expected}（实际 ${lessons}）`);
	return errs;
}

/** 校验全部课程；返回错误数组 */
export function validateAll(opts = {}) {
	const errs = [];
	const entries = loadTracks();
	if (!entries.length) return [`${CONTENT_DIR} 下没有课程 JSON`];
	const codes = new Set();
	for (const e of entries) {
		const err = validateTrack(e, opts);
		errs.push(...err);
		if (e.data?.code) {
			if (codes.has(e.data.code)) errs.push(`${e.file}: code 重复 ${e.data.code}`);
			codes.add(e.data.code);
		}
	}
	return errs;
}
