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

**本周目标**：用 `go mod` 建一个能跑测试的小模块，并用可运行的输出证明：`append` 之后两个切片什么时候共享底层数组、什么时候各自独立。

**为什么是这些内容**：Java 给你的三件套是 Maven、JUnit 和 `ArrayList`；Go 把它们换成了 `go.mod`、`testing` 和「切片头」。这一周不追求语法覆盖，只打三根桩：模块决定 import 路径和语言版本，测试是工具链自带的能力，切片头决定你写的函数是在复制还是在共享。

后面八周全长在这三根桩上。第 2 周的接口与包结构，要先知道值在传参时发生了什么；第 3 周把 `results[i]` 分给不同 goroutine，靠的正是「不同下标是不同内存」；第 4 周的 `-race` 抓的是同一块内存的无同步读写。切片别名在单线程里只是算错，在并发里就是数据竞争；nil map 在本地小数据量下常常不触发，一到线上写路径就 panic。

Go 1.22 还改了两处语义：`for` 循环变量每轮新建、`range` 可以直接遍历整数。这两点会用可运行的输出验证，而不是背结论。学完这周，你应该能在不查资料的情况下说清 `a` 和 `b` 共享了哪一段内存。

工具链的部分只学「够用且不会再变」的：`go mod init`、`go test`、`gofmt`、`go vet` 四条命令覆盖了日常九成场景。`go get`、`go mod tidy`、`go.sum` 等到第 2 周引入第三方依赖时再碰，现在先把「模块根目录」和「包路径」这两个概念固定下来。

#### 步骤 1.1 从模块和第一个测试开始

模块是「import 路径前缀 + 依赖清单 + 语言版本」三合一。`go mod init example.com/hello` 生成 `go.mod`：`module` 决定别人怎么 import 你，`go 1.22` 决定编译器用哪套语言语义（步骤 1.4 会看到它真的改变程序行为）。同一目录下所有 `.go` 文件的 `package` 名必须一致；`hello.go` 与 `hello_test.go` 都写 `package hello`，测试就能调用未导出函数，这叫同包测试。若写成 `package hello_test`，只能测导出的 API，适合验证对外契约。

`go test ./...` 编译并运行所有包的 `TestXxx`。`-v` 打印每个用例，`-count=1` 禁用结果缓存——否则第二次只显示 `(cached)`，容易误判成「刚跑过」。`t.Fatalf` 立刻终止当前用例，`t.Errorf` 记录后继续；`t.Helper()` 让失败行号指向调用处，而不是辅助函数内部。`gofmt -l .` 只列文件名、不打印差异，所以「无输出」才是通过；`go vet ./...` 查的是编译器不管的可疑写法。

```go
// hello.go
package hello

func Add(a, b int) int { return a + b }
```

关键点：`module` 后面的路径不必是真实网址，也不需要能访问，它只是全局唯一的 import 前缀；`_test.go` 结尾的文件不会被编进正常构建；`Add` 首字母大写才能被包外调用，第 2 周的接口会反复用到这条可见性规则。

测试文件不需要在主文件旁边注册，放在同一个目录即可；`go test -run TestAdd` 只跑名字匹配的用例，`-cover` 输出语句覆盖率。覆盖率不是目标，但它能告诉你「哪些分支从来没被执行过」，比凭感觉判断「应该没问题」可靠。

:::hint 为什么从测试开始而不是从 main 开始
`go test` 与 `go build` 是同一条工具链，不装插件、不配 pom；从第一分钟你就有一个「改坏了会响」的反馈环。
:::

:::solution 完整文件与命令
```go
// go.mod（由 go mod init example.com/hello 生成）
module example.com/hello

go 1.22
```
```go
// hello_test.go
package hello

import "testing"

func TestAdd(t *testing.T) {
	t.Helper()
	if got := Add(1, 2); got != 3 {
		t.Fatalf("Add(1,2)=%d, want 3", got)
	}
}
```
```bash
go mod init example.com/hello
go test -v ./...   # === RUN   TestAdd → --- PASS
gofmt -l .         # 无输出
go vet ./...       # 无输出
```
:::

#### 步骤 1.2 切片：append 之后为什么原切片没变

切片变量本身只有三个字长：指向底层数组的指针、长度、容量。`make([]int, 2, 4)` 分配 4 个 `int`，但长度是 2——下标 2、3 已经存在，只是不能通过 `a[2]` 访问。`append(a, 3)` 发现 `len < cap`，于是把 3 写到索引 2，返回一个长度 3 的新切片头；**底层数组没变**。这就是「原切片没变」的真相：`a` 的长度仍是 2，`fmt.Println(a)` 看不到 3，但 `a[0]` 与 `b[0]` 是同一个格子，改一个另一个也变；用 `a[:3]` 重新切片就能看见被 append 写进去的值。

容量用满时（`make([]int, 2, 2)`），`append` 只能分配新数组、复制旧元素，再把新元素写到末尾；此后 `c` 与 `d` 再无关系。想主动要一份独立数据，用 `slices.Clone`（Go 1.21 起）或 `copy`；`s[:0]` 复用只是把长度清零，底层数组仍与别人共享，拿它当「新切片」是常见事故。

```go
a := make([]int, 2, 4)   // len=2 cap=4
b := append(a, 3)        // 容量够：共用数组，写入索引 2
b[0] = 99
fmt.Println(a, b)        // [99 0] [99 0 3]
fmt.Println(a[:3])       // [99 0 3]

c := make([]int, 2, 2)   // cap 已满
d := append(c, 3)        // 重新分配并复制
d[0] = 7
fmt.Println(c, d)        // [0 0] [7 0 3]

e := slices.Clone(a)     // 独立数组
e[0] = 1
fmt.Println(a[0], e[0])  // 99 1
```

逐行看：第 2 行返回的 `b` 与 `a` 共享数组，但 `a` 的长度字段没有被修改，所以打印 `a` 只到索引 1；第 5 行 `a[:3]` 合法，因为切片的上界可以到容量而不是长度；第 8 行的 `append` 已经重新分配，所以 `d` 指向新数组，改 `d` 不影响 `c`；第 12 行 `Clone` 复制的是长度范围内的元素，不是整个容量。

把切片传进函数时，传的同样是这三个字。函数里写 `s[0] = 1` 能改到调用方的数组，因为指针相同；但在函数里 `s = append(s, x)` 只改了函数自己的长度字段，调用方看到的长度不变，新元素也拿不到。要「追加并让调用方看见」，就得把新切片作为返回值传出去——标准库的 `append` 本身就是这个形状，这不是风格问题，而是值语义的必然结果。

这条规则也解释了大量「原地修改」的坑：`slices.Sort(s)` 会重排共享的底层数组，如果 `t := s[:]` 之后再排序，`s` 的顺序也一起变。要保留原顺序就先 `slices.Clone`。看标准库函数签名时，先找它返回什么、有没有 `Clone` 字样，比读注释更快。

:::hint 一句话
`append` 改的是「新切片头 + 可能同一块数组」，不是原变量；判断共享看 `cap`，判断可见看 `len`。
:::

:::solution 可运行文件
```go
package main

import (
	"fmt"
	"slices"
)

func main() {
	a := make([]int, 2, 4)
	b := append(a, 3)
	b[0] = 99
	fmt.Println(a, b)
	fmt.Println(a[:3])

	c := make([]int, 2, 2)
	d := append(c, 3)
	d[0] = 7
	fmt.Println(c, d)

	e := slices.Clone(a)
	e[0] = 1
	fmt.Println(a[0], e[0])
}
```
:::

#### 步骤 1.3 map 的零值与结构体方法

`var m map[string]int` 只声明了类型，没有分配哈希桶。它的零值行为不对称：`len(m)` 是 0，`m["x"]` 返回 0，`range m` 一次都不进，`delete(m, "x")` 静默返回——读和删都安全；但 `m["x"] = 1` 或 `m["x"]++` 会 panic。**声明不等于可用**，写之前必须 `make` 或用 `map[string]int{}`。`counts[w]++` 看起来像「先读再写」，Go 把它当作一次合法的 map 索引自增，不需要先赋零值。

方法接收者决定「改的是原件还是副本」。值接收者拿到结构体副本，改字段不影响调用方；指针接收者拿到地址，才能改。方法集也跟着变：`*Counter` 拥有 `Inc` 和 `Value`，`Counter` 只有 `Value`。所以把 `Counter{}` 传给「需要 `Inc` 的接口」会编译失败——第 2 周的接口会再遇到这条规则。

```go
type Counter struct{ n int }

func (c *Counter) Inc()        { c.n++ }    // 指针：改原件
func (c Counter) Value() int   { return c.n } // 值：只读副本

c := &Counter{}
c.Inc()
fmt.Println(c.Value()) // 1
```

`c := &Counter{}` 之后写 `c.Inc()`，Go 自动取址；如果写成 `var c Counter`，`c.Inc()` 也能编译，因为 `c` 可寻址，编译器替你取地址。不可寻址的值（比如 `Counter{}.Inc()` 或函数返回的临时值）就不能直接调指针方法。

map 还有两条与 Java 不同的行为：迭代顺序是随机的，每次 `range` 都可能不同，别依赖它输出固定结果；键必须是可比较类型，切片、map、函数不能当键。`len(m)` 对 nil map 返回 0，所以「没 make」和「空 map」在读取时表现一样，这正是它容易漏到线上的原因。

:::hint nil map 与 nil 切片不一样
nil 切片可以直接 `append`（会分配新数组），nil map 不能写入；两者读都安全。
:::

:::solution 单词计数与 Counter
```go
package main

import (
	"fmt"
	"strings"
)

type Counter struct{ n int }

func (c *Counter) Inc()      { c.n++ }
func (c Counter) Value() int { return c.n }

func main() {
	counts := make(map[string]int)
	for _, w := range strings.Fields("go is go") {
		counts[w]++
	}
	fmt.Println(counts) // map[go:2 is:1]

	c := &Counter{}
	c.Inc()
	fmt.Println(c.Value()) // 1

	var m map[string]int
	fmt.Println(len(m), m["x"]) // 0 0，读安全
	// m["x"]++                 // 取消注释即 panic
}
```
:::

#### 步骤 1.4 range 变量与 Go 1.22 的循环语义

Go 1.21 及更早，`for _, v := range` 整个循环只有一个 `v`，每轮只是给它重新赋值。闭包或 goroutine 捕获的是这个变量，等它们真正执行时循环早已结束，于是全部打印最后一个值——这是 Java 程序员迁到 Go 最常踩的坑之一（Java 的增强 for 每轮是新变量）。老代码的土办法是在循环体里写 `v := v` 复制一份。

Go 1.22 改成每轮新建循环变量（`for i := 0; ...` 里的 `i` 也一样）。是否生效由 `go.mod` 的 `go` 指令决定：写 `go 1.22` 才是新语义，写 `go 1.21` 即使工具链是 1.22 也按旧语义编译。同一个版本还允许 `for i := range 5` 直接遍历整数，少写一段三段式 for。

```go
for _, v := range []int{1, 2, 3} {
	go func() { fmt.Print(v, " ") }() // 1.22：1 2 3；1.21：3 3 3
}

for i := range 3 { // Go 1.22 起合法
	fmt.Print(i, " ") // 0 1 2
}
```

判断你的模块到底是哪套语义，不要看 `go version`，要看 `go.mod`；`go mod edit -go=1.22` 可以改这一行。新语义下取 `&v` 每轮地址不同，旧语义下所有轮次指向同一个地址——这正是并发 bug 的源头。

还有一个实践细节：即使语言已经修好，把 `v` 作为参数显式传进 goroutine（`go func(v int){...}(v)`）仍然值得保留。它让「这个 goroutine 用的是哪一轮的值」在签名上就写清楚，阅读代码的人不用去翻 `go.mod` 判断语义；团队里混着 1.21 和 1.22 的模块时，这种写法不会因为升级工具链而改变行为。

:::hint 版本语义看 go.mod
`go version` 说的是工具链版本，`go.mod` 里的 `go` 指令说的是这门代码用哪套语言规则，两者可以不同。
:::

:::solution 可运行验证
```go
package main

import (
	"fmt"
	"sync"
)

func main() {
	var wg sync.WaitGroup
	for _, v := range []int{1, 2, 3} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			fmt.Print(v, " ")
		}()
	}
	wg.Wait()
	fmt.Println()

	for i := range 3 {
		fmt.Print(i, " ")
	}
	fmt.Println()
}
```
:::

:::error 三个高频报错
```text
panic: assignment to entry in nil map
```
根因：`var m map[string]int` 之后直接写。修复：`make(map[string]int)`，或改用 `map[string]int{}`。

```text
go: cannot find main module; see 'go help modules'
```
根因：当前目录不在任何 `go.mod` 的子树里。修复：回到模块根目录，或先 `go mod init`。

```text
./main.go:12:6: v declared and not used
```
根因：Go 把「声明未使用」当编译错误（Java 只是警告）。修复：改成 `for range`，或用 `_ = v` 明确表示忽略。
:::

**自测**（合上文档回答）

1. `a := make([]int, 2, 4); b := append(a, 3); b[0] = 99` 之后，`fmt.Println(a)` 和 `a[:3]` 分别输出什么？为什么 `a` 里看不到 3？
2. 在 `var m map[string]int` 上执行 `len(m)`、`m["x"]`、`m["x"]++`、`delete(m, "x")`，哪些安全、哪个 panic？
3. 同一段捕获 `v` 的 goroutine 代码，`go.mod` 写 `go 1.21` 和 `go 1.22` 输出有什么不同？决定语义的是哪个文件？

**验收**

- [ ] `go version` 输出包含 `go1.22`，`go.mod` 同时含 `module example.com/hello` 与 `go 1.22`
- [ ] `go test ./...` 输出 `ok example.com/hello`；`gofmt -l .` 与 `go vet ./...` 均无输出
- [ ] 运行步骤 1.2 的程序，四行输出依次为 `[99 0] [99 0 3]`、`[99 0 3]`、`[0 0] [7 0 3]`、`99 1`
- [ ] 运行步骤 1.4 的程序打印 `1 2 3`（顺序可不同）与 `0 1 2`；把 `go.mod` 改成 `go 1.21` 后 `range 3` 那行编译失败

---

### 第 2 周：接口、错误与包

**本周目标**：用隐式接口解耦一次调用、用带 `%w` 的错误链表达失败，并把代码拆成依赖方向单向的包。

**为什么是这些内容**：Java 的 `interface` 要显式 `implements`，失败用异常一路向上抛，包按 controller/service/mapper 分层。Go 把这三件事倒过来：接口是隐式方法集，错误是普通返回值，包的依赖方向要自己守住。

这一周不是学「interface 关键字怎么写」，而是让代码具备两个能力：调用方只依赖自己声明的最小接口，失败信息能带着上下文穿过三层调用、还能被程序判断。第 3、4 周写并发测试时，你要靠接口塞假实现；第 5 周的中间件签名就是 `func(http.Handler) http.Handler`；第 6 周的 store/service 分层直接复用步骤 2.3 的目录。

不学会的代价很具体：用 `err.Error()` 的字符串判断失败类型，文案改一个字就全线失效；用 `%v` 包装，`errors.Is` 永远返回 false；service 直接 import store，测试就必须连数据库；返回一个 nil 的具体错误指针，`if err != nil` 永远成立。这四种写法都能编译、都能在本地跑通，也都会在线上或重构时咬人。

还有一层工程习惯：Go 代码里 `if err != nil` 会反复出现，看着啰嗦，但它把「失败」摊在每一步调用旁边，读代码的人不需要跳去看 catch 块才知道哪里可能炸。接受这种形状，是写出可维护 Go 代码的前提。

#### 步骤 2.1 隐式接口：实现一个 io.Writer

接口在 Go 里是「方法集」：只要类型的方法表里有 `Write([]byte) (int, error)`，它就满足 `io.Writer`，不需要写 `implements`。这让接口可以定义在**使用方**——调用方声明「我要一个能写的东西」，实现方甚至不知道这个接口存在。

`io.Writer` 有一条容易忽略的契约：返回的 `n < len(p)` 时必须同时返回非 nil 的 error，否则调用方会认为数据只写了一半却没有原因。`CountingWriter` 用指针接收者，因为它要改 `n`；若用值接收者，`c.n +=` 改的是副本，调用方统计永远是 0。方法集规则随之而来：`*CountingWriter` 的方法集里有 `Write`，`CountingWriter` 的方法集里一个方法都没有。把值传给 `io.MultiWriter` 会编译失败，报 `CountingWriter does not implement io.Writer (method Write has pointer receiver)`。

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

