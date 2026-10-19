# Java 熟练路线 · 17 周

> **给谁**：已经能写 CRUD、但还不敢说自己「会 Java」的编程工作者。
> **终点**：L3 熟练 —— 能独立设计并交付中型后端系统，能定位并发与内存问题，能读懂 Spring / MyBatis 的关键实现，能做技术选型并说出理由。
> **节奏**：每周 8–10 小时。每阶段有产出物与验收，没过不进下一阶段。

## 这条路线要把你带到哪

很多人对「会 Java」的定义停在「能写接口」——那只是 L1。真正拉开差距的是**能不能在没有教程的情况下，把一个中型系统设计对、跑稳、查得动**。这条路线按四级能力模型组织：

| 级别 | 叫法 | 能做什么 | 怎么算达到 |
|---|---|---|---|
| L1 | 会写 | 看懂并修改现有代码，补一个小功能 | 在别人的项目里加一个接口并通过测试 |
| L2 | 能独立 | 独立设计模块、写测试、部署上线 | 从零交付一个带测试的服务 |
| **L3** | **熟练（本路线终点）** | 设计中型系统、定位疑难问题、做技术选型、评审他人代码 | 通过文末的毕业 rubric |
| L4 | 专家 | 定义规范/框架、解决语言级问题 | 不在本路线范围（需要长期实战与社区影响力） |

**L3 的具体标志**（毕业后应该能当场做到）：

- 给一个需求，能画出分层与表结构，并说出为什么这么分；
- 线上 500 变多，能在 10 分钟内用日志/线程栈/慢查询定位到具体一段代码；
- 两个技术方案摆面前，能列出取舍并给出建议，而不是「都行」；
- 能指出别人代码里**半年后才会炸**的地方。

## 知识地图：五个域，缺一个都到不了熟练

| 域 | 熟练要求 | 对应周 |
|---|---|---|
| 语言内核 | 类型/集合/泛型/异常/IO 的边界行为张口就来 | 1–4 |
| 运行时与内存 | 会看堆栈、GC、类加载，能用工具定位内存与 CPU 问题 | 17 |
| 并发 | 线程池参数有依据，能识别竞态与死锁，会用异步编排 | 7 |
| 生态与框架 | 知道 Spring 帮你做了什么，出问题能往哪层查 | 9–12 |
| 工程与交付 | 测试、构建、部署、观测、压测形成闭环 | 5–8、13–16 |

**学习方法（三条硬规矩）**：

1. **红-绿**：先写会失败的测试，再写实现；没有失败证据的「完成」不算完成。
2. **每步三问**：坏了会怎样？我怎么发现？怎么回滚？答不上就别提交。
3. **场景优先**：每学完一个域，去文末「场景实践库」挑一个业务场景做掉——语言是工具，场景才是熟练度。

---

## 先做能力定位（10 分钟，别跳过）

能当场答上算 1 分：

| # | 问题 |
|---|---|
| 1 | `==` 和 `equals` 的区别？`Integer` 的 128 陷阱是什么？ |
| 2 | 为什么重写 `equals` 就必须重写 `hashCode`？不重写会出什么事？ |
| 3 | `ArrayList` 和 `LinkedList` 什么时候该选哪个？ |
| 4 | `try-with-resources` 解决的是什么问题？ |
| 5 | 一个线程池的 7 个参数分别是什么？队列满了会怎样？ |
| 6 | `@Transactional` 在什么情况下不生效？ |
| 7 | 你写过一个带测试、能部署、别人能按 README 跑起来的项目吗？ |

| 得分 | 起点 |
|---|---|
| 0–2 | 从第 0 周开始，**一周都别跳** |
| 3–5 | 第 0 周压缩到 2 天，第 1–2 周快速过，重点放在第 5 周之后 |
| 6–7 | 直接从第 5 周开始，但第 6、7 周必须动手 |

---

## 路线总览

| 阶段 | 周次 | 主题 | 产出物 | 达到 |
|---|---|---|---|---|
| 准备 | 0 | 环境与工具链 | 命令行跑通 Hello World | L1 |
| 一 · 语言 | 1–4 | 语法、面向对象、集合、异常 IO | 命令行「记账本」 | L1 → L2 |
| 二 · 工程 | 5–8 | 测试、SQL/JDBC、并发、分层 | 带测试的多层任务管理器 | L2 |
| 三 · 框架 | 9–12 | Spring Boot、持久层、接口工程化、鉴权 | 带登录的 REST 服务 | L2 → L3 |
| 四 · 上线 | 13–16 | 日志监控、部署、综合项目、读真实代码 | 一个能公网访问的项目 | L3 |
| 五 · 深度 | 17 | JVM、GC、线程栈、CPU 热点 | 一次真实的线上诊断报告 | L3 |

**时间投入**：每周 8–10 小时。一周只有 4 小时，就把「周」当「双周」用，**不要压缩内容**。

---

## 阶段一 · 语言内核（第 0–4 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L1 → L2 |
| 这一阶段解决 | 从「照着教程敲」到「不查资料也能写出正确代码」 |
| 核心知识 | 类型与集合、异常与 IO、面向对象契约（equals/hashCode）、泛型擦除 |
| 场景项目 | 场景 #1 的简化版：命令行账单工具（先能跑，再谈接口） |
| 离开时应该能 | 写 300 行不查资料的命令行程序；解释集合选型与 `equals` 契约 |

### 第 0 周：环境与工具链

**本周目标**：不依赖 IDE，能用命令行把 `.java` 变成能运行的 class，并说清 `PATH` / `JAVA_HOME` / `classpath`。

#### 步骤 0.1 装 JDK 17 与 Maven

装 Temurin JDK 17、Maven 3.9，设 `JAVA_HOME`，把两者的 `bin` 加进 `PATH`；在 `%USERPROFILE%\.m2\settings.xml` 配阿里云镜像。

:::hint 为什么必须自己配环境
IDE 会替你藏起 `JAVA_HOME` 和 `classpath`，等你在服务器上跑 `java -jar` 报 `no main manifest attribute` 时，就不知道该改哪了。先手动通一遍，后面所有构建报错都能自己定位。
:::

:::solution 验证命令
```powershell
java -version      # 期望 17.x
javac -version     # 期望 17.x（只有 java 没有 javac = 装成了 JRE）
mvn -v             # 输出里应有 Java version: 17
```
三条都对了才算过。版本不一致说明 `PATH` 里还有别的 java，先解决它。
:::

:::error 环境没配好时最常见的三条
```text
'java' 不是内部或外部命令，也不是可运行的程序或批处理文件。
```
↓ PATH 没配，或者配了但没重开终端。

```text
Error: could not open `C:\Program Files\Java\jre1.8\lib\amd64\jvm.cfg'
```
↓ `JAVA_HOME` 指到了 `bin` 目录（或指到了 JRE）。要指到 JDK 根目录。

```text
java.lang.UnsupportedClassVersionError: Hello has been compiled by a more recent version
of the Java Runtime (class file version 61.0), this version ... recognizes only 52.0
```
↓ 用 17 编译、用 8 运行。`javac -version` 和 `java -version` 必须是同一个 JDK。

**怎么读**：先看第一条错误，它通常就是根因；后面的 `Caused by` 才是被包住的下层原因。
:::

#### 步骤 0.2 手敲 Hello.java 并运行

新建 `C:\code\hello\Hello.java`，用 `javac` 编译、`java` 运行，再用 `-cp` 跑一次。

:::hint classpath 到底是什么
`javac` 把源码编译成 `.class`，`java` 负责找类并执行。找的地方就是 **classpath**（默认当前目录）。`java Hello` 不用写 `.class`，是因为 JVM 按类名去找 `Hello.class`。后面 Maven、Spring Boot 的所有「找不到类」，本质都是 classpath 里没有它。
:::

:::solution 完整代码
```java
public class Hello {
    public static void main(String[] args) {
        System.out.println("hello, java " + System.getProperty("java.version"));
    }
}
```

```powershell
javac Hello.java     # 生成 Hello.class
java Hello           # 输出 hello, java 17.x
java -cp . Hello     # 等价：显式指定 classpath
```
:::

:::error 找不到或无法加载主类
```text
错误: 找不到或无法加载主类 Hello
原因: java.lang.ClassNotFoundException: Hello
```
**三个原因，按顺序查**：① 没编译（先 `javac`）；② classpath 不对（`java` 找的是 `.class` 所在目录，不是 `.java`）；③ 类名大小写不一致，或带了 `package` 却没按包路径放。
:::

#### 步骤 0.3 用 Maven 建第一个项目

`mvn archetype:generate` 生成骨架，打开 `pom.xml`，跑 `mvn compile`，最后 `git init` + 第一次 commit。

:::hint Maven 替你做了什么
它定义了**标准目录**（`src/main/java`）、**依赖坐标**（groupId:artifactId:version）、**生命周期**（compile → test → package）。你不需要理解全部，但要记住：`target/` 是构建产物，**不进 git**。
:::

:::solution 命令
```powershell
mvn archetype:generate -DgroupId=com.example -DartifactId=demo -DinteractiveMode=false
cd demo
mvn -q compile
git init; git add .; git commit -m "chore: maven 骨架"
```
:::

**验收**

- [ ] 三条版本命令都正常，且都是 JDK 17
- [ ] 不看笔记能从零敲出 `Hello.java` 并跑出结果
- [ ] 能解释「`java Hello` 为什么不用写 `.class`」
- [ ] Maven 项目能 `mvn compile` 成功

---

### 第 1 周：语法骨架

**本周目标**：掌握类型、控制流、方法、数组；能解释 Java 的「值传递」。

#### 步骤 1.1 亲手验证 `Integer` 的 128 陷阱

写一段代码比较 `==` 和 `equals`，覆盖 127 与 128 两个值。

:::hint 为什么会这样
`-128~127` 的 `Integer` 走的是缓存池，同一个值返回同一个对象，所以 `==` 为 true；超出范围每次 `new`，地址不同。`==` 比的是引用，`equals` 比的是值——**比较值永远用 `equals`**。
:::

:::solution 代码
```java
Integer a = 127, b = 127;
Integer c = 128, d = 128;
System.out.println(a == b);            // true（缓存池）
System.out.println(c == d);            // false（两个对象）
System.out.println(c.equals(d));       // true（比值）
```
:::

#### 步骤 1.2 写一个交换不了的 `swap`

写 `swap(int a, int b)`，在方法里交换，观察调用方没有变化。

:::hint Java 只有值传递
基本类型传的是值的副本；对象传的是**引用的副本**——所以你能改对象内部状态，但改不了「指向谁」。这解释了为什么 `swap` 无效，也解释了为什么方法里 `list.add()` 能生效。
:::

:::solution 代码与结论
```java
static void swap(int a, int b) { int t = a; a = b; b = t; }

