# Java 从零到独立开发 · 16 周实战路线

> **怎么用**：左边目录跳到本周，每一步都给了「做什么 → 为什么 → 代码」。**思路和代码默认是收起的**，先自己写，卡住了再点开对照——展开就抄，等于白学。
>
> **节奏**：目标 → 步骤（动手）→ 验收 → 记坑。没通过验收，不要进下一周。
>
> **配套**：B 端「编程学习 → 学习路线」里的 Java 课程（每节带随堂测试）；**最终靶场**是本项目自己的后端 `notelab-java`，第 16 周你会在里面提交真正上线的代码。

---

## 这份路线解决什么问题

大多数人的 Java 学习是断的：语法学完去写算法题，框架学完去抄 CRUD，中间**缺三块**，而这三块恰恰是「能独立开发」的分水岭：

| 缺口 | 表现 | 本路线怎么补 |
|---|---|---|
| 语言没吃透 | 集合选型靠猜、`equals`/`hashCode` 不知道为什么要一起重写 | 第 1–4 周只写语言，每条都配「能跑出错误结果」的反例 |
| 工程能力为零 | 不会写测试、不会分层、不会用 Maven | 第 5–8 周先做**没有框架**的项目，把工程习惯焊死 |
| 只会「跑起来」 | 不会部署、不会看日志、不会定位线上问题 | 第 13–16 周压测、部署、读真实项目 |

**先立一条规矩**：每一行代码都要自己敲。可以抄文档里的实现，但敲完必须能回答「这行为什么这么写」——你练的是**判断力**，不是打字。

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

| 阶段 | 周次 | 主题 | 产出物 | 验收方式 |
|---|---|---|---|---|
| 准备 | 第 0 周 | 环境与工具链 | 能手动 `javac` / `java` 跑起来 | 命令行跑通 Hello World |
| 一 · 语言 | 1–4 | 语法、面向对象、集合、异常 IO | 命令行「记账本」 | 能持久化、异常处理干净 |
| 二 · 工程 | 5–8 | 测试、SQL/JDBC、并发、分层 | 带测试的多层任务管理器 | `mvn test` 全绿 |
| 三 · 框架 | 9–12 | Spring Boot、持久层、接口工程化、鉴权 | 带登录的 REST 服务 | 401/403/400/404 都正确 |
| 四 · 上线 | 13–16 | 日志监控、部署、综合项目、读真实代码 | 一个能公网访问的项目 | 别人按 README 能跑起来 |

**时间投入**：每周 8–10 小时。一周只有 4 小时，就把「周」当「双周」用，**不要压缩内容**。

---

## 阶段一 · 语言（第 0–4 周）

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

## 阶段二 · 工程（第 5–8 周）

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

## 阶段三 · 框架（第 9–12 周）

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

**验收**

- [ ] 能复现并修复越权访问
- [ ] 能解释 `HttpOnly` 防的是什么攻击
- [ ] 权限判断只在服务端

---

## 阶段四 · 上线（第 13–16 周）

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

**验收**

- [ ] 10 分钟内能说清 `notelab-java` 的请求链路
- [ ] 有一次真实上线（哪怕只加了一个字段）
- [ ] 能回答「坏了会怎样 / 怎么发现 / 怎么回滚」

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

## 毕业验收清单

全部打勾，才算「能独立开发 Java 项目」：

- [ ] 能从零建 Maven 项目并跑起来，不依赖 IDE 模板
- [ ] 能写有边界的单元测试，并知道它为什么值得写
- [ ] 能设计两张以上有关联的表，写出带索引的查询
- [ ] 能解释并演示事务回滚
- [ ] 能写一个线程池任务并说出参数含义
- [ ] 能用 Spring Boot 写出带校验、统一错误码、分页的 REST 接口
- [ ] 能实现登录 + 权限，并挡住越权访问
- [ ] 能把服务部署到 Linux，配好 nginx 和 HTTPS
- [ ] 能压测并说出瓶颈
- [ ] 能在别人的项目里定位一处逻辑并安全地改掉

---

## 常见误区

- **只看不写**：看十遍视频，不如自己写一遍、报错一次。
- **一上来学框架**：Spring 的坑，一半是 Java 基础不牢导致的。
- **追求技术栈广度**：这个阶段学 Kafka / 微服务，学完也用不上，三个月就忘。
- **没有测试就重构**：那是赌博，不是工程。
- **把「跑起来」当「做完了」**：能跑、能测、能查、能回滚，才叫做完。
