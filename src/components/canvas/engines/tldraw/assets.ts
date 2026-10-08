// tldraw 引擎 —— 图片资源存取策略。
//
// 图片以 **data URL** 形式存进 tldraw 文档本身：
//   ✅ 不用为几张插图引入对象存储
//   ✅ 图片随文档同步给协作者、随 SQLite 快照持久化
//   ⚠️ 代价是快照体积 = 图片体积，所以必须限量
import type { TLAssetStore } from "tldraw"

/** 单张图片上限（超出直接抛错，让用户看到明确提示而不是静默失败） */
export const MAX_IMAGE_BYTES = 1_000_000

export const assets: TLAssetStore = {
  async upload(_asset, file) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`图片过大（${Math.round(file.size / 1024)}KB，上限 1000KB）`)
    }
    // ⚠️ tldraw 5.x 的 upload 要返回 { src }，不是裸字符串（返回 string 会被类型拒绝）
    const src = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = () => reject(new Error("图片读取失败"))
      fr.readAsDataURL(file)
    })
    return { src }
  },
  resolve(asset) {
    return asset.props.src
  },
}
