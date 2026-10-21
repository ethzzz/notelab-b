// 校验四条 study 路线：结构解析是否完整、每个步骤是否有「思路 / 代码·答案」折叠。
//
// 为什么需要它：`study/[lang]/page.tsx` 只在服务端 console.warn，构建期看不出来。
// 这次重写出现过「::: 未闭合把下一周整周吞掉」——周数少一周、页面却照常 200。
// 用法：node scripts/check-study.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const tmp = path.join(root, ".study-check-tmp");
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

for (const name of ["study", "study-render"]) {
	const src = fs.readFileSync(path.join(root, "src/lib", `${name}.ts`), "utf8");
	const out = ts.transpileModule(src, {
		compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
		fileName: `${name}.ts`,
	}).outputText;
	fs.writeFileSync(path.join(tmp, `${name}.mjs`), out);
}

const { parseStudy, studyWarnings } = await import(pathToFileURL(path.join(tmp, "study-render.mjs")).href);

let failed = false;
for (const lang of ["java", "go", "react", "nextjs"]) {
	const md = fs.readFileSync(path.join(root, "src/content/study", `${lang}.md`), "utf8");
	const data = parseStudy(md);
	const warns = studyWarnings(data);
	const rawWeeks = [...md.matchAll(/^###\s+第\s*(\d+)\s*周/gm)].map((m) => Number(m[1]));
	const parsedWeeks = data.weeks.map((w) => w.n);
	const steps = data.weeks.reduce((n, w) => n + w.steps.length, 0);

	const missing = rawWeeks.filter((n) => !parsedWeeks.includes(n));
	const extra = parsedWeeks.filter((n) => !rawWeeks.includes(n));
	console.log(
		`${lang.padEnd(7)} 周 ${parsedWeeks.length}/${rawWeeks.length} · 步骤 ${steps} · 告警 ${warns.length}` +
			(missing.length ? ` · 丢失周 [${missing}]` : "") +
			(extra.length ? ` · 多出周 [${extra}]` : ""),
	);
	for (const w of warns) console.log(`  ! ${w}`);
	if (missing.length || extra.length || warns.length) failed = true;
}

fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