public static void main(String[] args) {
    int x = 1, y = 2;
    swap(x, y);
    System.out.println(x + "," + y);   // 1,2 —— 没变
}
```
要真的交换，只能返回数组/用包装类，或者直接在调用方交换。
:::

#### 步骤 1.3 三个小程序练手

命令行写：猜数字（1–100）、九九乘法表、成绩统计（数组，不许用集合）。

:::hint 这一步练的是「输入校验」
初学者 90% 的崩溃都来自「用户不按你说的输入」。每个 `Scanner.nextInt()` 后面都要考虑：输入字母怎么办、输入空行怎么办。先把这三处处理好，比多写十个功能有用。
:::

:::solution 猜数字核心
```java
Scanner sc = new Scanner(System.in);
int target = new Random().nextInt(100) + 1, tries = 0;
while (true) {
    System.out.print("猜一个 1-100：");
    if (!sc.hasNextInt()) { sc.next(); System.out.println("请输入数字"); continue; }
    int guess = sc.nextInt(); tries++;
    if (guess == target) { System.out.println("对了，用了 " + tries + " 次"); break; }
    System.out.println(guess < target ? "小了" : "大了");
}
```
:::

**验收**

- [ ] 能解释 128 现象与 `==`/`equals` 的区别
- [ ] 能解释 `swap` 为什么无效
- [ ] 三个程序输入字母、空行时都不崩溃

---

### 第 2 周：面向对象

**本周目标**：能用类、接口、继承建模；能说清「什么时候用接口，什么时候用抽象类」。

#### 步骤 2.1 写出 `Book` 并重写三个方法

建 `Book`：`isbn / title / author / total / available`；重写 `equals`、`hashCode`、`toString`。

:::hint 为什么 equals 和 hashCode 必须成对
`HashSet`/`HashMap` 先用 `hashCode` 定位桶，再用 `equals` 比较。只重写 `equals`，两个「相等」的对象会落到不同桶里，于是 `set.contains(book)` 返回 false——数据明明在，就是查不到。
:::

:::solution 代码
```java
public class Book {
    private final String isbn;
    private final String title;
    private int available;

    public Book(String isbn, String title, int total) {
        this.isbn = isbn; this.title = title; this.available = total;
    }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Book other)) return false;
        return Objects.equals(isbn, other.isbn);
    }
    @Override public int hashCode() { return Objects.hash(isbn); }
    @Override public String toString() { return title + "(" + isbn + ")"; }

    public boolean borrow() { if (available == 0) return false; available--; return true; }
    public void giveBack() { available++; }
}
```
:::

:::error NullPointerException 只说了半句
```text
Exception in thread "main" java.lang.NullPointerException:
    Cannot invoke "String.length()" because "s" is null
    at com.example.Book.titleLength(Book.java:23)
```
**怎么读**：JDK 14 起，NPE 消息会直接告诉你「谁为 null、在调什么方法」——`because "s" is null` 就是答案。`at` 的第一行是**你的**代码（`Book.java:23`），后面的 `at` 才是 JDK 内部。先看第一行。
:::

#### 步骤 2.2 用接口抽出「可搜索」

定义 `interface Searchable { List<Book> search(String keyword); }`，让 `Library` 实现它。

:::hint 接口 vs 抽象类
接口说「能做什么」（can-do），抽象类说「是什么」（is-a）。`Library` 是「一个图书馆」，但它「能被搜索」——后者是能力，用接口。判断标准：**换一个实现，调用方要不要改**。
:::

:::solution 代码
```java
public interface Searchable {
    List<Book> search(String keyword);
}

public class Library implements Searchable {
    private final List<Book> books = new ArrayList<>();

    @Override
    public List<Book> search(String keyword) {
        return books.stream()
                .filter(b -> b.getTitle().contains(keyword))
                .toList();
    }
}
```
:::

#### 步骤 2.3 借书 / 还书 / 逾期

`Loan` 记录借出时间与应还时间，`LocalDate` 判逾期，输出逾期列表。

:::hint 日期不要自己算
用 `LocalDate.now().isAfter(dueDate)`，不要用毫秒差除以 86400000——夏令时、时区、闰秒都会让你少一天。`java.time` 就是为这个存在的。
:::

:::solution 代码
```java
public record Loan(Book book, String user, LocalDate borrowDate, LocalDate dueDate) {
    public boolean overdue() { return LocalDate.now().isAfter(dueDate); }
}

List<Loan> overdue = loans.stream().filter(Loan::overdue).toList();
overdue.forEach(l -> System.out.println(l.user() + " 逾期：" + l.book()));
```
:::

**验收**

- [ ] 能演示「只重写 equals 不重写 hashCode」导致的 `contains` 失败
- [ ] 能说出你在这个项目里为什么选了接口
- [ ] 借书 / 还书 / 逾期三个功能都能跑通

---

### 第 3 周：集合、泛型、Stream

**本周目标**：选型不靠猜；能用 Stream 把「循环 + if」重写成一行。

#### 步骤 3.1 用代码测出集合的差异

分别用 `ArrayList` 和 `LinkedList` 做 10 万次「尾部追加」和「头部插入」，打印耗时。

:::hint 结论要自己测出来
`ArrayList` 随机访问 O(1)、中间插入 O(n)（要搬元素）；`LinkedList` 插入 O(1)，但**找位置**是 O(n)。所以「LinkedList 插入快」只在「已经拿到节点」时成立——日常增删查，`ArrayList` 几乎总是更优。
:::

:::solution 测量代码
```java
static long time(Runnable r) {
    long t = System.nanoTime(); r.run(); return (System.nanoTime() - t) / 1_000_000;
}

List<Integer> array = new ArrayList<>();
List<Integer> linked = new LinkedList<>();
System.out.println("尾部追加 array=" + time(() -> { for (int i = 0; i < 100_000; i++) array.add(i); }));
System.out.println("尾部追加 linked=" + time(() -> { for (int i = 0; i < 100_000; i++) linked.add(i); }));
```
:::

:::error 边遍历边删元素：ConcurrentModificationException
```text
Exception in thread "main" java.util.ConcurrentModificationException
    at java.base/java.util.ArrayList$Itr.checkForComodification(ArrayList.java:1013)
    at java.base/java.util.ArrayList$Itr.next(ArrayList.java:967)
