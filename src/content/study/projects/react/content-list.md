---
title: 内容列表与筛选
route: react
direction: 内容
level: L2
weeks: 5-6
hours: 4-6
requires: react:5-6
tags: URL 状态, 分页, 空态, 弱网
summary: 一个「看起来最简单」的列表页，考的是 URL 即状态、三态齐全、弱网可用。
---

## 业务背景

内容列表是 C 端最高频的页面，也是最容易被做坏的页面：筛选条件存在组件里，一刷新就没了；翻页用 state，分享出去的链接永远是第一页；接口失败只显示空白。

这些在内部后台无所谓，在 C 端就是「用户流失」。

## 需求（用户故事）

- 作为访客，我筛选「工具 + 第 2 页」后，把链接发给朋友，他打开看到的是同样的筛选。
- 作为访客，我按浏览器后退，能回到上一组筛选，而不是退出页面。
- 作为访客，网络断了我要看到「加载失败，重试」，而不是一片空白。
- 作为手机用户，我在 375px 宽度下不横向滚动。

## 接口契约

```text
GET /api/posts?cat=tool&page=2&q=xxx
→ 200 { items: [{id,title,summary}], total: 128, page: 2, pageSize: 20 }
→ 500/超时 → 前端展示错误态
```

URL 约定：

| 参数 | 含义 | 默认 |
|---|---|---|
| `cat` | 分类 | `all` |
| `page` | 页码（1 起） | `1` |
| `q` | 搜索词 | 空 |

## 验收标准

- 刷新后筛选与页码保持不变。
- 复制 URL 到新标签页，内容一致。
- 浏览器后退一次回到上一个筛选组合。
- 断网时显示错误态与「重试」，重试成功后恢复。
- 空结果显示空态文案，而不是空白。
- 375px 无横向滚动；`document.documentElement.scrollWidth <= innerWidth`。

## 关键决策

:::hint 为什么状态一定要进 URL
URL 是唯一同时满足「可分享、可刷新、可后退」的状态载体。放组件 state 里，这三件事全废；放全局 store 里，刷新依然会丢。
:::

## 参考实现

:::solution useSearchParams + 三态 + 取消请求
```tsx
const sp = useSearchParams()
const router = useRouter()

const cat = sp.get("cat") ?? "all"
const page = Number(sp.get("page") ?? "1")
const q = sp.get("q") ?? ""

function setParam(key: string, value: string) {
  const next = new URLSearchParams(sp.toString())
  if (!value || value === "all" || (key === "page" && value === "1")) next.delete(key)
  else next.set(key, value)
  router.replace(`/posts?${next.toString()}`, { scroll: false })
}
```
```tsx
const [state, setState] = useState<{ loading: boolean; error?: string; data?: ListData }>({ loading: true })

useEffect(() => {
  const ac = new AbortController()
  setState({ loading: true })
  fetch(`/api/posts?${sp.toString()}`, { signal: ac.signal })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((data) => setState({ loading: false, data }))
    .catch((e) => {
      if (e.name === "AbortError") return
      setState({ loading: false, error: e.message })
    })
  return () => ac.abort()
}, [sp])
```
```tsx
if (state.loading) return <Skeleton.List rows={5} />
if (state.error) return <ErrorBox message={state.error} onRetry={() => setParam("_r", String(Date.now()))} />
if (!state.data?.items.length) return <Empty text="没有匹配的内容" />
return <List items={state.data.items} />
```
:::

## 验收脚本

:::check 可自动化部分（curl）+ 浏览器核对清单
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:3000}"

echo "== 1. URL 是唯一状态源：每个地址都要能直接分享"
for u in '/posts' '/posts?cat=tool' '/posts?cat=tool&page=2' '/posts?q=react'; do
  code=$(curl -s -o /tmp/nl.html -w '%{http_code}' "$BASE$u")
  [ "$code" = "200" ] || { echo "FAIL $u -> $code"; exit 1; }
  grep -q '<title>' /tmp/nl.html && echo "PASS $u（含 title）" || { echo "FAIL $u 没渲染出内容"; exit 1; }
done

echo "== 2. 首屏内容必须在 HTML 里（不能是纯客户端空壳）"
n=$(curl -s "$BASE/posts?cat=tool" | grep -c 'class="post-item"' || true)
[ "$n" -gt 0 ] && echo "PASS SSR 出 $n 条" || echo "FAIL 首屏无内容：应改为服务端取数"

echo "== 3. 翻页越界不应 500"
curl -s -o /dev/null -w 'page=9999 -> %{http_code}\n' "$BASE/posts?page=9999"
```

**浏览器核对（脚本覆盖不到的）**

- [ ] 改筛选 / 翻页后**刷新页面**，视图不丢
- [ ] 浏览器**后退**，回到上一组筛选（不是空列表）
- [ ] 复制地址发给同事，对方打开看到同一批数据
- [ ] 筛出 0 条时有空状态与「清除筛选」
- [ ] 375px 宽下不出现横向滚动

:::

## 延伸方向

- 无限滚动：用 `IntersectionObserver` 触底加载，同时保证 URL 仍可分享。
- 预取：hover 卡片时预取详情，提升点击后的体感。
- 搜索防抖：输入 300ms 后再改 URL，避免每敲一个字都发请求。
