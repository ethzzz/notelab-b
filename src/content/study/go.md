# Go 熟练路线 · 9 周（Java 之后的第二语言）

> **给谁**：已经会一门静态类型语言、想把 Go 真正用起来的编程工作者。
> **终点**：L3 熟练 —— 能写出不泄漏的并发代码，能解释调度与 GC，能交付并压测一个服务。
> **节奏**：每周 8–10 小时。

## 这条路线要把你带到哪

| 级别 | 叫法 | 能做什么 | 怎么算达到 |
|---|---|---|---|
| L1 | 会写 | 能改现有代码、加一个 handler | 在现有服务里加一个接口 |
| L2 | 能独立 | 独立写并发任务、接数据库、部署 | 交付一个能上线的服务 |
| **L3** | **熟练（本路线终点）** | 控制并发、定位泄漏与 GC、做容量判断 | 通过文末毕业 rubric |
| L4 | 专家 | 设计运行时级方案、写框架 | 不在本路线范围 |

## 知识地图：四个域

| 域 | 熟练要求 | 对应周 |
|---|---|---|
| 语言与工具链 | 切片/接口/错误链的边界行为张口就来 | 1–2 |
| 并发与运行时 | 能证明不泄漏，能解释 GMP 与 GC | 3–4、9 |
| 服务与数据 | 能写可上线、可优雅退出的服务 | 5–6 |
| 工程与交付 | 测试、交叉编译、部署、压测闭环 | 7–8 |

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

## 阶段一 · 语言与工具链（第 1–2 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L1 → L2 |
| 这一阶段解决 | 换语言不换思维：把「继承 + 异常」换成「组合 + error」 |
| 核心知识 | 切片三元组、nil map、隐式接口、`%w` 错误链、包与 internal |
| 场景项目 | 场景 #6：一个带子命令的 CLI 工具（读配置、输出 JSON） |
| 离开时应该能 | 写 500 行不查资料的 Go 程序；解释 append 的共享底层数组 |

### 第 1 周：语法、切片与工具链

**本周目标**：能用 `go mod` 管一个真实的小包，写得出可测函数，并说清切片为什么「改了一个另一个也变」。

#### 步骤 1.1 从模块和第一个测试开始

建目录 `hello`，`go mod init example.com/hello`，写 `Add(a, b int) int` 和它的测试，跑 `go test`。

:::hint 为什么从测试开始而不是从 main 开始
Go 把测试做进了工具链：`xxx_test.go` + `go test`，不需要装插件、不需要配 pom。`go.mod` 同时是「模块边界」和「依赖清单」，没有它 `go build` 连自己都找不到。
:::

:::solution 代码与命令
```go
// hello.go
package hello

func Add(a, b int) int { return a + b }
```
```go
// hello_test.go
package hello

import "testing"

func TestAdd(t *testing.T) {
	if got := Add(1, 2); got != 3 {
		t.Fatalf("Add(1,2)=%d, want 3", got)
	}
}
```
```bash
go mod init example.com/hello
go test ./...     # ok  example.com/hello
gofmt -l .        # 没有输出 = 格式已统一
```
:::

:::error 模块相关最常见的三条
```text
go: cannot find main module; see 'go help modules'
```
↓ 不在 `go.mod` 所在的目录（或子目录）里执行。

```text
package example.com/hello is not in std
```
↓ 模块名写错，或者 import 路径与 `module` 声明不一致。

```text
missing go.sum entry for module providing package ...
```
↓ 拉过依赖但没整理：`go mod tidy`。
:::

#### 步骤 1.2 切片：append 之后为什么原切片没变

写一段代码：`a := make([]int, 2, 4)`，`b := append(a, 3)`，改 `b[0]`，观察 `a[0]` 也变了；再对容量不足的情况重复一次。

:::hint 切片是「指针 + 长度 + 容量」三元组
`append` 在**容量够**时原地追加，返回的新切片与旧的共享底层数组 —— 所以改一个会影响另一个；容量不够才重新分配、复制。想让两者彻底独立，用 `slices.Clone` 或 `copy`。
:::

:::solution 代码
```go
a := make([]int, 2, 4)   // len=2 cap=4
b := append(a, 3)        // 容量够 → 共享底层数组
b[0] = 99
fmt.Println(a[0], b[0])  // 99 99

c := make([]int, 2, 2)   // cap 刚好用满
d := append(c, 3)        // 容量不够 → 重新分配
d[0] = 7
fmt.Println(c[0], d[0])  // 0 7

e := slices.Clone(a)     // 真副本
e[0] = 1
fmt.Println(a[0], e[0])  // 99 1
```
:::

#### 步骤 1.3 map 的零值与结构体方法

写一个计数器：`map[string]int`，统计单词；再定义一个 `Counter` 结构体，用指针接收者累加。