var _ io.Writer = (*CountingWriter)(nil) // 编译期断言
```

逐行看：`var _ io.Writer = ...` 不产生变量，只在编译期检查「这行还能不能过」；`n` 用 `int64` 是 io 包的计数惯例，32 位平台上 `int` 可能不够；返回 `n, err` 而不是 `len(p), nil`，否则上层会把短写当成功。`io.MultiWriter(cw, os.Stdout)` 按顺序写每个目标，任一失败立即返回，前面的目标已经写出去的字节不会回滚。

Go 标准库到处是这种小接口：`io.Copy(dst Writer, src Reader)`、`http.Handler` 只有一个 `ServeHTTP` 方法、`sort.Interface` 只有三个方法。接口越小，能满足它的类型越多，测试替身也越好写。反过来，如果你定义了一个十个方法的接口，先问自己：调用方真的会用满十个吗？多数时候拆成两三个单方法接口，组合起来更灵活。

接口还能靠嵌入组合：`io.ReadWriter` 就是 `Reader` 加 `Writer`，没有新增方法。这也是 Go 没有继承却能做到「行为复用」的方式——组合接口、组合结构体，而不是拉一棵类树。

:::hint 接口不需要声明「实现」
方法集对上就是实现了；指针接收者只把方法加进 `*T` 的方法集，所以「谁实现了接口」取决于你传的是值还是指针。
:::

:::solution 完整程序
```go
package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
)

type CountingWriter struct {
	w io.Writer
	n int64
}

func (c *CountingWriter) Write(p []byte) (int, error) {
	n, err := c.w.Write(p)
	c.n += int64(n)
	return n, err
}

var _ io.Writer = (*CountingWriter)(nil)

func main() {
	var buf bytes.Buffer
	cw := &CountingWriter{w: &buf}
	out := io.MultiWriter(cw, os.Stdout)

	fmt.Fprintln(out, "hello")
	fmt.Println("bytes:", cw.n) // hello\n = 6
}
```
:::

#### 步骤 2.2 error 是值：包装、判断、提取

`error` 本身是一个接口：`type error interface { Error() string }`。哨兵错误是包级变量，用来表达「这一类失败」；`fmt.Errorf` 的 `%w` 把下层错误装进链里，`%v` 只把文字拼进去，链就断了。

`errors.Is(err, target)` 沿 `Unwrap()` 一路比较（也认自定义的 `Is` 方法），回答「链里有没有它」；`errors.As(err, &target)` 找第一个能赋给目标类型的错误，把值写进去。`As` 的第二个参数必须是非 nil 指针，指向实现了 error 的类型或接口，否则运行时 panic。本例的链是：`fmt.wrapError`（`find user 0: ...`）→ `*QueryError`（`query users: ...`）→ `ErrNotFound`。`Is` 能走到最里层，`As` 能停在中间层拿到 `Table`。

错误文案的约定：小写开头、不加句号、不重复上层已经说过的话；上下文由调用方补。这样日志拼出来是一句能读的话，而不是每层都写「failed to」。

```go
var ErrNotFound = errors.New("user not found")

type QueryError struct {
	Table string
	Err   error
}

func (e *QueryError) Error() string { return "query " + e.Table + ": " + e.Err.Error() }
func (e *QueryError) Unwrap() error { return e.Err }

func Find(id int) error {
	return fmt.Errorf("find user %d: %w", id, &QueryError{Table: "users", Err: ErrNotFound})
}
```

`Unwrap` 是让 `Is/As` 能往下走的关键；没有它，`*QueryError` 就是链的终点，里面的 `ErrNotFound` 永远找不到。

两个补充：`%w` 可以出现多次（Go 1.20 起支持多错误包装），`errors.Is` 会检查每一条分支；`errors.Join` 能把多个错误合成一个，适合「关闭文件时又发现写入失败」这类收尾场景。另外，`err == ErrNotFound` 这种直接比较只在完全没包装时成立，一旦经过 `fmt.Errorf` 就必然为 false，所以团队约定里应直接禁用这种写法。

测试错误时也只断言结构：`if !errors.Is(err, ErrNotFound) { t.Fatalf("got %v", err) }`。不要去比 `err.Error()` 的整句文案，否则改一个介词就会让测试红掉，而真正的行为并没有变。

哨兵错误和自定义类型怎么选：只需要判断「是不是这一类失败」用哨兵；需要带字段（哪个表、哪一行、重试次数）用类型。类型还可以实现 `Is` 方法，把「多个哨兵算同一类」的规则收进错误自己身上，调用方仍然只写 `errors.Is`。

:::hint 结构判断用 Is/As，字符串只给人看
错误文案随时会改，`errors.Is/As` 比的是链里的哨兵值或类型；`%w` 负责接链，`%v` 负责断链。
:::

:::solution 带判断的完整程序
```go
package main

import (
	"errors"
	"fmt"
)

var ErrNotFound = errors.New("user not found")

type QueryError struct {
	Table string
	Err   error
}

func (e *QueryError) Error() string { return "query " + e.Table + ": " + e.Err.Error() }
func (e *QueryError) Unwrap() error { return e.Err }

func Find(id int) error {
	if id > 0 {
		return nil
	}
	return fmt.Errorf("find user %d: %w", id, &QueryError{Table: "users", Err: ErrNotFound})
}

func main() {
	err := Find(0)
	fmt.Println(err)                         // find user 0: query users: user not found
	fmt.Println(errors.Is(err, ErrNotFound)) // true

	var qe *QueryError
	if errors.As(err, &qe) {
		fmt.Println(qe.Table) // users
	}
	fmt.Println(Find(1) == nil) // true
}
```
:::

#### 步骤 2.3 包、可见性与 internal

包是编译单元，也是可见性边界：首字母大写导出，小写只在包内可见。`internal/` 是编译器强制的隔离——只有 `internal` 父目录这棵树里的包能 import 它，模块外的人写了会报 `use of internal package ... not allowed`。

依赖方向要画成单向：`cmd/server` 同时 import `service` 和 `store`，`service` 不 import `store`。`service` 自己声明 `UserGetter`，`store` 恰好满足它，`main` 把 store 塞进 service。这样 service 的测试不需要数据库，塞一个 `fakeUsers` 就行；将来换存储，service 一行不改。

包名要短、不要重复：`user.Service` 而不是 `user.UserService`；不要建 `util`、`common` 这种无主包，它们会变成谁都能往里塞的垃圾场。

```text
hello/
  go.mod
  cmd/server/main.go          // 装配：new store → new service
  internal/user/user.go       // type User
  internal/service/service.go // UserGetter + Service
  internal/store/store.go     // Store.Get
```

```go
// internal/service/service.go
type UserGetter interface {
	Get(ctx context.Context, id int) (*user.User, error)
}

type Service struct{ users UserGetter }

func New(u UserGetter) *Service { return &Service{users: u} }
```

`service` 只认识「能按 id 取用户」这个行为，不认识 `store.Store` 这个类型；`store` 只要方法签名对得上，就自动满足接口，连 import service 都不需要。

验收依赖方向不要靠肉眼：`go list -f '{{join .Imports "\n"}}' ./internal/service` 会打印这个包直接 import 的路径，出现 `internal/store` 就说明接口放错了位置。`internal` 的隔离则是编译器负责的：在模块外新建一个包去 import `example.com/hello/internal/user`，会直接编译失败，不需要 code review 去拦。

`main` 是唯一知道所有具体类型的地方：它 new 出 store、传给 service 的构造函数。Go 社区把这叫「手动装配」，没有 Spring 那样的容器，依赖关系在 `main` 里一眼看全；包越多，这个函数会变长，但换来的是没有隐式注入、没有启动期反射。

:::hint 接口定义在使用方
谁调用，谁声明接口。`service` 说「我需要一个能按 id 查用户的东西」，于是接口出现在 `service` 包里；循环依赖从结构上就不可能出现。
:::

:::solution 各包代码与装配
```go
// internal/service/service.go
package service

import (
	"context"
	"fmt"

	"example.com/hello/internal/user"
)

type UserGetter interface {
	Get(ctx context.Context, id int) (*user.User, error)
}

type Service struct{ users UserGetter }

func New(u UserGetter) *Service { return &Service{users: u} }

func (s *Service) Name(ctx context.Context, id int) (string, error) {
	u, err := s.users.Get(ctx, id)
	if err != nil {
		return "", fmt.Errorf("service.Name(%d): %w", id, err)
	}
	return u.Name, nil
}
```
```go
// internal/user/user.go
package user

type User struct {
	ID   int
	Name string
}
```
```go
// internal/store/store.go
package store

import (
	"context"
	"errors"

	"example.com/hello/internal/user"
)

var ErrNotFound = errors.New("user not found")

type Store struct{ data map[int]*user.User }

func New() *Store { return &Store{data: map[int]*user.User{1: {ID: 1, Name: "ada"}}} }

func (s *Store) Get(_ context.Context, id int) (*user.User, error) {
	u, ok := s.data[id]
	if !ok {
		return nil, ErrNotFound
	}
	return u, nil
}
```
```go
// cmd/server/main.go
package main

import (
	"context"
	"errors"
	"fmt"

	"example.com/hello/internal/service"
	"example.com/hello/internal/store"
)

func main() {
	svc := service.New(store.New())
	fmt.Println(svc.Name(context.Background(), 1)) // ada <nil>
	_, err := svc.Name(context.Background(), 9)
	fmt.Println(errors.Is(err, store.ErrNotFound)) // true
}
```
:::

#### 步骤 2.4 接口里的 nil 不是 nil

接口值由「动态类型 + 动态值」两半组成。只有两半都为 nil，接口才等于 nil。`var e *NotFoundError` 的 `e` 是 nil 指针，但一旦赋给 `error`，动态类型变成 `*NotFoundError`，接口本身就不再是 nil。

现象：函数签名是 `func lookup(id int) error`，内部 `var e *NotFoundError; return e`。调用方 `if err != nil` 成立，日志却打印 `<nil>`；如果 `Error()` 方法里读了 `e.ID`，直接 panic。Java 不会出现这种情况，因为 Java 的 null 就是 null；Go 的接口是盒子，装了「类型为 T 的 nil」就不再是空盒子。

修复只有两种：没有错误时显式 `return nil`；或者不要「先声明具体错误指针、最后统一 return」，每个分支直接返回。`errors.As` 能匹配到这种值，但取出来仍要判空——它解决的是类型提取，不是空值判断。

排查时用 `%T` 打印动态类型：`fmt.Printf("%T %v\n", err, err)` 会输出 `*main.NotFoundError <nil>`，一眼就能看出「盒子不空、值是 nil」。如果 `err` 真的是 nil 接口，`%T` 输出的是 `<nil>`，两者很好区分。

标准库有时故意让 nil 接收者可用（比如 `(*bytes.Buffer)(nil)` 调 `Len` 返回 0），那是实现者显式处理了 nil；你自己写的错误类型不要指望这一点，`Error()` 里解引用 nil 指针就是一次 panic。

```go
type NotFoundError struct{ ID int }

func (e *NotFoundError) Error() string {
	return fmt.Sprintf("user %d not found", e.ID)
}

func lookup(id int) error {
	var e *NotFoundError
	if id <= 0 {
		e = &NotFoundError{ID: id}
	}
	return e // id > 0 时：装了 nil 指针的非 nil 接口
}
```

:::hint 判 nil 前先问「盒子里有没有类型」
`err != nil` 只说明盒子不是空的；如果盒子里的类型是 `*T`、值是 nil，它照样不是 nil 接口。
:::

:::solution 修复后的写法
```go
func lookup(id int) error {
	if id <= 0 {
		return &NotFoundError{ID: id}
	}
	return nil
}

func main() {
	fmt.Println(lookup(1) == nil) // true
	fmt.Println(lookup(0) == nil) // false
}
```
:::

:::error 三类报错
```text
./main.go:23:24: cannot use cw (variable of type CountingWriter) as io.Writer
	value in argument to io.MultiWriter: CountingWriter does not implement
	io.Writer (method Write has pointer receiver)
```
根因：`Write` 是指针接收者，值类型的方法集里没有它。修复：传 `&cw`，或把接收者改成值（但那样就改不到计数器）。

```text
panic: errors: target must be a non-nil pointer to either a type that implements error, or to any interface type
```
根因：`errors.As(err, qe)` 传了值而不是 `&qe`。修复：`var qe *QueryError; errors.As(err, &qe)`。

```text
import cycle not allowed
package example.com/hello/internal/service
	imports example.com/hello/internal/store
	imports example.com/hello/internal/service
```
根因：两个包互相 import。修复：把接口挪到使用方（本例是 service），让 store 只依赖数据类型。
:::

**自测**（合上文档回答）

1. `*CountingWriter` 满足 `io.Writer`，为什么 `CountingWriter` 值不满足？写一行编译期断言验证你的判断。
2. 把 `Find` 里的 `%w` 换成 `%v`，`errors.Is` 和 `errors.As` 分别是什么结果？为什么？
3. `lookup(1)` 在「返回 nil 指针」的版本里与 nil 比较是什么结果？两种修复方式分别是什么？

**验收**

- [ ] `go build ./...` 与 `go vet ./...` 均无输出；`go test ./...` 全绿
- [ ] 测试里断言 `errors.Is(err, ErrNotFound)` 为 true、`errors.As` 取出的 `Table == "users"`；把 `%w` 改成 `%v` 后该测试失败并打印 `Is=false`，改回后恢复
- [ ] `go list -f '{{join .Imports "\n"}}' ./internal/service` 的输出里没有 `internal/store`
- [ ] 运行步骤 2.4 的程序，`lookup(1) == nil` 输出 `true`；改回 `var e *NotFoundError; return e` 后输出 `false`

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

**本周目标**：写出「每个 goroutine 都有明确退出路径、失败能传回、取消能生效」的并发代码，并用 `-race` 与 `runtime.NumGoroutine()` 证明它。

**为什么是这些内容**：Java 里提交任务拿到 `Future`，`get()` 阻塞、`cancel()` 打断；Go 里 `go f()` 没有返回值、没有句柄、没有 interrupt，只有 channel 和 context。这一周要把「会起 goroutine」升级成「知道它什么时候结束、失败怎么传、取消怎么下去」。

第 4 周的 worker pool、`-race`、pprof 全建立在这周；第 5 周每个 HTTP 请求一个 goroutine，优雅退出就是 `Shutdown` + 在途请求；第 9 周的 GMP 调度解释的正是这些 goroutine 怎么被复用。把这周跳过，后面所有并发代码都只能靠「看起来对」上线。

不学会的后果都在线上才看得见：请求超时了后台还在跑，内存和连接慢慢涨；无缓冲 channel 少一个接收者，整个服务卡死并报 deadlock；接收方去 close，发送方 panic；`WaitGroup.Add` 写在 goroutine 里，主协程提前返回，任务全丢。这些错误在本地低并发下经常不出现，所以本周的验收都要求跑出确定性输出或报告。

本周还会建立一条排查直觉：任何「起了 goroutine」的函数，都要能回答「它在什么条件下退出」。答不上来的，先当成泄漏处理，用 `runtime.NumGoroutine()` 在调用前后对比，第 4 周再学 pprof 看栈。

#### 步骤 3.1 WaitGroup：等一组 goroutine 结束

goroutine 启动后主协程不会等它；`main` 返回，进程退出，所有 goroutine 被粗暴终止。等一组任务结束用 `sync.WaitGroup`：`Add(n)` 加计数、`Done()` 减一、`Wait()` 阻塞到零。

顺序是硬要求：`Add` 必须在 `go` 之前。若写在 goroutine 内部，主协程可能先执行到 `Wait`，此时计数还是 0，直接放行，后面的任务全丢。`defer wg.Done()` 保证函数退出时一定减一，即使中间 return 或 panic（panic 仍会让进程崩，但测试里能收尾）。

共享切片时，每个 goroutine 写自己的下标是安全的：不同元素是不同内存地址；若两个 goroutine 写同一个下标，就是第 4 周 `-race` 要抓的竞争。`results` 预分配长度，避免在 goroutine 里对同一个切片 `append`。

```go
var wg sync.WaitGroup
results := make([]int, 5)

for i := 0; i < 5; i++ {
	wg.Add(1) // 必须在 go 之前
	go func(i int) {
		defer wg.Done()
		time.Sleep(time.Duration(rand.Intn(50)) * time.Millisecond)
		results[i] = i * i // 各写各的下标
	}(i)
}
wg.Wait()
```

把 `i` 作为参数传进去，是给读代码的人一个明确信号：这个 goroutine 使用的是「本轮」的值。Go 1.22 的循环变量语义已经保证每轮独立，但显式传参在旧模块里是必需的，在新模块里也不损失什么。

`results` 预分配而不是在 goroutine 里 `append`，是因为 `append` 会修改切片头：多个 goroutine 同时 `append` 同一个切片，即使底层数组最终会重新分配，读写 `len/cap` 本身也没有同步，`-race` 一定报。预分配后各写各的下标，连锁都不需要。`WaitGroup` 可以复用，但必须等上一轮 `Wait` 返回之后再 `Add`，否则两批任务会混在一起计数。

:::hint WaitGroup 的三个动作
`Add` 在 `go` 之前、`Done` 用 `defer`、`Wait` 在最后；三者顺序错一个，表现分别是「提前返回」「负数计数 panic」「永久阻塞」。
:::

:::solution 可运行程序
```go
package main

import (
	"fmt"
	"math/rand"
	"sync"
	"time"
)