```
**原因**：`for (Book b : books) { if (...) books.remove(b); }` —— 迭代器发现集合被改了。
**改法**：`books.removeIf(b -> ...)`，或显式 `Iterator<Book> it = books.iterator(); it.remove();`。
:::

#### 步骤 3.2 复现 HashMap 的并发问题

用 10 个线程各往同一个 `HashMap` 里 put 1000 次，统计最终 size；再换 `ConcurrentHashMap` 对比。

:::hint 为什么 size 会变小
`HashMap` 的 `put` 是「读桶 → 改链表 → 写回」，扩容时还会整表搬迁，全程没有同步。并发写会互相覆盖，甚至把链表写坏。`ConcurrentHashMap` 用 CAS + 分段锁（JDK8 是桶级 `synchronized`）保证安全。
:::

:::solution 代码
```java
Map<Integer, Integer> unsafe = new HashMap<>();
IntStream.range(0, 10).parallel().forEach(t -> {
    for (int i = 0; i < 1000; i++) unsafe.put(t * 1000 + i, i);
});
System.out.println("HashMap size = " + unsafe.size());   // 常见 < 10000

Map<Integer, Integer> safe = new ConcurrentHashMap<>();
// 同样循环，结果稳定 10000
```
:::

#### 步骤 3.3 用 Stream 做词频 TopN

读一个文本文件，统计词频，输出前 10。

:::hint Stream 的三段式
`source`（`Files.lines`）→ `中间操作`（`flatMap`/`filter`/`collect`）→ `终端操作`（`forEach`/`toList`）。写不出来时先想清楚「我要的是 Map 还是 List」，再倒推用哪个收集器。
:::

:::solution 代码
```java
Map<String, Long> freq = Files.lines(path)
        .flatMap(line -> Arrays.stream(line.split("\\s+")))
        .filter(w -> !w.isBlank())
        .collect(Collectors.groupingBy(w -> w, Collectors.counting()));

freq.entrySet().stream()
        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
        .limit(10)
        .forEach(e -> System.out.println(e.getKey() + " " + e.getValue()));
```
:::

**验收**

- [ ] 能说出 `ArrayList` 随机访问 O(1)、中间插入 O(n) 的原因
- [ ] 能解释 `HashMap` 为什么线程不安全，并能复现 size 变小
- [ ] 能用 Stream 完成分组、排序、去重、取 TopN

---

### 第 4 周：异常、IO、JSON + 小项目「记账本」

**本周目标**：程序出错时**知道错在哪**，数据能落盘。

#### 步骤 4.1 用 try-with-resources 管资源

分别用「手动 close」和「try-with-resources」读文件，中间故意抛异常，观察资源是否释放。

:::hint 为什么老代码里全是 finally
`BufferedReader` 必须关，否则文件句柄泄漏，跑久了报 `Too many open files`。手写 `finally { close() }` 容易漏、也容易在 close 时再抛异常。`try-with-resources` 由编译器生成关闭逻辑，**而且关闭异常不会吞掉业务异常**。
:::

:::solution 代码
```java
try (BufferedReader r = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
    String line;
    while ((line = r.readLine()) != null) System.out.println(line);
}   // 不用写 close，异常也会正确关闭
```
:::

#### 步骤 4.2 用 Jackson 读写 JSON

定义 `Record` 记录（日期/金额/分类/备注），用 `ObjectMapper` 序列化到文件并读回。

:::hint 字符集是国内最常见的乱码来源
Windows 默认 GBK，Linux 默认 UTF-8。读写文件**永远显式指定 `StandardCharsets.UTF_8`**，不要依赖平台默认值——否则本地正常、上线乱码。
:::

:::solution 代码
```java
public record RecordItem(LocalDate date, BigDecimal amount, String category, String note) {}

ObjectMapper om = new ObjectMapper()
        .registerModule(new JavaTimeModule())
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

List<RecordItem> items = List.of(new RecordItem(LocalDate.now(), new BigDecimal("12.50"), "餐饮", "午饭"));
om.writerWithDefaultPrettyPrinter().writeValue(new File("data.json"), items);

List<RecordItem> back = om.readValue(new File("data.json"),
        om.getTypeFactory().constructCollectionType(List.class, RecordItem.class));
```
:::

:::error Jackson 不认识 LocalDate
```text
com.fasterxml.jackson.databind.exc.InvalidDefinitionException:
Java 8 date/time type `java.time.LocalDate` not supported by default:
add Module "com.fasterxml.jackson.datatype:jackson-datatype-jsr310"
```
**原因**：自己 `new ObjectMapper()` 时没注册 `JavaTimeModule`（Spring Boot 默认已经配好了）。
**改法**：`.registerModule(new JavaTimeModule())`，并且 `.disable(WRITE_DATES_AS_TIMESTAMPS)`，否则日期会变成数组。
:::

#### 步骤 4.3 拼出「记账本」

命令行菜单：添加 / 按月统计 / 按分类统计 / 导出 CSV；数据存 JSON；文件不存在自动初始化。

:::hint 先画数据流再写代码
`main` 只做「读命令 → 分发」；`Store` 只做「读写文件」；`Report` 只做「统计」。三层各写一个类，`main` 里串起来。**不要把所有逻辑塞进 main**——第 8 周你会感谢现在分层了。
:::

:::solution 骨架
```java
public static void main(String[] args) {
    Store store = new Store(Path.of("data.json"));
    Report report = new Report(store.load());
    Scanner sc = new Scanner(System.in);
    while (true) {
        System.out.println("1 添加  2 按月统计  3 按分类统计  4 导出CSV  0 退出");
        switch (sc.nextLine().trim()) {
            case "1" -> { store.add(readItem(sc)); System.out.println("已添加"); }
            case "2" -> report.byMonth().forEach((k, v) -> System.out.println(k + " " + v));
            case "3" -> report.byCategory().forEach((k, v) -> System.out.println(k + " " + v));
            case "4" -> report.exportCsv(Path.of("report.csv"));
            case "0" -> { return; }
            default -> System.out.println("无效输入");
        }
    }
}
```
:::

**验收**

- [ ] 程序重启后数据还在
- [ ] 输入 `abc` 当金额时给友好提示，不打印堆栈
- [ ] 代码里没有一处空的 `catch {}`
- [ ] 能说出受检异常和运行时异常分别适合什么场景

---

## 阶段二 · 工程与数据（第 5–8 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L2 |
| 这一阶段解决 | 从「能跑」到「能被别人用、能被自己改」——测试、分层、SQL、并发 |
| 核心知识 | JUnit、Maven 生命周期、事务与索引、线程池与竞态 |
| 场景项目 | 场景 #1：内容社区 API 的数据层（帖子/评论/分页），先不接框架 |
| 离开时应该能 | 交付一个带测试的多层项目；演示事务回滚；解释线程池参数 |

目标：**在没有框架的情况下**，把「分层、测试、数据库、并发」这四件事做对。框架会替你做事，但不会替你思考。

### 第 5 周：测试与构建

**本周目标**：写出「改坏了会红」的测试。

#### 步骤 5.1 写第一个会失败的测试

给记账本加 `JUnit 5` 依赖，写一个 `assertThrows` 测试：金额为负时抛 `IllegalArgumentException`，**先让它失败**，再补实现。

:::hint 为什么要先红再绿
测试的价值不在于「跑过」，而在于「**改坏的时候会红**」。先写断言、再写实现，你才能确认这个测试真的在检查东西。直接写实现再补测试，很容易写成「怎么实现就怎么断言」，等于没测。
:::

:::solution 代码
```java
@Test
void 金额为负应拒绝() {
    Store store = new Store(tempFile());   // 每个测试用独立临时文件
    assertThrows(IllegalArgumentException.class,
            () -> store.add(new RecordItem(LocalDate.now(), new BigDecimal("-1"), "餐饮", "")));
}

@Test
void 金额为零应允许() {
    // 边界值：0 是合法输入，别把 <0 写成 <=0
}
```
:::

:::error 测试一个都没跑
```text
Tests run: 0, Failures: 0, Errors: 0, Skipped: 0
```
**这不是通过，是没找到测试。** 三查：① 类名不以 `Test` 结尾（Surefire 默认只扫 `*Test`）；② 方法上没有 `@Test`；③ 依赖里只有 `junit-jupiter-api` 没有 `junit-jupiter-engine`。
:::

#### 步骤 5.2 用参数化测试覆盖边界

用 `@ParameterizedTest` + `@CsvSource` 把「金额」的边界写成一张表。

:::hint 测试数据要写成表
边界值（0、负数、超大数、空字符串、超长备注）用表格驱动，一行一个用例。这比复制十遍测试方法可读，而且加用例只加一行。
:::

:::solution 代码
```java
@ParameterizedTest(name = "金额 {0} → {1}")
@CsvSource({
        "0,       true",
        "0.01,    true",
        "-0.01,   false",
        "99999999,true"
})
void 金额边界(String amount, boolean ok) {
    RecordItem item = new RecordItem(LocalDate.now(), new BigDecimal(amount), "餐饮", "");
    assertEquals(ok, item.valid());
}
```
:::

**验收**

- [ ] `mvn test` 全绿
- [ ] **变异检验**：随便改坏一处业务逻辑，测试必须变红；改回来必须变绿
- [ ] 能说出「这个测试为什么值得写」

---

### 第 6 周：SQL 与 JDBC

**本周目标**：能设计表、写事务，并知道**为什么不能用字符串拼 SQL**。

#### 步骤 6.1 建表、加索引、看执行计划

建 `account` 表，插 1 万条数据，对 `WHERE category = ?` 做 `EXPLAIN`，对比「有索引 / 无索引」。

:::hint 索引不是越多越好
索引加速查询，但拖慢写入（每次 insert 要维护 B+ 树），还占空间。判断标准：**高频出现在 WHERE / ORDER BY 里的列**才建；区分度低的列（比如性别）建了也没用。
:::

:::solution SQL
```sql
CREATE TABLE account (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  happened_at DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  category VARCHAR(32) NOT NULL,
  note VARCHAR(200),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_category (category),
  KEY idx_happened_at (happened_at)
);

