# Go 上手路线 · 4 周专项（Java 之后的第二语言）

> **定位**：不是「从零学编程」，而是**用 4 周把 Go 的思维方式换过来**。前置：已经能写 Java（或任一静态类型语言）。
>
> **学完的标准**：能给本项目写一个真实的小服务（素材处理 / webhook 转发），独立部署，并被 nginx 挂上去。
>
> **用法**：思路和代码默认收起，先自己想，卡住了再展开。

---

## 先看清差异：Java 到 Go 的五个思维切换

| 维度 | Java | Go | 你要改的习惯 |
|---|---|---|---|
| 继承 | 类继承 + 接口 | **没有继承**，只有组合 + 隐式接口 | 别再想着 `extends`，用嵌入（embedding） |
| 异常 | try / catch / finally | **没有异常**，`error` 是返回值 | 每个可能失败的地方都 `if err != nil` |
| 并发 | 线程池 + 锁 | goroutine + channel（CSP） | 用 channel 传递所有权，不要共享内存 + 锁 |
| 依赖 | Maven 中央仓 + 传递依赖 | `go.mod`，依赖少而显式 | 一个包只做一件事，包越小越好 |
| 泛型 | 成熟 | 1.18 起有，但**刻意克制** | 不到第三次重复，别抽泛型 |

**一句话**：Java 用抽象管理复杂度，Go 用简单拒绝复杂度。写 Go 觉得「太啰嗦」，多半是还在用 Java 的思路。

---

## 第 1 周：语法与工具链

#### 步骤 1.1 切片的坑：append 之后原切片没变

写一段代码，对切片 `append` 后检查原切片长度，再用「共享底层数组」制造一个互相污染的 bug。

:::hint 切片是「指针 + 长度 + 容量」
`append` 在容量够时原地追加，返回的新切片和旧的**共享底层数组**；容量不够才重新分配。所以「改一个影响另一个」不是玄学，是没扩容。要独立副本就用 `slices.Clone` 或 `copy`。
:::

:::solution 代码
```go
a := make([]int, 2, 4)   // len=2 cap=4
b := append(a, 3)        // 容量够，b 与 a 共享底层数组
b[0] = 99
fmt.Println(a[0], b[0])  // 99 99  —— 互相污染

c := slices.Clone(a)     // 真副本
c[0] = 1
fmt.Println(a[0], c[0])  // 99 1
```
:::

#### 步骤 1.2 错误处理与 %w

写 `Divide(a, b)`，除零返回 error；用 `errors.Is` 判断，用 `%w` 包装后仍能判断。

:::hint 为什么用 %w 而不是 %v
`%w` 保留错误链，`errors.Is/As` 才能穿透包装找到原始错误；`%v` 只留字符串，链路就断了。Go 1.20 起多个错误用 `errors.Join`。
:::

:::solution 代码
```go
var ErrDivideByZero = errors.New("除数不能为零")

func Divide(a, b int) (int, error) {
	if b == 0 {
		return 0, fmt.Errorf("divide: %w", ErrDivideByZero)
	}
	return a / b, nil
}

_, err := Divide(1, 0)
fmt.Println(errors.Is(err, ErrDivideByZero)) // true
```
:::

**验收**

- [ ] 能解释 `append` 后原切片为什么没变
- [ ] 能说出值接收者和指针接收者分别什么时候用
- [ ] `go test ./...` 全绿，且测试是表驱动的

---

## 第 2 周：并发（Go 的核心）

#### 步骤 2.1 worker pool

100 个任务、5 个 worker、带 `context` 超时，汇总结果。

:::hint 为什么每个阻塞操作都要接 ctx
`ctx` 是取消信号的传递通道：上游超时，下游的 HTTP 请求、数据库查询、`select` 都能立刻退出。不接 `ctx` 的代码，超时了还在后台跑，等于泄漏。
:::

:::solution 代码
```go
func pool(ctx context.Context, jobs <-chan int, workers int) []int {
	results := make(chan int, len(jobs))
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case job, ok := <-jobs:
					if !ok {
						return
					}
					select {
					case results <- job * 2:
					case <-ctx.Done():
						return
					}
				}
			}
		}()
	}
	wg.Wait()
	close(results)
	out := make([]int, 0, len(jobs))
	for r := range results {
		out = append(out, r)
	}
	return out
}
```
:::

#### 步骤 2.2 造一次数据竞争并用 -race 抓到

两个 goroutine 同时 `counter++`，用 `go test -race` 跑出竞争报告，再用 `atomic` 修好。