func main() {
	var wg sync.WaitGroup
	results := make([]int, 5)

	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			time.Sleep(time.Duration(rand.Intn(50)) * time.Millisecond)
			results[i] = i * i
		}(i)
	}
	wg.Wait()
	fmt.Println(results) // [0 1 4 9 16]
}
```
:::

#### 步骤 3.2 channel、select 与 close

无缓冲 channel 的发送会阻塞，直到有接收者准备好；这是握手，不是排队。有缓冲 channel 在缓冲未满时不阻塞，满了才阻塞。这个差别决定「生产者会不会拖住消费者」：无缓冲适合「交棒」，有缓冲适合「削峰」。

`close` 的规则只有一条：由发送方关闭，且只关一次。接收方用 `v, ok := <-ch`，关闭后 `ok` 为 false、`v` 是零值；`for v := range ch` 在关闭后自动结束。向已关闭的 channel 发送会 panic；关闭 nil channel 也 panic；重复关闭 panic。接收方不要 close，因为你不知道还有没有别的发送者。

`select` 同时等多个 case，哪个就绪走哪个；多个同时就绪时随机选。`time.After` 每次调用创建一个定时器，放在 `for` 里会一直积累到触发为止；本例只等一次，放在循环外即可。

```go
jobs := make(chan int)      // 无缓冲：发送方等到有人接
out := make(chan int, 10)   // 有缓冲：最多囤 10 个

go func() {
	defer close(jobs)       // 发送方负责关
	for i := 0; i < 5; i++ {
		jobs <- i
	}
}()

go func() {
	defer close(out)
	for j := range jobs {   // 收到 close 后退出
		out <- j * 2
	}
}()

timeout := time.After(2 * time.Second)
for {
	select {
	case v, ok := <-out:
		if !ok {
			return
		}
		fmt.Println(v)
	case <-timeout:
		fmt.Println("超时")
		return
	}
}
```

注意 `out` 由消费者关闭：它既是 `jobs` 的接收方，又是 `out` 的发送方。所有权沿着数据流转移，每一段 channel 只有一个发送方负责关闭，这是避免「重复 close」最省心的纪律。

还有个诊断技巧：nil channel 上的收发会永久阻塞。这个特性在 `select` 里是工具——把某个 case 的 channel 置为 nil，就能临时禁用这一路，而不必写一堆 if。缓冲大小则要看消费速度：缓冲太大只是把内存当队列，并不能提高吞吐，反而让背压来得更晚。

`select` 里如果没有 `default`，它就一直等到某个 case 就绪；有 `default` 则变成非阻塞轮询，常常配 `for` 做「尽力而为」的发送。两种写法都没有错，区别是「愿不愿意等」，写之前先想清楚。

只传递信号、不传数据时用 `chan struct{}`：零内存、语义清楚。`done := make(chan struct{})`，发送方 `close(done)`，所有接收方立刻解除阻塞——比发一个值再要求对方读走更可靠，因为 close 是一对多的广播。

:::hint 谁发送谁关闭
接收方永远不要 close；关闭后接收会立刻返回零值和 false，而发送会 panic。
:::

:::solution 可运行程序
```go
package main

import (
	"fmt"
	"time"
)

func main() {
	jobs := make(chan int)
	out := make(chan int, 10)

	go func() {
		defer close(jobs)
		for i := 0; i < 5; i++ {
			jobs <- i
		}
	}()

	go func() {
		defer close(out)
		for j := range jobs {
			out <- j * 2
		}
	}()

	timeout := time.After(2 * time.Second)
	for {
		select {
		case v, ok := <-out:
			if !ok {
				return
			}
			fmt.Println(v) // 0 2 4 6 8
		case <-timeout:
			fmt.Println("超时")
			return
		}
	}
}
```
:::

#### 步骤 3.3 context：超时、取消、向下传递

`context` 是一棵取消树：父 ctx 取消，所有子 ctx 的 `Done()` 关闭。`WithTimeout` 到点自动取消，`WithCancel` 由你手动取消；`ctx.Err()` 返回 `context.Canceled` 或 `context.DeadlineExceeded`。

超时是协作式的：被调函数必须 `select ctx.Done()` 或把 ctx 传给下游（`http.NewRequestWithContext`、`QueryContext`），否则到点也不会停。`defer cancel()` 一定要写，即使函数正常返回——它释放定时器和子节点，否则父 ctx 活多久它活多久。

约定：ctx 作为第一个参数、命名 `ctx`；不要存进结构体；不要传 nil，用 `context.TODO()`。区分两种错误用 `errors.Is`：主动取消是 `Canceled`，到点是 `DeadlineExceeded`，不要比字符串。`WithDeadline` 接受绝对时间，适合「整条链路共用一个截止点」；`WithTimeout` 只是它的相对写法。

```go
func slowQuery(ctx context.Context, d time.Duration) (string, error) {
	select {
	case <-time.After(d):
		return "done", nil
	case <-ctx.Done():
		return "", fmt.Errorf("slowQuery: %w", ctx.Err())
	}
}

ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
defer cancel()

_, err := slowQuery(ctx, time.Second)
fmt.Println(err)                                       // slowQuery: context deadline exceeded
fmt.Println(errors.Is(err, context.DeadlineExceeded))  // true
```

用 `%w` 包住 `ctx.Err()`，上层才能用 `errors.Is` 判断；直接返回 `errors.New(ctx.Err().Error())` 会造出一个新错误，链断在这里。

服务端代码里，`r.Context()` 就是这次请求的 ctx：请求断开或超时，它会自动取消，你只要把它继续往下传。不要把业务参数塞进 `context.WithValue`——那是给请求域的元数据（request id、调用链 id）用的，键还要用自定义类型避免冲突；业务参数走函数参数，类型安全、也看得见。

:::hint ctx 不传下去，超时就只是「你以为超时了」
取消信号不会自己飞进函数体；不 select `ctx.Done()`、不把 ctx 交给下游的代码，到点照样跑完。
:::

:::solution 可运行程序
```go
package main

import (
	"context"
	"errors"
	"fmt"
	"time"
)

func slowQuery(ctx context.Context, d time.Duration) (string, error) {
	select {
	case <-time.After(d):
		return "done", nil
	case <-ctx.Done():
		return "", fmt.Errorf("slowQuery: %w", ctx.Err())
	}
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	_, err := slowQuery(ctx, time.Second)
	fmt.Println(err)
	fmt.Println(errors.Is(err, context.DeadlineExceeded))
}
```
:::

#### 步骤 3.4 第一个错误就取消全体

`WaitGroup` 只会等，不会告诉你谁失败了。多个请求并发时，通常要「第一个错误就取消其余」。用 `WithCancel` 派生 ctx：谁先失败谁 `cancel()`，其他 goroutine 的 `select` 立刻收到 `ctx.Done()`。

错误通道用 `make(chan error, 1)`，并且用 `select { case errCh <- err: ... default: }` 发送：缓冲 1 保证第一个错误一定放得下，`default` 保证后来的错误不阻塞。若用无缓冲通道且此刻没有接收者，失败的 goroutine 会永远卡在发送上——这就是泄漏。

`wg.Wait()` 之后 `close(errCh)`，再 `<-errCh`：成功时通道为空且已关闭，返回 nil。真实项目里这段就是 `golang.org/x/sync/errgroup` 的 `errgroup.WithContext`；手写一遍是为了看清它的三个零件：派生 ctx、错误通道、WaitGroup。

```go
func fetchAll(ctx context.Context, urls []string) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var wg sync.WaitGroup
	errCh := make(chan error, 1)
	for _, u := range urls {
		wg.Add(1)
		go func(u string) {
			defer wg.Done()
			if err := fetch(ctx, u); err != nil {
				select {
				case errCh <- fmt.Errorf("fetch %s: %w", u, err):
					cancel() // 第一个错误：取消其余
				default:
				}
			}
		}(u)
	}
	wg.Wait()
	close(errCh)
	return <-errCh
}
```

`defer cancel()` 在函数返回时兜底释放子 ctx；即使所有请求都成功，也要取消，否则这个 ctx 会挂在父节点上直到父节点结束。

这段代码只返回「第一个错误」，因为它假设后续错误多半是取消导致的、对定位没用。如果你需要知道全部失败，就把 `errCh` 做成带缓冲的切片收集，最后用 `errors.Join` 合成一个；但别在错误通道上无限缓冲，失败数量本身也要有上限。

:::hint 缓冲 1 + default
第一个错误胜出且不阻塞后来者；去掉缓冲，失败的 goroutine 可能永远等在发送上，`wg.Wait()` 也就永远不返回。
:::

:::solution 可运行程序
```go
package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"sync"
)

func fetch(ctx context.Context, u string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, err = io.Copy(io.Discard, resp.Body)
	return err
}

func fetchAll(ctx context.Context, urls []string) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var wg sync.WaitGroup
	errCh := make(chan error, 1)
	for _, u := range urls {
		wg.Add(1)
		go func(u string) {
			defer wg.Done()
			if err := fetch(ctx, u); err != nil {
				select {
				case errCh <- fmt.Errorf("fetch %s: %w", u, err):
					cancel()
				default:
				}
			}
		}(u)
	}
	wg.Wait()
	close(errCh)
	return <-errCh
}

func main() {
	err := fetchAll(context.Background(), []string{
		"http://127.0.0.1:1/a", // 必然失败
		"http://127.0.0.1:1/b",
	})
	fmt.Println(err)
}
```
:::

:::error 三个高频报错
```text
fatal error: all goroutines are asleep - deadlock!
```
根因：所有 goroutine 都在等一个永远不会发生的事件。看它最后打印的栈：`chan send` 说明没人接收，`chan receive` 说明没人发送。修复：发送方是否忘了 `go`、close 是否由接收方误调、`Wait` 是否早于 `Add`。

```text
panic: send on closed channel
```
根因：发送方 close 之后还有别的 goroutine 在发，或接收方抢着 close 了。修复：只让唯一的发送方 close，并确保 close 发生在所有发送之后。

```text
panic: sync: negative WaitGroup counter
```
根因：`Done()` 调用次数多于 `Add()`，常见于把 `defer wg.Done()` 放在不该放的循环里。修复：每个 goroutine 恰好一次 `Add(1)` 配一次 `Done()`。
:::

**自测**（合上文档回答）

1. 无缓冲 channel 的发送在什么条件下返回？有缓冲的呢？「握手」和「排队」分别指哪种？
2. `close(ch)` 之后，接收方 `v, ok := <-ch` 的 `v`、`ok` 各是什么？向已关闭的 channel 发送、重复 close 分别会怎样？
3. `WaitGroup.Add` 为什么不能写进 goroutine？步骤 3.4 的错误通道为什么要缓冲 1 并用 `default` 发送？

**验收**

- [ ] `go run -race main.go` 跑步骤 3.1，输出 `[0 1 4 9 16]`，且没有 `WARNING: DATA RACE`
- [ ] 步骤 3.2 依次输出 `0 2 4 6 8` 后正常退出，退出码为 0，不出现 deadlock
- [ ] 步骤 3.3 第一行是 `slowQuery: context deadline exceeded`，第二行是 `true`
- [ ] 步骤 3.4 传入两个必然失败的地址，`fetchAll` 在 2 秒内返回带 `fetch ...` 的错误；在调用前后打印 `runtime.NumGoroutine()`，连续跑 10 次数值不持续增长（没有每次泄漏一个 goroutine）

---

### 第 4 周：并发模式与竞态

**本周目标**：在 3 秒超时内用固定 5 个 worker 跑完 100 个任务，用 `go test -race` 复现并修掉一处竞争，并从 pprof 里指出泄漏 goroutine 的阻塞点。

**为什么是这些内容**

第 3 周你学会了起 goroutine、用 channel 传值、用 context 取消，但那只是「能并发」，还不是「敢上线」。真实服务里的并发问题集中在三处：并发度没有上限，把数据库或第三方接口打挂；共享状态没有同步，测试偶尔过一次、线上偶发崩溃；goroutine 泄漏，几天后内存和文件描述符一起耗尽。它们分别对应 worker pool、`-race`、pprof，也正好是第 9 周运行时分析和第 5 周服务化的地基。顺序上先限流、再正确性、再泄漏，最后补共享状态的锁与所有权取舍，是从「能跑」到「能证明它不会出事」的最短路径。跳过这一周，第 5 周的优雅退出会写不出来——你不知道在途请求到底是谁；第 8 周压测也解释不了 QPS 为什么上不去。另一个容易被忽略的点是：这周的产出不是「写对一次」，而是「有一套能反复证明它对的方法」。

#### 步骤 4.1 worker pool：限并发

worker pool 只有三个部件：`jobs` 是任务队列，固定数量的 worker 从里面取，`results` 收集返回值。并发度等于 worker 数，与任务总数无关，这就是它和「一个任务一个 goroutine」的本质区别。`jobs` 用无缓冲 channel 时，生产者会阻塞到有 worker 接手，天然形成背压；用带缓冲 channel 则允许生产快于消费，缓冲大小就是你允许积压多少任务。缓冲不是越大越好：队列长期堆满只说明下游处理不过来，积压越多，超时后丢掉的任务越多；无缓冲则把压力直接传回生产者，适合「生产速度必须被下游节流」的场景。100 个任务、5 个 worker、整体 3 秒超时，做法是派生一个带超时的 ctx，让 worker 的取任务、交结果两个 `select` 都监听 `ctx.Done()`；时间一到，所有 worker 从阻塞点醒来退出。

这里有两个必须记住的顺序。第一，`close(jobs)` 由发送方在生产者 goroutine 里 `defer`，接收方只判断 `ok`；第二，`wg.Wait()` 必须排在 `close(results)` 之前，否则最后一个 worker 还在往 results 写，主协程已经把 channel 关了，直接 `panic: send on closed channel`。反过来，如果把 `results` 改成无缓冲，5 个 worker 会在发送处全部阻塞，主协程又在 `wg.Wait()` 上等它们结束，谁也动不了，运行时会报 `fatal error: all goroutines are asleep - deadlock!`。这两个坑一个来自关闭时机，一个来自缓冲容量，都是面试里说不清、线上会要命的地方。

逐行看：外层 `select` 同时等取消和任务，内层 `select` 同时等结果可写和取消；`results` 容量取 `len(tasks)`，保证 worker 永远不会因为没人读而卡住；生产者也在 `select` 里发送，超时后能退出并关闭 jobs。`time.Sleep(10*time.Millisecond)` 只是模拟一次下游调用，让 100 个任务真的分五批跑完。

:::hint 一句话点破
worker 数决定并发上限，results 的缓冲决定「消费者会不会被自己堵死」，`Wait` 与 `close` 的先后决定会不会 panic。三者任一写反，程序不是死锁就是崩。
:::

:::solution 参考实现
```go
package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

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
					time.Sleep(10 * time.Millisecond) // 模拟下游调用
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

func main() {
	tasks := make([]int, 100)
	for i := range tasks {
		tasks[i] = i + 1
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	start := time.Now()
	out := pool(ctx, tasks, 5)
	fmt.Println(len(out), time.Since(start) < 3*time.Second) // 100 true
}
```
:::

#### 步骤 4.2 数据竞争：用 -race 抓住它

`counter++` 在机器层面是「读、加一、写回」三条指令，两个 goroutine 交错执行时，后写的会覆盖先写的，1000 次加完可能只剩 1998。更麻烦的是，Go 的内存模型不保证没有同步的读写能看到对方的结果，所以「这次跑出 2000」什么也证明不了。`-race` 用 happens-before 关系做动态插桩：只要两个 goroutine 访问同一块内存、其中至少一个是写、且中间没有同步事件，它就报 `WARNING: DATA RACE`，哪怕这次执行恰好没丢更新。

修法有三种，选哪种取决于你要保护什么。单个计数器用 `sync/atomic`，`AddInt64` 一条指令完成读改写；多个字段要一起满足的不变量用 `sync.Mutex`，把「检查 + 修改」放进同一个临界区；所有权本来就可以转移的场景用 channel，让同一时刻只有一个 goroutine 持有数据。不要用 atomic 拼复合逻辑——「先 Load 判断再 Add」中间仍然可以被插队。

跑 `go test -race ./...` 或 `go run -race main.go` 都行。报告里会写 `Write at 0x... by goroutine 7` 和 `Previous read at 0x... by goroutine 8`，这两个栈就是冲突双方；goroutine 编号是本次运行的临时编号，不要拿它当稳定标识。代价是 5–10 倍变慢和更高内存，所以只在测试和预发开。Go 1.19 起可以用 `atomic.Int64` 类型，`var n atomic.Int64; n.Add(1)` 比函数式写法更不容易把指针传错；如果坚持用裸 `int64` 字段，在 32 位平台上要保证 64 位对齐，否则原子操作会 panic，`atomic.Int64` 自带对齐保证，优先用它。

:::hint 为什么结果对也可能有竞争
`-race` 检查的是同步关系，不是结果对不对。两个 goroutine 之间没有 happens-before 边，即使这次输出正确，下一次就可能错；把 `-race` 当并发测试的默认开关，而不是出事后的补救。
:::

:::solution 参考实现
```go
package main

import (
	"fmt"
	"sync"
	"sync/atomic"
)

func main() {
	var counter int64
	var wg sync.WaitGroup

	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 1000; j++ {
				atomic.AddInt64(&counter, 1) // 改成 counter++ 就会被 -race 抓到
			}
		}()
	}
	wg.Wait()
	fmt.Println(atomic.LoadInt64(&counter)) // 2000
}
```
:::

:::error 竞争报告怎么读
```text
==================
WARNING: DATA RACE
Write at 0x00c00001a0e8 by goroutine 7:
  main.main.func1()
      /app/main.go:12 +0x44
