"use client"
// tldraw 侧的「我是谁」——useSync 的 users 与右上角「谁在线」共用这一份。
//
// ⚠️ 为什么单独成一个模块：自己的 name/color 必须**只有一个来源**。
//    身份是异步取到的（/api/me），而 `editor.user.getName()/getColor()` 读到的是
//    editor 构造那一刻的快照 —— atom 后来 set 了它也不会跟着变，于是出现
//    「presence 广播出去的名字是对的，自己界面上却显示默认空名 + 随机色」这种分裂。
//    所以读自己那份一律走这个 atom（Signal 可订阅），别绕 editor.user.*。
import { atom } from "@tldraw/state"
import { UserRecordType, createUserId } from "@tldraw/tlschema"
import type { TLUser, TLUserStore } from "@tldraw/tlschema"
import { loadCanvasMe } from "@/lib/canvas"

/**
 * tldraw 的协作者色板（照抄 `@tldraw/editor` 的 USER_COLORS）。
 * 按账户 id 取模挑一个 —— **稳定**比随机重要：同一个人每次进来、以及每个人看到他，
 * 颜色都一致，不会「一刷新就换色」。
 */
const TL_USER_COLORS = [
  "#FF802B", "#EC5E41", "#F2555A", "#F04F88", "#E34BA9", "#BD54C6",
  "#9D5BD2", "#7B66DC", "#02B1CC", "#11B3A3", "#39B178", "#55B467",
]
export const tlUserColor = (uid: number) => TL_USER_COLORS[Math.abs(Math.trunc(uid)) % TL_USER_COLORS.length]

/**
 * 当前用户。tldraw 的 `TLUserStore.currentUser` 必须是 Signal，所以先用 atom 兜着，
 * 拿到 /api/me 再 set —— tldraw 内部订阅它，名字与颜色会自己补上，不必等身份再建连接。
 */
export const currentUserAtom = atom<null | TLUser>("notelabCanvasCurrentUser", null)

/** 喂给 `useSync({ users })`：不传这个，别人的界面上就没有你的名字 */
export const tldrawUserStore: TLUserStore = { currentUser: currentUserAtom }

let requested = false
/** 拉一次自己的身份（幂等，模块级）。取不到就维持 null，协作本身不受影响。 */
export function ensureCurrentUser() {
  if (requested) return
  requested = true
  void loadCanvasMe().then((me) => {
    if (!me) return
    currentUserAtom.set(
      UserRecordType.create({
        // id 用**账户 id**（不是用户名）：颜色与归属都按它算，改个用户名不该换个人
        id: createUserId(String(me.id)),
        name: me.username || `账户#${me.id}`,
        color: tlUserColor(me.id),
      }),
    )
  })
}
