// 课程内容校验：node scripts/validate-learning.mjs
import { chineseChars, loadTracks, validateAll } from "./learning-lib.mjs";

const entries = loadTracks();
const errs = validateAll();

console.log(`课程文件：${entries.length} 个`);
let totalLessons = 0;
let totalZh = 0;
for (const { file, data } of entries) {
	let lessons = 0;
	let quiz = 0;
	let zh = 0;
	for (const s of data.stages || []) {
		for (const l of s.lessons || []) {
			lessons++;
			quiz += (l.quiz || []).length;
			zh += chineseChars(l.content);
		}
	}
	totalLessons += lessons;
	totalZh += zh;
	const avg = lessons ? Math.round(zh / lessons) : 0;
	console.log(`  ${data.code.padEnd(10)} ${String(lessons).padStart(2)} 节 / ${String(quiz).padStart(2)} 题 / 中文 ${zh} 字 / 均 ${avg} 字`);
}
console.log(`合计：${totalLessons} 节，中文 ${totalZh} 字`);

if (errs.length) {
	console.error(`\n校验失败（${errs.length} 条）：`);
	for (const e of errs) console.error(`  - ${e}`);
	process.exit(1);
}
console.log("\n校验通过");
