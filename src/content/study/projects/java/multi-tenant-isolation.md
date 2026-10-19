---
title: 多租户数据隔离
route: java
direction: 平台
level: L3
weeks: 12-14
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

## 延伸方向

- 分库分表：租户数超过单库容量后按 tenant_id 取模。
- 租户级配额：单租户的存储/请求量限制。
- 导出与备份：导出接口同样要带租户条件，别在报表里漏。