EXPLAIN SELECT * FROM account WHERE category = '餐饮';   -- 看 key 列是否命中 idx_category
```
:::

#### 步骤 6.2 亲手演示一次 SQL 注入

用字符串拼出登录 SQL，输入 `' OR '1'='1` 绕过；再改成 `PreparedStatement`，确认绕过失败。

:::hint 为什么占位符能防住
拼接时，用户输入会被当成 **SQL 语法**解析；`PreparedStatement` 先把语句结构发给数据库，参数走单独的协议通道，输入永远只能是**值**，不会被解析成语法。
:::

:::solution 对比代码
```java
// ❌ 注入：输入  ' OR '1'='1  即可绕过
String sql = "SELECT * FROM users WHERE name='" + name + "' AND pwd='" + pwd + "'";

// ✅ 安全：? 是占位符，参数只当值
String sql = "SELECT * FROM users WHERE name=? AND pwd=?";
try (PreparedStatement ps = conn.prepareStatement(sql)) {
    ps.setString(1, name);
    ps.setString(2, pwd);
    try (ResultSet rs = ps.executeQuery()) { return rs.next(); }
}
```
:::

:::error 连不上数据库的两个不同错误
```text
java.sql.SQLException: Access denied for user 'root'@'localhost' (using password: YES)
```
↓ **账号密码或权限问题**。`using password: YES` 说明密码传了但不对；`using password: NO` 说明根本没配密码。

```text
Communications link failure
The last packet sent successfully to the server was 0 milliseconds ago.
```
↓ **网络问题**，不是密码：MySQL 没启动 / 端口不对 / 防火墙 / `useSSL` 与服务器配置不匹配。先 `telnet 127.0.0.1 3306` 确认端口通不通。
:::

#### 步骤 6.3 写一个会回滚的转账

`A` 扣钱、`B` 加钱，中间抛异常，验证两边都没变。

:::hint 事务的边界在哪
`setAutoCommit(false)` 之后，**所有写操作在 commit 之前都不生效**。回滚就是把这段区间撤销。生产里这段通常由 `@Transactional` 管理，但你要先手写一遍，才知道它到底包住了什么。
:::

:::solution 代码
```java
try (Connection conn = dataSource.getConnection()) {
    conn.setAutoCommit(false);
    try {
        update(conn, from, -amount);
        if (amount.signum() < 0) throw new IllegalStateException("金额非法");
        update(conn, to, amount);
        conn.commit();
    } catch (Exception e) {
        conn.rollback();     // 关键：异常时必须回滚
        throw e;
    }
}
```
:::

**验收**

- [ ] 能演示事务回滚：中途抛异常，两张表都没变
- [ ] 能解释 `PreparedStatement` 为什么能防注入
- [ ] 能用 `EXPLAIN` 看出走了哪个索引

---

### 第 7 周：并发

**本周目标**：知道线程池怎么配、共享状态怎么坏、死锁怎么来。

#### 步骤 7.1 配一个线程池并触发拒绝策略

用 `ThreadPoolExecutor` 显式构造（核心 2、最大 4、队列 2），提交 10 个任务，观察拒绝策略。

:::hint 七参数里最关键的是队列
任务进来先占核心线程 → 满了进队列 → 队列满了才扩到最大线程 → 再满就触发拒绝策略。所以**队列无限大会导致最大线程永远用不上**，任务堆积到 OOM。`Executors.newFixedThreadPool` 的队列就是无界的，生产禁用。
:::

:::solution 代码
```java
ThreadPoolExecutor pool = new ThreadPoolExecutor(
        2, 4, 60, TimeUnit.SECONDS,
        new ArrayBlockingQueue<>(2),                    // 有界队列
        new ThreadPoolExecutor.AbortPolicy());          // 满了抛异常，而不是静默丢弃

for (int i = 0; i < 10; i++) {
    try { pool.submit(() -> { Thread.sleep(500); return null; }); }
    catch (RejectedExecutionException e) { System.out.println("被拒绝：第 " + i + " 个"); }
}
pool.shutdown();
```
:::

#### 步骤 7.2 复现竞态并用 Atomic 修好

1000 个线程各对同一个 `int` 加 1，结果小于 1000；换成 `AtomicInteger` 后结果正确。

:::hint i++ 不是原子操作
它由「读 → 加 → 写」三步组成，中间可能被别的线程插进来，两次加只生效一次。`AtomicInteger.incrementAndGet()` 用 CPU 的 CAS 指令保证三步不可分割。`volatile` 只保证可见性，**不保证原子性**。
:::

:::solution 代码
```java
int[] bad = {0};
AtomicInteger good = new AtomicInteger(0);

IntStream.range(0, 1000).parallel().forEach(i -> { bad[0]++; good.incrementAndGet(); });
System.out.println("int=" + bad[0] + " atomic=" + good.get());   // 常见 int<1000
```
死锁现场：两个线程分别锁 A、B 又互相等对方，用 `jps` 找到进程号后 `jstack <pid>`，搜 `Found one Java-level deadlock`。
:::

**验收**

- [ ] 能说清 7 个参数与拒绝策略
- [ ] 能解释 `volatile` 解决什么、不解决什么
- [ ] 能在 `jstack` 输出里认出死锁

---

### 第 8 周：综合小项目（不用框架）

**本周目标**：把前 8 周缝成一个**分层清晰、有测试、能跑**的项目。

#### 步骤 8.1 先定分层和接口，再写实现

任务管理器：`model` / `dao` / `service` / `cli` 四层；先写 `TaskDao` 接口，再写 JDBC 实现。

:::hint 接口先行是为了能测
`Service` 依赖 `TaskDao` 接口，测试时传一个内存实现，就不需要连数据库。如果 `Service` 里直接 `new JdbcTaskDao()`，这个测试永远跑不快、跑不稳。
:::

:::solution 骨架
```java
public interface TaskDao {
    long insert(Task t);
    List<Task> findAll();
    void updateStatus(long id, Status s);
    void delete(long id);
}