:::hint 为什么 nil map 会 panic
`var m map[string]int` 只声明了类型，没分配桶；读安全（返回零值），写 panic。`make` 之后才是可写的。结构体方法：要在方法里改字段，接收者必须是指针；值接收者拿到的是副本。
:::

:::solution 代码
```go
counts := make(map[string]int)   // 必须 make
for _, w := range strings.Fields("go is go") {
	counts[w]++
}

type Counter struct{ n int }

func (c *Counter) Inc() { c.n++ }   // 指针接收者才能改
func (c Counter) Value() int { return c.n }
```
:::

:::error 写 nil map 的 panic
```text
panic: assignment to entry in nil map
```
**怎么读**：站在第几行不重要，关键是「哪个 map 没 make」。`var m map[string]int` + `m[k] = v` 必崩；`m[k]++` 也一样。
:::

**验收**

- [ ] `go test ./...` 全绿，`gofmt -l .` 无输出
- [ ] 能解释 `append` 后原切片为什么没变
- [ ] 能说出值接收者和指针接收者分别什么时候用

---

### 第 2 周：接口、错误与包

**本周目标**：能用接口解耦、用 `error` 表达失败，并组织出不被循环依赖缠住的包结构。

#### 步骤 2.1 隐式接口：实现一个 io.Writer

写一个 `CountingWriter`，包装任意 `io.Writer` 并统计字节数，然后把它接到 `io.MultiWriter` 上。

:::hint 接口不需要声明「实现」
Go 的接口是**方法集**：只要你的类型有 `Write([]byte) (int, error)`，它就已经是 `io.Writer`。这是「在使用方定义接口」的基础 —— 调用方只需要说「我要一个能写的东西」，不需要知道具体类型。
:::

:::solution 代码
```go
type CountingWriter struct {
	w io.Writer
	n int64
}

func (c *CountingWriter) Write(p []byte) (int, error) {
	n, err := c.w.Write(p)
	c.n += int64(n)
	return n, err
}

var buf bytes.Buffer
cw := &CountingWriter{w: &buf}
out := io.MultiWriter(cw, os.Stdout)   // 同时写两个目标
fmt.Fprintln(out, "hello")
fmt.Println("bytes:", cw.n)
```
:::

#### 步骤 2.2 error 是值：包装、判断、提取

定义一个哨兵错误 `ErrNotFound`，在 `Find` 里用 `%w` 包装，调用方用 `errors.Is` 判断；再加一个自定义错误类型，用 `errors.As` 取出字段。

:::hint 为什么不能用字符串比较错误
错误信息是给人看的，随时会改；`errors.Is/As` 比对的是错误链里的**结构**（哨兵值或类型）。`%w` 负责把下层错误串进链里，用 `%v` 就断了。
:::

:::solution 代码
```go
var ErrNotFound = errors.New("not found")

type QueryError struct{ Table string; Err error }

func (e *QueryError) Error() string { return "query " + e.Table + ": " + e.Err.Error() }
func (e *QueryError) Unwrap() error { return e.Err }

func Find(id int) error {
	return fmt.Errorf("load user %d: %w", id, ErrNotFound)
}

err := Find(1)
fmt.Println(errors.Is(err, ErrNotFound))   // true

var qe *QueryError
if errors.As(err, &qe) {
	fmt.Println("失败的表:", qe.Table)
}
```
:::

:::error errors.Is 永远是 false
```go
return fmt.Errorf("load user %d: %v", id, ErrNotFound)   // ❌ %v 断链
```
**三条自查**：用没用到 `%w`；哨兵错误是不是同一个变量（不是重新 `errors.New`）；中间层有没有把 error 丢掉（`if err != nil { return errors.New(err.Error()) }`）。
:::

#### 步骤 2.3 包、可见性与 internal

把前一阶段的代码拆成 `internal/store`、`internal/service`、`cmd/server` 三个包，让 `service` 依赖一个**自己定义的接口**而不是 `store` 的具体类型。

:::hint 接口定义在使用方
`service` 说「我需要一个能按 id 查用户的东西」，于是它自己定义 `type UserGetter interface{ Get(int) (*User, error) }`；`store` 恰好满足它。这样 service 不 import store，循环依赖自然消失，测试时塞个假实现也容易。
:::

:::solution 目录与代码
```text
cmd/server/main.go        装配：把 store 传给 service
internal/service/service.go  type UserGetter interface { Get(int) (*User, error) }
internal/store/store.go    func (s *Store) Get(id int) (*User, error)
```
```go
// service 只依赖自己定义的接口
type Service struct{ users UserGetter }
func New(s UserGetter) *Service { return &Service{users: s} }
```
:::

**验收**

- [ ] 能说出「隐式接口」为什么让依赖方向可控
- [ ] 能写出带 `%w` 的错误链并用 `errors.Is/As` 判断
- [ ] 包结构里没有循环依赖，`internal/` 起到隔离作用

---