Previous read at 0x00c00001a0e8 by goroutine 8:
  main.main.func2()
      /app/main.go:20 +0x38
==================
```
**根因**：两处访问之间没有同步边，且至少一处是写。**修复**：计数用 `atomic.AddInt64`；一组字段用同一把 `Mutex`；或者改成 channel 传递所有权。改完重跑 `-race`，直到报告消失。注意报告可能只抓到一次交错，修完要重复跑几轮，别用「这次没报」当结论。
:::

#### 步骤 4.3 goroutine 泄漏与 pprof

泄漏的定义很窄：goroutine 永久停在某个阻塞点，而且再也没有外部事件能唤醒它。常见形态只有四种——向一个永远没人接收的 channel 发送、从一个永远没人发送的 channel 接收、`select` 只监听业务 channel 不监听 `ctx.Done()`、`WaitGroup` 的 `Add` 多于 `Done`。它们的共同点是栈里会留下 `chan send`、`chan receive`、`select` 或 `semacquire` 这样的阻塞点。

`runtime.NumGoroutine()` 适合做前后差值和时间序列：请求前后差 1，重复一万次就是一万。但它只给数量，不给位置。定位要靠 `net/http/pprof` 的 `/debug/pprof/goroutine?debug=2`：`debug=1` 是聚合后的栈（同一栈合并计数），`debug=2` 是每个 goroutine 的完整栈，能直接看到它卡在哪一行、等的是哪个 channel。生产上把这个端口只监听 `127.0.0.1`，通过跳板机或内网访问，不要暴露公网。

修法不是「加个超时」就完事，而是给这个 goroutine 一个明确的生命周期归属：要么保证有接收方并在结束时关闭 channel，要么让发送和接收都监听同一个 ctx，要么干脆不要为每个请求起一个没有回收路径的 goroutine。压测时观察 `NumGoroutine` 曲线是否在流量回落后回到基线，是最便宜的回归手段。把它做成测试也很简单：同一用例连跑十次，每次结束都断言 goroutine 数回到启动时的值，泄漏就进不了主干。

:::hint 泄漏的 goroutine 不会自己消失
它不占 CPU，所以监控看不出来；它占的是栈内存和它引用的对象。一个请求漏一个，几万 QPS 下几分钟就是几十万个 goroutine。看到 `NumGoroutine` 只涨不落，先去 pprof 看栈，不要先加内存。
:::

:::solution 参考实现
```go
package main

import (
	"fmt"
	"runtime"
	"time"
)

func main() {
	before := runtime.NumGoroutine()
	ch := make(chan int)    // 无缓冲、没人读
	go func() { ch <- 1 }() // 永远阻塞在这
	time.Sleep(100 * time.Millisecond)
	fmt.Println("leaked:", runtime.NumGoroutine()-before) // 1
}
```
```go
package main

import (
	"log"
	"net/http"
	_ "net/http/pprof"
	"time"
)

func main() {
	go func() {
		log.Println("pprof: http://127.0.0.1:6060/debug/pprof/")
		log.Fatal(http.ListenAndServe("127.0.0.1:6060", nil))
	}()

	ch := make(chan int)
	go func() { ch <- 1 }() // 制造一个泄漏，方便观察

	time.Sleep(time.Hour)
}
```
```bash
curl -s 'http://127.0.0.1:6060/debug/pprof/goroutine?debug=2' | grep -A3 'chan send'
```
:::

#### 步骤 4.4 共享 map：Mutex 还是 channel

map 是这周最容易踩的共享状态，因为「只写一个键」看起来很短。两个 goroutine 同时写同一个 map，运行时直接 `fatal error: concurrent map writes`——这是运行时主动终止进程，不是 panic，`recover` 抓不到。即使没崩，并发读写也可能读到写了一半的桶。`-race` 通常会在崩溃之前先给出 `WARNING: DATA RACE`。

三种方案按优先级：第一，能不让共享就不共享——每个 goroutine 写自己的局部结果，最后用 channel 或切片下标汇总，所有权清晰就不需要锁；第二，必须共享时用 `sync.Mutex` 包住所有访问，临界区里只做内存操作，不要发 HTTP、不要写日志、不要回调外部代码；第三，读远多于写、键集合基本固定时可以考虑 `sync.RWMutex` 或 `sync.Map`。`RWMutex` 的 `RLock` 不是免费的，临界区只有几纳秒时它可能比 `Mutex` 更慢，用 benchmark 说话。`sync.Map` 没有 `Len`，遍历用 `Range`，键值都是 `any`，只适合「每个键写一次、之后大量读」的缓存或注册表，不要当默认 map 用。

锁和 channel 不是二选一：读多写少的配置表用 `RWMutex` 包一层就够，跨 goroutine 传递任务才用 channel，判断标准是「这块数据有没有明确的所有者」，而不是「哪个看起来更 Go」。计数器例子：`Inc` 和 `Get` 都先 `Lock`、`defer Unlock`。如果以后要加「读完后清零」这种复合操作，也必须放在同一把锁里，否则中间又会出现竞态。锁保护的是不变量，不是某个变量。

:::hint 锁的粒度
锁要包住「读—判断—写」的整段，而不是只包写。把 `if m[k] == 0 { m[k] = 1 }` 拆成两次加锁，等于没加。
:::

:::solution 参考实现
```go
package main

import (
	"fmt"
	"sync"
)

type Counter struct {
	mu sync.Mutex
	m  map[string]int
}

func NewCounter() *Counter { return &Counter{m: make(map[string]int)} }

func (c *Counter) Inc(k string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.m[k]++
}

func (c *Counter) Get(k string) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.m[k]
}

func main() {
	c := NewCounter()
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				c.Inc("go")
			}
		}()
	}
	wg.Wait()
	fmt.Println(c.Get("go")) // 10000
}
```
:::

**自测**（合上文档回答）

1. `results` 改成无缓冲后，为什么 5 个 worker 会全部卡在发送处，而 `wg.Wait()` 也永远不返回？
2. `-race` 报告里的 `goroutine 7`、`goroutine 8` 能用来定位业务代码吗？真正该看的是什么？
3. 什么场景适合 `sync.Map`，什么场景应该直接用 `sync.Mutex`？

**验收**

- [ ] 在单独目录跑 4.1 的 pool：100 个任务、5 个 worker，输出 `100 true`，总耗时小于 3 秒
- [ ] 把 4.2 的 `atomic.AddInt64` 换成 `counter++` 后 `go run -race .`，终端出现 `WARNING: DATA RACE`；换回后报告消失
- [ ] 运行 4.3 的泄漏示例，`runtime.NumGoroutine()` 前后差值为 1；`curl '127.0.0.1:6060/debug/pprof/goroutine?debug=2'` 能搜到 `chan send`
- [ ] 4.4 的计数器用 `go run -race .` 跑出 `10000`，且无竞争报告（每个示例放在各自目录，避免多个 `main` 冲突）

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

**本周目标**：用标准库交付一个只监听本机、三个接口可用、Ctrl+C 后 5 秒内退出的 HTTP 服务，并能说清中间件的顺序为什么这么排。

**为什么是这些内容**

第 4 周解决「并发不出事」，第 5 周把这些能力装进一个进程。Go 的 `net/http` 本身就是生产级服务器：路由、TLS、连接池、超时都在标准库里。这一周不学框架，是因为框架的价值在生态而不在能力；把 `ServeMux`、中间件、`Shutdown` 学透，换任何框架都只是换语法。顺序也有讲究：先路由（请求怎么进来）、再中间件（横切关注点怎么复用）、再优雅退出（进程怎么死得体面）、最后超时与请求体上限（怎么不被慢连接和超大 body 拖死）。缺任何一块，第 6 周接上数据库后都会变成线上事故：没有超时，慢查询会挂住连接；没有优雅退出，发布时用户看到 502；中间件顺序错了，panic 产生的 500 连日志都记不上。还有一个现实理由：这周写的 `mux` 和 handler 会成为第 7 周 `httptest` 的被测对象，也会成为第 8 周 nginx 反代的上游；现在把边界划清，后面测试和部署都不用返工。

#### 步骤 5.1 路由与 handler（Go 1.22 起支持方法与路径参数）

Go 1.22 的 `ServeMux` 支持 `METHOD /path/{param}` 模式。匹配按「最具体」优先：字面量路径压过通配符，带方法的压过不带方法的；注册冲突在 `Handle` 时直接 panic，启动即暴露，比运行时 404 好。`r.PathValue("id")` 取参数，`{id}` 只匹配一个非空路径段，所以 `/api/assets/1/2` 是 404，而不是把 `1/2` 当 id——想匹配剩余全部路径，用 `{path...}` 通配。方法不匹配时 `ServeMux` 自动回 405 并带 `Allow` 头，不用自己写。

写 handler 的纪律：先设置头，再 `WriteHeader`，最后写 body；错误分支写完就 `return`，否则会二次写 header。POST 解码用 `json.NewDecoder(r.Body)`，不要 `io.ReadAll` 再 `Unmarshal`——前者边读边解析，后者先把整个 body 堆进内存，给攻击者留了把内存打满的口子（真正的上限在 5.4 用 `MaxBytesReader` 加）。

`mux` 本身实现了 `http.Handler`，所以它能被中间件包、能被 `httptest` 直接调用，不需要真的监听端口——这是第 7 周测试能写起来的前提。`http.HandlerFunc` 则是一个适配器，把普通函数转成带 `ServeHTTP` 方法的类型。还有两个边界值得现在记住：HEAD 请求会自动复用 GET 的 handler，但响应 body 会被丢弃；`Content-Type` 要在写 body 之前设置，写完再改无效。路径参数拿到的永远是字符串，业务上要转数字就在这里转，转失败回 400，不要带进数据库查询。

:::hint 注册顺序不影响匹配
Go 1.22 按具体度选，不按注册先后；但同一模式重复注册会在启动时 panic。把「路由是声明式的」记住，就不会去猜优先级。
:::

:::solution 参考实现
```go
package main

import (
	"encoding/json"
	"log"
	"net/http"
)

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	})

	mux.HandleFunc("GET /api/assets/{id}", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"id": r.PathValue("id")})
	})

	mux.HandleFunc("POST /api/assets", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
			return
		}
		if body.Name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name required"})
			return
		}
		writeJSON(w, http.StatusCreated, body)
	})

	log.Println("listening on 127.0.0.1:8081")
	log.Fatal(http.ListenAndServe("127.0.0.1:8081", mux))
}
```
:::

```bash
curl -s 127.0.0.1:8081/healthz
curl -s 127.0.0.1:8081/api/assets/42
curl -s -X POST 127.0.0.1:8081/api/assets -d '{"name":"logo"}'
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE 127.0.0.1:8081/api/assets/42   # 405
```

#### 步骤 5.2 中间件：日志、恢复、请求 ID

中间件就是 `func(http.Handler) http.Handler`，请求从外到内穿过多层，响应从内到外返回。顺序不是审美问题，而是决定「谁能看见谁」。推荐 `withRequestID(withLogging(withRecover(mux)))`：requestID 在最外层，保证后面所有日志都能拿到同一个 rid；logging 在 recover 外面，才能把 recover 写出的 500 记进 `statusRecorder`；recover 紧贴业务 handler，因为 panic 只应该发生在业务代码里。

网上常见的「recover 必须最外层」只说对了一半：recover 确实要包住业务 handler，但如果它在 logging 外面，它写 500 时拿到的是原始 `ResponseWriter`，logging 的 recorder 根本看不到这次写。结果就是日志不可信：要么因为 panic 跳过了收尾那行而直接缺失，要么（如果 logging 用 `defer` 记日志）记成 200。把顺序换成 `withRecover(withLogging(mux))`，`/panic` 请求就会给你上这一课。

两个实现细节。第一，`statusRecorder` 包装了 `ResponseWriter`，会丢掉 `Flusher`、`Hijacker` 这些可选接口，SSE 场景要显式实现 `Flush`，或者加一个 `Unwrap() http.ResponseWriter` 让 `http.NewResponseController` 找回底层对象。第二，request ID 要同时写响应头和 context：响应头方便客户端报障，context 方便下游日志和数据库调用串起来；不要用全局变量传。context 的 key 用自定义类型 `ctxKey` 而不是字符串，是为了避免不同包用同一个字符串 key 互相覆盖，这是 Go 的惯例，不是洁癖。request ID 也不能无条件信任客户端传来的 `X-Request-ID`：内网可以透传，公网入口最好重新生成，或者只接受符合长度和字符集的值，否则日志里会出现伪造的 id，甚至被换行符注入。

日志里不要打整个 body 和 `Authorization` 头，request ID 和路径足够定位；需要排查时再按 id 去查脱敏后的样本。

另外，`statusRecorder` 的默认状态码要设为 200，因为 handler 只 `Write` 不 `WriteHeader` 时，`net/http` 隐式写的就是 200；如果默认零值 0，日志里会出现 `code=0` 这种假状态，排查时会被带偏。

:::hint 顺序由「500 是谁写的」决定
先问：panic 之后那个 500 经过谁？谁需要记录它？答案会直接告诉你 recover 必须在 logging 里面。
:::

:::solution 参考实现
```go
package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log"
	"net/http"
	"runtime/debug"
	"time"
)

type ctxKey string

const ridKey ctxKey = "rid"

type statusRecorder struct {
	http.ResponseWriter
	code int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.code = code
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusRecorder) Unwrap() http.ResponseWriter { return s.ResponseWriter }