public class TaskService {
    private final TaskDao dao;
    public TaskService(TaskDao dao) { this.dao = dao; }
    public void complete(long id) {
        dao.updateStatus(id, Status.DONE);
    }
}
```
:::

#### 步骤 8.2 写 README 并按它重跑一遍

README 写清：建库 SQL、启动命令、测试命令。**照着 README 从零跑一遍**，卡住的每一步都补进去。

:::hint README 是验收工具
你自己跑不卡，不代表别人不卡——你机器上装过的东西、配过的路径，别人都没有。把「别人 10 分钟能跑起来」当验收标准，你会被迫补全所有隐式前提。
:::

:::solution README 模板
```markdown
## 运行
1. 建库：mysql -u root -p < schema.sql
2. 改配置：复制 config.example.properties → config.properties，填数据库密码
3. 编译：mvn -q compile
4. 运行：mvn -q exec:java -Dexec.mainClass=com.example.Main
## 测试
mvn test
```
:::

**验收**

- [ ] 分包结构合理，改一个功能不跳 3 个以上文件
- [ ] `mvn test` 全绿，至少 15 个测试
- [ ] 别人按 README 能在 10 分钟内跑起来

---

## 阶段三 · 框架与服务（第 9–12 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L2 → L3 |
| 这一阶段解决 | 从「会写业务」到「会设计服务边界」——IoC、持久层、契约、鉴权 |
| 核心知识 | Spring 容器与 AOP、MyBatis-Plus、校验与错误码、拦截器与 RBAC |
| 场景项目 | 场景 #2：订单与库存（事务 + 幂等 + 超卖），接口先写契约再写实现 |
| 离开时应该能 | 设计出一套「别人敢调」的接口；挡住越权；说清框架替你做了什么 |

目标：**用 Spring Boot 把第 8 周的项目改造成 REST 服务**，并且知道框架替你做了什么。

### 第 9 周：Spring 核心

**本周目标**：写第一个接口，理解 IoC 与配置。

#### 步骤 9.1 第一个 Controller（构造器注入）

```java
@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    private final TaskService service;
    public TaskController(TaskService service) { this.service = service; }

    @GetMapping
    public List<Task> list() { return service.findAll(); }

    @PostMapping
    public Task create(@RequestBody Task task) { return service.create(task); }
}
```
`curl` 打一遍，看请求怎么进来、JSON 怎么出去。

:::hint 为什么不用 @Autowired 字段注入
构造器注入能保证依赖**不为 null**、能写成 `final`、也能在测试里直接 `new` 出来。字段注入靠反射赋值，脱离容器就不可用——这是 Spring 官方推荐的写法，也是本项目的写法。
:::

:::solution 验证命令
```bash
curl -s http://127.0.0.1:8080/api/tasks
curl -s -X POST http://127.0.0.1:8080/api/tasks -H 'Content-Type: application/json' -d '{"title":"写代码"}'
```
返回 200 且 JSON 字段名与你定义的一致，才算通。
:::

:::error 端口被占用
```text
***************************
APPLICATION FAILED TO START
***************************
Description:
Web server failed to start. Port 8080 was already in use.
```
**查是谁占的**：`netstat -ano | findstr :8080` 拿到 PID → `taskkill /PID <pid> /F`；或者干脆 `server.port=8081`。
:::

#### 步骤 9.2 配置外置与多环境

把数据库地址从代码挪到 `application.yml`，用环境变量覆盖，再加一个 `dev` profile。

:::hint 配置优先级
命令行参数 > 环境变量 > `application-{profile}.yml` > `application.yml`。**密码永远不进代码、不进 git**；本地用 `.env`，服务器用环境变量。
:::

:::solution 配置
```yaml
spring:
  datasource:
    url: ${DB_URL:jdbc:mysql://127.0.0.1:3306/demo?useSSL=false}
    username: ${DB_USER:root}
    password: ${DB_PASSWORD:}
```
```bash
java -jar app.jar --spring.profiles.active=dev
DB_PASSWORD=xxx java -jar app.jar      # 环境变量覆盖
```
:::

**验收**

- [ ] 能解释「为什么 `@Autowired` 能注入」（本质是容器按类型找 Bean）
- [ ] 能说出单例 Bean 的坑（不要在 Controller 里存请求状态）
- [ ] 能改端口 / 改数据源而不改代码

---

### 第 10 周：持久层（MyBatis-Plus）

**本周目标**：用 Mapper 完成 CRUD，并亲手复现一次事务失效。

#### 步骤 10.1 Mapper 与条件构造器

定义 `TaskMapper extends BaseMapper<Task>`，用 `LambdaQueryWrapper` 写条件查询，加分页。

:::hint 什么时候用 Wrapper，什么时候写 SQL
单表条件查询用 Wrapper，可读、防拼错字段；多表关联 / 复杂统计写 XML 或 `@Select`。**永远不要拼字符串 SQL**，参数一律 `#{}`。
:::

:::solution 代码
```java
public interface TaskMapper extends BaseMapper<Task> {}

List<Task> todo = mapper.selectList(
        new LambdaQueryWrapper<Task>()
                .eq(Task::getStatus, "TODO")
                .orderByDesc(Task::getCreatedAt));
```
:::

#### 步骤 10.2 复现 `@Transactional` 失效

写一个 `Service`，在**同类内部**用 `this.methodB()` 调用带 `@Transactional` 的方法，观察异常后没有回滚。

:::hint 为什么自调用失效
Spring 的事务靠**代理对象**：外部调用先进代理 → 开事务 → 调真实方法。类内部 `this.xxx()` 走的是原始对象，绕过了代理，注解等于没写。修法：拆到另一个 Bean，或注入自己（`@Lazy`），或改用 `TransactionTemplate`。
:::

:::solution 反例与修法
```java
@Service
public class TaskService {
    public void outer() {
        this.inner();        // ❌ 不经过代理，@Transactional 不生效
    }

    @Transactional(rollbackFor = Exception.class)
    public void inner() { throw new RuntimeException("boom"); }
}
```
```java
// ✅ 拆到独立 Bean（推荐）：调用方注入 InnerService
@Service
public class InnerService {
    @Transactional(rollbackFor = Exception.class)
    public void inner() { ... }
}
```
:::

:::error 抛了异常但没回滚
**现象**：`outer()` 里调用带 `@Transactional` 的方法，抛异常后数据仍然写进去了。
**三个原因，按顺序查**：
1. **自调用**——同一个类里 `this.inner()`，绕过了代理（本周步骤 10.2 就是复现它）；
2. **异常被吞**——`catch (Exception e) { log.warn(...) }`，代理根本看不到异常；
3. **只回滚运行时异常**——受检异常要写 `@Transactional(rollbackFor = Exception.class)`。
:::

**验收**

- [ ] 能演示事务回滚：两张表都没变
- [ ] 能复现并修复一次自调用失效
- [ ] 会用 Wrapper 写条件查询

---

### 第 11 周：接口工程化

**本周目标**：接口「能被别人安全调用」，而不只是「能返回数据」。

#### 步骤 11.1 参数校验 + 统一异常

用 `@Valid` + `@NotBlank` / `@Min` 校验入参，用 `@RestControllerAdvice` 统一返回错误体。

:::hint 为什么不能把 Entity 直接返回
Entity 里有 `password`、`deleted` 这类字段，直接返回等于泄露；而且字段一改，前端跟着崩。用 DTO 进、VO 出，**接口形状由你控制**，不由数据库表决定。
:::

:::solution 代码
```java
public record TaskCreateReq(@NotBlank String title, @Min(1) @Max(5) int priority) {}

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> badRequest(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + " " + f.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return ResponseEntity.badRequest().body(Map.of("error", msg));
    }
}
```
:::

#### 步骤 11.2 分页与幂等

统一分页返回 `{items, total, limit, offset}`；给「创建订单」这类接口加幂等键。

:::hint 幂等的判断标准
同一个请求重复发 N 次，结果与发 1 次相同。做法：客户端带 `requestId`，服务端对 `requestId` 建唯一索引，插入冲突时直接返回上次结果。**没有唯一约束的「先查再插」在并发下一定漏**。
:::

:::solution 代码
```java
public record PageResult<T>(List<T> items, long total, int limit, int offset) {}

// 幂等：唯一索引 + 捕获重复键
try {
    orderMapper.insert(order);                 // uk_request_id 唯一
} catch (DuplicateKeyException e) {
    return orderMapper.findByRequestId(req.requestId());
}
```
:::

**验收**

- [ ] 每个接口都有 200 / 400 / 404 / 500 的正确响应
- [ ] 错误响应格式统一，且**不返回堆栈**
- [ ] 能说出「什么接口需要幂等」

---

### 第 12 周：鉴权

**本周目标**：能实现登录、权限判断，并挡住越权访问。

#### 步骤 12.1 登录 + 拦截器

登录成功签发 HMAC 签名 token 写进 `HttpOnly` Cookie；拦截器校验签名与过期时间。

:::hint 为什么用 HttpOnly Cookie
`localStorage` 里的 token 能被任意 JS 读走（XSS 一打就中）。`HttpOnly` 让 JS 根本读不到，浏览器自动携带；再配 `SameSite=Lax` 挡 CSRF。签名用 HMAC，**密钥只在服务端**，客户端改不了内容。
:::

:::solution 代码
```java
String payload = uid + "." + exp;
String sig = hmacSha256(payload, secret);        // 服务端密钥
String token = payload + "." + sig;

Cookie cookie = new Cookie("session", token);
cookie.setHttpOnly(true);
cookie.setPath("/");
cookie.setMaxAge(7 * 24 * 3600);
response.addCookie(cookie);
```
:::

#### 步骤 12.2 用两个账号验证越权

A 登录后访问 B 的任务详情，必须 403；不带 cookie 访问，必须 401。

:::hint 越权要测「别人的资源 id」
把 `id` 换成别人的，服务端必须校验 `task.userId == 当前用户`。只在列表接口做过滤是不够的——详情、修改、删除**每一个**按 id 操作的接口都要校验。
:::

:::solution 期望结果
```text
GET /api/tasks/1       无 cookie          → 401
GET /api/tasks/1       A 的 cookie        → 200
PATCH /api/tasks/1     B 的 cookie        → 403
```
这三条都对了，鉴权才算做完。
:::

:::error 401 和 403 别混
| 状态码 | 含义 | 常见原因 |
|---|---|---|
| **401** | 没登录 / 会话过期 | Cookie 没带上、跨域没带 `credentials`、token 过期 |
| **403** | 登录了，但没这个权限 | 角色没勾这页、接口要求超管、资源不属于你 |

最容易误判的一种：后端把未登录**302 跳到登录页**，前端只看到 200 的 HTML，于是「请求成功但没有数据」。看响应头里的 `Location`，或者用 `fetch` 的 `redirect: "manual"` 判断。
:::

**验收**

- [ ] 能复现并修复越权访问
- [ ] 能解释 `HttpOnly` 防的是什么攻击
- [ ] 权限判断只在服务端

---

## 阶段四 · 交付与实战（第 13–16 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L3 |
| 这一阶段解决 | 从「本机能跑」到「线上能跑、坏了能查、敢回滚」 |
| 核心知识 | 结构化日志、指标、压测、部署与回滚、读真实代码 |
| 场景项目 | 场景 #3 通知中心 / #5 开放网关（二选一），必须能部署并压测 |
| 离开时应该能 | 独立发布一次；给出 QPS/P95；说出「坏了怎么发现、怎么回滚」 |

目标：**从「我这儿能跑」到「别人能用、坏了能查」。**

### 第 13 周：日志、指标、压测

#### 步骤 13.1 用 MDC 串起一个请求

在 Filter 里生成 `requestId` 放进 MDC，日志格式加上 `%X{rid}`，一次请求的所有日志都能 grep 到一起。

:::hint 没有请求 ID 的日志等于没有
一个接口打 5 条日志，并发时全混在一起。有了 `requestId`，出问题时先拿到客户端的时间点和参数，再 grep 这一个 ID，整条链路一目了然。
:::

:::solution 代码
```java
@Component
public class RequestIdFilter extends OncePerRequestFilter {
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String rid = req.getHeader("X-Request-Id");
        if (rid == null || rid.isBlank()) rid = UUID.randomUUID().toString().substring(0, 8);
        MDC.put("rid", rid);
        res.setHeader("X-Request-Id", rid);
        try { chain.doFilter(req, res); } finally { MDC.remove("rid"); }
    }
}
```
:::

#### 步骤 13.2 压测找拐点

用 `wrk`（Windows 可用 `k6`）压核心接口，记录 QPS、P95、错误率，逐步加压直到 P95 超 500ms。

:::hint 看什么指标
先看**错误率**（从 0 开始涨的点），再看 **P95**（不是平均值，平均值会骗人），最后看瓶颈在哪：CPU、连接池、数据库慢查询、还是 GC。
:::

:::solution 命令
```bash
wrk -t4 -c100 -d30s http://127.0.0.1:8080/api/tasks
k6 run --vus 50 --duration 30s script.js     # 跨平台更稳
```
记录成一张表：并发 10/50/100/200 各一行 QPS 与 P95。
:::

**验收**

- [ ] 能从日志还原一次完整请求
- [ ] 能说出你的接口 P95 是多少、瓶颈在哪
- [ ] 压测时 CPU / 内存 / 连接池哪个先满

---

### 第 14 周：部署

#### 步骤 14.1 打包并外置配置

`mvn package` 产出 fat jar，`java -jar` 跑起来，密码用环境变量传，**不进 jar**。

:::hint 为什么配置必须外置
jar 是构建产物，打进 jar 的密码会跟着 jar 被复制、被备份、被误传。环境变量或外部配置文件让「同一份 jar 部署到任意环境」成为可能。
:::

:::solution 命令
```bash
mvn -q -DskipTests package
DB_PASSWORD=xxx java -jar target/app.jar --server.port=8080
# 后台常驻 + 限制内存
nohup java -Xms256m -Xmx512m -jar app.jar > app.log 2>&1 &
```
:::

:::error jar 里没有主类
```text
no main manifest attribute, in app.jar
```
**原因**：这个 jar 不是 Spring Boot 的 fat jar。要么没配 `spring-boot-maven-plugin` 的 `repackage`，要么打出来的是原始 jar（没有把依赖一起打进去）。
**判断**：`java -jar` 能跑起来的 jar，`BOOT-INF/` 目录一定存在。
:::

#### 步骤 14.2 systemd 守护 + nginx 反代

写一个 unit 文件让服务开机自启；nginx 反代到 `127.0.0.1:8080`，配 HTTPS。

:::hint 为什么不用 nohup
`nohup` 起的进程，机器重启就没了、崩了也不会拉起、日志还会无限增长。`systemd` 负责自启、自动重启、日志轮转，这是生产的最低要求。
:::

:::solution unit 与 nginx
```ini
[Unit]
Description=myapp
After=network.target

[Service]
WorkingDirectory=/opt/myapp
EnvironmentFile=/opt/myapp/.env
ExecStart=/usr/bin/java -Xmx512m -jar /opt/myapp/app.jar
Restart=always

[Install]
WantedBy=multi-user.target
```
```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header X-Real-IP $remote_addr;
}
```
改完先 `nginx -t`，通过再 `systemctl reload nginx`。
:::

**验收**

- [ ] 服务器重启后服务自动起来
- [ ] 改配置不用重新打包
- [ ] 外网可访问且有 HTTPS

---

### 第 15 周：综合项目（毕业设计）

#### 步骤 15.1 先写接口文档，再写代码

短链服务（或文件分享）：先把 5 个接口的「入参 / 出参 / 错误码 / 权限」写成表，评审后再动手。

:::hint 为什么先写文档
接口是前后端、你和三个月后的你之间的**契约**。先定契约，实现可以改；先写实现，契约就被实现绑架了——改一个字段，调用方全崩。
:::

:::solution 接口表模板
| 方法 | 路径 | 入参 | 出参 | 错误码 |
|---|---|---|---|---|
| POST | `/api/links` | `{url}` | `{code, shortUrl}` | 400 非法 URL / 401 未登录 |
| GET | `/{code}` | — | 302 Location | 404 不存在 / 410 已过期 |
| GET | `/api/links?page=` | `page,size` | `{items,total}` | 401 |
:::

#### 步骤 15.2 让别人按 README 跑一遍

找一个人（或换台干净机器），只看 README，30 分钟内跑起来。**他卡住的每一处，都是你的 bug。**

:::hint 这才是真正的验收
你自己跑通只证明「代码在你机器上能跑」。别人跑不通，说明依赖没写、步骤缺了、配置有隐式前提——这些在真实交付里全是事故。
:::

:::solution 交付清单
```text
□ README：建库、配置、启动、测试、部署
□ 接口文档：5 个接口的契约
□ 测试：单测 + 至少 3 个接口测试
□ 部署：一键脚本或 systemd unit
□ 压测：QPS 与 P95 数据
```
:::

**验收**：别人 30 分钟内跑起来；接口文档与实现一致；压测有数据。

---

### 第 16 周：读真实项目，做一次真实提交

#### 步骤 16.1 走通 `notelab-java` 的一条链路

按 `NoteLabApplication → MenuController → PermService → MenuTree` 读一遍，回答：请求从哪进来、鉴权在哪一层、数据从哪出。

:::hint 读代码的顺序
不要从第一个文件读起。从一个**你熟悉的接口**倒推：`curl` 打到它 → 找到 Controller → 看它调了谁 → 一路往下。读一条链路，比读十个文件有用。
:::

:::solution 三个问题的参考答案
1. **请求从哪进**：nginx `/api/` → `127.0.0.1:8001` → Spring MVC 按 `@RequestMapping` 分发。
2. **鉴权在哪层**：`ApiPermInterceptor`（`/api/**`）+ 各 Controller 的 `AuthUtil.user()`，双层。
3. **数据从哪出**：静态门面 `XxxDao` → MyBatis-Plus `Mapper` → MySQL；出口统一是 `Map<String,Object>`。
:::

#### 步骤 16.2 做一次真实上线

挑一个小需求（给接口加一个只读字段 / 加一个查询参数），走完：写测试（红）→ 改代码（绿）→ 本地构建 → 推送 → 部署 → 线上验证。

:::hint 上线前问自己三个问题
**坏了会怎样？我怎么发现？怎么回滚？** 三个都答不上，就不要上线。这个项目的规范是「构建失败不重启，老进程继续服务」，你要知道这一点才能安心发版。
:::

:::solution 流程
```bash
git push origin main
ssh myapp "/root/Notelab/notelab-java/ops/sync-deploy.sh notelab-java"
# 探活：/api/menu 返回 401 即为正常（本服务没有 /api/health）
```
:::

:::error push 了但线上没变
**这不是缓存问题，先看部署日志**：`/root/ops/sync-deploy-<仓>.log`。
该脚本的设计是「**构建失败不重启**」——老进程继续对外服务，所以表现成「代码推上去了，行为没变」。
另外两种：`git pull` 因为工作区脏被拒绝执行（有人手改过服务器）；或者改的仓和部署的仓不是同一个。
:::

**验收**

- [ ] 10 分钟内能说清 `notelab-java` 的请求链路
- [ ] 有一次真实上线（哪怕只加了一个字段）
- [ ] 能回答「坏了会怎样 / 怎么发现 / 怎么回滚」

---

## 阶段五 · 深度与诊断（第 17 周）

| 项 | 内容 |
|---|---|
| 能力跃迁 | L3 巩固 |
| 这一阶段解决 | 把「感觉有点慢」变成「哪个线程、哪段代码、哪次 GC」 |
| 核心知识 | GC 日志、线程栈、CPU 采样、堆直方图 |
| 场景项目 | 场景 #4 报表导出：故意制造一次 OOM，再用工具定位到具体代码 |
| 离开时应该能 | 10 分钟内定位一次内存或 CPU 问题，并给出修复方案 |

### 第 17 周：JVM 与线上诊断

**本周目标**：能读懂一次 GC、一次线程栈、一次 CPU 采样——这是 L3 和 L2 最直观的分界线。

#### 步骤 17.1 打开 GC 日志并读懂它在说什么

用固定堆 + `-Xlog:gc*` 启动你的服务，跑一轮压测，读日志回答：Young GC 多频繁？有没有 Full GC？单次停顿多长？

:::hint 为什么要固定 Xms = Xmx
堆在运行中伸缩会带来额外的扩容/缩容停顿，线上机器的内存本来就是独占的，固定住更稳。`-Xlog` 是新版统一日志，取代了 `-XX:+PrintGCDetails` 那套老参数。
:::

:::solution 启动参数与读法
```bash
java -Xms512m -Xmx512m \
     -Xlog:gc*:file=/var/log/app/gc.log:time,uptime,level,tags \
     -jar app.jar
```
```text
[2026-10-19T10:00:01.120+0800][1.2s] GC(12) Pause Young (Normal) (G1 Evacuation Pause) 210M->48M(512M) 12.4ms
[2026-10-19T10:03:44.001+0800][223s] GC(88) Pause Full (System.gc()) 480M->470M(512M) 3800ms
```
- `Young` 频繁、单次 10–30ms：正常；
- 出现 `Full`：要么堆不够，要么有对象一直活着（泄漏）；
- `480M->470M`：回收后几乎没降，**这就是泄漏的样子**。
:::

#### 步骤 17.2 用 jstack 找阻塞与死锁

压测时导出线程栈，找出占着锁不放的线程；再故意写一个死锁，看 JDK 自己怎么报告。

:::hint 线程状态要先认全
`RUNNABLE` 不代表在跑，可能在等 IO；`BLOCKED` 是在等锁；`WAITING/TIMED_WAITING` 在等条件。**大量线程卡在同一个锁上**，就是吞吐上不去的直接原因。死锁时 JVM 会直接给你一段 `Found one Java-level deadlock`。
:::

:::solution 命令与读法
```bash
jps -l                       # 找 pid
jstack <pid> > /tmp/stack.txt
grep -c "java.lang.Thread.State: BLOCKED" /tmp/stack.txt
grep -A 15 "Found one Java-level deadlock" /tmp/stack.txt
```
```text
"pool-1-thread-3" #23 waiting to lock <0x000000076ab1> (a java.lang.Object)
   held by thread "pool-1-thread-1"
```
读法：先看 `held by` 指向谁，再看那个线程在等什么——这就是环路。
:::

#### 步骤 17.3 用采样找出 CPU 热点

用 JFR（JDK 自带）或 async-profiler 采 30 秒，找出占 CPU 最多的 3 个方法。

:::hint 采样 vs 插桩
采样（JFR / async-profiler）开销低、能看火焰图；插桩（老式 profiler）会改变执行时序。线上优先用采样，**别在高峰期开调试级日志**。
:::

:::solution 命令
```bash
# 方式一：JFR（零依赖）
java -XX:StartFlightRecording=duration=60s,filename=/tmp/app.jfr -jar app.jar
jfr print --events jdk.ExecutionSample /tmp/app.jfr | head -50

# 方式二：async-profiler（火焰图更直观）
./asprof -d 30 -f /tmp/flame.html <pid>
```
读火焰图：**横轴是占用比例，越宽越热**；找最宽的「塔底」方法，那就是热点入口。
:::

**验收**

- [ ] 能说出自己服务的 Young GC 频率与单次停顿
- [ ] 能从 jstack 里认出 BLOCKED 的锁持有者
- [ ] 能用 JFR 或 async-profiler 指出一个 CPU 热点方法

---

## 怎么读报错（比背错误信息有用）

报错不是「失败通知」，是**别人写好的一份诊断报告**。会读的人 5 分钟定位，不会读的人改三天。

### 三条通用规则

1. **先看第一行，不是最后一行**。最后一行往往是 `Caused by` 的根因，但第一行通常已经说了「哪个类、什么错」。
2. **在 `at` 里找第一个属于你代码的栈帧**。`at com.example.Book.borrow(Book.java:23)` 才是要改的地方；`at java.base/...` 是 JDK 内部，改不了也不用看。
3. **一次只改一个变量**。报错给了行号就只改那一处，改完重跑；一次改五处，出错就不知道是谁的问题。

### 「报错 → 先查什么」对照表

| 报错关键字 | 先查什么 |
|---|---|
| `ClassNotFoundException` | 依赖有没有加、类名拼错、jar 冲突 |
| `NoSuchMethodError` | 依赖版本冲突（编译时是新版，运行时是旧版） |
| `UnsupportedClassVersionError` | 编译与运行用的 JDK 版本不一致 |
| `Port already in use` | 谁占了端口（`netstat -ano`），或改端口 |
| `Communications link failure` | 网络 / 端口 / 防火墙，**不是密码** |
| `Access denied for user` | 账号密码 / 权限，**不是网络** |
| `OutOfMemoryError: Java heap space` | 一次查太多、没分页、或真泄漏；先看 `-Xmx` |
| `StackOverflowError` | 递归没有终止条件 / 对象循环引用 |
| `ConcurrentModificationException` | 遍历时改了集合，用 `removeIf` |
| `Tests run: 0` | 测试没被扫到，不是通过 |
| `no main manifest attribute` | 不是 Spring Boot 的 fat jar |

### 报错信息本身也是你写的代码

```java
// ❌ 半年后：这是啥？
throw new RuntimeException("error");

// ✅ 半年后：一眼知道哪个订单、什么状态、为什么不行
throw new IllegalStateException("订单 " + id + " 当前状态 " + status + "，不能取消");
```

**记住**：你写下的每一条异常消息，都是写给未来半夜排查问题的自己。

---

## 每周固定动作

| 时间 | 动作 |
|---|---|
| 每天 30 分钟 | 敲当天的代码 / 读一段源码，**不做笔记也不算完成** |
| 每天收工 | `git commit`，信息写清「做了什么」 |
| 每周日 30 分钟 | 复盘三问：哪个判断被推翻了？哪个坑文档里没写？下周第一步是什么？ |

**复盘模板**

```text
## 第 N 周复盘
- 本周完成：
- 卡最久的问题：            怎么解决的：
- 哪个「我以为对」的认知被推翻了：
- 下周第一步：
```

---

## 卡住了怎么办

| 症状 | 先做什么 |
|---|---|
| 编译报错看不懂 | 读**第一行**错误，往往不是最后一行；`javac` 会指明文件:行号 |
| 程序能跑但结果不对 | 关键位置打日志，先构造最小复现，不要靠猜 |
| 依赖下载不下来 | 检查 `settings.xml` 镜像、代理、`~/.m2` 缓存 |
| 不知道选哪个方案 | 写出两个方案各 3 行取舍，选**改动小的那个** |
| 看教程都懂、自己写就卡 | 正常。关掉教程，从「能跑的最小版本」开始加功能 |

---

## 场景实践库（可迭代的扩展点）

这条路线的「熟练」不能只靠读文档，必须落到具体业务。下面每个场景都是**一份可独立交付的需求**，也是这份路线后续扩展的主要入口。

| # | 场景 | 业务背景 | 交付物 | 考察点 | 建议阶段 |
|---|---|---|---|---|---|
| 1 | 内容社区 API | 帖子 / 评论 / 点赞，列表要分页、搜索要快 | REST 接口 + 表结构 + 索引 | 分页、N+1、索引、缓存 | 二 |
| 2 | 订单与库存 | 下单扣库存，不能超卖；重复提交不能多扣 | 下单接口 + 幂等 + 对账脚本 | 事务、乐观锁、幂等 | 三 |
| 3 | 通知中心 | 站内信 / 邮件，失败要重试、不能丢 | 异步任务 + 重试 + 死信表 | 线程池、退避、幂等 | 四 |
| 4 | 报表导出 | 百万行导出 CSV，不能 OOM | 流式导出 + 进度查询 | 游标查询、流式写、内存控制 | 五 |
| 5 | 开放网关 | 给第三方调用的 API，要鉴权 / 限流 / 灰度 | 拦截器链 + 令牌桶 + 开关 | 拦截器、限流、配置化 | 四 |
| 6 | 文件服务 | 大文件上传、断点续传、下载鉴权 | 分片上传 + 合并 + 签名 URL | 流、分片、存储、安全 | 四 |

**每个场景的统一交付标准**：

- 有表结构与索引说明，能解释每个索引为什么建；
- 有测试：正常路径 + 至少 3 条异常路径；
- 有压测数据（QPS / P95 / 错误率）；
- 有一页 README：怎么跑、怎么造数据、怎么回滚。

**怎么用**：不必按顺序全做。学完哪个阶段，就挑「建议阶段」匹配的那一个；一个做完再换。**一个场景只考察 1–2 个点**，不要做成大杂烩。

**已展开的场景**：#2 订单与库存 → 见下方「场景详解（模板）」，其余场景按同一格式展开（用户故事 / 契约 / 数据模型 / 验收脚本 / 参考实现）。

## 场景详解（模板）：订单与库存

> 这是场景库 #2 的**完整需求文档**，也是其余场景的展开模板。五段式：
> **用户故事 → 接口契约 → 数据模型 → 验收脚本 → 参考实现**。
> 判断一份场景文档合不合格：别人只看这一篇，能不能直接开工。

### 一、用户故事

- 作为买家，我提交订单后能拿到订单号；**网络重试不会让我被扣两次**。
- 作为买家，库存不足时我要看到明确原因，而不是「系统错误」。
- 作为运营，我能用一条命令验出「20 个人同时抢 10 件，最后只卖出 10 件」。

### 二、接口契约

| 方法 | 路径 | 入参 | 成功 | 失败 |
|---|---|---|---|---|
| POST | `/api/orders` | `{sku, qty, requestId}` | 201 `{orderId, status}` | 400 参数非法 / 409 库存不足 / 409 重复提交（返回原 orderId） |
| GET | `/api/orders/{id}` | — | 200 `{id, sku, qty, status, createdAt}` | 404 |
| GET | `/api/stock/{sku}` | — | 200 `{sku, qty}` | 404 |

**契约先行的三条规矩**：

1. 错误体统一 `{error: string}`，前端只认这个字段；
2. 幂等键由**客户端生成**（`requestId`），服务端只负责去重；
3. `409` 有两种语义（库存不足 / 重复提交），用 `error` 文案区分，不用状态码硬凑。

### 三、数据模型

```sql
CREATE TABLE stock (
  sku  VARCHAR(32) PRIMARY KEY,
  qty  INT NOT NULL,
  version INT NOT NULL DEFAULT 0      -- 乐观锁备用；本场景用条件更新即可
);

CREATE TABLE orders (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  request_id VARCHAR(64) NOT NULL,
  sku        VARCHAR(32) NOT NULL,
  qty        INT NOT NULL,
  status     VARCHAR(16) NOT NULL,     -- CREATED / CANCELLED
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_request_id (request_id),   -- 幂等的唯一保险
  KEY idx_sku (sku)
);
```

**为什么幂等靠唯一索引而不是「先查再插」**：并发下两个请求会同时查到「不存在」，然后都插入。唯一索引 + 捕获 `DuplicateKeyException` 是唯一可靠的做法。

### 四、验收脚本

```bash
BASE=http://127.0.0.1:8080

# 1) 幂等：同一 requestId 打两次，必须返回同一个 orderId
curl -s -X POST $BASE/api/orders -H 'Content-Type: application/json' \
  -d '{"sku":"A","qty":1,"requestId":"r-1"}'
curl -s -X POST $BASE/api/orders -H 'Content-Type: application/json' \
  -d '{"sku":"A","qty":1,"requestId":"r-1"}'      # 期望：同一 orderId

# 2) 超卖：20 并发抢 10 件，成功数必须等于库存
seq 20 | xargs -P20 -I{} curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST $BASE/api/orders -H 'Content-Type: application/json' \
  -d '{"sku":"A","qty":1,"requestId":"r-{}"}' | sort | uniq -c
# 期望：10 个 201，10 个 409

# 3) 库存不足
curl -s -X POST $BASE/api/orders -H 'Content-Type: application/json' \
  -d '{"sku":"A","qty":999,"requestId":"r-999"}'   # 期望 409 + 库存不足
```

### 五、参考实现（先自己写，写完再展开）

:::solution 扣库存 + 幂等 + 事务
```java
// 条件更新：把「扣减」和「够不够」合成一条 SQL，天然防超卖
@Update("UPDATE stock SET qty = qty - #{qty} WHERE sku = #{sku} AND qty >= #{qty}")
int deduct(@Param("sku") String sku, @Param("qty") int qty);
```
```java
@Transactional(rollbackFor = Exception.class)
public Order create(String sku, int qty, String requestId) {
    if (stockMapper.deduct(sku, qty) == 0) {
        throw new InsufficientStockException();   // 影响行数 0 = 库存不够
    }
    Order o = new Order(null, requestId, sku, qty, "CREATED", null);
    orderMapper.insert(o);                        // uk_request_id 兜底幂等
    return o;
}
```
```java
@PostMapping("/api/orders")
public ResponseEntity<?> create(@RequestBody @Valid CreateOrderReq req) {
    try {
        Order o = orderService.create(req.sku(), req.qty(), req.requestId());
        return ResponseEntity.status(201).body(Map.of("orderId", o.getId(), "status", o.getStatus()));
    } catch (DuplicateKeyException e) {
        // 已经下过单：返回原订单，而不是报错
        Order old = orderMapper.findByRequestId(req.requestId());
        return ResponseEntity.ok(Map.of("orderId", old.getId(), "status", old.getStatus()));
    } catch (InsufficientStockException e) {
        return ResponseEntity.status(409).body(Map.of("error", "库存不足"));
    }
}
```
:::

:::hint 三个决策点，写完必须能答上来
1. 为什么用「条件更新」而不是「先查库存再扣」？（后者在并发下必超卖）
2. 为什么幂等靠唯一索引，而不是先 `select` 再 `insert`？
3. 事务里如果先插订单再扣库存，失败时会发生什么？（顺序反过来更安全：先扣库存，失败就回滚）
:::

### 六、评分点（自己给自己打分）

| 项 | 合格 | 熟练 |
|---|---|---|
| 幂等 | 同一 requestId 两次不重复扣 | 并发下也不重复（有唯一索引 + 捕获异常） |
| 超卖 | 能跑通串行场景 | 20 并发下成功数 = 库存 |
| 可观测 | 有日志 | 能按 requestId 串起一次下单 |
| 测试 | 正常路径 | 覆盖并发、库存不足、重复提交 |

---

## 毕业评估（L3 rubric）

不看你「学完了没有」，看你能不能**在不看教程的情况下**做到：

| 维度 | 不合格（L1–L2） | 合格（L2） | 熟练（L3） | 优秀（L4） |
|---|---|---|---|---|
| 设计 | 照着教程抄结构 | 能按需求分层建表 | 能说清取舍与边界，预判扩展点 | 能定义团队规范 |
| 正确性 | 只测 happy path | 有单测与异常路径 | 能想到并发与幂等 | 能设计可验证的契约 |
| 性能 | 不知道 QPS | 能压测并读指标 | 能用工具定位瓶颈 | 能做容量规划 |
| 可维护 | 一个类几百行 | 分层清楚、命名一致 | 改动收敛、可回滚 | 能重构遗留系统 |
| 交付 | 本机能跑 | 能部署、有 README | 有监控与回滚预案 | 能定发布流程 |

**通过标准**：5 个维度里至少 4 个达到「熟练」，且没有「不合格」。

## 后续迭代：怎么往里加东西

这份路线会持续长，但**结构不变**，只做两种加法：

| 加什么 | 怎么加 | 注意 |
|---|---|---|
| 新场景 | 往「场景实践库」加一行 + 写清交付物与验收 | 不改周结构；一个场景只考察 1–2 个点 |
| 新深度周 | 在对应阶段后加 `### 第 N 周`，同步更新「路线总览」与「知识地图」 | 每周必须有一个可验收的产出物，不能只是「了解」 |

**三条红线**：

1. 每个步骤都要有「思路 + 答案」，缺了服务端日志会点名；
2. 场景必须能独立交付（README / 测试 / 数据齐全），否则只是练习题；
3. 不加「以后可能会用」的内容——学完用不上的，三个月后一定忘。

---

## 常见误区

- **只看不写**：看十遍视频，不如自己写一遍、报错一次。
- **一上来学框架**：Spring 的坑，一半是 Java 基础不牢导致的。
- **追求技术栈广度**：这个阶段学 Kafka / 微服务，学完也用不上，三个月就忘。
- **没有测试就重构**：那是赌博，不是工程。
- **把「跑起来」当「做完了」**：能跑、能测、能查、能回滚，才叫做完。
