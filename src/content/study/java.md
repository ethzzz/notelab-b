# Java 从零到独立开发 · 16 周实战路线

> **怎么用这份文档**：左边是目录，右边是代码编辑器。每一周都走同一个节奏——**目标 → 任务 → 动手敲 → 验收 → 记坑**。没通过验收，不要进下一周。
>
> **配套内容**：B 端「编程学习 → 学习路线」里的 Java 课程（每节带随堂测试）；**最终靶场**是本项目自己的后端 `notelab-java`（第 16 周你会在里面提交真正上线的代码）。
>
> **这份文档**只解决一件事：让你在 4 个月内，从「语法不熟」走到「能独立把一个 Java 后端做出来并部署上线」。

---

## 这份路线解决什么问题

大多数人的 Java 学习是断的：语法学完去写算法题，框架学完去抄 CRUD，中间**缺三块**，而这三块恰恰是「能独立开发」的分水岭：

| 缺口 | 表现 | 本路线怎么补 |
|---|---|---|
| 语言没吃透 | 集合选型靠猜、`equals`/`hashCode` 不知道为什么要一起重写 | 第 1–4 周只写语言，每一条都配「能跑出错误结果」的反例 |
| 工程能力为零 | 不会写测试、不会分层、不会用 Maven | 第 5–8 周先做**没有框架**的项目，把工程习惯焊死 |
| 只会「跑起来」 | 不会部署、不会看日志、不会定位线上问题 | 第 13–16 周压测、部署、读真实项目 |

**先立一条规矩**：这个路线里，每一行代码都要你自己敲。复制粘贴可以，但敲完必须能回答「这行为什么这么写」。你是在练**判断力**，不是练打字。

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
| 6–7 | 直接从第 5 周开始，但第 6、7 周必须动手，不能只看 |

---

## 路线总览

| 阶段 | 周次 | 主题 | 产出物 | 验收方式 |
|---|---|---|---|---|
| 准备 | 第 0 周 | 环境与工具链 | 能手动 `javac` / `java` 跑起来 | 命令行能跑通 Hello World |
| 一 · 语言 | 1–4 | 语法、面向对象、集合、异常 IO | 命令行「记账本」 | 能持久化、有异常处理 |
| 二 · 工程 | 5–8 | 测试、SQL/JDBC、并发、分层 | 带测试的多层任务管理器 | `mvn test` 全绿 |
| 三 · 框架 | 9–12 | Spring Boot、持久层、接口工程化、鉴权 | 带登录的 REST 服务 | 401/403/400/404 都正确 |
| 四 · 上线 | 13–16 | 日志监控、部署、综合项目、读真实代码 | 一个能公网访问的项目 | 别人按 README 能跑起来 |

**时间投入**：每周 8–10 小时（工作日每天 1 小时 + 周末 3–4 小时）。如果一周只有 4 小时，就把「周」当「双周」用，**不要压缩内容**。

---

## 第 0 周：环境与工具链（3–5 天）

### 目标

不依赖 IDE，能用命令行把一个 `.java` 文件变成能运行的 class，并说清 `PATH` / `JAVA_HOME` / `classpath` 各是什么。

### 任务

1. **装 JDK 17（Temurin 发行版）**
   - 下载后安装，记住安装路径（例如 `C:\Program Files\Eclipse Adoptium\jdk-17.x`）。
   - 设环境变量 `JAVA_HOME` 指向该目录，把 `%JAVA_HOME%\bin` 加进 `PATH`。
   - 验收：**新开一个 PowerShell 窗口**，执行：
     ```powershell
     java -version
     javac -version
     ```
     两条都要输出 `17.x`。版本不一致 = `PATH` 里还有别的 java，先解决它。

2. **装 Maven 3.9**
   - 解压到 `C:\tools\apache-maven-3.9.x`，`MAVEN_HOME` 指向它，`%MAVEN_HOME%\bin` 加进 `PATH`。
   - 在 `%USERPROFILE%\.m2\settings.xml` 配阿里云镜像（国内不配会卡在下载）。
   - 验收：`mvn -v` 输出里能看到 `Java version: 17`。