func newID() string {
	var b [8]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

func withRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rid := r.Header.Get("X-Request-ID")
		if rid == "" {
			rid = newID()
		}
		w.Header().Set("X-Request-ID", rid)
		ctx := context.WithValue(r.Context(), ridKey, rid)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, code: http.StatusOK}
		next.ServeHTTP(rec, r)
		rid, _ := r.Context().Value(ridKey).(string)
		log.Printf("rid=%s %s %s %d %s", rid, r.Method, r.URL.Path, rec.code, time.Since(start))
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

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("GET /panic", func(w http.ResponseWriter, r *http.Request) {
		panic("boom")
	})

	handler := withRequestID(withLogging(withRecover(mux)))
	log.Println("listening on 127.0.0.1:8081")
	log.Fatal(http.ListenAndServe("127.0.0.1:8081", handler))
}
```
:::

#### 步骤 5.3 优雅退出

`Shutdown(ctx)` 做两件事：先关闭 listener，新连接被拒绝；再等待活跃连接变空闲，ctx 到期就返回 `context.DeadlineExceeded` 并强制关闭。它不会等待被 hijack 的连接（WebSocket），也不会替你取消 handler 内部起的 goroutine——那些要靠请求自己的 ctx。

正确的启动/退出骨架：先 `signal.NotifyContext` 拿信号 ctx，再在 goroutine 里 `ListenAndServe`，主 goroutine 阻塞在 `<-ctx.Done()`。`ListenAndServe` 在 Shutdown 之后一定返回 `http.ErrServerClosed`，必须用 `errors.Is` 排除，否则每次正常退出都被 `log.Fatal` 记成崩溃。拿到信号后派生一个 5 秒的 shutdownCtx，调用 `srv.Shutdown`，把返回值记下来：如果是 deadline exceeded，说明还有请求没结束，下一次要么调大超时，要么去查那个慢 handler。

不优雅退出的现象很具体：`curl` 一个正在返回大响应的请求，直接 Ctrl+C，客户端得到 `curl: (18) transfer closed with outstanding read data remaining`；用 Shutdown 后，同一请求能完整收完，进程最后打印 `bye` 再退出。`systemctl restart` 就是先发 SIGTERM，不给它时间就是用户吃 502。

还有一个容易忽略的点：`Shutdown` 只处理它自己 accept 的连接。如果你在 handler 里又起了 goroutine 去写响应，或者用了 `http.Hijacker`，那些连接不在它的等待范围里，必须自己用 context 或 WaitGroup 收口。把 `Shutdown` 放在 `defer` 里也不对——它需要先于 `db.Close` 执行，而 defer 的顺序由声明顺序决定，不如显式写在 `<-ctx.Done()` 之后。

信号在 Windows 和 Linux 上不完全一样：`os.Interrupt` 两边都有，`SIGTERM` 在 Linux 由 systemd 或容器运行时发，Windows 的控制台关闭事件则走另一套机制；本地用 Ctrl+C 验证 `os.Interrupt` 就够了，部署到 Linux 再用 `kill -TERM` 验证一次。滚动发布时更稳的做法是先从负载均衡摘掉实例，等几秒再发 SIGTERM，否则 Shutdown 刚开始时仍会有新连接打进来。

:::hint 先 Shutdown 再关数据库
Shutdown 返回后，在途请求已经结束，这时 `db.Close()` 才不会把正在用的连接抽走。第 6 周会把这两步串进同一个 `run()`。
:::

:::solution 参考实现
```go
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /slow", func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(2 * time.Second):
			_, _ = w.Write([]byte("done"))
		case <-r.Context().Done():
			log.Println("client gone:", r.Context().Err())
		}
	})

	srv := &http.Server{Addr: "127.0.0.1:8081", Handler: mux}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Println("shutdown:", err)
	}
	log.Println("bye")
}
```
:::

#### 步骤 5.4 超时与请求体上限：别让一个连接拖垮服务

`http.Server` 的零值没有超时。慢客户端可以一个字节一个字节地发 header，把连接占住，这种攻击叫 slowloris；没有 `ReadHeaderTimeout`，几百个连接就能把服务拖垮。四个超时各管一段：`ReadHeaderTimeout` 管读完请求头，`ReadTimeout` 管整个请求（含 body），`WriteTimeout` 管响应写出，`IdleTimeout` 管 keep-alive 连接的空闲时间。API 服务常用 5s / 10s / 30s / 60s，按业务调整；流式接口不能照抄。

请求体上限用 `http.MaxBytesReader(w, r.Body, 1<<20)`，超限时 Decode 返回 `*http.MaxBytesError`，用 `errors.As` 区分「太大」和「JSON 写错」，前者回 413，后者回 400。只设 `MaxBytesReader` 不设 `ReadTimeout` 还不够：攻击者可以发一个 1 字节的 body 然后挂着不动，连接照样被占。

SSE 这类长连接要单独处理：`WriteTimeout` 会在到点时切断响应，可以在 handler 里用 `http.NewResponseController(w).SetWriteDeadline(time.Time{})` 取消这一次写的期限（Go 1.20 起），或者给 SSE 单独起一个不带 `WriteTimeout` 的 Server。超时是服务端保护自己的最后一道闸，客户端 `http.Client` 的超时替代不了它。

验证 slowloris 不需要真的攻击工具：用 `curl --limit-rate 1 -H 'Content-Length: 1000000' --data-binary @big.json` 慢慢发，另开一个终端 `ss -tan state established '( sport = :8081 )'` 就能看到连接一直挂着；加上 `ReadTimeout` 后，同样的命令会在 10 秒左右被服务端断开。

`http.TimeoutHandler` 是另一种选择：它给整个 handler 一个总时限，超时后返回 503，适合「业务处理可能卡住」的场景；但它不能替代连接级超时，因为它管不到读 header 的阶段，两者可以叠加使用。`MaxBytesReader` 则要放在 Decode 之前，而且它只限制本次请求体；如果先把 body 读进内存再检查长度，限制就失效了。keep-alive 会复用连接、省掉建连开销，但 `IdleTimeout` 太长会占住文件描述符，太短会让客户端频繁重连，通常取 30–90 秒。`ReadTimeout` 包含 body，上传大文件的接口要单独放宽，不能用一个全局值卡死所有路由。

:::hint 四个超时对应四个阶段
先画出请求生命周期：连上、读头、读 body、写响应、空闲。每个阶段给一个上限，缺哪一段，攻击者就从哪一段挂住你。
:::

:::solution 参考实现
```go
srv := &http.Server{
	Addr:              "127.0.0.1:8081",
	Handler:           handler,
	ReadHeaderTimeout: 5 * time.Second,
	ReadTimeout:       10 * time.Second,
	WriteTimeout:      30 * time.Second,
	IdleTimeout:       60 * time.Second,
}
```
```go
mux.HandleFunc("POST /api/assets", func(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "body too large"})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	writeJSON(w, http.StatusCreated, body)
})
```
:::

:::error 响应头写了两次
```text
2026/10/21 12:00:00 http: superfluous response.WriteHeader call from main.main.func2 (main.go:24)
```
**根因**：handler 里已经 `writeJSON(w, 200, ...)` 之后又走到 `http.Error(w, ..., 500)`，第二次 `WriteHeader` 被忽略，客户端仍拿到 200，但状态码已经错了。**修复**：每个错误分支写完立刻 `return`；把成功响应放在所有校验之后，保证一条路径只写一次头。
:::

**自测**（合上文档回答）

1. 为什么 `GET /api/assets/{id}` 不匹配 `/api/assets/1/2`？想匹配剩余全部路径该用什么模式？
2. 中间件顺序改成 `withRecover(withLogging(mux))` 后，`/panic` 请求的日志状态码会是多少？为什么？
3. `ReadHeaderTimeout` 和 `ReadTimeout` 分别防住哪一段？SSE 为什么不能直接沿用 30 秒的 `WriteTimeout`？

**验收**

- [ ] `curl -s -o /dev/null -w '%{http_code}\n' 127.0.0.1:8081/healthz` 输出 200；`/api/assets/42` 返回 `{"id":"42"}`；POST 合法 JSON 返回 201；`DELETE /api/assets/42` 返回 405
- [ ] 访问 `/panic` 后，终端里同一 rid 的日志 `code=500`；把 recover 换到最外层后，这次请求的日志行消失（panic 跳过了 logging 的收尾），并能解释原因
- [ ] `curl -N 127.0.0.1:8081/slow` 进行中按 Ctrl+C，客户端收到 `done`，进程依次打印 `shutting down`、`bye`
- [ ] 用 Python 生成 2MB 文件 `python -c "open('big.json','wb').write(b'x'*2000000)"` 后 POST 返回 413；1KB 合法 JSON 仍返回 201

---

### 第 6 周：数据与配置

**本周目标**：把数据库接进第 5 周的服务，事务失败能整体回滚，配置从环境变量来并在启动时校验，日志是可按 `rid` 过滤的单行 JSON。

**为什么是这些内容**

第 4 周管并发、第 5 周管入口，第 6 周才碰到真正的状态。`database/sql` 是最容易被低估的包：它本身不是驱动，而是连接池加一层抽象；`Open` 不建连接、`Ping` 才建、事务要手动 `Commit` 或 `Rollback`、context 决定查询能不能被取消。这三件事写错，表现分别是「启动时不报错、第一个请求才炸」、「库存扣了订单没写」、「请求取消了 SQL 还在跑」。配置和日志放在同一周，是因为它们和数据库共享同一个失败面：DSN 错了、日志里没有 request_id，线上就只能靠猜。第 7 周的测试要用可注入的 `*sql.DB`，第 8 周的部署要靠环境变量和 JSON 日志排障，所以这周是「能上线」的最后一块拼图。顺序也按故障排查的路径排：先能连上，再保证一次操作要么全成要么全败，再让配置和日志把失败说清楚，最后装配成能启动、能关闭的 `main`。还有一个常见误区：把连接池当成缓存，以为越大越快；池超过数据库承受能力后，所有请求会一起变慢。

#### 步骤 6.1 database/sql 与连接池

`sql.Open` 返回的 `*sql.DB` 不是一条连接，而是一个连接池的句柄。驱动实现了 `DriverContext` 时，它会在 `Open` 阶段把 DSN 交给驱动解析，格式错误能当场返回，但不会真的拨号；所以 `Open` 成功不代表数据库可用，第一次查询或 `PingContext` 才真正建连。健康检查必须 `Ping`，而且要给 Ping 一个短超时（1–3 秒），否则数据库网络不通时启动会卡很久。

池参数四个：`MaxOpenConns` 是同时打开的硬上限，0 表示不限；`MaxIdleConns` 是回收后保留的空闲连接数，默认只有 2；`ConnMaxLifetime` 限制一条连接的总寿命，应该小于 MySQL 的 `wait_timeout`（默认 8 小时），否则会拿到被服务端单方面关掉的连接，报 `invalid connection`；`ConnMaxIdleTime` 限制空闲多久后关闭。经验值是 `MaxOpenConns` 约等于 `max_connections` 除以实例数，再留 20% 余量给运维和迁移；`MaxIdleConns` 设成和 `MaxOpenConns` 接近，避免流量抖动时反复建连。

现象：不设上限压测，MySQL 报 `Error 1040: Too many connections`，整库所有业务一起挂；`MaxIdleConns` 用默认值时，`show processlist` 里的连接数反复上下，P99 延迟跟着抖。DSN 里还要加驱动自己的网络超时：`timeout=3s` 管拨号，`readTimeout=5s`、`writeTimeout=5s` 管单次读写，`parseTime=true` 让 `DATETIME` 扫进 `time.Time`。这些是驱动参数，不是 `database/sql` 的池参数，写错位置不会报错，只会不生效。

不要在请求里反复 `sql.Open` 和 `Close`：`Open` 本身很轻，但每次新建池都会丢掉连接复用，压测时表现为连接数暴涨、握手耗时占满 P99。`*sql.DB` 是长期对象，一个进程一个，随进程退出而关闭。

:::hint Open 不建连，Ping 才建连
池参数保护的是数据库，不是你的 QPS。把上限设成「数据库能承受的连接数除以实例数」，而不是「越大越好」。
:::

:::solution 参考实现
```go
package main

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

func openDB(ctx context.Context, dsn string) (*sql.DB, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("open: %w", err)
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(30 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)

	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	if err := db.PingContext(pingCtx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}
	return db, nil
}
```
:::

#### 步骤 6.2 事务与 context

事务的本质是「同一个连接上的 BEGIN / COMMIT / ROLLBACK」。`db.BeginTx` 从池里取一条连接并绑定到 `*sql.Tx`，之后所有语句都必须走 `tx`；如果图省事写成 `db.ExecContext`，这条语句会从池里另取一条连接、自动提交，完全不在事务里——回滚时它不会撤销。这是最隐蔽的事务 bug，因为代码看起来「都在一个函数里」，不查库根本发现不了。

扣库存要写成条件更新：`UPDATE stock SET qty = qty - 1 WHERE id = ? AND qty > 0`，然后检查 `RowsAffected` 是否为 1。不要先 `SELECT qty` 再判断再 `UPDATE`，两个事务可能同时读到 1，然后都减，库存变成 -1；条件更新把「检查」和「修改」合成一条原子语句，InnoDB 的行锁会保证只有一个成功。`RowsAffected` 返回 0 就说明库存不足或 id 不存在，这时返回错误，`defer tx.Rollback()` 会把前面可能的修改撤销。

`defer tx.Rollback()` 在 `Commit` 成功之后调用会返回 `sql.ErrTxDone`，是安全的 no-op，所以不用在每条错误分支手写回滚。ctx 要传进 `BeginTx` 和每个 `ExecContext`：请求被取消时驱动会中断查询、关闭连接，避免一个已经没人等的长事务继续占着行锁。事务要短，绝对不要在事务里发 HTTP 请求、写日志文件或等用户输入。

默认隔离级别由驱动和数据库决定（MySQL 是 REPEATABLE READ），大多数业务够用；只有明确需要时才用 `BeginTx` 的 `sql.TxOptions` 调隔离级别或设 `ReadOnly`。高并发下死锁不是异常，是正常现象：遇到 `Error 1213: Deadlock found` 要有重试策略，重试次数和退避都要有限，别在事务里无限重试。

:::hint 事务里的每一条语句都必须用 tx
`db.Exec` 会跑出事务外，回滚救不回来。判断方法很简单：这个函数里除了 `BeginTx`，还有没有出现 `db.` 的写操作？
:::

:::solution 参考实现
```sql
CREATE TABLE stock (
  id  BIGINT PRIMARY KEY,
  qty INT NOT NULL
);
CREATE TABLE orders (
  id       BIGINT AUTO_INCREMENT PRIMARY KEY,
  sku      VARCHAR(64) NOT NULL,
  stock_id BIGINT NOT NULL
);
INSERT INTO stock (id, qty) VALUES (1, 1);
```
```go
func placeOrder(ctx context.Context, db *sql.DB, sku string, id int64) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback() // Commit 之后是 no-op

	res, err := tx.ExecContext(ctx,
		"UPDATE stock SET qty = qty - 1 WHERE id = ? AND qty > 0", id)
	if err != nil {
		return fmt.Errorf("decr stock: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows: %w", err)
	}
	if n != 1 {
		return fmt.Errorf("stock %d not enough", id)
	}

	if _, err := tx.ExecContext(ctx,
		"INSERT INTO orders (sku, stock_id) VALUES (?, ?)", sku, id); err != nil {
		return fmt.Errorf("insert order: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}
```
:::

#### 步骤 6.3 配置与结构化日志（slog）

配置的优先级通常是命令行 flag 高于环境变量、环境变量高于默认值。容器和 systemd 用环境变量最方便，本地开发用默认值最省事，敏感项（DSN、密钥）只从环境变量来，不进代码库。关键纪律是启动时一次性 `Load` 成结构体并校验：必填项为空就立刻返回错误，让进程起不来，而不是带着半截配置服务第一个请求。`os.Getenv` 不要散落在业务代码里，否则测试没法注入，改一个配置要全局搜索。

`slog` 从 Go 1.21 进标准库，`slog.NewJSONHandler(os.Stdout, nil)` 输出一行一个 JSON 对象，日志系统能按字段过滤、聚合、告警。字段是 key-value 对，key 用字符串，value 用 `any`；传入奇数个参数会得到 `!BADKEY`，这是提醒你写漏了。请求级日志把 `rid` 作为字段带上，或者用 `logger.With("rid", rid)` 预置固定字段，再在 handler 里用它；不要每次手动拼字符串。

现象：配置缺失时服务正常启动，第一个请求才报 `dial tcp: missing port in address`，排查要从业务代码往回找；文本日志 `2026/10/21 ...` 能 grep 但不能按 `rid` 聚合，出了问题只能翻整段时间的日志。敏感字段（密码、token、完整 DSN）不要进日志，需要记录时打主机名和库名就够了。

校验至少要覆盖：必填项非空、地址里的端口能解析、超时是正数。配置错误要在启动日志里说清是哪个变量，不要只打印一句 `invalid config`。日志级别可以用 `slog.LevelVar` 在运行中调整，但要有开关和审计；多数服务启动时定级就够。

:::hint 配置在启动时校验，日志字段名是契约
启动时打印一份脱敏摘要（addr、库名、池大小），运行中配置只读；日志字段名发布后不要随手改，否则告警规则和看板会一起失效。
:::

:::solution 参考实现
```go
type ctxKey string

const ridKey ctxKey = "rid"

type statusRecorder struct {
	http.ResponseWriter
	code int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.code = code
	s.ResponseWriter.WriteHeader(code)
}

type Config struct {
	Addr  string
	DBDSN string
}

func Load() (Config, error) {
	cfg := Config{
		Addr:  env("ADDR", "127.0.0.1:8081"),
		DBDSN: os.Getenv("DB_DSN"),
	}
	if cfg.DBDSN == "" {
		return Config{}, errors.New("DB_DSN is required")
	}
	return cfg, nil
}

func env(k, def string) string {
	if v, ok := os.LookupEnv(k); ok && v != "" {
		return v
	}
	return def
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, code: http.StatusOK}
		next.ServeHTTP(rec, r)
		slog.Info("http",
			"rid", r.Context().Value(ridKey),
			"method", r.Method,
			"path", r.URL.Path,
			"code", rec.code,
			"dur_ms", time.Since(start).Milliseconds(),
		)
	})
}