:::hint -race 是 Go 最值钱的工具
它在运行时插桩检测「无同步的并发读写」，命中就打印两个 goroutine 的完整调用栈。**生产代码建议 CI 里常开**——代价是 5~10 倍变慢，但换来的是不会在线上偶发。
:::

:::solution 代码
```go
var counter int64
var wg sync.WaitGroup
for i := 0; i < 2; i++ {
	wg.Add(1)
	go func() {
		defer wg.Done()
		for j := 0; j < 1000; j++ {
			atomic.AddInt64(&counter, 1)
		}
	}()
}
wg.Wait()
fmt.Println(atomic.LoadInt64(&counter)) // 稳定 2000
```
:::

**验收**

- [ ] 能说出「为什么每个阻塞操作都要接 ctx」
- [ ] 能解释无缓冲 channel 的发送为什么会阻塞
- [ ] `go test -race` 能跑出你造出来的竞争

---

## 第 3 周：HTTP 服务与工程结构

#### 步骤 3.1 最小 HTTP 服务 + 中间件

用标准库 `net/http` 起服务：`/healthz`、`/api/assets`，加一个打印耗时的中间件。

:::hint 中间件就是「函数套函数」
`func(http.Handler) http.Handler`，在调用内层之前/之后做事。日志、鉴权、限流、panic 恢复都是这个形状——不需要框架。
:::

:::solution 代码
```go
func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}

mux := http.NewServeMux()
mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"ok":true}`))
})
srv := &http.Server{Addr: "127.0.0.1:8081", Handler: withLogging(mux)}
```
:::

#### 步骤 3.2 优雅退出

监听 `SIGTERM`，给在途请求 5 秒处理时间，再关闭。

:::hint 不优雅退出会怎样
直接 `os.Exit` 会切断正在处理的请求，客户端拿到连接重置；`systemctl restart` 时用户就看到了 502。`Shutdown(ctx)` 会停止接收新连接、等待在途请求完成。
:::

:::solution 代码
```go
ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
defer stop()

go func() {
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}()

<-ctx.Done()
shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
_ = srv.Shutdown(shutdownCtx)
```
:::

**验收**

- [ ] `curl` 能打通两个接口
- [ ] Ctrl+C 时优雅退出
- [ ] 代码里没有用全局变量传状态

---

## 第 4 周：真实落点（部署到本项目）

#### 步骤 4.1 交叉编译并部署

在 Windows 上直接构建 Linux 二进制，`scp` 到服务器，用 `systemd` 托管，只监听 `127.0.0.1:80xx`。

:::hint 交叉编译要关 CGO
`CGO_ENABLED=0` 出不依赖系统库的静态二进制，才能真正「拷过去就能跑」。开了 CGO 会链接 glibc，换台机器就可能起不来。
:::

:::solution 命令
```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o app ./cmd/server
scp app myapp:/opt/assetd/
ssh myapp "systemctl restart assetd"
```
:::

#### 步骤 4.2 挂 nginx 并压测

新增 `location`，先 `nginx -t` 再 reload；`wrk` 压 30 秒看 QPS 与内存。

:::hint Go 服务的优势在内存曲线
goroutine 初始栈只有 2KB，几十万并发也只占几十 MB；对比 Java 一个线程 1MB 栈。压测时重点看「内存是否随并发线性上涨」——Go 通常很平。
:::

:::solution nginx 与压测
```nginx
location /assets/ {
    proxy_pass http://127.0.0.1:8081/;
    proxy_set_header X-Real-IP $remote_addr;
}
```
```bash
wrk -t2 -c50 -d30s http://127.0.0.1:8081/healthz
```
:::

**验收**

- [ ] 二进制在服务器上直接能跑，不依赖运行时
- [ ] 重启服务器后自动起来
- [ ] 能说出这个服务的内存占用与 QPS

---

## 与 Java 对照的「坑清单」

| Java 习惯 | 在 Go 里会怎样 |
|---|---|
| 用异常控制流程 | 没有异常，只能靠 `error` 返回值 |
| 大而全的 `Service` 类 | 推崇小接口 + 组合，包大了就是设计问题 |
| 线程池解决一切 | goroutine 很便宜，但要靠 ctx 和 channel 控制数量 |
| `synchronized` 保护共享状态 | 优先用 channel 传递所有权，锁是最后手段 |
| 依赖注入框架 | 通常**手动装配**，`main` 里把依赖串起来 |

> **提醒**：Go 4 周只是「能写」，不是「精通」。分水岭在**第 4 周有没有真实落点**——没有落点的 Go 学习，三个月后只剩语法记忆。