3. **装 IntelliJ IDEA Community**（免费版够用）。
   - 第一个项目先**不要**用 IDEA 创建，用下面的命令行创建，目的是看清 Maven 到底生成了什么。

4. **手动编译运行**（这是本周最重要的一步）
   ```powershell
   mkdir C:\code\hello
   cd C:\code\hello
   ```
   新建 `Hello.java`：
   ```java
   public class Hello {
       public static void main(String[] args) {
           System.out.println("hello, java " + System.getProperty("java.version"));
       }
   }
   ```
   ```powershell
   javac Hello.java          # 生成 Hello.class
   java Hello                # 运行（不需要写 .class）
   java -cp . Hello          # 等价写法：-cp 指定 classpath
   ```
   **理解点**：`javac` 只负责编译，`java` 负责运行；`classpath` 就是「去哪儿找 class」的路径清单。后面所有构建工具的报错，本质都是 classpath 问题。

5. **建第一个 Maven 项目**
   ```powershell
   mvn archetype:generate -DgroupId=com.example -DartifactId=demo -DinteractiveMode=false
   cd demo
   mvn -q compile
   mvn -q exec:java -Dexec.mainClass=com.example.App   # 第一次会下载插件
   ```
   打开 `pom.xml`，搞清三件事：`groupId/artifactId/version` 是什么、`<dependencies>` 里的坐标怎么来的、`target/` 目录是什么时候生成的。

6. **git**
   ```powershell
   cd C:\code\demo
   git init
   git add .
   git commit -m "chore: maven 骨架"
   ```
   从今天起，**每天至少一次 commit**。这不是形式，是让你随时能回到「上一个能跑的版本」。

### 验收

- [ ] `java -version` / `javac -version` / `mvn -v` 三者都正常，且 JDK 都是 17
- [ ] 能不看笔记，从零手敲 `Hello.java` 并跑出结果
- [ ] 能解释「`java Hello` 为什么不用写 `Hello.class`」
- [ ] Maven 项目能 `mvn compile` 成功

### 常见坑

| 现象 | 原因 | 处理 |
|---|---|---|
| `java` 能用但 `javac` 没有 | 装的是 JRE 不是 JDK | 重装 JDK |
| 改了环境变量没生效 | 旧终端缓存了 PATH | 关掉所有终端重开 |
| Maven 卡在下载 | 没配镜像 / 公司网络 | 配 `settings.xml` 镜像 |
| `mvn` 报 `JAVA_HOME not found` | `JAVA_HOME` 指到了 `bin` 目录 | 指到 JDK 根目录，不是 `bin` |

---

## 阶段一 · 语言（第 1–4 周）

目标：**不看教程，能写出一个几百行、有类有接口、能读写文件、异常处理干净的命令行程序。**

### 第 1 周：语法骨架

**目标**：掌握类型、控制流、方法、数组，能解释 Java 的「值传递」。

**任务**

1. 基本类型 8 种、`String`、包装类型；写一段代码验证：
   ```java
   Integer a = 127, b = 127;
   Integer c = 128, d = 128;
   System.out.println(a == b);   // true  —— 缓存区间 -128~127
   System.out.println(c == d);   // false —— 超出缓存，两个对象
   ```
   **必须亲手跑一遍**，这个坑会跟你很多年。
2. 控制流：`if` / `switch`（注意穿透）/ `for` / `while` / `break` `continue` 带标签。
3. 方法：参数、返回值、重载、可变参数 `int...`。
   - 写一个 `swap(int a, int b)`，发现**交换不了**——因为 Java 只有值传递。这就是理解「对象引用也是值传递」的入口。
4. 数组：一维、二维、`Arrays.sort` / `Arrays.toString` / 越界异常。