func main() {
	cfg, err := Load()
	if err != nil {
		log.Fatal(err)
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)
	logger.Info("server start", "addr", cfg.Addr)
}
```
:::

#### 步骤 6.4 装配 main：启动顺序与关闭顺序

启动顺序是自下而上：先 `Load` 配置（失败立刻退出），再初始化 logger，再 `openDB`（Ping 失败就退出），再构造 store/service，再注册路由，最后 `ListenAndServe`。任何一步失败都 `return err`，由 `main` 统一 `log.Fatal`，不要带着半初始化状态对外服务。监听失败也要能传回主 goroutine：只在 goroutine 里 `logger.Error` 然后什么都不做，进程会假装活着，健康检查却全部拒绝。把装配写进 `run() error` 而不是全塞 `main`，是为了让测试能只测其中一段，也为了让 `defer` 的关闭顺序更清楚。下面的 `run` 依赖 6.1 的 `openDB`、6.3 的 `Load`，以及第 5 周的 `writeJSON` 和三个中间件，放进同一个 `main` 包即可运行。

关闭顺序和启动相反，自上而下：先 `srv.Shutdown`（不再接新请求，等在途请求把数据库用完），再 `db.Close`。由于 `defer` 是后进先出，`defer db.Close()` 要写在 `srv.Shutdown` 之前，这样它会在 `run` 返回时才执行，晚于 Shutdown。反过来先关数据库，滚动发布时日志里会出现 `sql: database is closed`，客户端拿到 500，而你以为是数据库挂了。

健康检查要分两种：liveness 只证明进程还在，返回 200 即可；readiness 检查依赖，Ping 数据库失败就回 503。不要把 readiness 做成每次请求都跑重查询，也不要把 liveness 做成依赖数据库——数据库抖一下，编排系统会把所有实例重启一遍，反而放大故障。`/healthz` 里给 Ping 一个 1 秒超时，超时就回 503，这是最小可用的 readiness。发布时还有一层顺序：先从负载均衡摘掉实例，等 readiness 变成 503，再发 SIGTERM，最后才 Shutdown；这样新请求不会在关闭过程中进来，5 秒的等待才够用。

:::hint 启动自下而上，关闭自上而下
`main` 只做装配，不写业务；所有资源按「后创建先关闭」的顺序用 `defer` 排队，顺序就自然对了。
:::

:::solution 参考实现
```go
func run() error {
	cfg, err := Load()
	if err != nil {
		return err
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := openDB(ctx, cfg.DBDSN)
	if err != nil {
		return err
	}
	defer db.Close() // run 返回时才执行，晚于下面的 Shutdown

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		pingCtx, cancel := context.WithTimeout(r.Context(), time.Second)
		defer cancel()
		if err := db.PingContext(pingCtx); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"db": "down"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"db": "ok"})
	})

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           withRequestID(withLogging(withRecover(mux))),
		ReadHeaderTimeout: 5 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		logger.Info("shutting down")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown", "err", err)
	}
	return nil
}

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}
```
:::

:::error 连不上数据库的两个不同错误
```text
Error 1045 (28000): Access denied for user 'app'@'localhost' (using password: YES)
```
**根因**：账号、密码或授权主机不对。`'app'@'localhost'` 和 `'app'@'%'` 在 MySQL 里是两条独立授权，从 127.0.0.1 连不一定命中 `localhost`。**修复**：用同一账号在命令行 `mysql -h 127.0.0.1 -u app -p` 复现，再核对 `SHOW GRANTS FOR 'app'@'%'`。

```text
dial tcp 127.0.0.1:3306: connect: connection refused
```
**根因**：网络、端口或服务没起，不是密码问题。**修复**：先 `nc -z 127.0.0.1 3306`，再 `systemctl status mysql`；容器里还要确认端口有没有映射到宿主机。
:::

**自测**（合上文档回答）

1. `sql.Open` 返回 nil error，是否说明数据库已经可用？为什么？
2. 事务里误用 `db.ExecContext` 而不是 `tx.ExecContext`，回滚后会发生什么？
3. 为什么关闭顺序必须是先 `srv.Shutdown` 再 `db.Close`？反过来会看到什么错误？

**验收**

- [ ] 在 MySQL 里执行 6.2 的建表语句后，写一个调用 `placeOrder` 两次的 `main`（库存 1），第二次返回 `stock 1 not enough`，`SELECT qty FROM stock WHERE id=1` 为 0，`orders` 只有 1 行
- [ ] 把 INSERT 的表名临时改成不存在的 `orders_x` 调用一次，函数返回错误，`qty` 仍为 1，订单数为 0（证明回滚生效）
- [ ] 不设 `DB_DSN` 启动，进程立即退出并打印 `DB_DSN is required`
- [ ] `curl -s 127.0.0.1:8081/healthz` 返回 `{"db":"ok"}`；停掉 MySQL 后返回 503 和 `{"db":"down"}`
- [ ] 日志是单行 JSON，`grep '"rid":"<同一个值>"'` 能定位该请求的 `http` 记录，`code` 与 `dur_ms` 是能被 `jq` 过滤的字段

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

**本周目标**：用表驱动 + `httptest` 覆盖 `/api/assets/{id}` 的 200 / 400 / 404 / 500 四条分支，用 `-benchmem` 给出 `+=` 与 `strings.Builder` 两组可比的 `ns/op`，并用 `pprof` 指出一个热点函数。

**为什么是这些内容**：第 5 周的 handler 只能靠 `curl` 验，第 6 周加了数据库之后连 `curl` 都要先造数据；第 8 周你要把二进制拷到服务器上，那时没有断点、没有热重载，坏了只能翻日志。中间缺的那一层就是测试——它把「我看着对」换成「跑一遍就知道」。

Go 把测试做进了工具链：`xxx_test.go` 加 `go test`，不需要 JUnit、不需要 Mock 框架、不需要配插件。表驱动是 Go 社区的事实标准：语言没有注解、没有参数化测试，一行一个 case 就是最便宜的参数化，加场景只加一行，失败信息里还带着 case 名。`httptest` 让你不起端口就能打到 HTTP 层——这才可能让测试在 CI 里几秒跑完、还能并行。

性能同理。第 9 周要调 `GOGC`、要解释 GC 停顿，前提是手上有一组能对比的数字；`ns/op`、`B/op`、`allocs/op` 就是这个基准。跳过这周，第 8 周的压测数字没有对照物，第 9 周的调参只能凭感觉。

不学会的后果很具体：改一个 `if` 之后没人知道 404 分支是否还活着；线上 p99 从 40ms 涨到 2s，你说不出慢在 handler、JSON 编码还是分配；`strings.Builder` 比 `+=` 快多少，你只能背结论。

还有一层更隐蔽的收益：测试是可执行的文档。半年后接手的人读 `cases` 那张表，就知道这个接口承诺了哪几种结果，比读一遍 `if` 分支更快。所以表里的 `name` 要认真起，它就是你写给人看的目录。

#### 步骤 7.1 表驱动测试 + httptest

handler 的签名是 `func(http.ResponseWriter, *http.Request)`，`ServeMux` 自己也是一个 `http.Handler`，所以测 HTTP 层不一定需要端口：给 `mux.ServeHTTP` 一个假的 `ResponseWriter` 就够了。前提是路由能单独构造——把装配抽成 `NewRouter(st Store) http.Handler`，`main` 只负责传依赖。这也是第 2 周「接口定义在使用方」的直接回报：`Store` 写在 assets 包里，测试塞一个内存实现进去。

分支要分清。`id` 不是正整数 → 400，是请求本身有问题；`id` 合法但查不到 → 404，是资源不存在；store 报别的错 → 500，是服务端坏了。三者混在一起，前端就没法区分「你传错了」和「我坏了」。

```go
var ErrNotFound = errors.New("asset not found")

type Store interface {
	Get(ctx context.Context, id int) (*Asset, error)
}

func NewRouter(st Store) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/assets/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.PathValue("id"))
		if err != nil || id <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bad id"})
			return
		}
		a, err := st.Get(r.Context(), id)
		switch {
		case errors.Is(err, ErrNotFound):
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		case err != nil:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		default:
			writeJSON(w, http.StatusOK, a)
		}
	})
	return mux
}
```

`r.PathValue("id")` 取的是 Go 1.22 路由模式里 `{id}` 那一段；`Atoi` 失败就说明客户端传了非数字。`switch` 里先判 `errors.Is` 再判 `err != nil`，顺序不能反——反了 404 会被 500 吃掉。`r.Context()` 传下去是第 3 周的约定：请求被取消时 store 能中断，而不是闷头查完再丢掉结果。

:::hint httptest 三件套
`NewRequest` 造请求（不进网络）、`NewRecorder` 造响应记录器（code / header / body 全留底）、`mux.ServeHTTP` 跑一遍。整个测试同步完成，不开端口、不占 8081。
:::

:::solution 表驱动用例
```go
type memStore map[int]*Asset

func (m memStore) Get(_ context.Context, id int) (*Asset, error) {
	if a, ok := m[id]; ok {
		return a, nil
	}
	return nil, ErrNotFound
}

func TestGetAsset(t *testing.T) {
	mux := NewRouter(memStore{1: {ID: 1, Name: "tile.png"}})
	cases := []struct {
		name string
		path string
		code int
	}{
		{"ok", "/api/assets/1", http.StatusOK},
		{"missing", "/api/assets/999", http.StatusNotFound},
		{"not-a-number", "/api/assets/abc", http.StatusBadRequest},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, c.path, nil))
			if rec.Code != c.code {
				t.Fatalf("code=%d want %d body=%s", rec.Code, c.code, rec.Body)
			}
			if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
				t.Fatalf("Content-Type=%q", ct)
			}
		})
	}
}
```
:::

`t.Run` 把每个 case 变成独立子测试，`go test -run='TestGetAsset/missing'` 能单独跑挂了的那条。`t.Fatalf` 一定要带上 `rec.Body`：失败信息里没有响应体，你就得加日志重跑一遍，而加了日志的那次往往不复现。

测试文件可以放在同一个包里，也可以放在 `assets_test` 这个外部包里。handler 这种对外契约建议放外部包——它逼你只用导出 API 验证，等于顺手检查了「这个包对外够不够用」。放同包则能碰到未导出符号，适合测纯计算的小函数。两种都合法，选哪种取决于你想让测试站在用户的位置还是维护者的位置。

顺带抓一个常见坑：`writeJSON` 必须先把 `Content-Type` `Set` 上、再 `WriteHeader`、最后 `Encode`。顺序反了，`WriteHeader` 一发出响应头就锁死，后面的 `Set` 静默失效——`curl` 里看不出任何异常，只有客户端解析 JSON 时才炸。上面那条 `Content-Type` 断言就是为这个坑写的，它比状态码断言更早发现问题。

表里没有 `""` 这个 case，是刻意的。`/api/assets/` 这种空段会不会匹配 `{id}`、会不会先被规整成重定向，属于 `ServeMux` 的路径处理行为，不是你的契约。测试钉契约，不钉框架的边角——钉了之后一次升级就可能红一片，而业务其实没变。

#### 步骤 7.2 基准测试与 pprof

`BenchmarkXxx(b *testing.B)` 的函数体要跑 `b.N` 次，`b.N` 由框架定：先给一个小值试跑，再成倍放大，直到单轮超过 `-benchtime`（默认 1s）。所以循环里只放被测代码，任何 setup（读文件、建 map、造大字符串）要么挪到循环外，要么用 `b.ResetTimer()` 把已耗时清零——否则你测的是「setup + 业务」，而 setup 占比还随 `b.N` 变化，数字完全不可比。

三个指标各管一件事：`ns/op` 是单次耗时，`B/op` 是每次迭代分配多少字节，`allocs/op` 是分配了几次。后两个才是 Go 里更该看的——GC 的 CPU 花在分配速率上，`allocs/op` 从 8 降到 1，往往比 `ns/op` 降 10% 更值钱（第 9 周用 `gctrace` 验证这句话）。

:::hint 先降分配，再谈耗时
把 setup 挪出循环、用 `b.ReportAllocs()`（或 `-benchmem`）打开分配统计；比较时先看 `allocs/op`、`B/op`，再用 profile 定位到具体行。单次读数不可信，至少 `-count=5` 看波动。
:::

:::solution 基准代码、pprof 命令与读法
```go
var sink string // 包级变量，防止结果被优化掉

func BenchmarkConcatPlus(b *testing.B) {
	for i := 0; i < b.N; i++ {
		s := ""
		for j := 0; j < 100; j++ {
			s += "x"
		}
		sink = s
	}
}

func BenchmarkConcatBuilder(b *testing.B) {
	b.ReportAllocs() // 等价于命令行加 -benchmem
	for i := 0; i < b.N; i++ {
		var sb strings.Builder
		sb.Grow(100) // 一次分配够，避免扩容
		for j := 0; j < 100; j++ {
			sb.WriteString("x")
		}
		sink = sb.String()
	}
}
```

`+=` 每次新建一个字符串并复制前面所有内容，100 次拼接是平方级的复制量；`strings.Builder` 内部是一个 `[]byte`，`Grow` 之后不再扩容。这不是风格问题，是复杂度问题——但仍要用你自己的数字说话，因为数据量和字符串长度都会改变结论，短字符串拼三次时两者可能打平。

如果被测函数处理的是字节流，加一句 `b.SetBytes(int64(len(input)))`，`go test` 会额外打出 `MB/s`，比 `ns/op` 更能说明「吞吐到了多少」。

跑的时候 `-run=^$` 跳过功能测试只跑基准，`-count=5` 跑五轮看波动，别拿单次结果下结论。再让 profile 落盘看热点：

```bash
go test -run=^$ -bench=. -benchmem -count=5
go test -run=^$ -bench=BenchmarkConcatPlus -cpuprofile=cpu.out -memprofile=mem.out
go tool pprof -top -nodecount=8 cpu.out
go tool pprof -sample_index=alloc_space -top mem.out   # 看"分配了多少"，不是"还占着多少"
go tool pprof -list=BenchmarkConcatPlus cpu.out        # 逐行看时间花在哪
```

`-top` 按累计耗时排序，第一行通常就是答案；`-list` 把函数的每一行和它的开销并排列出来，能直接看出是 `+=` 那行还是 `WriteString` 那行。`memprofile` 默认按 `inuse_space` 展示，做基准时你关心的是分配速率，所以要显式切到 `alloc_space`。

`-count=5` 得到的五行数字不会一模一样：内核调度、CPU 频率、GC 恰好插在哪一轮，都会带来几个百分点的抖动。两条基准差距小于 10% 时，先怀疑测量而不是代码；要把「快了」写成结论，就把多轮输出喂给 `benchstat`（`go install golang.org/x/perf/cmd/benchstat@latest`），它给出中位数和变化幅度，比肉眼看五行可靠。被测函数如果用到了 CPU 数（比如并发），再加 `-cpu=1,4` 各跑一遍，避免「在我这台 8 核机器上」这种不可复现的结论。
:::


#### 步骤 7.3 用失败替身测 500 与超时，把检查收成一条命令

200 / 400 / 404 都能用正常 store 造出来，500 不能——你没法让一个内存 map 突然报错。这正是「依赖是接口」的回报：写一个 `failingStore`，`Get` 直接返回错，handler 的 `case err != nil` 就被覆盖了。在测试里注入故障，比在生产上等故障便宜一万倍。

断言 500 要同时查两件事：状态码是 500，**响应体里不能出现原始错误文本**。`internal` 这种固定文案是契约；把 `err.Error()` 原样吐出去，等于把表名、SQL、内网地址送给调用方。这条断言写下来，以后谁为了「方便排查」把错误拼进响应，测试当场变红。

超时分支同理：`httptest.NewRequest` 之后用 `req = req.WithContext(ctx)` 换掉上下文，cancel 之后 `st.Get(r.Context(), id)` 会拿到 `context.Canceled`。这时别纠结「该返回哪个状态码」（客户端早断开了，没人收），该断言的是**函数在 50ms 内返回**——不返回就说明有人在等一个已经没人要的结果。下面这段先写 500 那条，超时那条照着改三行即可。

:::hint 用替身制造失败，而不是等失败
给 `Store` 换一个永远返回错的实现，就能稳定走到 500；超时分支则换掉请求的 context。断言除了状态码，还要包含「响应体不出现内部错误」这一条。
:::

:::solution 500 测试代码与一条检查命令
```go
type failingStore struct{ err error }

func (f failingStore) Get(context.Context, int) (*Asset, error) { return nil, f.err }

func TestServerReturns500(t *testing.T) {
	srv := httptest.NewServer(NewRouter(failingStore{err: errors.New("dial tcp 127.0.0.1:3306: refused")}))
	t.Cleanup(srv.Close)

	resp, err := srv.Client().Get(srv.URL + "/api/assets/1")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("code=%d want 500", resp.StatusCode)
	}
	body, _ := io.ReadAll(resp.Body)
	if strings.Contains(string(body), "3306") {
		t.Fatalf("响应体泄露了内部错误：%s", body)
	}
}
```

`t.Cleanup` 是 `defer` 的测试版：注册在测试上，子测试结束、甚至 `t.FailNow` 之后也一定执行，适合关服务、清临时目录。`httptest.NewServer` 在随机端口起一个真服务，`srv.URL` 可以直接喂给 `http.Client`——只有需要真实客户端行为（重定向、超时、header 上限）时才用它，其余场景 `NewRecorder` 更快也更稳。

这些 case 彼此独立，可以在 `t.Run` 里补一句 `t.Parallel()` 让它们并发跑，`httptest` 不开端口，并发是安全的。但共享了可变状态的 case 一旦并行，就从「稳定失败」变成「偶发失败」——加之前先确认每条 case 自己是完整的。

最后把这一周的检查收成一条命令，写进仓库根目录的 README：

```bash
gofmt -l . && go vet ./... && go test -race -cover ./... && go test -run=^$ -bench=. -benchmem
```

`-race` 会插桩内存访问，慢 5–10 倍，但能抓住「测试里恰好没撞上」的并发 bug（第 4 周的教训：结果对不代表没竞争）。`-cover` 给行覆盖率，别追 100%：分支有没有 case 比百分比重要，一个 handler 的 70% 往往比一个工具包的 100% 值钱。

CI 里再加一条 `-short`：慢的集成测试（要起数据库、要连外网）在函数开头写 `if testing.Short() { t.Skip("needs db") }`，日常提交只跑契约测试，几秒出结果；发版前再跑全量。单元测试不该花时间等一个容器起来，这是保持「随手就能跑一下」的关键。
:::

:::error 三个高频失败
```text
--- FAIL: TestGetAsset/missing (0.00s)
    asset_test.go:26: code=500 want 404 body={"error":"internal"}
