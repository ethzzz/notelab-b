// @joplin/turndown-plugin-gfm 没有自带类型声明（package.json 只有 main，无 types），
// 这里按它的实际导出补一份最小声明。导出项由 lib/turndown-plugin-gfm.cjs.js 的
// exports.* 读出，别凭文档猜。
declare module "@joplin/turndown-plugin-gfm" {
	/** 插件签名与 turndown 的 Plugin 一致：接收 service 实例、向它注册规则 */
	type TurndownPlugin = (service: import("turndown")) => void

	/** 聚合预设：表格 + 删除线 + 任务列表（本编辑器只用这个） */
	export const gfm: TurndownPlugin
	/** Git 风格表格 */
	export const tables: TurndownPlugin
	/** ~~删除线~~ */
	export const strikethrough: TurndownPlugin
	/** - [ ] 任务列表 */
	export const taskListItems: TurndownPlugin
	/** 带语言标注的围栏代码块 */
	export const highlightedCodeBlock: TurndownPlugin
}