**动手**

写三个小程序，全部命令行交互：
- 猜数字（1–100，记录次数）
- 九九乘法表（对齐输出）
- 成绩统计：输入若干分数，输出最高/最低/平均/及格率（用数组，不许用集合）

**验收**

- [ ] 能解释 `==` 和 `equals` 的区别，以及上面的 128 现象
- [ ] 能解释为什么 `swap(int, int)` 交换不了
- [ ] 三个小程序都能跑，且输入非法（字母、空行）时**不崩溃**

**坑**：字符串用 `+` 在循环里拼接；`switch` 忘了 `break`；数组下标从 0 开始。

---

### 第 2 周：面向对象

**目标**：能用类、接口、继承把现实问题建模，能说清「什么时候用接口，什么时候用抽象类」。

**任务**

1. 类与对象：构造器、`this`、`static`、`final`、访问修饰符。
2. 三大特性：封装（私有字段 + 方法）、继承（`extends`）、多态（父类引用指向子类对象）。
3. 抽象类 vs 接口：
   - 抽象类：**is-a**，可以有状态和构造器，单继承。
   - 接口：**can-do**，定义契约，多实现，可有 `default` 方法。
4. `Object` 的三个契约：`equals` / `hashCode` / `toString`。
   ```java
   @Override public boolean equals(Object o) { ... }
   @Override public int hashCode() { return Objects.hash(id); }
   ```
   **反例**：只重写 `equals` 不重写 `hashCode`，把对象放进 `HashSet` 会出现「明明相等却查不到」。

**动手**：图书管理系统（纯内存版，不碰数据库）

```
Book   (isbn, title, author, total, available)
User   (id, name, borrowed)
Loan   (book, user, borrowDate, dueDate)
Library(books, users, loans)  —— 借书、还书、查可借、逾期列表
```

要求：
- `Book` 重写 `equals`/`hashCode`（以 isbn 为准）
- 用接口 `Searchable` 抽出「按标题搜 / 按作者搜」
- 逾期判断用 `LocalDate`，不要自己算天数

**验收**

- [ ] 能说清重写 `equals` 必须重写 `hashCode` 的原因，并能演示反例
- [ ] 能说出你在这个项目里为什么选了接口而不是抽象类
- [ ] 借书/还书/逾期三个功能都能跑通

**坑**：在 `static` 方法里用 `this`；继承过深；把字段写成 `public`。

---

### 第 3 周：集合、泛型、Stream

**目标**：选型不靠猜；能用 Stream 把「循环 + if」重写成一行。

**任务**

1. `List` / `Set` / `Map` 三大接口，以及 `ArrayList` / `LinkedList` / `HashSet` / `TreeSet` / `HashMap` / `TreeMap` 的取舍。
2. `HashMap` 原理（面试必问，也是理解「为什么线程不安全」的入口）：
   - 数组 + 链表 +（JDK 8 起）红黑树；默认容量 16，负载因子 0.75
   - 扩容时重新分配；并发 `put` 可能丢数据
3. 泛型：类型参数、`<? extends T>` / `<? super T>`（PECS）、**类型擦除**（运行时没有泛型信息）。
4. `Stream` / `Lambda` / `Optional`：`filter` / `map` / `sorted` / `collect` / `groupingBy`。
5. `Comparable` vs `Comparator`。

**动手**：把第 1 周的「成绩统计」用 Stream 重写；再写一个「词频统计」：

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

**验收**

- [ ] 能说出 `ArrayList` 随机访问 O(1)、中间插入 O(n) 的原因
- [ ] 能解释 `HashMap` 为什么线程不安全，`ConcurrentHashMap` 大致怎么解决
- [ ] 能用 Stream 完成分组、排序、去重、取 TopN

**坑**：`foreach` 里删元素抛 `ConcurrentModificationException`（用 `Iterator.remove` 或 `removeIf`）；`Arrays.asList` 返回定长列表；`Optional` 当字段用。