```
根因：`errors.Is(err, ErrNotFound)` 为 false。最常见的是 store 里用 `%v` 包装断了链（第 2 周那个坑），其次是把哨兵错误重新 `errors.New` 了一次。修复：`fmt.Errorf("get %d: %w", id, ErrNotFound)`。

```text
BenchmarkConcatPlus-8   1000000   2480 ns/op   512 B/op   8.00 allocs/op
```
`allocs/op` 是 8 而不是 1，说明每次迭代都在重新分配：`strings.Builder` 建在循环里却没 `Grow`，或者干脆用了 `+=`。先降 `B/op`，再看 `ns/op`。

```text
--- FAIL: TestServerReturns500 (0.00s)
    asset_test.go:41: 响应体泄露了内部错误：{"error":"dial tcp 127.0.0.1:3306: refused"}
```
根因：handler 把 `err.Error()` 写进了响应。修复：对外固定文案，原始错误只进 `slog`，日志里带请求 ID 供对账。
:::

**自测**（合上文档回答）

1. 表驱动比「一个函数里串三个断言」好在哪？失败时你多拿到哪两样信息？
2. `b.N` 是谁定的？`b.ResetTimer()` 解决什么问题？`B/op` 和 `allocs/op` 分别读什么？
3. 测 500 分支为什么必须替换 `Store`？断言响应体不含内部错误，防的是哪一类事故？

**验收**

- [ ] `go test ./...` 三条 case 全绿；把 handler 里的 `errors.Is` 改成字符串比较后 `missing` 变红，改回来恢复绿
- [ ] `go test -run=^$ -bench=. -benchmem -count=5` 有输出，`strings.Builder` 的 `allocs/op` 低于 `+=`，并把两组 `ns/op / B/op` 抄进 README
- [ ] `go test -race -cover ./...` 通过，`go vet ./...` 无输出
- [ ] `go tool pprof -top cpu.out` 能点出一个函数并说出它占多少 CPU，`-list` 能指到具体一行

---

### 第 8 周：部署与真实落点

**本周目标**：交叉编译出一个静态 Linux 二进制，交给 systemd 托管、只监听 `127.0.0.1`、由 nginx 反代，并交出启动耗时、QPS、p99、稳态内存四个数字，以及一套 30 秒内能回滚的发布步骤。

**为什么是这些内容**：前六周的所有代码都有一个隐含前提——你在本机、终端开着、`go run` 着。这一周把这个前提拆掉。第 5 周学的优雅退出，只有在 systemd 发 `SIGTERM` 的时候才有意义；第 6 周写的 `env()` 和 slog，只有配上 `EnvironmentFile` 和 journald 才算真的可用；第 7 周的测试，是为了让你敢在服务器上换二进制。第 9 周要做的容量判断，也需要一个真实的压测环境——`go run` 的启动耗时和 `httptest` 的 QPS 都不是生产数字。

不学会的后果：SSH 一断服务就没了；`nohup` 起来的东西重启机器不会回来；写 `:8081` 等价于写 `0.0.0.0:8081`，等于把一个没有鉴权的接口直接送到公网；`systemctl restart` 时用户吃 502；出了事没有上一版可以退，只能现场改代码。

这一周的顺序就是一次真实发布的顺序：先造出能跑的二进制，再让它被托管，再让 nginx 接住流量，再写真正的业务，最后补上探活与回滚。前三步做完，你就有了一个「能长期跑」的壳，业务只是往里填。部署真正的门槛不在命令，而在「每一步都能退回去」——所以最后一步留给回滚，不留给新功能。

#### 步骤 8.1 交叉编译与静态二进制

Go 的编译器自带所有目标平台的后端，纯 Go 代码不需要交叉工具链——两个环境变量就够。会打破这条的只有 CGO：一旦某个依赖调用了 C（某些 `os/user` 实现、SQLite 驱动、图像处理库），构建时就要去链接目标平台的 libc，那时你才需要 `aarch64-linux-gnu-gcc` 这类工具链。

`CGO_ENABLED=0` 关掉 CGO，产物是纯静态 ELF，不依赖目标机的任何 `.so`。代价是 DNS 解析走纯 Go 实现（自己读 `/etc/resolv.conf`），不再走 glibc 的 NSS 链——对绝大多数服务没有差别，但如果你的环境靠 `nsswitch.conf` 接 LDAP 做用户查询，要留意。

`-trimpath` 把编译期的绝对路径换成模块路径。两个好处：构建可复现（同一份源码在不同机器上产出同样的二进制，便于比对哈希），以及不把 `C:\Users\<你的名字>\...` 写进 panic 栈和 pprof 输出。

`-ldflags="-s -w"`：`-s` 去掉 ELF 符号表和调试信息，`-w` 去掉 DWARF，体积通常小 25%–30%。Go 自己的函数名和行号在 `pclntab` 里，不受影响，所以 panic 栈和 `go tool pprof` 照样能显示函数名；不能用的只是 `go tool nm`、gdb 这类依赖 ELF 符号表的工具。

:::hint 一条命令产出可拷走的二进制
关 CGO、去路径、去符号，产物就是静态链接的 ELF，不依赖目标机的 `.so`。构建完先 `go version -m` 自检构建参数，再 `file` 确认 `statically linked`。
:::

:::solution 交叉编译与产物自检
```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build -trimpath -buildvcs=false -ldflags="-s -w" -o app ./cmd/server

go version -m app   # 打印模块、依赖和构建参数
ls -lh app          # 常见 8–12 MB
```

PowerShell 没有行内环境变量前缀，要写成 `$env:CGO_ENABLED="0"; $env:GOOS="linux"; $env:GOARCH="amd64"; go build ...`，只对当前会话有效。

`go version -m app` 是最省事的自检：它会打印 `build CGO_ENABLED=0`、`build GOOS=linux`、`build GOARCH=amd64`、`build -trimpath`，后面还有完整依赖清单。在 Windows 上没有 `file` 命令，这条就是替代品；到了服务器上再补一次 `file app`，确认输出里是 `ELF 64-bit LSB executable, ... statically linked`。

不确定目标平台怎么写时，`go tool dist list` 会列出全部 `os/arch` 组合，`linux/arm64` 就是多数 ARM 云主机和树莓派的目标。

`-buildvcs=false` 是给「在别人的 git 仓子目录里构建」准备的。Go 1.18 起会把 VCS 信息编进二进制，如果当前目录属于某个 git 仓但状态不干净（未提交改动、可疑所有权），构建会直接失败，而报错跟代码毫无关系。
:::

:::error 拷到服务器上跑不起来
```text
bash: ./app: cannot execute binary file: Exec format error
```
根因：架构不对——arm 机器上跑了 amd64，或者 Windows 的 exe 被当成 Linux 程序。修复：`uname -m` 看目标机架构，`GOARCH=arm64` 重编。

```text
./app: /lib64/ld-linux-x86-64.so.2: bad ELF interpreter: No such file or directory
```
根因：开了 CGO，二进制动态链接 glibc，目标机（常见于 alpine / scratch 镜像）没有这个 loader。修复：`CGO_ENABLED=0` 重编，再 `file app` 确认 `statically linked`。

```text
error obtaining VCS status: exit status 128
```
根因：构建目录属于一个 git 仓，但 Go 拿不到 VCS 信息（权限、`safe.directory`、目录被移动过）。修复：加 `-buildvcs=false`，或换到干净目录构建。
:::

#### 步骤 8.2 systemd + nginx + 压测

systemd 的 unit 是一份「进程监护契约」：`Restart=always` 保证崩了 2 秒后回来；`systemctl stop` 默认发 `SIGTERM`，第 5 周那句 `signal.NotifyContext(ctx, syscall.SIGTERM)` 就是在这里被触发的；`EnvironmentFile` 让密码和 DSN 留在 `/opt/assetd/.env`（`chmod 600`），不进仓库、不进命令行、不进 `ps`。

:::hint 进程只对本地端口负责
服务只监听 `127.0.0.1`，生命周期交给 systemd，公网入口交给 nginx；压测时同时记 QPS、p99 与 RSS，再拿 `/healthz` 做对照。
:::

:::solution unit、nginx 与压测的完整配置
```ini
[Unit]
Description=assetd (read-only asset service)
After=network.target
# 崩溃循环保护：5 分钟内起 10 次就停手，别把机器拖死
StartLimitBurst=10
StartLimitIntervalSec=300

[Service]
Type=simple
User=assetd
Group=assetd
WorkingDirectory=/opt/assetd
EnvironmentFile=/opt/assetd/.env
ExecStart=/opt/assetd/app
Restart=always
RestartSec=2
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

`Type=simple` 表示 `ExecStart` 一执行就算启动完成（进程不 fork），绝大多数 Go 服务都是这个类型。`User=assetd` 是必须的：用 root 跑一个只读文件服务，等于把整台机器押上去；这个系统用户用 `useradd --system --no-create-home assetd` 建，再让 `/opt/assetd` 对他只给读和执行。`StartLimitBurst`/`StartLimitIntervalSec` 属于 `[Unit]` 段——写进 `[Service]` 会被静默忽略，这是 unit 文件最常见的白写。

装好之后三步：`systemctl daemon-reload`（改了 unit 必须做，否则 systemd 还用内存里的旧版本）、`systemctl enable --now assetd`（`enable` 管开机自启，`--now` 顺带立刻启动）、`journalctl -u assetd -f` 跟日志。

服务只监听 `127.0.0.1:8081`，公网入口交给 nginx：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8081;   # 不带 URI：路径原样转发
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 10s;
}
```

`proxy_pass` 带不带 URI 是两套语义：不带 URI（上面这种）原样转发，`/api/assets` 到应用还是 `/api/assets`；带 URI（比如写成 `http://127.0.0.1:8081/`）时，匹配到的 `/api/` 前缀会被替换成 `/`，应用收到的是 `/assets`，直接 404。这个差别只在一行里，却是 nginx 反代最常见的坑——写的时候先问自己「应用期望的路径长什么样」，别照着抄。改完一定 `nginx -t` 再 `systemctl reload nginx`。

压测只认三个数：QPS、p99、非 2xx 比例。

```bash
wrk -t2 -c50 -d30s --latency 'http://127.0.0.1:8081/api/assets?dir=spire/art'
```

`-t2` 两个线程、`-c50` 50 个并发连接、`-d30s` 跑 30 秒；`--latency` 会打延迟分布，你要看的是 `99%` 那一行。压测时另开一个终端 `top -p $(pgrep -f /opt/assetd/app)` 记 CPU 和 RSS——只说 QPS 不说资源，等于只说车速不说油耗。wrk 只有 Linux/macOS 的原生包，Windows 上走 WSL。

压测要有对照：先压 `/healthz`（几乎不做事）拿到这套配置的框架上限，再压 `/api/assets`，两者的差就是业务成本。只压一次真实接口，你分不清瓶颈在网络框架、JSON 编码还是文件系统；有对照，才知道优化该往哪儿使劲。每轮之间停 30 秒，让上一轮的内存回收、连接退干净，否则第二轮的数字被第一轮污染。
:::

#### 步骤 8.3 给 NoteLab 写一个素材服务（真实任务）

需求：`public/spire` 下有几百张 PNG，做一个只读接口，按目录列出文件名、大小、修改时间和访问 URL。它会成为第一块真正跑在别人系统里的 Go 代码，所以约束比 demo 多：只读、无状态、防路径穿越、能被 nginx 挂上。

路径穿越是这类服务的一号漏洞。`filepath.Join("/opt/assets", "../../etc/passwd")` 会先 Clean 再拼，结果就是 `/etc/passwd`——`Join` 不会因为第二个参数带 `..` 就把你锁在根目录里。所以拼之前必须单独判一次：Go 1.20 起有 `filepath.IsLocal`，它明确回答「这个相对路径会不会跑出当前目录」，`..`、绝对路径、空串、含 NUL 全部返回 false。

```go
func listHandler(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dir := r.URL.Query().Get("dir")
		if !filepath.IsLocal(dir) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		p := filepath.Join(root, dir)

		entries, err := os.ReadDir(p)
		if errors.Is(err, fs.ErrNotExist) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, "internal", http.StatusInternalServerError)
			return
		}

		type item struct {
			Name    string    `json:"name"`
			Size    int64     `json:"size"`
			ModTime time.Time `json:"modTime"`
			URL     string    `json:"url"`
		}
		out := make([]item, 0, len(entries))
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".png") {
				continue
			}
			info, err := e.Info() // 多一次 stat，换来 size / modTime
			if err != nil {
				continue
			}
			out = append(out, item{
				Name:    e.Name(),
				Size:    info.Size(),
				ModTime: info.ModTime().UTC(),
				URL:     path.Join("/assets", dir, e.Name()),
			})
		}
		writeJSON(w, http.StatusOK, out)
	}
}
```

逐行只有四处值得停一下。`IsLocal` 挡的是「跑出 root」，**不挡符号链接**：root 下面若有人放一个指向 `/etc` 的软链，`ReadDir` 不会跟进去，但你要是再 `os.Open` 文件内容就会跟——真要开这条路，先 `filepath.EvalSymlinks` 再判一次前缀。`e.Info()` 每个条目多一次 `stat`，几百个文件无所谓，几万个就该换缓存。`path.Join` 而不是 `filepath.Join` 拼 URL，因为 URL 永远用 `/`，而 `filepath` 在 Windows 上会给你 `\`。`err` 分支先判 `fs.ErrNotExist` 再判其他，顺序反了 404 会变 500。

下一步如果要真的吐文件内容，别自己 `io.Copy`：`http.ServeContent(w, r, name, modTime, file)` 会替你处理 `Range` 断点续传、`If-Modified-Since` 与 `Content-Type`，浏览器缓存也就顺带有了。这个服务现在只列目录，是因为几百张缩略图的信息量比图片本身更便宜——先让前端拿到清单，再按需取图，是只读服务最省流量的形态。

:::hint 只读服务的三条边界
「只读」= 没有 `POST`/`PUT` 路由，且系统用户对目录只有 `r-x`；「无状态」= 不写缓存、不落临时文件，重启后行为完全一致；「能挂 nginx」= 不关心 TLS、不解析真实 IP，只认 `127.0.0.1`。三条守住，它就是一块可以复制的拼图。
:::

:::solution 挂上路由并自检
```go
mux.Handle("GET /api/assets", listHandler(os.Getenv("ASSET_ROOT")))
```
```bash
curl -fsS 'http://127.0.0.1:8081/api/assets?dir=spire/art' | jq '.[0]'
curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:8081/api/assets?dir=../../etc'  # 403
curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:8081/api/assets?dir=nope'       # 404
```
:::

#### 步骤 8.4 上线后的探活、日志与回滚

一个能长期跑的服务，缺的从来不是功能，是「坏了怎么办」。这一节把三件事变成动作：怎么判断它还活着、出事去哪看、怎么退回去。

探活要分两层。liveness 只回答「进程还能不能回 HTTP」，`/healthz` 直接回 200，**不要查数据库**——数据库挂了应该让业务接口报错，而不是让 systemd 每两秒重启一次进程（重启治不了 DB，只会把日志刷满并触发启动风暴）。readiness 才检查依赖，那是给负载均衡决定要不要往里发流量用的；这个服务单实例，一个 `/healthz` 就够。

日志不落文件。`StandardOutput=journal` 之后所有 slog 的 JSON 都进 journald：轮转、压缩、权限都由系统接管，你少了一个「磁盘被日志写满」的故障模式。查的时候 `journalctl -u assetd --since "10 min ago"`，要按字段过滤就 `journalctl -u assetd -o cat | jq 'select(.level=="ERROR")'`——这就是第 6 周坚持结构化日志的兑现时刻。

回滚的关键是**别覆盖旧二进制**：上传成 `app.new`，在服务器上再替换，用 `mv` 而不是 `cp`（同一文件系统上 `mv` 是 rename，不会出现半个文件被执行的窗口），重启后探活，失败就把 `app.prev` 换回来再重启。整个过程 20 秒内完成，比「现场重编一遍看看」可靠得多。

:::hint 每步都能退回去
新版本先落成 `app.new`，`mv` 原子替换；探活失败就把 `app.prev` 换回来。探活只查进程能不能回 HTTP，不查数据库。
:::

:::solution 发布与回滚脚本
```bash
# 本机：只上传，不动线上正在跑的文件
scp app server:/opt/assetd/app.new

# 服务器：/opt/assetd/deploy.sh
set -euo pipefail
cd /opt/assetd
chmod +x app.new
cp -f app app.prev
mv -f app.new app
systemctl restart assetd

for i in 1 2 3 4 5; do
  if curl -fsS http://127.0.0.1:8081/healthz >/dev/null; then
    echo "deploy ok"; exit 0
  fi
  sleep 1
done

