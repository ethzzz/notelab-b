# Go 上手路线 · 4 周专项（Java 之后的第二语言）

> **定位**：这不是「从零学编程」，而是**用 4 周把 Go 的思维方式换过来**。前置要求：已经能写 Java（或任一静态类型语言）。
>
> **为什么学**：Go 的价值不在语法，而在三件事——**部署形态（单二进制）**、**并发模型（goroutine + channel）**、**显式错误处理（error 当值）**。这三件事恰好是 Java 里最重、最容易写错的。
>
> **学完的标准**：能给本项目写一个真实的小服务（素材处理 / webhook 转发），独立部署，并且能被 nginx 挂上去。

---

## 先看清差异：Java 到 Go 的五个思维切换

| 维度 | Java | Go | 你要改的习惯 |
|---|---|---|---|
| 继承 | 类继承 + 接口 | **没有继承**，只有组合 + 隐式接口 | 别再想着 `extends`，用嵌入（embedding） |
| 异常 | try / catch / finally | **没有异常**，`error` 是返回值 | 每个可能失败的地方都 `if err != nil` |
| 并发 | 线程池 + 锁 | goroutine + channel（CSP） | 用 channel 传递，不要用共享内存 + 锁 |
| 依赖 | Maven 中央仓 + 传递依赖 | `go.mod` + 模块，**依赖少而显式** | 一个包只做一件事，包越小越好 |
| 泛型 | 成熟 | 1.18 起有，但**刻意克制** | 不到第三次重复，别抽泛型 |

**一句话**：Java 让你「用抽象管理复杂度」，Go 让你「用简单拒绝复杂度」。写 Go 时如果觉得「这太啰嗦了」，多半是你还在用 Java 的思路。

---

## 第 1 周：语法与工具链

**目标**：能写命令、结构体、方法、错误处理，并用 `go test` 验证。

**任务**

1. 装 Go（1.22+），确认 `go version`；`go env GOPROXY` 配国内代理。
2. 基础语法：变量（`:=`）、常量、`for`（Go 只有 for）、`switch`（不用 break）、数组 / 切片 / map。
   - **切片是重点**：`len` vs `cap`、`append` 扩容、切片共享底层数组的坑。
3. 结构体与方法：值接收者 vs 指针接收者（**要不要修改、要不要拷贝**）。
4. 接口：**隐式实现**——方法签名对上就算实现，不需要 `implements`。
5. 错误处理：
   ```go
   f, err := os.Open(path)
   if err != nil {
       return fmt.Errorf("打开文件失败: %w", err)   // %w 保留错误链
   }
   defer f.Close()
   ```
   - `errors.Is` / `errors.As` 判断错误类型
   - `panic` 只用于「程序真的不该继续」，不要拿它当异常用
6. 工具链：`go mod init` / `go build` / `go run` / `go test` / `gofmt` / `go vet`。

**动手**

```
1. 词频统计：读文件 → 切片 → map → 排序 → 输出 TopN
2. 一个包：calculator（Add/Div，除零返回 error），配表驱动测试
3. 用 defer 模拟「打开→使用→关闭」，故意在中间 return，观察 defer 顺序
```

**验收**

- [ ] 能解释切片 `append` 后原切片为什么没变
- [ ] 能说出值接收者和指针接收者分别什么时候用
- [ ] `go test ./...` 全绿，且测试是**表驱动**的

---

## 第 2 周：并发（Go 的核心）

**目标**：能用 goroutine + channel 写出「不会泄漏、能被取消」的并发代码。

**任务**

1. `go func()`、`sync.WaitGroup`、`sync.Mutex`、`sync.Once`。
2. channel：无缓冲 vs 有缓冲、`close` 的语义、`for range ch`、`select` + `default` + `time.After`。
3. **context**（最重要）：
   ```go
   ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
   defer cancel()
   ```
   - 向下传递超时与取消
   - 每个会阻塞的操作都应该接受 `ctx`