---

### 第 4 周：异常、IO、JSON + 小项目「记账本」

**目标**：写出的程序**出错时知道错在哪**，数据能落盘。

**任务**

1. 异常体系：`Throwable` → `Error` / `Exception` → `RuntimeException`。受检异常 vs 非受检异常，什么时候用哪个。
2. `try-catch-finally`、`try-with-resources`（资源自动关闭）、自定义异常。
   ```java
   try (BufferedReader r = Files.newBufferedReader(path)) {
       ...
   }   // 不用手写 close
   ```
3. IO / NIO：`Path` / `Files` / `BufferedReader` / `BufferedWriter`；**字符集统一 UTF-8**（Windows 默认 GBK，这是中文乱码的根源）。
4. JSON：用 Jackson 做序列化 / 反序列化（后面 Spring Boot 用的就是它）。

**动手**：命令行「记账本」

```
功能：添加一笔（日期/金额/分类/备注）、按月统计、按分类统计、导出 CSV
存储：JSON 文件（Jackson 读写）
要求：所有输入都要校验；文件不存在要能自动初始化；异常不能静默吞掉
```

**验收**

- [ ] 程序重启后数据还在
- [ ] 输入 `abc` 当金额时，给出友好提示而不是堆栈
- [ ] 能说出「受检异常」和「运行时异常」分别适合什么场景
- [ ] 代码里没有一处空的 `catch {}`

**坑**：吞异常（`catch (Exception e) {}`）；用平台默认字符集读写；资源没关。

---

## 阶段二 · 工程（第 5–8 周）

目标：**在没有框架的情况下**，把「分层、测试、数据库、并发」这四件事做对。框架会替你做事，但不会替你思考。

### 第 5 周：测试与构建

**目标**：写出「改坏了会红」的测试。

**任务**

1. JUnit 5：`@Test`、`assertEquals` / `assertThrows`、`@BeforeEach`、`@ParameterizedTest`。
2. Maven 生命周期：`compile` → `test` → `package` → `install`；依赖的 `scope`（`compile` / `test` / `provided`）。
3. 测试金字塔：单元测试多、集成测试少；**测试的是行为，不是实现**。
4. 可测性设计：把时间、随机数、文件路径**注入**进去，不要在方法里直接 `new Date()` / `Math.random()`。

```java
public class AccountService {
    private final Clock clock;            // 注入，测试里传固定时间
    public AccountService(Clock clock) { this.clock = clock; }
}
```

**动手**：给第 4 周的记账本补 **20 个测试**，必须包含：
- 正常路径 ×5
- 边界（金额 0、负数、超长备注、空文件）×8
- 异常路径（非法日期、损坏的 JSON、磁盘不可写）×7

**验收**

- [ ] `mvn test` 全绿
- [ ] **变异检验**：随便改坏一处业务逻辑，测试必须变红；改回来必须变绿
- [ ] 能说出「这个测试为什么值得写」

**坑**：测试互相依赖执行顺序；测试里用真实时间导致偶发失败；只测 happy path。

---

### 第 6 周：SQL 与 JDBC

**目标**：能设计表、写事务，并知道**为什么不能用字符串拼 SQL**。

**任务**

1. MySQL 基础：建库建表、主键、外键、索引、`EXPLAIN`。
2. 事务：ACID、隔离级别（重点理解「可重复读」和幻读）、`BEGIN` / `COMMIT` / `ROLLBACK`。
3. JDBC 四件套：`Connection` / `PreparedStatement` / `ResultSet` / 关闭资源。
4. 连接池：HikariCP（Spring Boot 默认就是它），理解「池大小不是越大越好」。
5. **SQL 注入演示**：用字符串拼接登录 SQL，输入 `' OR '1'='1`，亲眼看到绕过；再改成 `PreparedStatement`。

**动手**：把记账本改成 MySQL 版