## 阶段二 · 并发（第 3–4 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L2 |
| 这一阶段解决 | 从「会起 goroutine」到「能控制它不泄漏、能取消」 |
| 核心知识 | WaitGroup、channel/select/close、context 传递、worker pool、`-race` |
| 场景项目 | 场景 #4：SSE 推送服务（连接管理 + 心跳 + 优雅关闭） |
| 离开时应该能 | 写出 `go test -race` 干净通过、且能被 context 取消的并发代码 |

### 第 3 周：goroutine 与 channel

**本周目标**：能写出「不会泄漏、能被取消」的并发代码。

#### 步骤 3.1 WaitGroup：等一组 goroutine 结束

起 5 个 goroutine，各睡随机时间，主协程等它们全部结束后统计。

:::hint WaitGroup 的三个动作
`Add(n)` 必须在启动 goroutine **之前**；`Done()` 通常 `defer` 在 goroutine 里；`Wait()` 阻塞到计数归零。常见错误是把 `Add` 写在 goroutine 内部 —— 主协程可能先 `Wait`，计数还是 0，直接返回。
:::

:::solution 代码
```go
var wg sync.WaitGroup
results := make([]int, 5)

for i := 0; i < 5; i++ {
	wg.Add(1)                     // 必须先 Add
	go func(i int) {
		defer wg.Done()
		time.Sleep(time.Duration(rand.Intn(50)) * time.Millisecond)
		results[i] = i * i        // 每个 goroutine 写自己的下标，无竞争
	}(i)
}
wg.Wait()
fmt.Println(results)
```
:::

#### 步骤 3.2 channel、select 与 close

用无缓冲 channel 做「生产者 → 消费者」，再加一个 `select` 同时监听结果与超时。

:::hint channel 的所有权
**发送方负责 close**，接收方只用 `v, ok := <-ch` 判断是否关闭。无缓冲 channel 的发送会阻塞到有人接收；`select` 让「等结果」和「等超时」同时进行。
:::

:::solution 代码
```go
jobs := make(chan int)
out := make(chan int, 10)

go func() {                 // 生产者：自己关
	defer close(jobs)
	for i := 0; i < 5; i++ { jobs <- i }
}()

go func() {                 // 消费者
	for j := range jobs { out <- j * 2 }
	close(out)
}()

for {
	select {
	case v, ok := <-out:
		if !ok { return }
		fmt.Println(v)
	case <-time.After(2 * time.Second):
		fmt.Println("超时")
		return
	}
}
```
:::

:::error 死锁：所有 goroutine 都在等
```text
fatal error: all goroutines are asleep - deadlock!
```
**怎么读**：它会打印最后一个动作。`chan send` = 无缓冲 channel 没人接收；`chan receive` = 没人发送。检查：发送方是否忘了 `go`；`close` 是否由接收方调用了；`Wait` 是否在 `Add` 之前。
:::

#### 步骤 3.3 context：超时、取消、向下传递

给一个「模拟慢查询」的函数加上 `ctx`，主程序 100ms 后取消，观察函数立刻返回。

:::hint ctx 不是可选项
`context` 是取消信号的传递通道：HTTP 请求、数据库查询、`select` 都能接上。不接 ctx 的代码，超时了还在后台跑 —— 这就是隐蔽的资源泄漏。约定：`ctx` 永远是第一个参数，不存进结构体。
:::

:::solution 代码
```go
func slowQuery(ctx context.Context, d time.Duration) (string, error) {
	select {
	case <-time.After(d):
		return "done", nil
	case <-ctx.Done():
		return "", ctx.Err()     // context.DeadlineExceeded / Canceled
	}
}

ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
defer cancel()

_, err := slowQuery(ctx, time.Second)
fmt.Println(err)   // context deadline exceeded
```
:::

**验收**

- [ ] 能解释无缓冲 channel 的发送为什么阻塞
- [ ] 能说出 `close` 应该由谁调用
- [ ] 能写出一个带超时的调用并区分 `DeadlineExceeded` 与 `Canceled`

---

### 第 4 周：并发模式与竞态

**本周目标**：能控制并发度、能定位数据竞争、能发现泄漏。

#### 步骤 4.1 worker pool：限并发

100 个任务、5 个 worker、整体 3 秒超时，汇总结果。

:::hint 为什么不用「一个任务一个 goroutine」
goroutine 便宜但不是免费：无限制地起，会把下游（数据库、第三方接口）打挂。worker pool 的本质是**用固定数量的消费者 + 有缓冲队列**把并发度钉死。
:::

:::solution 代码
```go
func pool(ctx context.Context, tasks []int, workers int) []int {
	jobs := make(chan int)
	results := make(chan int, len(tasks))
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
					case results <- job * job:
					case <-ctx.Done():
						return
					}
				}
			}
		}()
	}

	go func() {
		defer close(jobs)
		for _, t := range tasks {
			select {
			case jobs <- t:
			case <-ctx.Done():
				return
			}
		}
	}()

	wg.Wait()
	close(results)
	out := make([]int, 0, len(tasks))
	for r := range results {
		out = append(out, r)
	}
	return out
}
```
:::