4. 经典模式：worker pool、fan-out/fan-in、限流（带缓冲 channel 当信号量）。
5. 数据竞争：`go test -race`。

**动手**

```
1. 并发下载器：10 个 URL，最大并发 4，用 context 控制整体超时
2. worker pool：100 个任务 → 5 个 worker → 汇总结果
3. 故意写一个 goroutine 泄漏（channel 没人读），用 pprof 找出来
```

**验收**

- [ ] 能说出「为什么每个阻塞操作都要接 ctx」
- [ ] 能解释无缓冲 channel 的发送为什么会阻塞
- [ ] `go test -race` 能跑出你造出来的数据竞争

---

## 第 3 周：HTTP 服务与工程结构

**目标**：写出一个能被别人调用的 HTTP 服务，结构清晰。

**任务**

1. 标准库 `net/http`：`ServeMux`（Go 1.22 起支持方法与路径参数）、中间件（函数套函数）、`http.Handler` 接口。
2. JSON：`encoding/json`、`json:"name"` 标签、`omitempty`。
3. 工程结构（小服务够用的最小分层）：
   ```
   cmd/server/main.go      —— 入口，只做装配
   internal/handler/       —— HTTP 层，只做参数解析与响应
   internal/service/       —— 业务逻辑
   internal/store/         —— 存储
   ```
4. 配置：环境变量 + `flag`，不要写死在代码里。
5. 优雅退出：`signal.NotifyContext` + `server.Shutdown(ctx)`。

**动手**：写一个「素材信息」服务

```
GET  /healthz                     → {"ok":true}
GET  /api/assets?dir=spire        → 列出目录下的文件（大小、修改时间）
POST /api/assets/convert          → 接收图片路径，返回缩略图路径（可以先用占位实现）
```

**验收**

- [ ] `curl` 能打通三个接口
- [ ] Ctrl+C 时服务**优雅退出**（打印日志、不再接新请求）
- [ ] 代码里没有全局变量传递状态

---

## 第 4 周：真实落点（部署到本项目）

**目标**：让 Go 服务成为本项目的一部分，而不是一个练习 demo。

**任务**

1. 交叉编译：`GOOS=linux GOARCH=amd64 go build -o app`（在 Windows 上直接产出 Linux 二进制）。
2. 部署：`scp` 到服务器 → `systemd` 或 `pm2` 托管 → 只监听 `127.0.0.1:80xx`。
3. 挂 nginx：新增一个 `location`，**先 `nginx -t` 再 reload**，改前备份配置。
4. 压测：`wrk -t2 -c50 -d30s`，看 QPS 与内存占用（Go 服务内存应该很稳）。

**验收**

- [ ] 二进制在服务器上直接能跑，不依赖任何运行时
- [ ] 重启服务器后服务自动起来
- [ ] nginx 能访问到，且只监听本地端口
- [ ] 能说出这个服务的内存占用和 QPS

---

## 与 Java 对照的「坑清单」

| Java 习惯 | 在 Go 里会怎样 |
|---|---|
| 用异常控制流程 | Go 里没有异常，只能靠 `error` 返回值 |
| 大而全的 `Service` 类 | Go 推崇小接口 + 组合，包大了就是设计问题 |
| 线程池解决一切 | goroutine 很便宜，但要靠 ctx 和 channel 控制数量 |
| `synchronized` 保护共享状态 | 优先用 channel 传递所有权，锁是最后手段 |
| 依赖注入框架 | Go 通常**手动装配**，`main` 里把依赖串起来 |

---

## 4 周之后

- 能读 `net/http`、`context` 的源码（都不长）
- 能看懂 Kubernetes / Docker 生态里大量 Go 代码
- 回到本项目：把「素材缩略图」这类 CPU/IO 混合任务从 Java 里拆出去，用 Go 写，是最自然的第一块拼图

> **提醒**：Go 4 周只是「能写」，不是「精通」。真正的分水岭在**第 4 周有没有真实落点**——没有落点的 Go 学习，三个月后只剩语法记忆。