```
表：account(id, happened_at, amount, category, note, created_at)
    索引：idx_happened_at(happened_at)、idx_category(category)
分层：Dao（只碰 SQL）/ Service（只碰业务）
事务：转账场景（从 A 账户扣、给 B 账户加）必须原子
```

**验收**

- [ ] 能写出「失败时回滚」的转账代码，并演示中途抛异常后两边都没变
- [ ] 能解释 `PreparedStatement` 为什么能防注入
- [ ] 用 `EXPLAIN` 看出 `WHERE category = ?` 走了索引

**坑**：拼接 SQL；忘记 `close` 导致连接池耗尽；事务里做了远程调用。

---

### 第 7 周：并发

**目标**：知道线程池怎么配、共享状态怎么坏、死锁怎么来。

**任务**

1. 线程的三种创建方式；`Runnable` vs `Callable`。
2. `ExecutorService` 与线程池 7 个参数：核心数、最大数、空闲存活、队列、线程工厂、拒绝策略、时间单位。
   - 队列满了 + 最大线程也满了 → 触发拒绝策略（默认 `AbortPolicy` 抛异常）。
3. 同步：`synchronized`、`volatile`、`AtomicInteger`、`ConcurrentHashMap`。
4. 死锁四条件，以及用 `jstack` 看死锁现场。
5. `CompletableFuture` 编排异步任务。

**动手**

- 写一个「并发下载器」：10 个 URL，固定 4 个线程，统计成功/失败
- 写一个「计数器」反例：1000 个线程各加 1，结果小于 1000；再用 `AtomicInteger` 修正
- 制造一次死锁，用 `jps` + `jstack` 找到它

**验收**

- [ ] 能说清线程池 7 个参数，以及「为什么不能用 `Executors.newFixedThreadPool`」
- [ ] 能解释 `volatile` 解决什么、不解决什么
- [ ] 能在 `jstack` 输出里认出死锁

**坑**：共享可变状态没加锁；线程池不关闭导致进程不退出；在锁里做 IO。

---

### 第 8 周：综合小项目（不用框架）

**目标**：把前 8 周的东西缝成一个**分层清晰、有测试、能跑**的项目。

**需求**：命令行任务管理器

```
任务：标题、优先级(高/中/低)、截止日期、状态(待办/完成)
功能：增删改查、按优先级/截止日期排序、逾期提醒
存储：MySQL（DAO 手写 JDBC 或 MyBatis，二选一）
分层：model / dao / service / cli
```

**硬性要求**

- 每一层只做一件事：`cli` 不写 SQL，`dao` 不写业务判断
- Service 层有单元测试（用假的 Dao 实现）
- README 写清：怎么建库、怎么跑、怎么测

**验收**

- [ ] 分包结构合理，改一个功能不用跳 3 个以上文件
- [ ] `mvn test` 全绿，至少 15 个测试
- [ ] 别人拿到仓库，按 README 能在 10 分钟内跑起来

---

## 阶段三 · 框架（第 9–12 周）

目标：**用 Spring Boot 把第 8 周的项目改造成 REST 服务**，并且知道框架替你做了什么。

### 第 9 周：Spring 核心

**任务**

1. IoC / DI：Bean 是什么、容器管什么、为什么不要 `new`。
2. Bean 生命周期与作用域（单例！所以**不要在 Controller 里存请求状态**）。
3. Spring MVC：`@RestController`、`@RequestMapping`、`@PathVariable` / `@RequestParam` / `@RequestBody`、返回 JSON。
4. 自动配置：`@SpringBootApplication` 到底做了什么（组件扫描 + 自动配置 + 配置类）。
5. 配置文件：`application.yml`、多环境 `application-dev.yml`、环境变量覆盖。

**动手**

```java
@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    private final TaskService service;
    public TaskController(TaskService service) { this.service = service; }  // 构造器注入

    @GetMapping
    public List<Task> list(@RequestParam(defaultValue = "0") int page) { ... }
}
```