#### 步骤 4.2 数据竞争：用 -race 抓住它

两个 goroutine 各对同一个 `int` 加 1000 次，跑 `go test -race`，看竞争报告；再用 `atomic` 修好。

:::hint -race 是 Go 最值钱的工具
它在运行时插桩，检测「无同步的并发读写」，命中会打印两个 goroutine 的完整栈。代价是 5–10 倍变慢，所以只在测试/预发开；换来的是不会把偶发 bug 带上线。
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
			atomic.AddInt64(&counter, 1)   // 换成 counter++ 就会触发 -race
		}
	}()
}
wg.Wait()
fmt.Println(atomic.LoadInt64(&counter))   // 2000
```
:::

:::error 竞争报告怎么读
```text
WARNING: DATA RACE
Write at 0x00c00001a0e8 by goroutine 7:
  main.main.func1()
      /app/main.go:12 +0x44
Previous read at 0x00c00001a0e8 by goroutine 8:
  main.main.func2()
      /app/main.go:20 +0x38
```
**怎么读**：它把「谁写、谁读、各自停在哪一行」都给了。两处行号就是你要加同步的地方。注意：**能跑出正确结果不代表没有竞争**——-race 只看同步关系。
:::

#### 步骤 4.3 goroutine 泄漏与 pprof

故意写一个「发送到无人接收的 channel」的 goroutine，用 `pprof` 或 `runtime.NumGoroutine()` 看出它没退出。

:::hint 泄漏长什么样
goroutine 卡在 `chan send` 或 `select` 上永远不会醒 —— 因为它等的 channel 再也不会有人读。服务里每来一个请求漏一个，几天后内存和 fd 就满了。排查入口是 `net/http/pprof` 的 `/debug/pprof/goroutine?debug=2`。
:::

:::solution 代码
```go
before := runtime.NumGoroutine()
ch := make(chan int)          // 无缓冲、没人读
go func() { ch <- 1 }()       // 永远阻塞在这
time.Sleep(100 * time.Millisecond)
fmt.Println("leaked:", runtime.NumGoroutine()-before)   // 1

// 修法：要么有人读，要么给它一个可取消的 ctx
```
```go
import _ "net/http/pprof"
go http.ListenAndServe("127.0.0.1:6060", nil)
// curl 'http://127.0.0.1:6060/debug/pprof/goroutine?debug=2'
```
:::

**验收**

- [ ] 能写出带 ctx 的 worker pool
- [ ] `go test -race` 能抓到你造出来的竞争
- [ ] 能用 pprof 找到泄漏的 goroutine 及其调用栈

---

## 阶段三 · 服务（第 5–6 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L2 → L3 |
| 这一阶段解决 | 从「写得出接口」到「写得出能上线的服务」 |
| 核心知识 | `net/http` 路由、中间件链、优雅退出、`database/sql` 事务、slog |
| 场景项目 | 场景 #2：任务队列消费者（重试 + 幂等 + 死信） |
| 离开时应该能 | 交付一个只监听本机、可优雅退出、有结构化日志的服务 |

### 第 5 周：HTTP 服务

**本周目标**：用标准库写出结构清晰、能优雅退出的 HTTP 服务。

#### 步骤 5.1 路由与 handler（Go 1.22 起支持方法与路径参数）

实现 `GET /healthz`、`GET /api/assets/{id}`、`POST /api/assets`。

:::hint 标准库够不够用
Go 1.22 的 `ServeMux` 支持 `GET /api/assets/{id}` 这种模式，也能用 `r.PathValue("id")` 取参数。中小服务用标准库最省心：没有框架版本升级、没有隐藏行为。需要复杂中间件生态时再考虑 chi/echo。
:::

:::solution 代码
```go
mux := http.NewServeMux()
mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
})
mux.HandleFunc("GET /api/assets/{id}", func(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	writeJSON(w, http.StatusOK, map[string]string{"id": id})
})
mux.HandleFunc("POST /api/assets", func(w http.ResponseWriter, r *http.Request) {
	var body struct{ Name string `json:"name"` }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	writeJSON(w, http.StatusCreated, body)
})

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
```
:::

#### 步骤 5.2 中间件：日志、恢复、请求 ID

写 `withLogging` / `withRecover` / `withRequestID` 三个中间件并按顺序套上。

:::hint 中间件就是函数套函数
`func(http.Handler) http.Handler`。顺序很关键：recover 要在最外层（否则后面 panic 没人接），日志要在 recover 里面才能记录到状态码。
:::

:::solution 代码
```go
type statusRecorder struct {
	http.ResponseWriter
	code int
}