echo "health check failed, rolling back" >&2
mv -f app.prev app
systemctl restart assetd
exit 1
```

`set -euo pipefail` 让任何一步失败都立刻停，别带着半成品往下走；探活重试 5 次、每次 1 秒，是给进程启动留时间。启动耗时不用 `time` 测——它在后台跑；在 `main` 里记 `start := time.Now()`，`ListenAndServe` 之前 `slog.Info("started", "in", time.Since(start).String())`，重启后 `journalctl` 里就能读到，这个数字第 9 周还要用。
:::

:::error nginx 502 与 unit 起不来
```text
502 Bad Gateway
```
根因有四种：应用没起、端口不对、应用只监听了 `[::1]` 而 nginx 连 `127.0.0.1`、SELinux 拦了出站。排查顺序固定：`curl http://127.0.0.1:8081/healthz`（应用侧活不活）→ `ss -ltnp | grep 8081`（监听在哪）→ `journalctl -u assetd -n 30`（启动日志）→ `nginx -t`（配置对不对）。

```text
Job for assetd.service failed because the control process exited with error code.
```
根因：`ExecStart` 路径不对、没有执行位、`EnvironmentFile` 不存在、`User=assetd` 读不了该文件。`systemctl status assetd` 给退出码，`journalctl -xeu assetd` 给程序自己打印的最后一句话——先看程序说了什么，再看 unit。
:::

**自测**（合上文档回答）

1. `CGO_ENABLED=0` 与 `-trimpath` 各自解决什么问题？`-ldflags="-s -w"` 之后 pprof 还能显示函数名吗，为什么？
2. 在 `location /api/` 下，`proxy_pass http://127.0.0.1:8081;` 与 `proxy_pass http://127.0.0.1:8081/;` 把 `/api/assets` 分别转发成什么？
3. 回滚脚本为什么先把新二进制传成 `app.new` 再 `mv`？探活为什么不去查数据库？

**验收**

- [ ] `go version -m app` 里有 `CGO_ENABLED=0`、`GOOS=linux`、`GOARCH=amd64`；服务器上 `file app` 显示 `statically linked`
- [ ] `systemctl is-enabled assetd` 输出 `enabled`，`systemctl is-active assetd` 输出 `active`；重启机器后两者不变
- [ ] `ss -ltnp | grep 8081` 只看到 `127.0.0.1:8081`，没有 `0.0.0.0`
- [ ] 经 nginx 访问 `/api/assets?dir=spire/art` 返回 JSON 数组；`dir=../../etc` 返回 403，`dir=nope` 返回 404
- [ ] `wrk -t2 -c50 -d30s --latency` 有输出，README 里记下 QPS、p99、RSS、启动耗时四个数字
- [ ] 把 `app` 换成一段立刻退出的脚本跑一次 `deploy.sh`，脚本返回 1，回滚后 `systemctl is-active assetd` 仍是 `active`

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

**本周目标**：用 `GODEBUG=schedtrace` 与 `gctrace` 解释「goroutine 为什么便宜」「RSS 为什么不降」，并交出一份每项都有命令或数字支撑的 L3 毕业自评。

**为什么是这些内容**：前八周你已经能写出不泄漏、可取消、有测试、能上线的服务。剩下的差距不是「会不会写」，是「解释得了吗」：线上 CPU 打满时，是 GC 在扫还是锁在自旋？内存涨到 2G 时，是泄漏还是分配器不肯还？p99 抖动时，是调度延迟还是下游慢？这三个问题没有 trace 就只能靠猜，而猜错方向会白花一整周。

这一周也是收官。第 1–2 周的语言边界、第 3–4 周的并发、第 5–6 周的服务与数据、第 7–8 周的测试与交付，最后都要落到毕业 rubric 的五个维度上。所以本周的验收不是「跑通某个 demo」，而是「每个维度都拿得出证据」——一条命令、一份输出、一个数字。没有证据的「我掌握了」，半年后就是没掌握。

不学会的后果都很贵：`GOMAXPROCS` 在 2 核容器里默认取宿主机核数，P 比真实核多，调度开销白付；`GOGC` 往错的方向调，CPU 花在 GC 上却以为在处理请求；看到 RSS 不降就重启进程，把正常行为当成泄漏，顺手把一堆连接和缓存全丢掉。这一周不引入任何新语法，只引入证据：数字、trace、对比表。

#### 步骤 9.1 看懂 GMP 调度

G 是 goroutine，起始栈 2KB，按需增长；M 是 OS 线程；P 是逻辑处理器，持有本地运行队列（长度 256）和一小块内存缓存。`go f()` 做的事是把新 G 塞进当前 P 的本地队列，M 从自己绑定的 P 上取 G 执行——**只有 P 是执行许可，M 没有 P 就不能跑 Go 代码**。这条比记三个字母重要：它解释了为什么「G 比 M 多几个数量级」不构成问题，因为调度发生在用户态，一次切换几十纳秒，不用进内核。

本地队列空了，M 会去全局队列拿一批，再没有就去别的 P 的队列里偷一半，这叫 work stealing。真正贵的是阻塞：G 做同步系统调用（读本地文件、CGO 调用）时，M 带着 P 一起卡住，`sysmon` 发现 P 超过 10ms 没动静，就把 P 抢过来交给另一个 M（handoff），于是 `threads` 短暂上涨。而 `net` 系列的 fd 注册在 netpoller 上，G 阻塞时只挂起自己、把 P 让出去——这才是「一个慢 IO 不拖垮全局」的真实机制，前提是你用了支持并发的 API。

```go
// cmd/sched/main.go
package main

import (
	"fmt"
	"runtime"
	"sync"
)

func main() {
	results := make([]int, 100_000) // 写回切片，防止循环被优化掉
	var wg sync.WaitGroup
	wg.Add(100_000)
	for i := 0; i < 100_000; i++ {
		go func(i int) {
			defer wg.Done()
			sum := 0
			for j := 0; j < 200_000; j++ { // 让每个 G 活够时间，trace 才有东西可打
				sum += j
			}
			results[i] = sum
		}(i)
	}
	wg.Wait()
	fmt.Println("goroutines left:", runtime.NumGoroutine(), "first:", results[0])
}
```

:::hint 三个数字各管一件事
`gomaxprocs` 是许可（P 有几个），`threads` 是真实线程（M 有几个），`runqueue` 加方括号是积压（G 排了多少）。吞吐不够看 P 有没有空转，延迟抖动看队列有没有积压，线程暴涨看有没有阻塞式系统调用。
:::

:::solution 跑起来读一行 SCHED
```bash
GODEBUG=schedtrace=1000 go run ./cmd/sched
```
```text
SCHED 1004ms: gomaxprocs=8 idleprocs=0 threads=12 spinningthreads=1 idlethreads=4 runqueue=0 [3 2 0 1 0 2 1 0]
```
:::

`gomaxprocs=8` 是 P 的数量，`threads=12` 是真实 OS 线程数——和 10 万个 G 差四个数量级，这就是「便宜」的证据。方括号里是每个 P 的本地队列长度，`runqueue` 是全局队列。`idleprocs=0` 说明 8 个 P 都在忙；`spinningthreads` 是正在自旋找活的 M，它长期大于 0 意味着有 P 在空转，通常说明 G 太少、并行度没喂满。

别把「便宜」读成免费：每个 G 起始 2KB 栈，10 万个就是 200MB 起步，再加运行队列和 sysmon 的开销。它便宜在创建成本（几百纳秒）和切换成本（用户态完成，不用陷内核），相对 10 万个线程（每个默认预留 8MB 栈空间）仍是两三个数量级的差距。所以纪律是：并发度按下游能承受的量来定，而不是按 G 有多便宜来定。

把间隔改成 100ms（`GODEBUG=schedtrace=100`）看启动阶段，会看到 `threads` 冲到二三十再落回来——那是 GC 的后台 worker 和 handoff，不是泄漏。注意 schedtrace 是按时间打印的：程序跑不到一秒就退，你一行都看不到，所以上面那个循环要真的干活，而不是 `_ = n * n`。判断泄漏看 `runtime.NumGoroutine()` 在业务稳定后是否持续上升，不看 `threads`。

`GOMAXPROCS` 决定 P 的数量，默认等于 `runtime.NumCPU()`。注意 Go 1.22 不读 cgroup 的 CPU quota：容器限 2 核但宿主机 64 核时，P 还是 64，多出来的 P 只能抢同一份配额。要么启动时 `runtime.GOMAXPROCS(2)`，要么用 `GOMAXPROCS=2` 环境变量；判断依据是 `cat /sys/fs/cgroup/cpu.max`（cgroup v2），不是 `nproc`。

#### 步骤 9.2 看懂 GC trace

Go 的 GC 是并发的三色标记加混合写屏障。标记阶段大部分和应用并行，只有两次很短的 STW：开始标记前（mark setup）和标记结束（mark termination），量级通常是几十微秒。新对象先落在 P 的缓存里，攒够一批再向全局要——这条快路径上没有全局锁，所以小对象分配很便宜，贵的是「分配得太频繁」。

触发时机由 `GOGC` 决定：`GOGC=100`（默认）表示「堆涨到上次回收后存活量的 2 倍就开一轮」。注意基准是**存活量**而不是堆总量，所以一个长期持有大量对象的服务，目标堆也会跟着水涨船高。Go 1.19 起还有 `GOMEMLIMIT`（`debug.SetMemoryLimit`）作为软上限：接近它时 GC 会提前并更频繁地跑，超过也不会 OOM kill——它是「预算」，不是「闸门」。

把 `GOGC` 设成 `off`（`GOGC=off` 或 `debug.SetGCPercent(-1)`）只适合「进程活不过几秒」的批处理：跑完就退，让 OS 一次性回收，省掉全部 GC 开销。常驻服务这么干等于把内存交给运气。

:::hint 先看 STW，再看百分比
trace 里只有两段 STW 真正停住应用；GC 占用 CPU 的百分比高而堆不大时，通常是分配太快，先减少分配，再考虑调 `GOGC`。
:::

:::solution 制造分配并读 trace
```go
package main

func main() {
	keep := make([][]byte, 0, 200)
	for i := 0; i < 2_000_000; i++ {
		b := make([]byte, 256)
		if i%10_000 == 0 {
			keep = append(keep, b) // 只留一小部分：存活量不大，但分配很快
		}
	}
	_ = keep
}
```
```bash
GODEBUG=gctrace=1 go run main.go
```
```text
gc 12 @3.214s 2%: 0.021+1.8+0.004 ms clock, 0.17+1.2/2.4/0.8+0.03 ms cpu, 120->124->60 MB, 130 MB goal, 8 P
```
:::

逐段读：`gc 12` 是第 12 轮，`@3.214s` 是启动后的时刻，`2%` 是 GC 累计占用 CPU 的比例。`0.021+1.8+0.004 ms clock` 是墙钟时间的三段——STW、并发标记、STW 收尾；你要盯的是第一段和第三段（真正停住应用的），中间那段是和应用抢 CPU 的。后一个加号组是 CPU 时间的拆分：标记辅助（mutator assist）、后台标记、空闲标记。`120->124->60 MB` 是回收前堆、峰值、回收后堆，`130 MB goal` 是下一轮的触发目标，约等于 `60 × (1 + GOGC/100)`。

`2%` 这个数字比堆大小更值得盯。分配速率高（热路径里拼字符串、每个请求都 `make([]byte, 32<<10)`）时，GC 会被迫更频繁地跑，百分比上去、吞吐下来，而堆看起来并不大。这时候先减少分配（复用 buffer、用 `sync.Pool`、预分配切片），比调 `GOGC` 有效得多——调 `GOGC` 只是把问题推到内存那一侧。

:::error 「内存不还给系统」不是泄漏
```text
# 压完一波流量，RSS 稳在 2.1GB 不降，但 /debug/pprof/heap 的 inuse_space 只有 90MB
```
根因：Go 的分配器把空闲页留在自己的堆里复用。Go 1.16 起空闲页用 `MADV_DONTNEED` 归还，但归还是按 span 粒度、由后台 scavenger 慢慢做的，而且下一波流量马上又要回来——所以 RSS 不降是常态。判断依据是 `inuse_space`（还在用的对象）和 `heap_sys`（向 OS 要了多少），不是 RSS。

修复分三种：`inuse_space` 持续上涨是真泄漏，用 `pprof -alloc_space` 找出谁在分配；`inuse_space` 稳定只是 RSS 高，属正常，别重启；确实要立刻归还（批处理跑完），`debug.FreeOSMemory()`，但别放进热路径——它会触发一次完整的 STW GC。
:::

#### 步骤 9.3 把读数变成容量结论（并完成毕业自评）

前两步给的是「看得懂」，这一步要「用得上」：同一个服务换两组运行时参数，压出两组数字，选一个并说出理由。这是 L3 和 L2 的分界——L2 能跑通，L3 能说清「为什么是这个配置」。

三个数字够用：QPS（吞吐）、p99（尾延迟）、稳态 RSS（成本）。它们之间是预算关系：`GOGC` 调大，GC 次数少、CPU 省给业务、QPS 上去，但两次回收之间要留更多空余堆，RSS 上涨；`GOMEMLIMIT` 调小，内存被摁住，但 GC 更频繁，p99 抖动变大。

:::solution 两组参数，一张表
```bash
run() { # 用法：run <GOGC> <GOMEMLIMIT>
  sudo systemctl set-environment GOGC="$1" GOMEMLIMIT="$2"
  sudo systemctl restart assetd
  sleep 2   # 给启动和预热留时间
  wrk -t2 -c50 -d30s --latency 'http://127.0.0.1:8081/api/assets?dir=spire/art' \
    | tee "/tmp/bench-gogc-$1.txt"
  grep VmRSS "/proc/$(pgrep -f /opt/assetd/app)/status"
}

run 100 512MiB
sleep 30
run 400 512MiB
```
```text
GOGC | QPS  | p99  | RSS
100  | 4800 | 12ms | 180MB
400  | 5600 | 15ms | 340MB
```
:::

`systemctl set-environment` 设的变量对**之后启动**的服务生效，所以每次都要 `restart`；两轮之间停 30 秒，让上一轮的内存回收、连接退干净，否则第二轮的 RSS 被第一轮污染。结论要写成一句话：「`GOGC=400` 让 QPS 涨 17%、p99 涨 3ms、RSS 从 180MB 到 340MB；这是只读服务、内存预算 512MB，所以选 400。」——有数字、有权衡、有依据，这就够了。

`GOMEMLIMIT` 和容器内存 limit 的关系值得单独记一句：设成 limit 的 80%–90%，留出栈、CGO、运行时元数据的余量；设成正好等于 limit，就会在临界点上和 OOM killer 抢最后几 MB。它和 `GOGC` 同时生效，谁先到阈值算谁的。

再看一次 `go tool trace`：`main` 里 `trace.Start(f)` / `trace.Stop()`，或测试里 `go test -trace=trace.out`，然后 `go tool trace trace.out` 打开浏览器。三块最有用：Goroutine analysis 看谁起了最多 G，Scheduler latency 看 G 排到 P 上等了多久，GC 一栏看每轮标记耗时。调度延迟高而 CPU 不满，通常是 P 太少或有阻塞式系统调用；GC 频繁而堆不大，通常是分配太快。

:::hint 顺序别反
先压出基线，再改一个参数，再压一次。一次改两个参数，你永远不知道是谁的效果；没有基线，你连「变快了」都无从判断。
:::

**自测**（合上文档回答）

1. `gomaxprocs`、`threads`、`runqueue` 分别对应 GMP 里的哪个角色？为什么 10 万个 goroutine 只要十几个线程？
2. `gctrace` 里 `0.021+1.8+0.004` 哪几段真正停住了应用？`GOGC=400` 相比 100，GC 频率和 RSS 往哪个方向变？
3. 「RSS 高」和「内存泄漏」各看哪个指标？为什么 `debug.FreeOSMemory()` 不能放进热路径？

**验收**

这一份同时就是毕业自评：rubric 的五个维度，每一项都要能跑出一条命令或报出一个数字。做不到的，回对应那一周补，别在这里打勾。

- [ ] 并发：`go test -race ./...` 全绿；跑步骤 9.1 得到 `threads` 小于 50，且抄下 `gomaxprocs` 与 `nproc` 的对比
- [ ] 正确性：表驱动覆盖 200 / 400 / 404 / 500；错误判断全用 `errors.Is`，且有一条测试证明改成 `%v` 后会断链
- [ ] 性能：`gctrace` 抓到至少 5 行，能算出平均 STW 和 GC 占 CPU 的百分比；README 里有 `GOGC` 两档的 QPS / p99 / RSS 表
- [ ] 工程：`gofmt -l .` 无输出、`go vet ./...` 静默、`go list -deps ./internal/service | grep -c internal/store` 输出 0（service 不依赖 store 的具体实现）
- [ ] 交付：`file app` 显示 `statically linked`、`ls -lh app` 小于 15MB、`systemctl is-enabled assetd` 为 `enabled`，重启机器后 `/healthz` 仍返回 200
- [ ] 回滚：跑一次第 8 周的 `deploy.sh`（换上一个会立刻退出的二进制），30 秒内服务恢复且版本回到上一版
- [ ] 自评：五个维度（并发 / 正确性 / 性能 / 工程 / 交付）各写一条证据，至少 4 条达到「熟练」档，且没有「不合格」——写完把这张表放进 README，它是你这条路线的毕业证

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