用 `curl` 打一遍，看请求怎么进来、JSON 怎么出去。

**验收**

- [ ] 能解释「为什么 `@Autowired` 能注入」（你写的其实是构造器注入）
- [ ] 能说出单例 Bean 的坑
- [ ] 能改端口 / 改数据源而不改代码

**坑**：包扫描范围（启动类要放在最外层包）；循环依赖；在单例 Bean 里放可变成员变量。

---

### 第 10 周：持久层（MyBatis-Plus）

**任务**

1. MyBatis-Plus：`BaseMapper`、`@TableName`、`@TableId`、`LambdaQueryWrapper`。
2. 分页插件、逻辑删除、自动填充（`created_at` / `updated_at`）。
3. 事务：`@Transactional` 的 `propagation` / `rollbackFor`，以及**失效场景**（同类内自调用、异常被吞、非 public 方法）。
4. 连接池与慢 SQL 日志。

**动手**：把第 8 周的任务管理器改成 Spring Boot + MyBatis-Plus

```java
@Transactional(rollbackFor = Exception.class)
public void complete(Long id) {
    taskMapper.updateStatus(id, "DONE");
    logMapper.insert(new TaskLog(id, "DONE"));   // 这里抛异常，上面要回滚
}
```

**验收**

- [ ] 能演示一次「事务回滚」：故意抛异常，两张表都没变
- [ ] 能说出一个 `@Transactional` 失效的场景，并在代码里复现
- [ ] 会用 `Wrapper` 写条件查询，不拼 SQL 字符串

---

### 第 11 周：接口工程化

**目标**：接口「能被别人安全调用」，而不只是「能返回数据」。

**任务**

1. DTO / VO / Entity 分层：**不要直接把 Entity 返回给前端**（会泄露字段、绑定耦合）。
2. 参数校验：`@Valid` + `@NotBlank` / `@Min` / `@Pattern`；统一校验失败响应。
3. 统一异常处理：`@RestControllerAdvice` + 自定义业务异常 + **错误码**。
4. 分页：统一 `{items, total, limit, offset}` 契约。
5. 幂等：同一请求重复提交不产生两条数据（唯一键 / 幂等 token）。
6. 限流：令牌桶或固定窗口。

**验收**

- [ ] 每个接口都有：200 / 400 / 404 / 500 的正确响应
- [ ] 错误响应格式统一，且**不返回堆栈**
- [ ] 能说出「什么接口需要幂等」

---

### 第 12 周：鉴权

**任务**

1. 认证 vs 授权：你是谁 / 你能干什么。
2. Session + Cookie：`HttpOnly` / `Secure` / `SameSite` 各防什么。
3. Token：签名（HMAC）、过期时间、刷新。
4. 拦截器 / Filter：在请求进入 Controller **之前**做校验。
5. RBAC：用户 → 角色 → 权限，页面级和接口级两层。

**动手**：给任务管理器加登录与权限

```
未登录访问 /api/tasks → 401
普通用户删别人的任务 → 403
管理员可以删任何任务 → 200
```

**验收**

- [ ] 能复现并修复「越权访问别人的数据」
- [ ] 能解释 `HttpOnly` 防的是什么攻击
- [ ] 权限判断在**服务端**，不在前端

---

## 阶段四 · 上线（第 13–16 周）

目标：**从「我这儿能跑」到「别人能用、坏了能查」。**

### 第 13 周：日志、指标、压测

**任务**

1. SLF4J + Logback：日志级别、滚动策略、**不要在日志里打密码**。
2. MDC 请求 ID：一个请求的所有日志串起来。
3. 指标：QPS、P95、错误率、连接池活跃数。
4. 压测：`wrk` 或 `k6`，找到 QPS 拐点和瓶颈。

**验收**

- [ ] 能从日志里还原一次完整请求
- [ ] 能说出你的接口 P95 是多少、瓶颈在哪
- [ ] 压测时 CPU / 内存 / 连接池哪个先满