func (s *statusRecorder) WriteHeader(code int) { s.code = code; s.ResponseWriter.WriteHeader(code) }

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, code: 200}
		next.ServeHTTP(rec, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, rec.code, time.Since(start))
	})
}

func withRecover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				log.Printf("panic: %v\n%s", v, debug.Stack())
				http.Error(w, "internal error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

handler := withRecover(withLogging(mux))
```
:::

#### 步骤 5.3 优雅退出

监听 `SIGTERM`，停止接收新请求，给在途请求 5 秒处理时间。

:::hint 不优雅退出会怎样
直接 `os.Exit` 会切断正在处理的请求，客户端看到连接重置；`systemctl restart` 时用户就吃 502。`Shutdown(ctx)` 会关闭监听、等待在途请求结束，超时才强杀。
:::

:::solution 代码
```go
srv := &http.Server{Addr: "127.0.0.1:8081", Handler: handler}

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

- [ ] `curl` 能打通三个接口，JSON 正确
- [ ] 中间件顺序改错时能说出后果
- [ ] Ctrl+C 后进程优雅退出，日志里能看到「shutting down」

---

### 第 6 周：数据与配置

**本周目标**：能连数据库、写事务、把配置与日志管起来。

#### 步骤 6.1 database/sql 与连接池

用 `database/sql` + MySQL 驱动查询一张表，并设置连接池参数。

:::hint 为什么池大小要显式设
默认 `MaxOpenConns` 是 0（不限），高并发时会把数据库连接打满，报 `too many connections`。经验值：`MaxOpenConns` ≈ 数据库 max_connections / 实例数，`MaxIdleConns` 与之接近，`ConnMaxLifetime` 小于数据库的 `wait_timeout`。
:::

:::solution 代码
```go
db, err := sql.Open("mysql", dsn)   // 注意：Open 不建连接
if err != nil {
	return err
}
db.SetMaxOpenConns(20)
db.SetMaxIdleConns(10)
db.SetConnMaxLifetime(30 * time.Minute)

if err := db.PingContext(ctx); err != nil {   // 真正建连
	return err
}
```
:::

#### 步骤 6.2 事务与 context

实现「扣库存 + 写订单」两表操作，任一步失败整体回滚。

:::hint 事务的边界
`BeginTx` 之后的写操作在 `Commit` 前都不生效；`Rollback` 撤销。ctx 要传进 `BeginTx/ExecContext`，这样请求被取消时数据库也会中断，不会留下长事务。
:::

:::solution 代码
```go
tx, err := db.BeginTx(ctx, nil)
if err != nil {
	return err
}
defer tx.Rollback()   // Commit 之后再调用是 no-op，安全

if _, err := tx.ExecContext(ctx, "UPDATE stock SET qty = qty - 1 WHERE id = ? AND qty > 0", id); err != nil {
	return err
}
if _, err := tx.ExecContext(ctx, "INSERT INTO orders (sku) VALUES (?)", sku); err != nil {
	return err
}
return tx.Commit()
```
:::

#### 步骤 6.3 配置与结构化日志（slog）

用环境变量读配置，用 `log/slog` 输出 JSON 日志，带请求 ID。

:::hint 结构化日志的价值
`log.Printf("user %s failed: %v")` 只能人读；`slog.Info("login failed", "user", u, "rid", rid)` 能被日志系统按字段过滤、聚合。Go 1.21 起标准库自带 `slog`，不需要第三方库。
:::

:::solution 代码
```go
type Config struct {
	Addr   string
	DBDSN  string
}

func Load() Config {
	return Config{
		Addr:  env("ADDR", "127.0.0.1:8081"),
		DBDSN: env("DB_DSN", ""),
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" { return v }
	return def
}

logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
logger.Info("server start", "addr", cfg.Addr)
```
:::

:::error 连不上数据库的两个不同错误
```text
Error 1045 (28000): Access denied for user 'app'@'localhost' (using password: YES)
```
↓ 账号/密码/权限问题。

```text
dial tcp 127.0.0.1:3306: connect: connection refused
```
↓ 网络/端口/服务没起，**不是密码**。先 `nc -z 127.0.0.1 3306`。
:::

**验收**

- [ ] 能演示事务回滚：中途返回 error，两张表都没变
- [ ] 连接池参数有明确取值依据
- [ ] 日志是 JSON，能按 request_id 过滤

---

## 阶段四 · 交付（第 7–8 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L3 |
| 这一阶段解决 | 从「本机可跑」到「单二进制上线、压测有数、坏了能查」 |
| 核心知识 | 表驱动测试、`httptest`、基准测试、交叉编译、systemd + nginx |
| 场景项目 | 场景 #3：素材服务（只读、防穿越、缩略图信息） |
| 离开时应该能 | 交叉编译出静态二进制并部署；给出 QPS / 内存 / 启动耗时 |

### 第 7 周：测试与质量

**本周目标**：接口有测试，性能有基准，问题有 profile。

#### 步骤 7.1 表驱动测试 + httptest

给 `/api/assets/{id}` 写表驱动测试，覆盖 200 / 400 / 404，用 `httptest` 直接打 handler。

:::hint 为什么表驱动
一个 case 一行，加场景只加一行；失败信息里带上 case 名，一眼知道哪个挂了。`httptest.NewRecorder()` 让你不用起真实端口就能测 HTTP 层。
:::

:::solution 代码
```go
func TestGetAsset(t *testing.T) {
	cases := []struct {
		name string
		id   string
		code int
	}{
		{"ok", "1", 200},
		{"empty", "", 404},
		{"bad", "abc", 400},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/assets/"+c.id, nil)
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)
			if rec.Code != c.code {
				t.Fatalf("code=%d want %d", rec.Code, c.code)
			}
		})
	}
}
```
:::

#### 步骤 7.2 基准测试与 pprof

给一个字符串拼接函数写 `Benchmark`，再用 `pprof` 看分配。

:::hint 基准测试看什么
`ns/op`（耗时）、`B/op`（分配字节）、`allocs/op`（分配次数）。字符串拼接用 `strings.Builder` 通常比 `+=` 少一到两个数量级 —— 但要用数据证明，别凭感觉优化。
:::

:::solution 代码
```go
func BenchmarkJoin(b *testing.B) {
	for i := 0; i < b.N; i++ {
		var sb strings.Builder
		for j := 0; j < 100; j++ { sb.WriteString("x") }
		_ = sb.String()
	}
}
```
```bash
go test -bench=. -benchmem
go test -bench=. -cpuprofile=cpu.out -memprofile=mem.out
go tool pprof -top cpu.out
```
:::

**验收**

- [ ] 关键 handler 有表驱动测试，失败信息可定位
- [ ] 能给出一组 `ns/op / B/op` 数据
- [ ] 会用 `go tool pprof` 看热点

---

### 第 8 周：部署与真实落点

**本周目标**：把服务变成能长期跑的东西，而不是本机 demo。

#### 步骤 8.1 交叉编译与静态二进制

在 Windows 上构建 Linux 二进制，确认它不依赖任何动态库。

:::hint 为什么要关 CGO
`CGO_ENABLED=0` 产出纯静态二进制，才能真正「拷过去就跑」；开了 CGO 会链接 glibc，换台机器可能报 `bad ELF interpreter`。`-ldflags="-s -w"` 去掉调试信息，体积通常小 30%。
:::

:::solution 命令
```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o app ./cmd/server
file app          # ELF 64-bit ... statically linked
ls -lh app        # 通常几 MB
```
:::

:::error 拷到服务器上跑不起来
```text
bash: ./app: cannot execute binary file: Exec format error
```
↓ 架构不对（arm 机器上跑了 amd64）。`file app` 看目标架构。

```text
./app: /lib64/ld-linux-x86-64.so.2: bad ELF interpreter
```
↓ 开了 CGO，链接了目标机没有的库。加 `CGO_ENABLED=0`。
:::

#### 步骤 8.2 systemd + nginx + 压测

写 unit 文件、只监听 `127.0.0.1`、nginx 反代、`wrk` 压 30 秒。

:::hint 为什么只监听本机
服务不该直接暴露公网：让 nginx 处理 TLS、限流、静态资源、访问日志。应用只认 `127.0.0.1:8081`，攻击面小一圈，换端口也不用改防火墙。
:::

:::solution 配置
```ini
[Unit]
Description=assetd
After=network.target

[Service]
WorkingDirectory=/opt/assetd
EnvironmentFile=/opt/assetd/.env
ExecStart=/opt/assetd/app
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```
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

#### 步骤 8.3 给 NoteLab 写一个素材服务（真实任务）

需求：C 端 `public/spire` 下有大量 PNG，提供一个只读服务，按目录列出文件、返回缩略图信息。

:::hint 真实任务的价值
你现在会写 demo，但「独立开发」的分水岭是：**能在别人的系统里加一个东西，并且它长期跑着**。这个服务的边界很清楚：只读、无状态、单文件、能挂 nginx —— 适合作为第一块拼图。
:::

:::solution 实现要点
```go
// GET /api/assets?dir=spire/art
// 1. 限定根目录，拒绝 .. 穿越
// 2. 只读，不提供上传
// 3. 返回 []{name,size,modTime,url}
root, _ := filepath.Abs(os.Getenv("ASSET_ROOT"))
p := filepath.Join(root, filepath.Clean("/"+dir))
if !strings.HasPrefix(p, root+string(os.PathSeparator)) {
	http.Error(w, "forbidden", http.StatusForbidden)
	return
}
entries, err := os.ReadDir(p)
```
验收：二进制 < 10MB、启动 < 100ms、`wrk` 下 QPS 与内存有记录、重启机器后自动起来。
:::

**验收**

- [ ] 二进制能在干净 Linux 上直接运行
- [ ] 服务只监听 127.0.0.1，能被 nginx 反代
- [ ] 有 QPS / 内存 / 启动耗时数据
- [ ] 重启服务器后服务自动恢复

---

## 阶段五 · 运行时与性能（第 9 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L3 巩固 |
| 这一阶段解决 | 把「goroutine 很便宜」这类说法，换成可测量的调度与 GC 行为 |
| 核心知识 | GMP 调度、work stealing、三色标记 GC、GOGC 与内存上限 |
| 场景项目 | 场景 #2 的高并发版本：10 万任务消费，观察调度与 GC 曲线 |
| 离开时应该能 | 用 `schedtrace` / `gctrace` 解释吞吐与延迟的变化 |

### 第 9 周：运行时与性能

**本周目标**：能解释「为什么 goroutine 便宜」和「为什么内存不还给系统」，并用运行时自带的 trace 证明，而不是背结论。

#### 步骤 9.1 看懂 GMP 调度

起 10 万个 goroutine 各做一点计算，开 `GODEBUG=schedtrace=1000`，观察 M / P / G 的数量变化。

:::hint 调度器到底调度什么
goroutine(G) 复用系统线程(M)，中间隔一层逻辑处理器(P)；`GOMAXPROCS` 决定 P 的数量。G 阻塞在**系统调用**时，M 会带着 P 卡住，运行时把 P 交给别的 M（handoff）——所以「一个慢 IO 不拖垮全局」是有前提的：你得用支持并发的 API（`net` 系列会自动把 fd 交给 netpoller）。
:::

:::solution 命令与读数
```go
func main() {
	var wg sync.WaitGroup
	for i := 0; i < 100_000; i++ {
		wg.Add(1)
		go func(n int) { defer wg.Done(); _ = n * n }(i)
	}
	wg.Wait()
}
```
```bash
GODEBUG=schedtrace=1000 go run main.go
```
```text
SCHED 1000ms: gomaxprocs=8 idleprocs=0 threads=12 spinningthreads=1 idlethreads=4 runqueue=0 [3 2 0 1 ...]
```
- `gomaxprocs`：P 的数量（= CPU 核数，除非显式设置）；
- `runqueue` + 方括号：全局队列与每个 P 的本地队列长度；
- `threads` 远小于 goroutine 数：这就是「便宜」的证据（几万个 G 复用十几个 M）。
:::

#### 步骤 9.2 看懂 GC trace

跑一段每秒分配几百 MB 的代码，开 `GODEBUG=gctrace=1`，读出 GC 次数、单次停顿、堆大小。

:::hint 三色标记与 GOGC
Go 的 GC 是**并发**三色标记：大部分工作与应用并行，只有很短的 STW。`GOGC=100` 表示「堆比上次回收后翻倍就触发」；调大它 → GC 更少、内存更高。Go 1.19+ 可以用 `debug.SetMemoryLimit` 设软上限，让运行时按内存预算调整 GC 频率。
:::

:::solution 输出与调参
```text
gc 12 @3.214s 2%: 0.021+1.8+0.004 ms clock, 0.17+1.2/2.4/0.8+0.03 ms cpu, 120->124->60 MB, 130 MB goal, 8 P
```
- `2%`：GC 占用总 CPU 的比例；
- `0.021+1.8+0.004`：STW + 并发标记 + STW 收尾（毫秒）；
- `120->124->60 MB`：回收前 → 峰值 → 回收后；
- `130 MB goal`：下次触发的目标堆大小。
:::

:::error 「内存不还给系统」不是泄漏
```text
# 程序跑完一波流量，RSS 不降，但 pprof 的 inuse_space 很小
```
**原因**：Go 的内存分配器把空闲页留在自己的堆里复用，不一定 `madvise` 还给 OS。
**判断**：看 `inuse_space`（还在用的）而不是 RSS；真要归还，`debug.FreeOSMemory()` 或调 `GOGC` / `SetMemoryLimit`。
:::

**验收**

- [ ] 能说出 GOMAXPROCS 与 P 的关系
- [ ] 能用 `gctrace` 说出 GC 次数与平均停顿
- [ ] 能区分「RSS 高」与「内存泄漏」

---

## 与 Java 对照的「坑清单」

| Java 习惯 | 在 Go 里会怎样 |
|---|---|
| 用异常控制流程 | 没有异常，只能靠 `error` 返回值 |
| 大而全的 `Service` 类 | 推崇小接口 + 组合，包大了就是设计问题 |
| 线程池解决一切 | goroutine 很便宜，但要靠 ctx 和 channel 控制数量 |
| `synchronized` 保护共享状态 | 优先用 channel 传递所有权，锁是最后手段 |
| 依赖注入框架 | 通常**手动装配**，`main` 里把依赖串起来 |

---

## 常见报错速查

| 报错 | 先查什么 |
|---|---|
| `assignment to entry in nil map` | map 没 `make` |
| `all goroutines are asleep - deadlock!` | 无缓冲 channel 只有发/只有收；Wait 早于 Add |
| `WARNING: DATA RACE` | 看报告里的两个行号，加 sync/atomic 或改 channel |
| `cannot execute binary file` | 交叉编译架构不对 |
| `bad ELF interpreter` | 开了 CGO，需静态编译 |
| `too many connections` | 连接池没设上限 |
| `context deadline exceeded` | 正常超时，看上游是哪儿慢 |

---

## 场景实践库（可迭代的扩展点）

Go 的「熟练」体现在**能把并发和部署形态变成优势**。下面的场景按这个方向挑，每个都能独立交付。

| # | 场景 | 业务背景 | 交付物 | 考察点 | 建议阶段 |
|---|---|---|---|---|---|
| 1 | 公开 API 网关 | 给第三方调用的入口，要限流、鉴权、超时 | 中间件链 + 令牌桶 + 路由 | 中间件、限流、超时传播 | 四 |
| 2 | 任务队列消费者 | 异步任务要重试、要幂等、失败进死信 | 消费者 + 退避 + 死信表 | 并发控制、重试、幂等 | 三 |
| 3 | 素材服务 | 只读列目录、返回元信息、防路径穿越 | 只读 HTTP 服务 + 静态二进制 | 文件安全、缓存、部署 | 四 |
| 4 | 实时推送 | SSE / WebSocket，连接多、要心跳与优雅关闭 | 推送服务 + 连接管理 | goroutine 生命周期、ctx、泄漏排查 | 二 |
| 5 | 数据采集 | 定时并发抓取、去重、聚合 | 调度器 + worker pool + 存储 | 限并发、超时、幂等 | 三 |
| 6 | CLI 工具 | 子命令、配置、跨平台分发 | 单二进制 CLI + 子命令 | 包结构、flag、交叉编译 | 一 |

**统一交付标准**：有测试（含 `-race`）、有 README、有压测或基准数据、能一键构建出 Linux 二进制。

**相关项目**（点开即可看完整需求与参考实现）：
[任务队列消费者](/admin/study/projects?p=go/task-consumer) ·
[延迟任务与超时调度](/admin/study/projects?p=go/delay-scheduler) ·
[开放 API 网关](/admin/study/projects?p=go/api-gateway) ·
[配置中心](/admin/study/projects?p=go/config-center) ·
[指标采集与聚合](/admin/study/projects?p=go/metrics-aggregation) ·
[SSE 推送与在线状态](/admin/study/projects?p=go/sse-push) ·
[订单与库存（Go 版）](/admin/study/projects?p=go/order-inventory)


每个项目末尾都有**「验收脚本」**折叠块：复制到本地，把 `BASE` 指向你的服务就能跑一遍验收。

## 毕业评估（L3 rubric）

| 维度 | 不合格 | 合格（L2） | 熟练（L3） | 优秀（L4） |
|---|---|---|---|---|
| 并发 | 只会 `go func()` | 会用 WaitGroup/ctx 收口 | 能证明不泄漏、能压测出并发上限 | 能设计并发模型 |
| 正确性 | 只测 happy path | 表驱动测试 + `-race` | 能想到幂等与超时传播 | 能定义错误契约 |
| 性能 | 不会看 pprof | 能用 benchmark 比较 | 能用 trace 定位调度/GC 问题 | 能做容量规划 |
| 工程 | 单文件堆逻辑 | 包划分清楚 | 依赖方向合理、可测试 | 能定团队规范 |
| 交付 | 本机 `go run` | 能交叉编译部署 | 有 systemd/nginx 与回滚 | 能定发布流程 |

**通过标准**：5 个维度里至少 4 个达到「熟练」，且没有「不合格」。

## 后续迭代：怎么往里加东西

| 加什么 | 怎么加 | 注意 |
|---|---|---|
| 新场景 | 往「场景实践库」加一行 | 一个场景只考察 1–2 个点 |
| 新深度周 | 在对应阶段后加 `### 第 N 周`，同步更新总览 | 每周必须有可验收产出物 |

**三条红线**：每步都要有「思路 + 答案」；场景要能独立交付；不加「以后可能会用」的内容。

---

## 9 周之后

- 能读 `net/http`、`context`、`runtime` 里关键路径的源码（都不长）
- 能看懂 Kubernetes / Docker 生态里大量 Go 代码
- 回到本项目：把「素材缩略图」这类 CPU/IO 混合任务从 Java 里拆出去，用 Go 写 —— 这是最自然的第一块拼图

> **提醒**：会写 Go 不等于会做服务。分水岭在**有没有真实落点**——没有落点的语言学习，三个月后只剩语法记忆。
