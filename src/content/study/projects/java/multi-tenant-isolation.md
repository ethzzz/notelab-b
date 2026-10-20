---
title: 多租户数据隔离
route: java
direction: 平台
level: L3
weeks: 12-14
hours: 6-8
requires: java:9-12
tags: 租户, 数据隔离, 越权, 拦截器
summary: 一套库服务多个客户，任何一条漏了 tenant_id 的 SQL 都是数据泄漏。
---

## 业务背景

SaaS 平台为了成本，通常多个客户共用一套库表。隔离靠一列 `tenant_id`，但只要有**一条**查询忘了带条件，客户 A 就能看到客户 B 的数据——这是能上新闻的事故。

## 需求（用户故事）

- 作为租户 A 的管理员，我只能看到本租户的数据，拿别人的 id 也打不开。
- 作为开发，我新增表时不需要每次都记得写 `tenant_id` 条件（框架自动加）。
- 作为平台超管，我能在显式开启「跨租户视图」时查看全部，且这个动作要留痕。

## 接口契约

- 租户身份**从会话推导**，不接受前端传 `X-Tenant-Id`（否则等于让用户自己选看哪家数据）。
- 跨租户访问统一返回 404（不暴露「存在但不属于你」）。
- 超管跨租户查询必须带 `X-Admin-View: 1` 且写审计日志。

## 数据模型

```sql
CREATE TABLE orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  order_no VARCHAR(32) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  UNIQUE KEY uk_tenant_no (tenant_id, order_no),   -- 唯一键必须含 tenant_id
  KEY idx_tenant_created (tenant_id, created_at)
);
```

## 验收标准

- 用租户 A 的会话请求租户 B 的订单 id → 404。
- 抓 SQL 日志：所有业务查询都带 `tenant_id = ?`。
- 新建订单时 `tenant_id` 自动写入，代码里看不到手写。
- 超管开跨租户视图能查到全部，审计表里有一条记录。

## 关键决策

:::hint 三个必须想清楚的点
1. **租户 id 从会话来**，不从请求参数来；否则前端改个 header 就能越权。
2. **拦截器自动加条件**：MyBatis 租户插件或 DAO 层统一注入，比每个 SQL 手写可靠。
3. **超管旁路要显式**：默认不绕过，绕过必须传开关 + 留痕。
:::

## 参考实现

:::solution 上下文 + 拦截器
```java
public final class TenantContext {
    private static final ThreadLocal<Long> CURRENT = new ThreadLocal<>();
    public static void set(long id) { CURRENT.set(id); }
    public static Long get() { return CURRENT.get(); }
    public static void clear() { CURRENT.remove(); }
}

// 过滤器：从会话取 tenantId，放进 ThreadLocal，请求结束清理
public class TenantFilter extends OncePerRequestFilter {
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) {
        try {
            TenantContext.set(session.tenantId(req));
            chain.doFilter(req, res);
        } finally {
            TenantContext.clear();
        }
    }
}
```
```java
// 查询：条件里显式带上（或用 MP 的 TenantLineHandler 自动拼）
List<Order> list = orderMapper.selectList(
        new LambdaQueryWrapper<Order>().eq(Order::getTenantId, TenantContext.get()));
```
:::

## 验收脚本

:::check 复制即用（bash + curl，需要两个租户会话）
```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8080}"
: "${COOKIE_A:?export COOKIE_A='<租户A的会话 Cookie>'}"
: "${COOKIE_B:?export COOKIE_B='<租户B的会话 Cookie>'}"

get() { curl -s -o /tmp/nl.body -w '%{http_code}' -H "Cookie: $1" "$BASE$2"; }

echo "== 1. 借 B 的 id 用 A 的会话访问 → 必须 404（不是 403，别暴露存在性）"
BID=$(curl -s -H "Cookie: $COOKIE_B" "$BASE/api/orders" \
  | sed -n 's/.*"id":\([0-9]*\).*/\1/p' | head -1)
[ -n "$BID" ] || { echo "FAIL B 租户没有数据，先造一条再跑"; exit 1; }
code=$(get "$COOKIE_A" "/api/orders/$BID")
[ "$code" = "404" ] && echo "PASS 跨租户访问被挡（id=$BID）" || { echo "FAIL 返回 $code —— 越权了"; cat /tmp/nl.body; exit 1; }

echo "== 2. A 访问自己的列表 → 200"
[ "$(get "$COOKIE_A" "/api/orders")" = "200" ] && echo "PASS 本租户正常" || { echo "FAIL 本租户也被挡"; exit 1; }

echo "== 3. 超管跨租户查询必须显式开视图"
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: ${ADMIN_COOKIE:?}" -H 'X-Admin-View: 1' "$BASE/api/orders?all=1")
[ "$code" = "200" ] && echo "PASS 超管跨租户可用" || echo "注意：超管视图返回 $code"

echo "== 4. 人工核对：应用 SQL 日志里每条业务查询都应带 tenant_id"
echo "   ssh <host> \"grep -c 'FROM orders' app.log\"; 再看每条是否都有 tenant_id = ?"
```
:::

## 延伸方向

- 分库分表：租户数超过单库容量后按 tenant_id 取模。
- 租户级配额：单租户的存储/请求量限制。
- 导出与备份：导出接口同样要带租户条件，别在报表里漏。