---

### 第 14 周：部署

**任务**

1. `mvn package` 产出的 fat jar 怎么运行；`java -jar` 的常用参数（`-Xms` / `-Xmx`）。
2. 配置外置：环境变量 / `.env`，**不要把密码打进 jar**。
3. 进程守护：`systemd`（Linux）或 `pm2`；开机自启。
4. nginx 反向代理 + HTTPS。
5. 健康检查接口（不要用首页代替）。

**验收**

- [ ] 服务器重启后服务自动起来
- [ ] 改配置不用重新打包
- [ ] 能从外网访问，且有 HTTPS

---

### 第 15 周：综合项目（毕业设计）

**题目**：短链服务（或文件分享服务），二选一。

**必须包含**

| 项 | 要求 |
|---|---|
| 接口设计 | 先写文档（入参/出参/错误码），再写代码 |
| 认证 | 登录 + 权限 |
| 数据 | 至少两张表，有索引，有事务 |
| 测试 | 单元测试 + 至少 3 个接口测试 |
| 部署 | 有部署脚本 / 说明，能一键跑起来 |
| 压测 | 有 QPS 数据 |
| 文档 | README + 接口文档 |

**验收**：找一个没用过你项目的人，让他只看 README，30 分钟内跑起来。**他卡住的每一处，都是你的 bug。**

---

### 第 16 周：读真实项目，做一次真实提交

**目标**：从「自己写」跨到「在别人的代码里改」。

**任务**

1. 读 `notelab-java`（本项目的后端），按这条链路走一遍：
   ```
   NoteLabApplication → MenuController → PermService → MenuTree
   ```
   回答三个问题：请求从哪进来、鉴权在哪一层、数据从哪出。
2. 挑一个**小的真实需求**（例如给某个接口补一个只读字段 / 加一个查询参数），走完整流程：
   - 先写测试（红）→ 改代码（绿）→ 本地构建 → 推送 → 部署 → 线上验证
3. 把这周踩到的坑写进「项目实践 → 项目开发总结」。

**验收**

- [ ] 能在 10 分钟内说清 `notelab-java` 的请求链路
- [ ] 有一次真实上线（哪怕只加了一个字段）
- [ ] 能说出「这个改动坏了会怎样、怎么发现、怎么回滚」

---

## 每周固定动作

| 时间 | 动作 |
|---|---|
| 每天 30 分钟 | 敲当天的代码 / 读一段源码，**不做笔记也不算完成** |
| 每天收工 | `git commit`，提交信息写清「做了什么」 |
| 每周日 30 分钟 | 复盘三问：这周哪个判断被推翻了？哪个坑文档里没写？下周第一步是什么？ |

**复盘模板**（复制到你的笔记里）

```
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
| 编译报错看不懂 | 读**第一行**错误，往往不是最后一行；`javac` 的报错会指明文件:行号 |
| 程序能跑但结果不对 | 在关键位置打日志，不要靠猜；先构造最小复现 |
| 依赖下载不下来 | 检查 `settings.xml` 镜像、VPN、`~/.m2` 缓存 |
| 不知道选哪个方案 | 写出两个方案各 3 行的取舍，选**改动小的那个** |
| 看教程都懂，自己写就卡 | 正常。关掉教程，从「能跑的最小版本」开始加功能 |

---

## 毕业验收清单

全部打勾，才算「能独立开发 Java 项目」：

- [ ] 能从零建一个 Maven 项目并跑起来，不依赖 IDE 模板
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

- **只看不写**：看十遍视频，不如自己写一遍报错一次。
- **一上来学框架**：Spring 的坑，一半是 Java 基础不牢导致的。
- **追求技术栈广度**：这个阶段学 Kafka / 微服务，学完也用不上，三个月就忘。
- **没有测试就重构**：那是赌博，不是工程。
- **把「跑起来」当「做完了」**：能跑、能测、能查、能回滚，才叫做完。
