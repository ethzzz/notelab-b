"use client"

// 爬塔工坊 · 角色授权（原「角色授权」Tab，已独立成页）
// 给 C 端用户组勾选可选择哪些角色；写入 spire.charAccess，随「发布到 C 端」生效。
// fail-open：某组没有对应键时 C 端**不筛选**（全部可选），避免未配置把玩家全锁死。
import { useEffect, useMemo, useState } from "react"
import { Alert, Button, Checkbox, Radio, Tag } from "antd"
import { toast } from "@/lib/toast"
import { useSpire } from "../_shared/store"
import { PageHead } from "../_shared/ui"
import { presetAccess } from "../_shared/access"

export default function SpireAccessPage() {
  const { groups, charPool, charAccess, setCharAccess, busy, saveQuiet, dirty } = useSpire()
  const [accGroup, setAccGroup] = useState<string>("default")

  // 组列表到位后，若没有 default 组就选第一个（与拆页前行为一致）
  useEffect(() => {
    if (groups.length && !groups.some((g) => g.code === "default")) setAccGroup(groups[0].code)
  }, [groups])

  const groupName = (code: string) => groups.find((g) => g.code === code)?.name || code

  /** 某组当前勾选：未配置该组键时按推荐规则预填（首次可直接发布，不落库） */
  const checked = useMemo(
    () => (Array.isArray(charAccess[accGroup]) ? charAccess[accGroup] : presetAccess(accGroup, charPool)),
    [charAccess, accGroup, charPool],
  )

  /** 写回某组白名单（其它组原样保留，去重） */
  const setGroup = (code: string, ids: string[]) =>
    setCharAccess((prev) => ({ ...prev, [code]: ids.filter((id, i, a) => a.indexOf(id) === i) }))

  const saveAccess = async () => {
    if (await saveQuiet()) toast.success("角色授权已保存，点「发布到 C 端」后生效")
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHead
        title="👥 角色授权"
        hint="按 C 端用户组控制「选择角色」页里哪些角色可选；未授权角色在 C 端显示为锁定"
        onSave={saveAccess}
        saving={busy}
        extra={dirty ? <span className="text-xs text-amber-500">保存后还需要「发布到 C 端」</span> : null}
      />

      <Alert type="info" showIcon
        message="授权改动需「保存」+「发布到 C 端」两步才在玩家侧生效"
        description={<span className="text-xs">
          白名单外的角色在 C 端锁定；<b>某组未配置（无键）时不筛选、全部可选</b>（fail-open，避免未配置时把玩家全锁死）。
          组内成员在「C 端用户管理 → 用户」页调整。
        </span>} />

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">用户组</span>
        {groups.length > 0 ? (
          <Radio.Group value={accGroup} onChange={(e) => setAccGroup(e.target.value)}
            options={groups.map((g) => ({
              value: g.code,
              label: `${g.name}（${g.code}${g.member_count != null ? ` · ${g.member_count}人` : ""}）`,
            }))}
            optionType="button" buttonStyle="solid" />
        ) : (
          <span className="text-xs text-amber-500">用户组列表加载失败或无可用组（需 B 端登录，可在「C 端用户管理」新建组）</span>
        )}
      </div>

      {accGroup && (
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="font-medium">「{groupName(accGroup)}」可选择的角色</span>
            <Tag color="blue">已选 {checked.length} / {charPool.length}</Tag>
            {!(accGroup in charAccess) && <Tag color="orange">尚未配置 · C 端当前不筛选</Tag>}
            <div className="ml-auto flex items-center gap-2">
              <Button size="small" onClick={() => setGroup(accGroup, charPool.map((c) => c.id))}>全选</Button>
              <Button size="small" onClick={() => setGroup(accGroup, [])}>全不选</Button>
              <Button size="small" onClick={() => setGroup(accGroup, presetAccess(accGroup, charPool))}>按推荐预填</Button>
            </div>
          </div>

          <Checkbox.Group className="!w-full" value={checked}
            onChange={(vals) => setGroup(accGroup, vals as string[])}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {charPool.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-2 dark:border-zinc-700">
                  <Checkbox value={c.id}>{c.icon} {c.name}</Checkbox>
                  <Tag className="!ml-auto !mr-0" color={c.custom ? "purple" : "default"}>{c.custom ? "工坊" : "内置"}</Tag>
                </div>
              ))}
            </div>
          </Checkbox.Group>

          {charPool.length === 0 && (
            <div className="py-4 text-center text-sm text-zinc-400">暂无可授权角色（内置角色清单加载失败？）</div>
          )}
          <div className="text-xs text-zinc-400 dark:text-zinc-500">
            角色池 = 内置基础角色 + 本工坊「角色制作」页的自定义角色（按 id 去重，自定义优先）。
          </div>
        </div>
      )}
    </div>
  )
}
