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

**本周目标**：不打开 IDE，在命令行里把 `.java` 编成 `.class`、打成能用 `java -jar` 启动的 jar，并说清 `PATH`、`JAVA_HOME`、`classpath`、`MANIFEST` 各自管什么。

**为什么是这些内容**：第 0 周不教语法，只回答一个问题——一行 Java 代码从文件到运行，中间经过了谁。后面每一周都会撞上这四个概念：第 5 周 `mvn test` 报 `Tests run: 0`，第 9 周 Spring Boot 启动时报 `UnsupportedClassVersionError`，第 14 周打出来的 jar 报 `no main manifest attribute`，第 16 周要在只有 SSH 的机器上判断服务到底起没起。这些都不是业务 bug，而是工具链 bug。IDE 恰恰把这些步骤藏得很好：它自己找 JDK、自己拼 classpath、自己选主类，于是你在 IDE 里永远碰不到它们，也就永远学不会定位。更实际的一点是，Maven 的依赖本质就是往 classpath 里塞 jar，Spring Boot 的胖 jar 本质就是改 MANIFEST 再把依赖打进去——地基不通，后面十几周的框架课只能靠背。跳过这一周的代价是：以后每次报错都先怀疑代码，而真正的原因往往在版本、路径或打包方式上。还有一个现实原因：第 16 周要读真实项目并做一次上线，靠的是 `git push` 加一条部署命令，全程没有图形界面可点。现在把命令行的不适感消化掉，那一周才不会退化成照抄命令。

#### 步骤 0.1 装 JDK 17 与 Maven

装 Temurin JDK 17 和 Maven 3.9。选 17 是硬约束：Spring Boot 3 最低要求 17，本路线所有代码按 17 写，而 `record`、`switch` 表达式、文本块这些第 1、2 周就要用的语法，在 8 和 11 上根本编译不过。Maven 3.9 是当前 3.x 的稳定线，别用 IDE 内置的那份——它的版本通常和命令行不一致，会出现「IDE 能跑、命令行报错」的经典错位。

安装时有两个容易选错的地方。第一，`JAVA_HOME` 要指到 **JDK 根目录**（下面直接有 `bin`、`lib`），不是 `bin`，更不是 JRE。第二，`PATH` 里加的是 `%JAVA_HOME%\bin`，位置要靠前，否则机器上另一个 java 会先被找到。这两条决定了两件事：`java` 命令用哪个 JDK，以及 Maven 用哪个 JDK——Maven 的启动脚本**优先读 `JAVA_HOME`**，不是读 `PATH`，所以完全可能出现 `java -version` 是 17、`mvn -v` 却是 1.8 的错位。

如果 `where java` 的第一条是 `C:\Program Files\Common Files\Oracle\Java\javapath\java.exe`，那是安装器塞的转发器，优先级往往高于你手配的目录，必须显式把它往后挪。

另一个必做项是配镜像。国内直连 Maven 中央仓库经常卡在 Downloading 几分钟然后超时，把阿里云镜像写进 `%USERPROFILE%\.m2\settings.xml`。注意这是用户级配置，不是 Maven 安装目录下的 `conf/settings.xml`——后者会在升级 Maven 时被覆盖。

Temurin 是 Eclipse 维护的 OpenJDK 构建，免费且长期更新；Oracle JDK 17 商用要授权，别给公司机器埋雷。装完可以在 JDK 根目录看到 `bin`、`lib`、`release`，`release` 文件里写着 `JAVA_VERSION="17.0.12"`，这是判断「它到底是不是 17」最硬的证据，比看目录名可靠。

```powershell
# 永久生效请走「系统属性 → 环境变量」，这里先临时设置
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.12.7-hotspot"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path

java -version
javac -version
mvn -v
```

```xml
<!-- %USERPROFILE%\.m2\settings.xml -->
<settings>
  <mirrors>
    <mirror>
      <id>aliyun</id>
      <mirrorOf>central</mirrorOf>
      <url>https://maven.aliyun.com/repository/public</url>
    </mirror>
  </mirrors>
</settings>
```

:::hint JAVA_HOME 与 PATH 分工
`JAVA_HOME` 指向 JDK 根目录，`PATH` 指向它的 `bin`；Maven 只认前者，所以两个都要对，而且改完必须重开终端。
:::

:::solution 三条命令对齐才算过
```powershell
where.exe java
where.exe javac
java -version    # openjdk version "17.0.12" ...
javac -version   # javac 17.0.12
mvn -v           # Apache Maven 3.9.x / Java version: 17.0.12
```
`where.exe` 各只输出一条，且 `mvn -v` 的 Java version 与 `java -version` 同一个小版本，才算配好。若 `where.exe java` 有多条，把不需要的那条从 `PATH` 里删掉，而不是改文件名。以后换机器、上 CI，都先跑这三条，比出了问题再查快得多。
:::

:::error mvn 用的是 1.8，java 却是 17
```text
Apache Maven 3.9.9 (...)
Maven home: C:\apache-maven-3.9.9
Java version: 1.8.0_402, vendor: Oracle Corporation, runtime: C:\Program Files\Java\jre1.8
```
**根因**：Maven 用 `JAVA_HOME` 找 JDK，而 `JAVA_HOME` 还指着旧 JDK 8，或者指到了 JRE。`java -version` 走 `PATH`，所以两者不一致。
**修复**：先 `echo $env:JAVA_HOME` 看当前值，改成 JDK 17 的根目录，重开终端再 `mvn -v`。只改 `PATH` 对 Maven 无效。
:::

#### 步骤 0.2 手敲 Hello.java 并运行

`javac` 是编译器，把 `.java` 变成同目录的 `.class`；`java` 是启动器，按**全限定类名**去 classpath 里找对应的 `.class` 再执行。这里有三个约束，每一个都能单独让你卡住半小时。

第一，`public class Hello` 必须写在 `Hello.java` 里，文件名和类名大小写都要一致——Java 没有「文件名随便起」这回事。第二，`java` 后面跟的是类名，不是文件名：`java Hello` 等于让 JVM 在 classpath 根目录下找 `Hello.class`，所以不能写成 `java Hello.class`。第三，`-cp` 是「去哪里找类的根目录列表」，默认值是当前目录 `.`；一旦你显式写了 `-cp`，默认值就被覆盖，漏掉 `.` 就会找不到类。

带 `package com.example;` 之后，源码要放进 `com\example\` 目录，运行时写全名 `java -cp . com.example.Hello`。第 9 周 Spring Boot 报 `ClassNotFoundException`，九成是这三条里错了一条。

`main` 的签名也是固定的：`public static void main(String[] args)`。少写 `static`，`java` 会报 `Main method not found in class Hello`；`String args[]` 虽然合法，但那是 C 风格，团队代码里别这么写。`args` 装的是命令行参数，`java Hello a b` 会得到长度 2 的数组，直接取 `args[2]` 会抛 `ArrayIndexOutOfBoundsException`，第 1 周会专门练这个边界。

```java
public class Hello {
    public static void main(String[] args) {
        System.out.println("hello, java " + System.getProperty("java.version"));
    }
}
```

```powershell
javac Hello.java                                # 生成 Hello.class
java Hello                                      # hello, java 17.0.12
java -cp . Hello                                # 等价写法
javap -v Hello | Select-String "major version"  # major version: 61
```

`major version: 61` 是 class 文件格式版本 61，对应 Java 17；如果是 52，说明你用的是 JDK 8 编译的。顺带记住 `System.getProperty("java.version")` 读的是**运行时**版本，不是你编译时用的版本；两者不一致，就是第 0.1 节里那个 `UnsupportedClassVersionError`。

:::hint 别用单文件源码启动
`java Hello.java` 也能跑，但它把编译这一步藏起来了。这一周先禁用这种写法，直到你能闭眼说出 `.class` 生成在哪。
:::

:::solution 把包和 -d 用一遍
```java
// src/com/example/Greeting.java
package com.example;

public class Greeting {
    public static void main(String[] args) {
        System.out.println("hello from " + Greeting.class.getPackageName());
    }
}
```
```powershell
javac -d out src\com\example\Greeting.java   # 按包名建目录，输出到 out
java -cp out com.example.Greeting            # hello from com.example
```
`-d` 让 javac 按包名建子目录，这是理解「包名就是目录结构」最快的方式。删掉源码只留 `out`，`java -cp out ...` 依然能跑——证明运行时只需要 class。
:::

:::error 找不到或无法加载主类
```text
错误: 找不到或无法加载主类 Hello
原因: java.lang.ClassNotFoundException: Hello
```
**四个原因，按顺序查**：① 没编译，目录里没有 `Hello.class`，先 `dir *.class`；② 终端不在 classpath 根目录，或 `-cp` 覆盖了默认的 `.`；③ 类名大小写不一致；④ 源码有 `package`，但没用 `-d` 按包输出，也没写全限定名。
:::

#### 步骤 0.3 用 Maven 建第一个项目

Maven 干三件事：约定目录（`src/main/java`、`src/test/java`）、管理依赖（坐标 `groupId:artifactId:version`，下载到 `~/.m2/repository`）、定义生命周期（compile → test → package → install）。你不需要背全部，但要建立直觉：`mvn compile` 不是「编译整个项目」，而是「沿生命周期跑到 compile 阶段为止」，产物在 `target/classes`；`mvn package` 会先跑测试再打 jar。`clean` 不是生命周期里的阶段，而是一次独立执行，所以 `mvn clean package` 与 `mvn package` 的差别是前者先把 `target` 清空。

依赖冲突时用 `mvn dependency:tree` 打印整棵树，看某个坐标是被谁带进来的；`mvn help:effective-pom` 显示父子 pom 合并后的最终配置——「我明明改了 pom 怎么没生效」通常能在这里找到答案。

新手最容易踩的坑是 archetype 生成的 `pom.xml` 里编译器版本很老（source/target 1.7 或 1.8）。这时写 `record` 或 `switch` 表达式，报错不是语法错，而是「records are not supported in -source 8」——看起来像代码问题，其实是 pom 问题。所以建完项目第一件事是打开 pom，把 `maven.compiler.release` 设成 17。

`target/` 是构建产物，必须写进 `.gitignore`；`~/.m2/repository` 是全机共享的依赖缓存，不要提交、也不要手工改里面的文件。初始化仓库后先写 `.gitignore`：`target/`、`.idea/`、`*.iml` 三行就够——判断标准很简单，能由源码重新生成的东西都不该进版本库。

```powershell
mvn archetype:generate -DgroupId=com.example -DartifactId=demo `
  -DarchetypeArtifactId=maven-archetype-quickstart -DinteractiveMode=false
cd demo
mvn -q clean compile
```

```xml
<properties>
  <maven.compiler.release>17</maven.compiler.release>
  <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
</properties>

<build>
  <plugins>
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-compiler-plugin</artifactId>
      <version>3.13.0</version>
    </plugin>
  </plugins>
</build>
```

:::hint 看 Maven 到底做了什么
`-q` 只打错误；去掉它重跑，你会看到它依次用了哪些插件、解析了哪些依赖——排「为什么没生效」时，这比猜快得多。
:::

:::solution 用 javap 验证产物
```powershell
mvn -q clean compile
javap -classpath target\classes com.example.App
# public class com.example.App {
#   public com.example.App();
#   public static void main(java.lang.String[]);
# }
```
`javap` 能读到类，说明 `target\classes` 就是 Maven 的 classpath 根。第 8 周以后你写的每个模块，都是这个结构。
:::

:::error records are not supported in -source 8
```text
[ERROR] .../App.java:[7,16] records are not supported in -source 8
  (use -source 14 or higher to enable records)
```
**根因**：archetype 的 pom 把 source/target 钉在 1.8，或 `maven-compiler-plugin` 版本太老不认 `release`。
**修复**：加 `<maven.compiler.release>17</maven.compiler.release>`，插件升到 3.13.0，`mvn -q clean compile` 重跑。
:::

#### 步骤 0.4 打成可执行 jar，读懂 MANIFEST

jar 就是一个 zip，多了一个 `META-INF/MANIFEST.MF`。`java -jar` 的行为很单纯：读 MANIFEST 里的 `Main-Class`，加载那个类，调 `main`。所以它不看 jar 叫什么名字，也不看里面有几个 main——`Main-Class` 没写或写错，就是 `no main manifest attribute`。产物名是 `artifactId-version.jar`，版本号来自 pom，脚本里别硬编码这个文件名。

`mvn package` 默认打的是「薄 jar」：只有你自己的 class，没有依赖。要让它能 `java -jar` 直接跑，得用 `maven-jar-plugin` 写 `Main-Class`；而 Spring Boot 的「胖 jar」是另一套——repackage 会把依赖放进 `BOOT-INF/lib`，主类换成 `JarLauncher`。第 14 周上线时你会再见到这两者的区别，现在先用 `jar tf` 把它们看清楚。

还有一个细节：`java -jar` 和 `-cp` 同时出现时，`-cp` 会被忽略。依赖必须已经在 MANIFEST 的 `Class-Path` 里，或者被打进了 jar。

薄 jar 缺依赖不会在编译期暴露，而是运行时抛 `NoClassDefFoundError`：编译时依赖在 classpath 里，打包时没进去。第一次见很容易误判成 jar 损坏，其实补依赖或换胖 jar 就好。`jar tf` 只列条目、`jar xf` 只解出指定条目，两个命令都不改 jar 本身，可以反复跑。

MANIFEST 里还能写 `Class-Path: lib/guava.jar`，用相对路径把同目录的 jar 串起来。这是没有 Maven 时手工分发的做法，读懂即可，现在不用。

先确认 `Main-Class` 要指向哪个类。`<mainClass>` 写的是**全限定类名**，必须和 `package` 加类名逐字一致，大小写错了照样报找不到主类：

```java
// src/main/java/com/example/App.java
package com.example;

public class App {
    public static void main(String[] args) {
        System.out.println("hello from jar, java " + System.getProperty("java.version"));
    }
}
```

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-jar-plugin</artifactId>
  <version>3.4.1</version>
  <configuration>
    <archive>
      <manifest>
        <mainClass>com.example.App</mainClass>
      </manifest>
    </archive>
  </configuration>
</plugin>
```

```powershell
mvn -q clean package
java -jar target\demo-1.0-SNAPSHOT.jar
jar tf target\demo-1.0-SNAPSHOT.jar | Select-String "MANIFEST|App.class"
jar xf target\demo-1.0-SNAPSHOT.jar META-INF/MANIFEST.MF
Get-Content META-INF\MANIFEST.MF      # 应有 Main-Class: com.example.App
```

:::hint java -jar 只认 Main-Class
`-jar` 模式下 `-cp` 不生效；想补依赖只能改 MANIFEST 或把依赖打进去，这是胖 jar 存在的理由。
:::

:::solution 一条命令分清薄厚
```powershell
jar tf target\demo-1.0-SNAPSHOT.jar | Select-String "BOOT-INF|MANIFEST"
```
有 `BOOT-INF/` 的是 Spring Boot 胖 jar；只有 `MANIFEST.MF` 和你的包的是薄 jar。薄 jar 缺依赖时报 `NoClassDefFoundError`，把缺的类名拿去 `~/.m2/repository` 里搜，就知道该补哪个坐标。
:::

:::error no main manifest attribute
```text
no main manifest attribute, in demo-1.0-SNAPSHOT.jar
```
**根因**：`maven-jar-plugin` 没配 `mainClass`，MANIFEST 里没有 `Main-Class`；或者你改了 pom 却没重新 `package`，跑的还是旧 jar。
**修复**：补上 `mainClass` 配置，`mvn -q clean package` 重打，再用 `jar xf` 解出 MANIFEST 确认那一行真的在。
:::

**自测**（合上文档回答）

1. `java -version` 是 17、`mvn -v` 却显示 1.8，最可能的原因是什么？该改哪个变量？
2. `java Hello` 时 JVM 按什么规则找 `Hello.class`？显式写 `-cp` 之后为什么必须带上 `.`？
3. 一个 jar 用 `java -jar` 报 `no main manifest attribute`，用哪条命令能立刻判断它是薄 jar 还是 Spring Boot 胖 jar？

**验收**

- [ ] `where.exe java` 与 `where.exe javac` 各只有一条，三条版本命令都显示 17
- [ ] 在空目录手写 `Hello.java`，`javac Hello.java && java Hello` 与 `java -cp . Hello` 都有输出
- [ ] `javap -v Hello` 里能看到 `major version: 61`
- [ ] `mvn -q clean package` 成功，`java -jar target\demo-1.0-SNAPSHOT.jar` 有输出
- [ ] `git status` 里看不到 `target/`，说明 `.gitignore` 生效

---

### 第 1 周：语法骨架

**本周目标**：掌握类型、控制流、方法、数组，能当场解释 Java 的「值传递」，并能把三个小程序收进一个带菜单的入口。

**为什么是这些内容**：第 1 周是从「看得懂」到「写得对」的转折点。语法本身两周就能过完，但这一周真正要建立的是三个反直觉的边界：包装类的对象身份、Java 只有值传递、数组的长度与下标。它们决定了你后面写出的代码是「样例能过」还是「边界也对」。路线里处处要用：第 3 周讲集合选型，前提是你知道 `==` 比的是引用；第 7 周讲 `i++` 不原子、第 17 周看线程栈，前提是你知道变量在栈上还是堆上；第 2 周面向对象要求你会写方法、会传参、会返回结果。不学会的后果不是「写不出来」，而是写出「一半输入正确」的代码——测试用 1 能过，线上用 1000 就挂，而且调试时容易归因错误，把值传递当成「Java 的 bug」。还有个隐性收益：这一周的练习全在命令行里做，你会习惯先读编译错误再改代码，而不是让 IDE 的红线替你思考。

#### 步骤 1.1 亲手验证 `Integer` 的 128 陷阱

自动装箱不是语法糖那么简单：`Integer a = 127` 会被编译成 `Integer.valueOf(127)`，而 `valueOf` 对 -128 到 127 的值直接返回缓存数组里的同一个对象，超出范围才新建。所以 `==` 比的是「是不是同一个对象」，在 127 上碰巧为 true，在 128 上就是 false。这个「碰巧」最坑：测试用 1 通过，线上用 1000 就挂，而且换个 JDK 参数行为还会变。

更绕的是混用类型。`Integer c = 128; c == 128` 为 true，因为右边是 `int`，编译器把左边拆箱成基本类型再比，比的是值。同一个 `==`，两边类型不同，语义就变了。规则只有一条：**包装类比值一律 `equals`，或先 `intValue()` 转成基本类型**；`Objects.equals(a, b)` 还能顺便处理 null。

`Long`、`Short`、`Byte`、`Character` 也有各自的缓存（`Character` 是 0–127），`Double`、`Float` 没有。不用背范围，记住「包装类只保证 `equals` 可靠」就够了。

装箱只发生在三个地方：赋值给包装类型、作为包装类型的参数传入、放进集合。`Integer.parseInt("128")` 返回的是基本类型 `int`，不创建对象；`Integer.valueOf("128")` 才创建。判断 `==` 的结果之前，先在代码里找出装箱点。

```java
import java.util.Objects;

public class Boxed {
    public static void main(String[] args) {
        Integer a = 127, b = 127;
        Integer c = 128, d = 128;
        System.out.println(a == b);        // true：同一个缓存对象
        System.out.println(c == d);        // false：两个新对象
        System.out.println(c.equals(d));   // true：比值
        System.out.println(c == 128);      // true：右侧是 int，c 被拆箱
        System.out.println(Objects.equals(c, d)); // true，且能处理 null
    }
}
```

注意 `c == 128` 这一行：它和 `c == d` 长得像，结果却相反。判断依据不是「值大不大」，而是「两边是不是都是包装类型」。

:::hint 缓存是 valueOf 里的数组
缓存不是编译器魔法，是 `Integer.valueOf` 查的一张静态数组；`new Integer(127)` 永远绕开它（该构造器在 17 已标记废弃，别写）。
:::

:::solution 改一个 JVM 参数，让结论翻转
```powershell
java Boxed                          # false
java -XX:AutoBoxCacheMax=1000 Boxed # true：上界被调到 1000
```
同一段代码、同一个 JDK，只改缓存上界，`c == d` 就从 false 变成 true。这证明结论来自 `valueOf` 的缓存，而不是「128 这个数字特殊」。
:::

:::error 包装类用 == 的两个后果
```text
error: incomparable types: java.lang.Integer and java.lang.Long
```
**根因**：`Integer.valueOf(1) == Long.valueOf(1)` 两边是不同包装类型，`==` 既不能拆箱也不能比较引用，直接编译失败。更隐蔽的版本是 `Integer` 和 `Integer` 比，编译能过、127 为 true、128 为 false，测试偶尔红。
**修复**：统一类型后比 `equals`；确实要比数值就都转成 `int`/`long` 再比。代码评审里见到包装类用 `==`，一律按缺陷提。
:::

#### 步骤 1.2 写一个交换不了的 `swap`

Java 只有值传递，这句话要拆成两半才不绕。调用方法时，实参的值被复制一份给形参：基本类型复制数值，对象复制**引用**。所以在方法里给形参重新赋值，改的只是副本，调用方看不到；但通过这个引用去改对象内部，调用方看得见，因为两边指着同一个对象。

`swap(int a, int b)` 无效就是这个原因：方法里的 `a`、`b` 是两个全新的局部变量，交换它们不影响外面的 `x`、`y`。换成数组就有效，因为数组变量复制的是引用，`arr[0] = ...` 改的是堆上那个数组。同理 `list.add(...)`、`sb.append(...)` 生效，而 `sb = new StringBuilder(...)`、`n = n + 1` 不生效。

想真的交换，让方法**返回**结果，或者传一个可变容器（数组、`AtomicInteger`、自定义 holder）。这也解释了为什么 Java 的 API 大量用返回值，而不是「传出参数」。

`String` 是最典型的反例：`void f(String s) { s += "!"; }` 调用方看不到变化，因为字符串不可变，`+=` 创建的是新对象、只改了副本引用；但方法里 `s.length()` 能读到内容，因为副本指向同一个串。不可变对象 + 值传递，两者叠在一起就容易得出「Java 传引用」的错误结论。

```java
public class PassByValue {
    static void swap(int a, int b) { int t = a; a = b; b = t; }
    static void swap(int[] arr) { int t = arr[0]; arr[0] = arr[1]; arr[1] = t; }
    static void reassign(StringBuilder sb) { sb = new StringBuilder("new"); }
    static void mutate(StringBuilder sb) { sb.append("!"); }

    public static void main(String[] args) {
        int x = 1, y = 2;
        swap(x, y);
        System.out.println(x + "," + y);          // 1,2

        int[] pair = {1, 2};
        swap(pair);
        System.out.println(pair[0] + "," + pair[1]); // 2,1

        StringBuilder sb = new StringBuilder("hi");
        reassign(sb);
        System.out.println(sb);                   // hi：只改了副本
        mutate(sb);
        System.out.println(sb);                   // hi!：改的是同一个对象
    }
}
```

:::hint 引用也是按值传的
方法拿到的是引用的副本：能改它指向的对象，不能让它指向别的对象。画一遍栈帧，这两个「不能」就分清了。
:::

:::solution 用返回值交换
```java
static int[] swapped(int a, int b) { return new int[]{b, a}; }

public static void main(String[] args) {
    int[] r = swapped(1, 2);
    System.out.println(r[0] + "," + r[1]);   // 2,1
}
```
一次返回两个值，用数组或第 2 周的 `record` 都行；核心是「方法不修改调用方的变量，只返回新值」。
:::

:::error 拆箱拆出空指针
```text
Exception in thread "main" java.lang.NullPointerException:
    Cannot invoke "java.lang.Integer.intValue()" because "total" is null
```
**根因**：`Integer total = null; int x = total;` —— 自动拆箱对 null 调 `intValue()`。常见于方法参数写成 `Integer`，调用方传了 null，方法里直接参与算术。
**修复**：能用 `int` 就别用 `Integer`；必须用包装类时先判空，或 `Objects.requireNonNullElse(total, 0)` 给默认值。
:::

#### 步骤 1.3 三个小程序练手

三个小程序看着简单，练的其实是同一件事：把「用户会乱输」当成默认前提。猜数字要处理非数字和超范围；九九乘法表练嵌套循环和格式化输出；成绩统计限定用数组，是为了逼你面对定长、下标和空数组。

`Scanner` 有两个坑。第一，`nextInt()` 遇到字母会抛 `InputMismatchException`，而且**不消费**那段输入，指针停在原地——放进 `while` 就是死循环。第二，`nextInt()` 只读数字不读换行，紧接着 `nextLine()` 会读到一个空串。修法是：读数字前用 `hasNextInt()` 判断，不是数字就 `next()` 把脏 token 丢掉；读字符串前多调一次 `nextLine()` 吃掉残留换行。

成绩统计还要处理「一个成绩都没有」：长度为 0 时求平均会得到 `NaN` 或除零，正确做法是先判断再输出。乘法表也别小看，`printf("%d*%d=%-3d", j, i, i * j)` 里的 `%-3d` 是左对齐占三格，不格式化的话列会歪；会格式化输出，第 4 周导出报表才不用手工补空格。

```java
import java.util.Random;
import java.util.Scanner;

public class Guess {
    public static void main(String[] args) {
        run(new Scanner(System.in));
    }

    static void run(Scanner sc) {
        int target = new Random().nextInt(100) + 1;
        int tries = 0;
        while (true) {
            System.out.print("猜一个 1-100：");
            if (!sc.hasNextInt()) {
                sc.next();                       // 丢掉非数字，否则死循环
                System.out.println("请输入数字");
                continue;
            }
            int guess = sc.nextInt();
            tries++;
            if (guess < 1 || guess > 100) { System.out.println("超出范围"); continue; }
            if (guess == target) {
                System.out.println("对了，用了 " + tries + " 次");
                sc.nextLine();                   // 吃掉残留换行，把输入权交回菜单
                break;
            }
            System.out.println(guess < target ? "小了" : "大了");
        }
    }
}
```

:::hint 输入校验是功能的一部分
每个 `nextInt()` 后面都要能回答：输入字母怎么办、空行怎么办、超范围怎么办。这三个问题答不上，程序就不算写完。
:::

:::solution 成绩统计：只用数组
```java
static void report(int[] scores) {
    if (scores.length == 0) { System.out.println("没有成绩"); return; }
    int sum = 0, pass = 0, max = scores[0];
    for (int s : scores) {
        sum += s;
        if (s >= 60) pass++;
        if (s > max) max = s;
    }
    System.out.printf("人数=%d 平均=%.2f 最高=%d 及格率=%.0f%%%n",
            scores.length, (double) sum / scores.length, max, pass * 100.0 / scores.length);
}
```
注意 `(double) sum` 这个强制转换：两个 `int` 相除是整除，不转会得到 0。
:::

:::error 输入字母后程序疯狂刷屏
```text
Exception in thread "main" java.util.InputMismatchException
	at java.base/java.util.Scanner.throwFor(Scanner.java:939)
	at java.base/java.util.Scanner.next(Scanner.java:1602)
```
**根因**：循环里直接 `nextInt()`，遇到 `abc` 抛异常；即使你 `catch` 住继续循环，Scanner 的指针没动，下一次读到的还是 `abc`。
**修复**：读之前 `hasNextInt()`，为 false 时先 `next()` 把 token 取走再 `continue`；或者统一用 `nextLine()` 读整行再 `Integer.parseInt` 并捕获 `NumberFormatException`。
:::

#### 步骤 1.4 用一个菜单把三个程序串起来

三个程序各自一个 `main` 能跑，但第 4 周的记账本要求一个入口分发多个功能，所以这一步提前练：把每个程序抽成 `static` 方法，`main` 只负责读菜单、分发、循环。

用 Java 17 的 `switch` 表达式，而不是老的 `switch` 语句：`case "1" -> guess();` 不会贯穿（不需要 `break`），每个分支必须有值，编译器帮你堵住「漏写 break 执行到下一个 case」这类错误；需要多行逻辑时用块加 `yield`。`default` 必须写，否则用户输入 `9` 时程序直接退出，看起来像「卡死」。

`var` 只能用在局部变量，且必须有初始值；它不是动态类型，编译后类型就定死了。老式 `switch` 漏写 `break` 会「贯穿」到下一个分支，是 Java 笔试的常客；表达式写法从语法上消除了这个坑，但 `case` 的类型必须和选择子一致——`String` 选择子不能匹配 `int` 常量，否则编译不过。这一节的目标不是多学几个关键字，而是让你习惯「一个方法只做一件事」。

```java
import java.util.Scanner;

public class Menu {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        while (true) {
            System.out.println("1 猜数字  2 乘法表  3 成绩统计  0 退出");
            String choice = sc.nextLine().trim();
            switch (choice) {
                case "1" -> Guess.run(sc);
                case "2" -> table();
                case "3" -> report(readScores(sc));
                case "0" -> { System.out.println("再见"); return; }
                default -> System.out.println("无效输入：" + choice);
            }
        }
    }

    static void table() {
        for (int i = 1; i <= 9; i++) {
            for (int j = 1; j <= i; j++) System.out.printf("%d*%d=%-3d", j, i, i * j);
            System.out.println();
        }
    }

    static int[] readScores(Scanner sc) {
        System.out.print("输入成绩，空格分隔：");
        String line = sc.nextLine().trim();
        if (line.isEmpty()) return new int[0];
        String[] parts = line.split("\\s+");
        int[] scores = new int[parts.length];
        for (int i = 0; i < parts.length; i++) scores[i] = Integer.parseInt(parts[i]);
        return scores;
    }

    static void report(int[] scores) {
        if (scores.length == 0) { System.out.println("没有成绩"); return; }
        int sum = 0;
        for (int s : scores) sum += s;
        System.out.printf("平均=%.2f%n", (double) sum / scores.length);
    }
}
```

:::hint switch 表达式不是语句
它必须产出值，所以 `case` 后面要么是表达式，要么是带 `yield` 的块；`default` 不是可选项，是编译器的要求。
:::

:::solution 先校验再解析
```java
static int[] readScores(Scanner sc) {
    String line = sc.nextLine().trim();
    if (line.isEmpty()) return new int[0];
    String[] parts = line.split("\\s+");
    int[] buf = new int[parts.length];
    int n = 0;
    for (String p : parts) {
        try {
            buf[n++] = Integer.parseInt(p);   // 只把成功的写进去
        } catch (NumberFormatException e) {
            System.out.println("跳过非法成绩：" + p);
        }
    }
    return Arrays.copyOf(buf, n);             // 截掉没用到的位置
}
```
`split("\\s+")` 是正则，`\s` 匹配空格和制表符；输入前后有空格时先 `trim()`，否则会切出空串。`Arrays.copyOf` 按实际有效个数截断——数组是定长的，想「少几个元素」只能复制。记得补 `import java.util.Arrays;`。
:::

:::error 成绩里混进一个字母
```text
Exception in thread "main" java.lang.NumberFormatException:
    For input string: "abc"
	at java.base/java.lang.Integer.parseInt(Integer.java:668)
```
**根因**：`readScores` 直接把每个 token 丢给 `Integer.parseInt`，没校验。字符串转数字失败抛的是 `NumberFormatException`，它属于运行时异常，不强制捕获，所以特别容易漏。
**修复**：先用 `p.matches("\\d+")` 判断，或 `try-catch` 后跳过该项并提示；不要用一个空的 `catch {}` 把错误吞掉，那会让成绩静默变少。
:::

**自测**（合上文档回答）

1. `Integer c = 128, d = 128;` 为什么 `c == d` 是 false，而 `c == 128` 是 true？
2. `swap(int a, int b)` 里明明交换了，调用方为什么没变？换成 `int[]` 为什么就有效？
3. 用 `nextInt()` 读输入时用户敲了 `abc`，会抛什么异常？为什么在循环里会死循环，怎么修？

**验收**

- [ ] `java -XX:AutoBoxCacheMax=1000 Boxed` 让 128 的 `==` 从 false 变 true，能说出原因
- [ ] 写出数组版 `swap` 并演示调用方元素真的交换，同时能解释 `reassign` 为什么无效
- [ ] 三个小程序遇到字母、空行、超范围输入都不打印堆栈，且猜数字不死循环
- [ ] 菜单输入 `9` 或空行时提示「无效输入」并继续，不退出
- [ ] 成绩统计输入空行时提示「没有成绩」，不抛除零或 `NaN`

---

### 第 2 周：面向对象

**本周目标**：能用类和接口给「图书馆」建模，写出符合契约的 `equals`/`hashCode`，并说清什么时候用接口、什么时候用抽象类。

**为什么是这些内容**：第 2 周是第一次把「数据」和「行为」放进同一个类型里设计。前两周写的都是散装方法，这一周开始要回答三个设计问题：哪些字段该私有、这个行为该属于哪个类、两个类之间是「是一种」还是「能做一件事」。路线后面全建在这上面：第 3 周往集合里放对象，去重和查找靠的就是本周的 `equals`/`hashCode`；第 8 周分层是「一层一个类、依赖接口」；第 9 周 Spring 容器管理的 Bean 就是普通对象，第 11 周的 DTO/VO 也是类的设计。不学会的后果很具体：一是写出贫血模型，所有逻辑塞进 `static` 工具类，改一个规则要跳五个文件；二是 `equals`/`hashCode` 写错，`HashSet` 去重失效、`HashMap` 取不到值。第二种最阴——它不报错、不抛异常，只是数据「凭空消失」，你可能查一整天。

#### 步骤 2.1 写出 `Book` 并重写三个方法

先定字段：`isbn`、`title`、`author`、`total` 是身份和属性，创建后不该变，用 `final`；`available` 是可变的库存，只能通过 `borrow()` / `giveBack()` 改。`final` 字段必须在构造器里赋值，编译器会替你检查「忘了初始化」。

`equals` 要满足五条契约：自反、对称、传递、一致、与 `null` 比较返回 `false`。最容易破坏的是对称性——如果 `Book` 允许被继承，子类拿自己的字段做比较，父类用 `instanceof` 判断，就可能出现 `a.equals(b)` 为 true 而 `b.equals(a)` 为 false。最省事的做法是把这个类声明成 `final`，从一开始就不打算被继承；真要扩展就用组合。

`hashCode` 必须和 `equals` 用**同一组字段**，而且只用不会变的字段。`HashSet` 先用 `hashCode` 定位桶、再用 `equals` 比较，两个「相等」的对象如果哈希不同，就会落进不同的桶——数据明明在集合里，`contains` 却返回 false。所以 `available` 绝不能参与哈希：借一次书，对象在集合里就「消失」了。

```java
import java.util.Objects;

public final class Book {
    private final String isbn;
    private final String title;
    private final String author;
    private final int total;
    private int available;

    public Book(String isbn, String title, String author, int total) {
        this.isbn = isbn;
        this.title = title;
        this.author = author;
        this.total = total;
        this.available = total;
    }

    public String getIsbn() { return isbn; }
    public String getTitle() { return title; }
    public String getAuthor() { return author; }
    public int getAvailable() { return available; }

    public boolean borrow() {
        if (available == 0) return false;
        available--;
        return true;
    }

    public void giveBack() {
        if (available < total) available++;   // 防止还书还超
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;           // 自反 + 性能
        if (!(o instanceof Book other)) return false;  // null 也会走到这里
        return isbn.equals(other.isbn);
    }

    @Override
    public int hashCode() { return Objects.hash(isbn); }   // 必须与 equals 同步

    @Override
    public String toString() { return title + "(" + isbn + ")"; }
}
```

`instanceof` 模式匹配（Java 16+）省掉了强转；`Objects.hash` 对 null 安全，字段多时直接列进去。

`toString` 不是装饰：日志、断言失败信息、调试输出都会调它。默认实现打印 `Book@1b6d3586`，对排查毫无帮助；把 isbn 和 title 放进去，线上日志里才能一眼认出是哪本书。反过来，密码、身份证这类字段绝不能进 `toString`——日志会被转发、被采集。

:::hint equals 与 hashCode 用同一组字段
字段不同步是最常见的失误：`equals` 比 isbn，`hashCode` 算 title，两个相等对象的哈希就不同，`HashSet` 永远查不到。
:::

:::solution 只重写 equals 会怎样
```java
final class BadBook {
    private final String isbn;
    BadBook(String isbn) { this.isbn = isbn; }
    @Override public boolean equals(Object o) {
        return o instanceof BadBook b && isbn.equals(b.isbn);
    }
    // 故意不写 hashCode
}

var set = new HashSet<BadBook>();
set.add(new BadBook("978-1"));
set.add(new BadBook("978-1"));
System.out.println(set.size());                        // 2，去重失效
System.out.println(set.contains(new BadBook("978-1"))); // false，查不到
```
把 `hashCode` 补回去，两个输出立刻变成 1 和 true。这就是「数据凭空消失」的现场。
:::

:::error NullPointerException 只说了半句
```text
Exception in thread "main" java.lang.NullPointerException:
    Cannot invoke "String.length()" because "s" is null
    at com.example.Book.titleLength(Book.java:23)
```
**怎么读**：JDK 14 起 NPE 会直接说清「谁为 null、在调什么方法」，`because "s" is null` 就是答案。`at` 的第一行是**你的**代码（`Book.java:23`），后面的 `at` 才是 JDK 内部。
**修复**：在这个例子里是构造器允许了 null 标题；在构造器里 `Objects.requireNonNull(title, "title")`，把失败提前到创建对象时，而不是等到十层调用之后。
:::

#### 步骤 2.2 用接口抽出「可搜索」

需求会变：今天只在内存里搜，明天要加「按作者搜」，后天要换数据库。如果调用方直接依赖 `Library` 这个具体类，每次加能力都得改调用方。接口的作用是把「调用方需要什么」和「谁来实现」拆开：调用方只写 `Searchable`，传进来的是内存实现还是 JDBC 实现，它不关心。

接口和抽象类的分工可以一句话记：接口说「能做什么」（can-do），抽象类说「是什么」（is-a），并且抽象类能带状态和共享代码。`Library` 是「一个图书馆」，同时它「能被搜索」——后者是能力，用接口。判断标准是：**换一个实现，调用方要不要改**。要改，说明抽象漏了；不用改，接口就抽对了。

具体实现里有两个细节。第一，关键词匹配要忽略大小写，并且用 `toLowerCase(Locale.ROOT)`，不要用默认 locale——土耳其语环境里 `I` 的小写不是 `i`，服务器换个区域设置结果就变。第二，`null` 和空串要提前挡掉，否则 `keyword.toLowerCase()` 直接空指针。接口的方法参数是契约的一部分，调用方传 null 算违约，但实现方仍应该给出确定行为。

```java
// Searchable.java
import java.util.List;

public interface Searchable {
    List<Book> search(String keyword);
}
```

```java
// Library.java
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class Library implements Searchable {
    private final List<Book> books = new ArrayList<>();

    public void add(Book book) { books.add(book); }

    @Override
    public List<Book> search(String keyword) {
        if (keyword == null || keyword.isBlank()) return List.of();
        String kw = keyword.toLowerCase(Locale.ROOT);
        return books.stream()
                .filter(b -> b.getTitle().toLowerCase(Locale.ROOT).contains(kw))
                .toList();
    }
}
```

`toList()` 返回不可变列表（Java 16+），调用方拿到后不能改，这正是你想要的：搜索结果不该反过来影响库存。

:::hint 接口是能力，抽象类是血缘
判断方法：把「是一个」和「能做一个」分别套进句子，读着通顺的那个就是答案；两个都通顺时，选接口，因为 Java 只能单继承。
:::

:::solution 换实现，调用方一行不改
```java
public class AuthorIndex implements Searchable {
    private final List<Book> books;
    public AuthorIndex(List<Book> books) { this.books = books; }

    @Override
    public List<Book> search(String keyword) {
        return books.stream()
                .filter(b -> b.getAuthor().contains(keyword))
                .toList();
    }
}

static void printMatches(Searchable s, String kw) {
    s.search(kw).forEach(System.out::println);
}
```
`printMatches` 的参数类型是接口，传 `Library` 或 `AuthorIndex` 都能编译——这就是「面向接口编程」的实际收益，第 5 周写测试时你会用它传入假实现。
:::

:::error 搜索传 null 直接空指针
```text
Exception in thread "main" java.lang.NullPointerException:
    Cannot invoke "String.toLowerCase()" because "keyword" is null
```
**根因**：`search(null)` 时实现里先调了 `keyword.toLowerCase()`；接口没写清 null 的语义，调用方也没判。
**修复**：实现开头 `if (keyword == null || keyword.isBlank()) return List.of();`，并在接口注释里写明「null 视为无结果」。别用 `Optional` 包参数，那是给返回值的。
:::

#### 步骤 2.3 借书 / 还书 / 逾期

借阅是一条有状态的记录：谁、借了哪本、什么时候借、什么时候该还。用 `record` 描述它最合适——`Loan` 是值对象，身份由四个字段共同决定，`record` 自动生成 `equals`/`hashCode`/`toString` 和访问器，省掉一整屏样板代码。

日期一律用 `java.time`。判断逾期用 `LocalDate.now().isAfter(dueDate)`；算逾期天数用 `ChronoUnit.DAYS.between(dueDate, now)`。不要用毫秒差除以 86400000：夏令时那天不是 24 小时，闰秒、时区偏移都会让你少算一天，而「逾期一天」在业务上可能要罚款。

`record` 的紧凑构造器适合放校验：应还日期早于借出日期，直接抛 `IllegalArgumentException`，让坏数据在创建时就失败。缺点是 `LocalDate.now()` 写死在方法里，测试没法固定时间——第 5 周会改成注入 `Clock`，现在先记住这个味道。

借书失败返回 `false` 还是抛异常，是接口设计问题：库存不足是**预期内**的业务分支，调用方本来就要处理，用返回值；参数非法（用户为 null、日期倒挂）是**违约**，用异常。两者别混，否则调用方要么到处 `try-catch`，要么把异常当 `if` 用。

```java
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

public record Loan(Book book, String user, LocalDate borrowDate, LocalDate dueDate) {
    public Loan {
        if (dueDate.isBefore(borrowDate)) {
            throw new IllegalArgumentException("应还日期不能早于借出日期");
        }
    }

    public boolean overdue() {
        return LocalDate.now().isAfter(dueDate);
    }

    public long overdueDays() {
        return overdue() ? ChronoUnit.DAYS.between(dueDate, LocalDate.now()) : 0;
    }
}

// Library 里加两个方法
public Loan borrow(Book book, String user) {
    if (!book.borrow()) return null;             // 没库存
    LocalDate today = LocalDate.now();
    return new Loan(book, user, today, today.plusDays(14));
}

public void printOverdue(List<Loan> loans) {
    loans.stream()
            .filter(Loan::overdue)
            .sorted(java.util.Comparator.comparing(Loan::dueDate))
            .forEach(l -> System.out.println(l.user() + " 逾期 " + l.overdueDays() + " 天：" + l.book()));
}
```

:::hint 日期不要自己算
`LocalDate` 没有时区，比较用 `isAfter`/`isBefore`，算天数用 `ChronoUnit.DAYS.between`；除以 86400000 是把「一天」当成固定毫秒数，时钟一变就错。
:::

:::solution 按逾期天数倒序，并处理还书
```java
public void printOverdue(List<Loan> loans) {
    loans.stream()
            .filter(Loan::overdue)
            .sorted(Comparator.comparingLong(Loan::overdueDays).reversed())
            .forEach(l -> System.out.printf("%s 逾期 %d 天：%s%n",
                    l.user(), l.overdueDays(), l.book()));
}

public void giveBack(Loan loan) {
    loan.book().giveBack();
}
```
`sorted` 之后 `forEach` 才有意义；`giveBack` 委托给 `Book`，库存的加减只在一个地方发生。
:::

:::error 手输日期格式不对
```text
Exception in thread "main" java.time.format.DateTimeParseException:
Text '2026-13-01' could not be parsed: Invalid value for MonthOfYear
(valid values 1 - 12): 13
```
**根因**：`LocalDate.parse("2026-13-01")` 用 ISO 格式严格解析，13 月不合法。
**修复**：输入层用 `DateTimeFormatter.ofPattern("yyyy-MM-dd")` 并捕获 `DateTimeParseException` 转成友好提示；不要用 `SimpleDateFormat`（可变、非线程安全）。
:::

#### 步骤 2.4 用不可变边界封住 `Library`

`Library` 里有一个 `List<Book>`。如果直接写成 `public List<Book> books() { return books; }`，调用方拿到的是内部那个列表的引用，一句 `library.books().clear()` 就能把库存清空——这不是恶意，很多人只是想「读一下再排个序」，`sort` 也会原地改。

`final` 挡不住这件事：`final` 只锁住「引用不能换指向」，列表里的内容照样能增删。要挡住，得在边界上做**防御性拷贝**：构造器里 `new ArrayList<>(initial)`，出口 `List.copyOf(books)` 返回一个不可变副本。`List.copyOf` 拒绝 null 元素，也顺手挡住了「塞 null 进集合」这种脏数据。

`record` 也一样：它生成的访问器直接返回字段引用，如果字段是 `List`，外部照样能改。所以「不可变对象」不是加个 `record` 就完事，得保证它持有的每个可变对象都不外泄。判断一个类是否真不可变，看两点：所有字段 `final`，且没有任何可变字段的引用被交出去。

顺带一提，`record Loan(Book book, ...)` 里的 `Book` 仍然可变，`loan.book().borrow()` 照样能改库存——`record` 只保证「字段不换指向」，不保证「指向的东西不变」。

```java
public class Library implements Searchable {
    private final List<Book> books;

    public Library(List<Book> initial) {
        this.books = new ArrayList<>(initial);   // 入口拷贝
    }

    public List<Book> books() {
        return List.copyOf(books);               // 出口拷贝，且不可变
    }

    // search 实现同步骤 2.2，此处省略
}
```

```java
Library lib = new Library(List.of(book));
lib.books().clear();     // UnsupportedOperationException
```

:::hint final 只锁引用
`final List<Book> books` 保证的是「books 不能指向另一个列表」，不保证「这个列表不能被改」。对外暴露集合时，永远返回副本或不可变视图。
:::

:::solution 读的时候也别泄露内部对象
```java
public List<Book> availableBooks() {
    return books.stream()
            .filter(b -> b.getAvailable() > 0)
            .toList();          // 新列表，元素仍是同一批 Book
}
```
返回新列表能挡住「改集合结构」，但挡不住「改元素字段」——`Book` 的 `available` 还是会被 `borrow()` 改。要彻底隔离，元素本身也得不可变，或者返回只读快照（DTO）。这是第 11 周 DTO 的动机之一。
:::

:::error 对不可变集合做修改
```text
Exception in thread "main" java.lang.UnsupportedOperationException
	at java.base/java.util.ImmutableCollections.uoe(ImmutableCollections.java:142)
	at java.base/java.util.ImmutableCollections$AbstractImmutableCollection.add(ImmutableCollections.java:147)
```
**根因**：`List.of(...)`、`Stream.toList()`、`List.copyOf(...)` 返回的都是不可变集合，`add`/`remove`/`clear` 一律抛这个异常。
**修复**：要改就先包一层 `new ArrayList<>(list)`；不要把「拿到集合」默认成「可以改集合」，先看它是怎么来的。
:::

**自测**（合上文档回答）

1. 只重写 `equals` 不重写 `hashCode`，往 `HashSet` 里放两个 isbn 相同的 `Book`，`size()` 是多少？`contains` 呢？
2. `Library` 为什么实现 `Searchable` 接口，而不是继承一个抽象类？你的判断依据是什么？
3. `books()` 直接 `return books` 会出什么事？`final` 为什么挡不住？

**验收**

- [ ] 两个 isbn 相同的 `Book` 放进 `HashSet`，`size()` 为 1，`contains` 新对象为 true
- [ ] 注释掉 `hashCode` 重跑，`size()` 变 2、`contains` 变 false，能说出原因
- [ ] `search(null)` 与 `search("  ")` 都返回空列表，不抛异常
- [ ] 库存为 1 时连续借两次，第二次返回 `false`；还书后 `available` 恢复且不超过 `total`
- [ ] 逾期列表按逾期天数倒序：造一条 `dueDate = LocalDate.now().minusDays(3)` 的记录，显示 3 天
- [ ] 调用 `lib.books().clear()` 抛 `UnsupportedOperationException`，内部库存不受影响

---

### 第 3 周：集合、泛型、Stream

**本周目标**：给定一段操作序列，能说清该选哪个集合、用泛型把类型错误挡在编译期、把「循环 + if」改写成一条能读懂的 Stream 流水线。

**为什么是这些内容**：前三周你写的程序，数据量最多几十条，集合只是「能装东西的容器」；从这一周起，集合开始决定程序的行为和速度。第 4 周的记账本要把记录装进 List 再分组统计，第 6 周的 JDBC 要把 ResultSet 转成 List，第 7 周的并发容器与第 10 周的分页同样以集合为载体。集合选错不会立刻报错，只会在数据量上来后变慢；泛型用错，问题会推迟到运行时变成 ClassCastException；Stream 写不顺，你就会继续写十行嵌套循环，三个月后连自己都要重读。这一周不背 API，只练三件事：用测量而不是传说选容器；让编译器替你做类型检查；把「过滤、分组、排序、取前 N」一次写对。学完的标志很具体：看到「去重后按出现次数排序取前十」，你能不查文档写出整条流水线，并说出每一步的复杂度。另一个判断标准：别人问你「这里为什么用 ArrayList」，你能给出数据量和操作类型，而不是「教程都这么写」。这一周的量不大，但每个结论都要有代码和数据撑着。

#### 步骤 3.1 用代码测出集合的差异

ArrayList 的底层是 Object[]。尾部 add 均摊 O(1)，因为容量满时按 1.5 倍扩容并复制；但 add(0, x) 要把整个数组后移一位，O(n)。LinkedList 的每个元素是一个 Node，多存 prev、next 两个引用；头尾插入只改几个指针，O(1)，可 get(i) 必须从头或从尾走 i 步，O(n)。所以「LinkedList 插入快」有前提：你已经站在要插入的位置上。日常的「按 id 找、按条件筛」都先要定位，而定位就是 O(n)，这才是它在真实业务里几乎总输给 ArrayList 的原因。

亲手做两个实验就能看到量级差：两万个元素反复往头部插，ArrayList 明显更慢；随后用 get(i) 顺序遍历，LinkedList 慢到不可接受。测量用 System.nanoTime()，同一份数据、同一台机器、先跑一轮预热再计时，比较毫秒数。一次 main 方法的数字不足以写进技术结论，要精确比较应该用 JMH；但用来建立量级感足够了。测量时注意三点：不要让 JIT 把循环优化掉（让累加结果参与一个无法静态判定的分支）；两边的数据规模必须一样；第一轮包含类加载和解释执行，必须预热。看到数字后回头看 ArrayList 源码里的 grow() 和 LinkedList 的 node(int)，你会记住为什么，而不是记住结论。另外记住两个默认值：ArrayList 的初始容量是 10，但第一次 add 才真正分配数组；扩容公式是 oldCapacity + (oldCapacity >> 1)。

:::hint 结论要自己测出来
「LinkedList 插入快」只在已经拿到节点时成立；日常增删查，ArrayList 几乎总是更优。凡是想写进文档的性能结论，都先量一遍。
:::

:::solution 测量代码
```java
static long ms(Runnable task) {
    long start = System.nanoTime();
    task.run();
    return (System.nanoTime() - start) / 1_000_000;
}

public static void main(String[] args) {
    int n = 20_000;
    List<Integer> array = new ArrayList<>();
    List<Integer> linked = new LinkedList<>();

    System.out.println("头部插入 array=" + ms(() -> {
        for (int i = 0; i < n; i++) array.add(0, i);
    }) + "ms");
    System.out.println("头部插入 linked=" + ms(() -> {
        for (int i = 0; i < n; i++) linked.add(0, i);
    }) + "ms");

    System.out.println("顺序访问 linked=" + ms(() -> {
        long sum = 0;
        for (int i = 0; i < 10_000; i++) sum += linked.get(i);
        if (sum < 0) System.out.println(sum);
    }) + "ms");
}
```
:::

关键点：System.nanoTime() 是单调时钟，不受系统时间校准影响，除以 1_000_000 得到毫秒。add(0, i) 每次都插在头部，ArrayList 每次都要搬 n 个元素，总操作量是平方级；LinkedList 只改头节点。linked.get(i) 每次都从头部走 i 步，一万次求和也是平方级，这就是它慢的原因。最后那行 `if (sum < 0)` 是为了让 sum 参与一次无法被编译期判定真假的分支，避免整个循环被优化掉；直接写 `sum` 不输出，JIT 可能把整段计算删掉。

:::error 边遍历边删元素：ConcurrentModificationException
```text
Exception in thread "main" java.util.ConcurrentModificationException
    at java.base/java.util.ArrayList$Itr.checkForComodification(ArrayList.java:1013)
    at java.base/java.util.ArrayList$Itr.next(ArrayList.java:967)
```
**根因**：`for (Book b : books) { if (...) books.remove(b); }`。for-each 背后是迭代器，remove 改的是集合的 modCount，迭代器下一次 next() 发现两者不一致就抛异常。这不是线程问题，单线程同样会炸。
**修复**：`books.removeIf(b -> ...)`；需要按条件删并记录时用显式 `Iterator<Book> it = books.iterator(); it.remove();`。不要在 for-each 里调用集合自身的 remove/add。
:::

#### 步骤 3.2 复现 HashMap 的并发问题

HashMap 的 put 不是原子操作：定位桶、比较 key、写链表或红黑树、modCount++、size++ 全是普通读写。JDK 7 的头插在并发扩容时会把链表写成环，JDK 8 改成尾插，不会再成环，但丢更新依旧会发生：两个线程同时写一个空桶，后写的覆盖先写的；扩容时另一个线程可能读到迁移到一半的表。更隐蔽的是 size 不是 volatile，在别的线程里轮询它，读到的可能是旧值。

复现方法：8 个线程、每个写 1000 个不重复的 key，用 CountDownLatch 让它们同时起跑，跑 5 轮统计 size。期望 8000，只要有一轮小于 8000，就证明它不安全。竞态是概率性的，一轮没复现不代表安全；换成 ConcurrentHashMap 后 5 轮都应是 8000。

ConcurrentHashMap 的读不加锁（volatile 读），写只锁当前桶（synchronized），扩容用 CAS 协作迁移。它保证单次 put/get 的原子性与可见性，但不保证「先查再写」这一整段复合操作的原子性——后者要用 computeIfAbsent 或 merge。这也是第 7 周竞态的前置知识：容器线程安全，不等于你的业务逻辑线程安全。顺带一提，Collections.synchronizedMap 只是给每个方法套一层 synchronized，连读都互斥，高并发下不如 CHM。

:::hint 为什么 size 会变小
HashMap 的 put 全程没有同步，并发写会互相覆盖；扩容时的迁移还会和写入交错。ConcurrentHashMap 用 CAS 加桶级 synchronized 保证单次操作安全。
:::

:::solution 代码
```java
static int fill(Map<Integer, Integer> map, int threads, int per) throws InterruptedException {
    CountDownLatch start = new CountDownLatch(1);
    CountDownLatch done = new CountDownLatch(threads);
    for (int t = 0; t < threads; t++) {
        int base = t * per;
        new Thread(() -> {
            try {
                start.await();
                for (int i = 0; i < per; i++) map.put(base + i, i);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                done.countDown();
            }
        }).start();
    }
    start.countDown();
    done.await();
    return map.size();
}

public static void main(String[] args) throws InterruptedException {
    for (int round = 1; round <= 5; round++) {
        System.out.println("HashMap 第 " + round + " 轮 size=" + fill(new HashMap<>(), 8, 1000));
    }
    for (int round = 1; round <= 5; round++) {
        System.out.println("CHM 第 " + round + " 轮 size=" + fill(new ConcurrentHashMap<>(), 8, 1000));
    }
}
```
:::

start.await() 让 8 个线程卡在同一刻起跑，没有它，先启动的线程可能已经写完，竞态窗口消失。base = t * per 保证每个线程写不重叠的 key 区间，size 的期望值才是 8000。done.await() 等所有线程结束再读 size，避免把「还没写完」误判成「丢了」。finally 里的 countDown 保证线程异常退出也不会把主线程永久挂住。

:::error ConcurrentHashMap 不接受 null
```text
Exception in thread "main" java.lang.NullPointerException
    at java.base/java.util.concurrent.ConcurrentHashMap.putVal(ConcurrentHashMap.java:1011)
```
**根因**：ConcurrentHashMap 不允许 null key 和 null value，HashMap 允许。CHM 的 get 返回 null 时无法区分「key 不存在」和「value 就是 null」，并发下这个歧义无法安全解决，所以直接从契约上禁止。行号随 JDK 小版本不同，认方法名 putVal 即可。
**修复**：在入口把 null 归一成空串、0 或 Optional.empty，或者过滤掉；不要用 containsKey 绕，两次调用之间仍可能被别的线程改掉。
:::

#### 步骤 3.3 用 Stream 做词频 TopN

Stream 把「数据源 → 变换 → 归约」显式分开。写不出来时先问自己：最终要的是 Map 还是 List？要 Map 就用 groupingBy，要 List 就用 filter/map/toList。Files.lines 返回惰性流，持有文件句柄，必须关闭，所以放进 try-with-resources；flatMap 把「每行一个数组」摊平成「一个词流」；filter 去掉空串；collect(groupingBy(identity(), counting())) 得到词频。

排序按 value 降序时，Map.Entry.<String, Long>comparingByValue() 的显式类型参数不能省，否则编译器推不出 Long；再接 thenComparing(comparingByKey()) 让同频词按字典序，输出才可复现。limit(10) 是短路操作，排完序后最多取十条。整条链只有 forEach 触发执行——没有终端操作，前面一行都不会跑。

两个坑：groupingBy 允许 null key，但 null 会变成一个叫 null 的分类，报表很难看，分类字段为 null 时先归一成「未分类」；默认的 toMap 既不接受 null value，也不接受重复 key，给了合并函数才允许重复。文件编码不要猜，Files.lines 默认 UTF-8，读到乱码时先确认源文件到底是 UTF-8 还是 GBK，再显式传 StandardCharsets。词频这种需求用 20 行 Stream 能写完，用 for 循环要 50 行，差别不在长度，而在「意图是否一眼可见」。要去重就在 groupingBy 之前加 distinct()，但 distinct 依赖 equals；自定义对象去重前先确认 equals 与 hashCode 成对重写，否则去不掉。

:::hint Stream 的三段式
source（Files.lines）→ 中间操作（flatMap/filter/collect）→ 终端操作（forEach/toList）。写不出来时先想清楚「我要的是 Map 还是 List」，再倒推用哪个收集器。
:::

:::solution 代码
```java
Path path = Path.of("note.txt");
Map<String, Long> freq;
try (Stream<String> lines = Files.lines(path, StandardCharsets.UTF_8)) {
    freq = lines.flatMap(line -> Arrays.stream(line.split("\\s+")))
            .filter(word -> !word.isBlank())
            .collect(Collectors.groupingBy(word -> word, Collectors.counting()));
}
freq.entrySet().stream()
        .sorted(Map.Entry.<String, Long>comparingByValue().reversed()
                .thenComparing(Map.Entry.comparingByKey()))
        .limit(10)
        .forEach(e -> System.out.println(e.getKey() + "\t" + e.getValue()));
```
:::

flatMap 与 map 的区别：map 是一对一，flatMap 是一对多再摊平。counting() 返回的收集器产出 Long，所以 Map 的 value 是 Long 而不是 Integer。整个链条只有 forEach 触发执行，前面的 flatMap、filter 都是惰性的；这也意味着异常会延迟到终端操作时才抛，栈里看到的是 forEach 那一行。

:::error Collectors.toMap 遇到重复 key
```text
java.lang.IllegalStateException: Duplicate key 餐饮 (attempted merging values 12.50 and 8.00)
    at java.base/java.util.stream.Collectors.lambda$uniqKeysMapAccumulator$1(Collectors.java:180)
```
**根因**：toMap 默认假设 key 唯一，背后用 `(a, b) -> { throw new IllegalStateException(...); }` 作为合并函数。分类汇总里同一个分类出现两次就会炸。
**修复**：要么给合并函数 `toMap(RecordItem::category, RecordItem::amount, BigDecimal::add)`，要么干脆用 `groupingBy(RecordItem::category, mapping(RecordItem::amount, reducing(BigDecimal.ZERO, BigDecimal::add)))`。汇总类需求优先 groupingBy。
:::

#### 步骤 3.4 用泛型把类型约束在编译期

泛型的检查只发生在编译期，编译完就擦除：运行时 List<String> 与 List<Integer> 是同一个 Class，所以不能 new T[]、不能 instanceof List<String>、不能在静态上下文里使用类的类型参数。理解擦除，你就不会追问「运行时怎么拿到泛型类型」；不理解，就会写出编译不过的 instanceof，或者在框架里被 TypeReference、ParameterizedType 这些词吓住。擦除还会让「重载」失效：两个方法分别接收 List<String> 与 List<Integer>，编译直接报 name clash，因为擦除后签名一模一样。

写两个方法就能体会边界：max(List<? extends T>) 里的 extends 表示「只读的生产者」，你可以从中取出 T，但不能 add；copy(List<? super T> dst, List<? extends T> src) 里的 super 表示「只写的消费者」，你可以往 dst 里 add T，读出来却只能是 Object。这就是 PECS：Producer Extends，Consumer Super。

泛型真正的收益是让错误提前：List<Object> xs = new ArrayList<String>() 编译失败，比运行时 ClassCastException 便宜得多；把 raw type（不带尖括号的 List）留在代码里，等于把这层保护关掉。集合 API 全都是泛型的，你这一周写的每个 List、Map 都在使用它，只是没意识到。

:::hint PECS 一句话
只从里面读，用 `? extends T`；只往里面写，用 `? super T`。又要读又要写，就别用通配符。
:::

:::solution 代码
```java
static <T extends Comparable<? super T>> T max(List<? extends T> items) {
    if (items.isEmpty()) throw new IllegalArgumentException("列表为空");
    T best = items.get(0);
    for (T item : items) {
        if (item.compareTo(best) > 0) best = item;
    }
    return best;
}

static <T> void copy(List<? super T> dst, List<? extends T> src) {
    for (T item : src) dst.add(item);
}

public static void main(String[] args) {
    System.out.println(max(List.of(3, 1, 4, 1, 5)));      // 5
    List<Number> numbers = new ArrayList<>();
    copy(numbers, List.<Number>of(1, 2.5));                // Integer 与 Double 都是 Number
    System.out.println(numbers);
}
```
:::

`<T extends Comparable<? super T>>` 而不是 `<T extends Comparable<T>>`：父类实现了 Comparable 的子类也能用，比如 java.sql.Timestamp 继承 Date，而 Date 实现的是 Comparable<Date>。`? super T` 放宽了这个约束，这是 JDK 里 max、sort 普遍采用的签名。copy 的签名让你能把 List<Integer> 拷进 List<Number>，反过来（把 Number 拷进 List<Integer>）编译器会拒绝，因为那可能塞进一个 Double。

:::error 泛型擦除后的 ClassCastException
```text
Exception in thread "main" java.lang.ClassCastException:
class java.lang.String cannot be cast to class java.lang.Integer
    at Main.main(Main.java:8)
```
**根因**：用了 raw type。`List raw = new ArrayList(); raw.add(1); raw.add("x");` 编译只给 unchecked 警告；取出时 `int n = (Integer) raw.get(1);` 由编译器插入的 checkcast 在运行时失败。擦除让编译器无法在 add 时拦住 String。
**修复**：声明成 `List<Integer>`，错误会提前到 `raw.add("x")` 那一行；确实要放多种类型就用 `List<Object>`，取出后先 `instanceof` 判断再转，不要靠强转。
:::

**自测**（合上文档回答）

1. 为什么 LinkedList 的 get(i) 是 O(n)，而「头部插入 O(1)」在真实业务里仍常常不如 ArrayList？
2. HashMap 并发写为什么会丢数据？ConcurrentHashMap 又为什么不允许 null 值？
3. `List<? extends Number>` 能读不能写、`List<? super Integer>` 能写不能读成 Integer，用 PECS 解释这两句话。

**验收**

- [ ] 两万次头部插入跑完，打印出 ArrayList 与 LinkedList 的毫秒数，并能解释差异
- [ ] 8 线程 × 1000 次 put 跑 5 轮：CHM 五轮都是 8000；HashMap 若五轮都 8000，把线程加到 16 重跑，直到出现小于 8000
- [ ] 准备至少 20 个不同单词的 note.txt，词频 TopN 输出 10 行；说出 Files.lines 为什么必须关闭
- [ ] 手写 `List<Object> xs = new ArrayList<String>();`，javac 报错，你能说出原因

---

### 第 4 周：异常、IO、JSON + 小项目「记账本」

**本周目标**：程序出错时能从异常栈定位到具体行，资源不泄漏，账单以 UTF-8 JSON 落盘并在重启后完整读回。

**为什么是这些内容**：第 1–3 周的程序都活在内存里，进程一退数据就没了；这一周第一次让数据穿过进程边界落到磁盘，也是第一次系统处理「失败」：文件可能不存在、磁盘可能满、用户可能输入 abc、JSON 可能被手工改坏。第 5 周要给记账本写测试，前提是它有一个可注入的文件路径和明确的异常契约；第 6 周把存储换成 JDBC 时，你会发现今天定义的 Store 接口几乎不用改。不学会的后果很具体：catch 里只写 e.printStackTrace()，线上只能看到一行「出错了」；用平台默认字符集读写，本地正常、服务器乱码；文件句柄不关，跑一夜之后报 Too many open files。这一周把这三类事故各演练一次，产出物是能连续添加、统计、导出的命令行记账本。记账本的数据结构不复杂，难的是边界：空文件、坏 JSON、重复分类、金额小数位；把这些边界在代码里写清楚，比多加十个功能更接近工程师的日常。记账本会一直用到第 9 周：第 5 周加测试、第 6 周换 JDBC、第 8 周拆分层，所以这一周的文件路径和异常契约要留出替换空间，不要把 Path 写死在业务代码里。

#### 步骤 4.1 用 try-with-resources 管资源

打开文件就是向操作系统借一个句柄，必须还。手写 `finally { reader.close(); }` 有三个坑：正文抛异常后如果 close 也抛，后者会覆盖前者，原始错误丢失；多个资源要按相反顺序关，漏一个就泄漏；close 写在 try 末尾而不是 finally 里，异常一抛就跳过。try-with-resources 由编译器生成等价的 finally，并把 close 抛出的异常 addSuppressed 到主异常上——主异常还在，关闭异常挂在 suppressed 里。如果正文没抛异常，close 的异常会正常向外抛。栈里看到 `Suppressed: java.io.IOException: ...`，说明主异常是正文的，关闭失败只是附注；看到 close 的异常跑到最外层，说明正文是干净的。多个资源按声明的相反顺序关闭，先开的最后关。

异常分三类：受检异常（IOException）是调用方可以恢复的外部故障，必须 catch 或声明 throws；运行时异常（IllegalArgumentException、NPE）是编程错误，应该让它炸在测试里，而不是吞掉；Error（OOM）不要 catch。包装异常时永远传 cause：`throw new UncheckedIOException("保存账单失败", e)`，否则栈就断在这里，第 13 周查日志时你会恨自己。不要把异常改写成一句「操作失败」——那等于把现场销毁。

读文件优先用 Files.readAllLines、Files.lines 这类 NIO API，它们默认 UTF-8；需要自己控制缓冲时用 `Files.newBufferedReader(path, UTF_8)`，不要 `new FileReader(path)`，后者用平台默认字符集。小文件一次读进内存没关系，超过几十兆再考虑流式处理。Closeable 的 close 只抛 IOException，AutoCloseable 抛 Exception；自己写资源类时实现后者、把 close 声明成具体异常，调用方更好处理。

:::hint 资源在拿到它的同一层关闭
谁 open 谁 close。把流当参数传来传去，最后一定没人关；跨层传递的应该是数据，不是句柄。
:::

:::solution 代码
```java
public final class JsonStore {
    private final Path file;

    public JsonStore(Path file) { this.file = file; }

    public List<String> readLines() {
        if (!Files.exists(file)) return List.of();          // 首次运行：空数据，不是错误
        try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            return reader.lines().toList();
        } catch (IOException e) {
            throw new UncheckedIOException("读取失败: " + file.toAbsolutePath(), e);
        }
    }
}
```
:::

`Files.exists` 先判存在，首次运行返回空列表而不是抛异常。`newBufferedReader` 的第二个参数锁死 UTF-8，跨平台一致。try 括号里声明的 reader 在退出时自动 close，无论正常返回还是抛异常。catch 把受检的 IOException 包成运行时的 UncheckedIOException，并保留 cause，调用方不必每层都写 throws。`reader.lines()` 是惰性的，但 toList 会把它读完，所以 return 时文件已经关闭。

:::error NoSuchFileException：路径是相对谁？
```text
java.nio.file.NoSuchFileException: data.json
    at java.base/sun.nio.fs.WindowsException.translateToIOException(WindowsException.java:85)
    at java.base/java.nio.file.Files.newInputStream(Files.java:157)
```
**根因**：相对路径按「进程的工作目录」解析，不是按 .java 文件所在目录，也不是按 jar 所在目录。IDE 里工作目录通常是项目根，命令行里是当前 shell，所以同一份代码在两处行为不同。
**修复**：启动时打印 `Path.of("data.json").toAbsolutePath()`，先确认它到底指到哪；需要固定位置就用 `-Ddata.file=...` 传绝对路径，或 `Files.createDirectories(dir)` 后拼路径。不要靠 `new File("data.json")` 猜。
:::

#### 步骤 4.2 用 Jackson 读写 JSON

JSON 是这一周的数据格式：人能读、机器能改、跨语言。Jackson 三样东西就够：ObjectMapper 做读写，JavaTimeModule 处理 java.time，TypeReference 保留泛型。Maven 里加 jackson-databind 与 jackson-datatype-jsr310 两个依赖，版本交给 Spring Boot 或 BOM 管。

record 自动生成构造器、访问器、equals/hashCode/toString，适合做不可变的数据载体；金额用 BigDecimal，不要用 double——0.1 + 0.2 在二进制浮点里不等于 0.3，账单会差几分钱。构造 BigDecimal 用字符串或 BigDecimal.valueOf，不要 `new BigDecimal(0.1)`，它会把 double 的误差原样带进来。

LocalDate 的处理分两种情况：不注册 JavaTimeModule，直接抛下面的 InvalidDefinitionException；注册了但没关 WRITE_DATES_AS_TIMESTAMPS，会写成 [2026,10,21] 这样的数组。注册模块并关掉时间戳，才会写成 "2026-10-21"。反序列化 record 需要 Jackson 2.12 以上，Spring Boot 3 自带的版本没问题。

编码问题通常不在 Jackson，而在你用 FileReader、FileWriter、Scanner 或控制台。Windows 控制台默认 GBK，输出中文前先 chcp 65001，或用 -Dfile.encoding=UTF-8 启动；自己用 Files.newBufferedWriter 时显式 StandardCharsets.UTF_8。Jackson 写 File 默认就是 UTF-8，这一层反而不用操心。

金额建议序列化成字符串（`@JsonFormat(shape = JsonFormat.Shape.STRING)`），或至少开 `WRITE_BIGDECIMAL_AS_PLAIN` 避免科学计数法：JavaScript 的 Number 只有 15–16 位有效数字，123456789012345.67 这样的金额用 JSON 数字传给前端会被读成近似值。这一步现在不做，第 9 周接前端时一定要补。

反序列化还有个开关：JSON 里多出未知字段时默认抛 UnrecognizedPropertyException，读自己的数据文件建议 `disable(FAIL_ON_UNKNOWN_PROPERTIES)`；读第三方 API 则保留严格校验，字段改名要第一时间发现。

:::hint 字符集是国内最常见的乱码来源
读写文件永远显式指定 StandardCharsets.UTF_8；日期变成数组，先查有没有注册 JavaTimeModule。
:::

:::solution 代码
```java
public class JsonDemo {
    public record RecordItem(LocalDate date, BigDecimal amount, String category, String note) {}

    public static void main(String[] args) throws IOException {
        ObjectMapper om = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        List<RecordItem> items = List.of(new RecordItem(
                LocalDate.of(2026, 10, 21), new BigDecimal("12.50"), "餐饮", "午饭"));

        Path file = Path.of("data.json");
        om.writerWithDefaultPrettyPrinter().writeValue(file.toFile(), items);

        List<RecordItem> back = om.readValue(file.toFile(),
                new TypeReference<List<RecordItem>>() {});
        System.out.println(back);
    }
}
```
:::

registerModule 只影响 java.time 类型，别的字段不受影响。disable 关掉时间戳写法，否则 LocalDate 可能变成数组或数字。writeValue 接 File 时默认 UTF-8，writerWithDefaultPrettyPrinter 只是让文件可读。readValue 的第二个参数用匿名 TypeReference，是因为泛型在运行时被擦除，必须靠这个子类把 List<RecordItem> 的类型信息保留到字节码里——这就是第 3 周擦除知识的一次真实应用。

:::error Jackson 不认识 LocalDate
```text
com.fasterxml.jackson.databind.exc.InvalidDefinitionException:
Java 8 date/time type `java.time.LocalDate` not supported by default:
add Module "com.fasterxml.jackson.datatype:jackson-datatype-jsr310" to enable handling
```
**根因**：自己 new ObjectMapper() 时没有注册 JavaTimeModule；Spring Boot 自动配置的 ObjectMapper 已经注册过，所以同样的代码在 Spring 里不报错，单独跑就炸。
**修复**：依赖加 jackson-datatype-jsr310，代码 `.registerModule(new JavaTimeModule())`，并 `.disable(WRITE_DATES_AS_TIMESTAMPS)`，否则日期会写成数组。
:::

#### 步骤 4.3 拼出「记账本」

先把数据流画出来，再写代码：main 只负责「读一行命令 → 分发」，Store 只负责「路径 → List<RecordItem> → 落盘」，Report 只负责「List → 统计结果」。三层各自可测：第 5 周的测试只 new Store(tmp)，根本不需要启动菜单。所有逻辑塞进 main 的写法，到第 8 周会被迫重写。

菜单用 switch 的箭头语法；金额不要用 Scanner.nextBigDecimal()——输入 abc 会抛 InputMismatchException，而且坏 token 留在缓冲区，下一次读还是它，循环里会无限刷异常。统一 nextLine() 拿字符串，再 try/catch NumberFormatException 转 BigDecimal，失败时提示并 continue。

写文件用「临时文件 + 原子移动」：先写 data.json.tmp，再 `Files.move(tmp, data.json, REPLACE_EXISTING, ATOMIC_MOVE)`。写到一半断电，至少不会留下半个 JSON。load() 在文件不存在时返回空列表，而不是抛异常——首次运行是正常状态，不是错误。

导出 CSV 时，备注里的逗号、引号、换行都必须用双引号包住并把内部引号翻倍；文件头写 UTF-8 BOM（\uFEFF），Excel 打开中文才不乱码。这些细节不写，用户第一次导出就会来报 bug。ATOMIC_MOVE 要求临时文件与目标在同一分区，所以 tmp 必须建在 data.json 同目录，不能丢到系统临时目录；跨分区时这个参数会直接抛 AtomicMoveNotSupportedException。

Report 内部统一用 `groupingBy(RecordItem::category, reducing(BigDecimal.ZERO, RecordItem::amount, BigDecimal::add))`，不要先 map 成 double 再相加；按月统计用 `YearMonth.from(item.date())` 做 key，排序后再输出。统计函数的输入是 List、输出是 Map，不碰文件也不碰 Scanner，第 5 周才能只用内存数据测它。菜单里每次统计都重新 store.load()，数据量小无所谓；数据大了就常驻内存，写操作成功后再刷新，别在循环里反复读盘。

:::hint 先画数据流再写代码
main 只做「读命令 → 分发」；Store 只做「读写文件」；Report 只做「统计」。三层各一个类，main 里串起来，第 5 周才测得动。
:::

:::solution 骨架
```java
public static void main(String[] args) throws IOException {
    Store store = new Store(Path.of("data.json"));
    Report report = new Report();
    Scanner sc = new Scanner(System.in, StandardCharsets.UTF_8);
    while (true) {
        System.out.println("1 添加  2 按月统计  3 按分类统计  4 导出CSV  0 退出");
        switch (sc.nextLine().trim()) {
            case "1" -> {
                RecordItem item = readItem(sc);
                if (item != null) { store.add(item); System.out.println("已添加"); }
            }
            case "2" -> report.byMonth(store.load()).forEach((k, v) -> System.out.println(k + " " + v));
            case "3" -> report.byCategory(store.load()).forEach((k, v) -> System.out.println(k + " " + v));
            case "4" -> report.exportCsv(store.load(), Path.of("report.csv"));
            case "0" -> { return; }
            default -> System.out.println("无效输入，请输入 0-4");
        }
    }
}

static RecordItem readItem(Scanner sc) {
    try {
        System.out.print("日期 yyyy-MM-dd：");
        LocalDate date = LocalDate.parse(sc.nextLine().trim());
        System.out.print("金额：");
        BigDecimal amount = new BigDecimal(sc.nextLine().trim());
        System.out.print("分类：");
        String category = sc.nextLine().trim();
        System.out.print("备注：");
        return new RecordItem(date, amount, category, sc.nextLine().trim());
    } catch (DateTimeParseException | NumberFormatException e) {
        System.out.println("输入格式不对：" + e.getMessage());
        return null;      // 不打印堆栈，直接回菜单
    }
}
```

```java
public void add(RecordItem item) {
    if (!validAmount(item.amount())) throw new IllegalArgumentException("金额必须 >= 0");
    List<RecordItem> all = load();
    all.add(item);
    save(all);
}

public static boolean validAmount(BigDecimal amount) {
    return amount != null && amount.signum() >= 0
            && amount.compareTo(new BigDecimal("100000000")) < 0;
}
```
:::

switch 的箭头语法不会贯穿到下一个 case。readItem 把所有解析放在一个 try 里，任何一处格式错都返回 null，调用方只需判空；这比在每个字段后面写一串 if 干净。catch 多类型要求两个异常没有继承关系，DateTimeParseException 与 NumberFormatException 都继承 RuntimeException，但彼此无关，合法。返回 null 表示「这次输入作废」，不是错误码，菜单继续循环。日期、金额的校验规则放在 Store.add 里，输入层只负责格式。把金额规则抽成 `Store.validAmount(BigDecimal)` 静态方法（null、负数、超过一亿都返回 false），add 里调用它并抛 `IllegalArgumentException("金额必须 >= 0")`；这样第 5 周的参数化测试可以直接测规则，不必构造文件。

:::error InputMismatchException 会卡住循环
```text
Exception in thread "main" java.util.InputMismatchException
    at java.base/java.util.Scanner.throwFor(Scanner.java:939)
    at java.base/java.util.Scanner.next(Scanner.java:1594)
    at java.base/java.util.Scanner.nextBigDecimal(Scanner.java:2803)
```
**根因**：nextBigDecimal 读到 abc，解析失败抛异常，但 Scanner 不消费这个坏 token；如果 catch 后继续循环，下次读到的还是 abc，于是无限刷同一条异常。
**修复**：改成 `nextLine()` 拿整行再自己 parse；如果坚持用 nextXxx，必须在 catch 里补一次 `sc.nextLine()` 把坏输入清掉。更好的做法是在输入层就把「格式错」变成提示，而不是让异常穿到 main。
:::

**自测**（合上文档回答）

1. try-with-resources 关闭时抛异常，业务异常会怎样？如果正文根本没抛异常呢？
2. 为什么金额用 BigDecimal 而不是 double？`new BigDecimal(0.1)` 与 `new BigDecimal("0.1")` 有什么区别？
3. Scanner.nextBigDecimal 读到 abc 后，为什么会在循环里反复抛同一个异常？两种改法各是什么？

**验收**

- [ ] 删除 data.json 后启动，菜单正常显示；添加一条后文件被创建
- [ ] 输入 abc 当金额，只提示「输入格式不对」，不打印堆栈，且能继续添加下一条
- [ ] 用编辑器打开 data.json，中文可读、日期形如 "2026-10-21"，不是数组
- [ ] 备注里带逗号和引号，导出的 CSV 用 Excel 打开列不串位
- [ ] 全文件搜不到空的 `catch {}` 与 `e.printStackTrace()`
- [ ] `mvn -q compile` 通过，Jackson 两个依赖已在 pom 里

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

**本周目标**：给记账本写出「改坏就变红」的测试，并让 `mvn test` 一条命令跑完、让构建在测试失败时停住。

**为什么是这些内容**：第 4 周的记账本已经能跑了，但「能跑」和「改不坏」是两件事：你今天改了校验，明天怎么知道没把按月统计改坏？第 5 周把这件事变成一条命令。测试在这条路线里位置很靠前，因为后面每一周都靠它兜底：第 6 周的事务回滚、第 7 周的线程池拒绝策略、第 10 周的 @Transactional 失效、第 16 周的真实上线，都是「先写一个会失败的用例，再改代码」。不学会的后果不是少写几个测试，而是回归只能靠手点、上线只能靠勇气；更常见的是写出一堆「怎么实现就怎么断言」的测试，看着全绿，其实什么都没测。构建还是团队契约：你本地能跑，不代表 CI 能跑，版本、编码、路径都可能不同，所以这一周连构建一起练。这一周的验收标准只有一条：随便改坏一处业务逻辑，测试必须红。测试还是读代码的入口：想测一个类，必须知道它的依赖从哪来，这会逼你把 new 从方法体挪到构造器外面，第 8 周的分层就是这么被测试逼出来的。

#### 步骤 5.1 写第一个会失败的测试

测试的第一步不是写断言，而是让它先失败，并且失败在断言上，不是编译错误。红-绿-重构：先写「金额为负应抛 IllegalArgumentException」，此时 Store.add 还没校验，`mvn test` 报 `expected ... to be thrown, but nothing was thrown`；再补校验，测试变绿；最后重构实现，测试仍然绿。这个顺序保证测试真的在观察行为。直接写实现再补测试，人会不自觉地把断言写成实现的镜子：实现里写 `<=0`，测试就断言 0 非法，边界被一起写错。

一个测试三段式：Given 准备一个临时文件 → When 调用被测方法 → Then 断言结果或异常。每个测试用独立的 @TempDir，不要共用 data.json，否则测试顺序会互相影响。测试方法名用中文可以，JUnit 5 允许，报告里更好读；类名必须以 Test 结尾，Surefire 默认只扫这个模式。

JUnit 5 用聚合依赖 `org.junit.jupiter:junit-jupiter`，它带 api、params、engine 三个包；只加 api 会出现「编译通过但 0 个测试」。断言异常用 assertThrows，它返回异常对象，可以继续断言 message；断言值用 assertEquals，expected 在前、actual 在后。测试类不需要 public，JUnit 5 用包级可见性就能跑。测试不要连数据库、不要依赖网络、不要读真实用户目录，这些都会让测试变慢变脆；测 Store 时把路径作为构造参数传进去，就是为了在测试里换成临时目录。断言里的期望值要写死，不要用实现算期望（比如 `assertEquals(store.calc(), store.calc())`），那是同义反复，永远绿。

:::hint 为什么要先红再绿
测试的价值不在于「跑过」，而在于「改坏的时候会红」。先写断言再写实现，你才能确认这个测试真的在检查东西。
:::

:::solution 代码
```java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.junit.jupiter.api.Assertions.*;

class StoreTest {
    @TempDir
    Path dir;

    @Test
    void 金额为负应拒绝() {
        Store store = new Store(dir.resolve("data.json"));
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> store.add(new RecordItem(LocalDate.now(), new BigDecimal("-1"), "餐饮", "")));
        assertEquals("金额必须 >= 0", ex.getMessage());
    }

    @Test
    void 金额为零应允许() {
        Store store = new Store(dir.resolve("data.json"));
        store.add(new RecordItem(LocalDate.now(), BigDecimal.ZERO, "餐饮", ""));
        assertEquals(1, store.load().size());
    }
}
```
:::

@TempDir 由 JUnit 在每个测试方法前创建独立目录、结束后清理，dir 字段由扩展注入，所以不能是 private。assertThrows 的第二个参数是 Executable 函数式接口，异常没抛出来它会自己失败，不需要写 try/catch。测试失败时先看断言消息（expected 与 actual），先确认期望写对了，再决定改实现还是改期望，不要一红就动生产代码。异常对象拿到后断言 message，是为了确认抛的是「校验失败」而不是碰巧另一个 IllegalArgumentException；message 一改测试就红，这是有意的——错误文案也是接口的一部分。第二个测试验证边界：0 合法，防止实现写成 `<= 0`。

:::error 测试一个都没跑
```text
Tests run: 0, Failures: 0, Errors: 0, Skipped: 0
```
**这不是通过，是没找到测试。** 三查：① 类名不以 Test 结尾，Surefire 默认只扫 `*Test`；② 方法上用的是 JUnit 4 的 `org.junit.Test`，JUnit 5 引擎不认；③ 依赖里只有 junit-jupiter-api，没有 engine。
**修复**：类名改成 StoreTest，import 换成 `org.junit.jupiter.api.Test`，依赖换成聚合的 junit-jupiter。改完再跑，Tests run 必须大于 0。
:::

#### 步骤 5.2 用参数化测试覆盖边界

边界值不要复制十个方法，写成一张表：0、0.01、-0.01、99999999。@ParameterizedTest 每行跑一次，@CsvSource 的每一行是一个用例；名字里的 {0}、{1} 会替换成参数，报告里一眼看出哪行挂了。参数是对象、或一个用例要构造多个参数对象时，用 @MethodSource 返回 `Stream<Arguments>`，比 CSV 可读。

断言金额不要用 `assertEquals(BigDecimal, BigDecimal)`：BigDecimal 的 equals 比较 scale，0.0 和 0.00 不相等，测试会莫名变红；用 compareTo == 0，或 `assertEquals(0, actual.compareTo(expected))`。字符串和集合的断言顺序是 expected 在前、actual 在后，反了报错信息读起来很别扭。

参数化测试不是越多越好：一个方法覆盖一组等价类，别把「功能测试」也塞进 CSV。测异常用 assertThrows，测返回值用 assertEquals，测集合顺序用 assertIterableEquals，各司其职。测试名里的中文和占位符会原样进报告，出问题时不用再回去读代码。

写用例前先列等价类和边界：小于 0、等于 0、正常值、上限、超过上限、null、非数字。每一行都问一句「如果实现改错，哪一行会红」；答不上来的用例删掉，它只会拖慢构建，不会提高信心。显示名也别只写 {0}，把语义写进去（「金额 -0.01 应拒绝」），CI 日志里一眼能看懂。

:::hint 测试数据要写成表
边界值（0、负数、超大数、空字符串、超长备注）用表格驱动，一行一个用例。比复制十遍测试方法可读，加用例只加一行。
:::

:::solution 代码
```java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;

@ParameterizedTest(name = "金额 {0} → 合法 {1}")
@CsvSource({"0, true", "0.01, true", "-0.01, false", "99999999, true"})
void 金额边界(String amount, boolean ok) {
    assertEquals(ok, Store.validAmount(new BigDecimal(amount)));
}

@Test
void 金额比较不看小数位() {
    assertEquals(0, new BigDecimal("0.0").compareTo(new BigDecimal("0.00")));
}
```
:::

CsvSource 默认会去掉每行首尾空白，所以 `"0, true"` 里的空格不会传进参数；参数类型按方法签名自动转换，String 转 boolean 也支持。`Store.validAmount` 是纯函数，不碰文件，所以这个测试不需要 @TempDir，跑得也最快——把校验规则做成静态纯函数，本身就是为可测性服务的。第二个测试是反例：如果你想验证 0.0 与 0.00「相等」，用 assertEquals 会红，用 compareTo 才绿，这个差异必须在脑子里。

:::error No ParameterResolver registered for parameter
```text
org.junit.jupiter.api.extension.ParameterResolutionException:
No ParameterResolver registered for parameter [java.lang.String arg0]
in method [void StoreTest.金额边界(java.lang.String,boolean)]
```
**根因**：方法带参数，但用的是 `@Test` 而不是 `@ParameterizedTest`；或者依赖里只有 junit-jupiter-api，没有 junit-jupiter-params。
**修复**：把注解换成 @ParameterizedTest 并加参数源（@CsvSource / @ValueSource / @MethodSource）；依赖换成聚合的 junit-jupiter，它会带上 params。
:::

#### 步骤 5.3 让构建在测试失败时停下来

Maven 的生命周期是 test 阶段跑测试、package 阶段先跑 test 再打包，所以 `mvn package` 默认就是一道门禁：测试红，jar 不会生成。但两个「跳过」参数差别很大：`-DskipTests` 仍然编译测试代码，只是不执行；`-Dmaven.test.skip=true` 连测试代码都不编译。前者能发现测试编译错误，后者会让一个编译不过的测试代码悄悄通过构建，问题留到别人跑测试时才爆，别在 CI 里用后者。

Surefire 3.x 原生支持 JUnit 5，不需要额外 provider。把 failIfNoTests 设成 true，就能把「0 个测试」从假绿变成构建失败——这正好治第 5.1 步那个坑。报告在 target/surefire-reports/，每个类一个 .txt；CI 里跑 `mvn -B verify`，退出码非 0 就阻断合并。集成测试用 `*IT` 命名并交给 failsafe 的 integration-test/verify 阶段，不要和单元测试混在一个目录。

覆盖率报告用 jacoco，但别设 80% 硬门槛；覆盖率只说明代码被执行过，不说明断言有效。真正有效的指标是「变异检验能不能抓到」：把 `>=` 改成 `>`，测试红不红。这个动作每周至少做一次，比看覆盖率数字有用。

依赖版本要锁：Surefire 不写 version 时，Maven 会用超级 POM 里的老版本，可能根本不认 JUnit 5；JUnit 建议走 junit-bom 统一版本，避免 api 与 engine 版本不一致时冒出 NoSuchMethodError。插件和库的版本都写死，构建才可复现。本地提交前跑 `mvn -B -q verify`，-q 只留错误和测试摘要，输出够短才愿意每次都跑。

:::hint 构建门禁比测试本身更重要
测试写了但没人跑，等于没写。把 `mvn verify` 接进提交前检查或 CI，红就不许合并。
:::

:::solution pom 与命令
```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-surefire-plugin</artifactId>
  <version>3.2.5</version>
  <configuration>
    <failIfNoTests>true</failIfNoTests>
  </configuration>
</plugin>
```

```powershell
mvn -B test
echo "exit=$LASTEXITCODE"                  # 0 才算过
mvn -B -DskipTests package                 # 编译测试，但不跑
mvn -B -Dmaven.test.skip=true package      # 连测试都不编译
mvn -B verify                              # CI 门禁：非 0 就阻断
```
:::

`-B` 是批处理模式，去掉下载进度条，日志适合贴进 CI。`echo "exit=$LASTEXITCODE"` 在 PowerShell 里读上一条原生命令的退出码；bash 里对应 `echo $?`。日常改代码跑 `mvn -B test` 就够，它不打包；提交前跑 `mvn -B verify`，它比 package 多跑集成测试阶段，是 CI 的默认入口。failIfNoTests 只对 Surefire 生效，Failsafe 要在 integration-test 里单独配自己的 failIfNoTests，别配错插件。

:::error No tests were executed!
```text
[ERROR] Failed to execute goal org.apache.maven.plugins:maven-surefire-plugin:3.2.5:test
(default-test) on project budget: No tests were executed!
(Set -DfailIfNoTests=false to ignore this error.)
```
**根因**：failIfNoTests=true 生效了，但一个测试都没匹配到——通常是类名不以 Test 结尾，或测试目录不在 src/test/java。
**修复**：先看 `target/surefire-reports/` 有没有文件；按 `*Test.java` 改名或移动目录。不要第一反应就加 `-DfailIfNoTests=false`，那等于把刚装的门禁又拆了。
:::

**自测**（合上文档回答）

1. 为什么测试要先红？先写实现再补测试，最常写出什么样的假测试？
2. @CsvSource 与 @MethodSource 各适合什么参数？BigDecimal 断言为什么不能用 assertEquals？
3. `-DskipTests` 与 `-Dmaven.test.skip=true` 的区别？`failIfNoTests=true` 解决什么问题？

**验收**

- [ ] `mvn -B test` 输出 Tests run 至少 4，0 failures
- [ ] 临时删掉 Store.add 的金额校验，`mvn test` 变红并点名「金额为负应拒绝」；恢复后变绿
- [ ] `mvn -B -DskipTests package` 生成 target 下的 jar；故意把测试类改出编译错误，该命令失败
- [ ] 同样的编译错误下，`mvn -B -Dmaven.test.skip=true package` 仍然成功
- [ ] 注释掉全部测试方法（含 @ParameterizedTest）后 `mvn test` 失败，提示 No tests were executed
- [ ] target/surefire-reports/ 下能找到 StoreTest.txt，里面有中文用例名

---

### 第 6 周：SQL 与 JDBC

**本周目标**：把记账本从 JSON 文件搬到 MySQL 8.0：用 `EXPLAIN` 证明索引命中、用同一个登录查询演示拼接被绕过而占位符挡得住、用一次中途抛异常的转账证明两边余额都没变。

**为什么是这些内容**：第 4 周的记账本把数据写进 JSON，第 5 周给它补了测试，但它还不是一个能同时给多人用的系统——两个人同时写同一个文件，后写的覆盖先写的；数据到十万行，按月统计只能全表扫。第 6 周换数据库，解决的就是这两件事。数据库是后端最慢、也最容易出事的一层：接口变慢，多数时候是慢查询或没走索引；数据被拖走，多数时候是拼了 SQL。这两个坑的共同点是「数据少、并发低的时候完全看不出来」，等看出来已经在生产上。这一周还第一次碰事务：扣钱和加钱必须同生共死，这是第 8 周项目、第 10 周 `@Transactional` 失效、以及第 9–12 周订单库存场景的全部基础。不学会的后果很具体：索引建错，查询随数据量线性变慢；事务边界画错，出现「钱扣了没到账」；连接不还，跑一夜之后服务连不上库。这一周刻意不接框架，就是为了看清 JDBC 到底做了什么——第 9 周之后 Spring 会把它包起来，但报错还是这些报错。

#### 步骤 6.1 建表、加索引、看执行计划

先定类型再谈索引。金额用 `DECIMAL(12,2)`，不要用 `DOUBLE`：二进制浮点存不下 0.1，`0.1 + 0.2` 得到 0.30000000000000004，账目对不上。日期用 `DATE` / `DATETIME`，不要用字符串存，否则范围查询和排序会退化成字典序。InnoDB 的主键索引就是整张表（聚簇索引），二级索引的叶子存的是主键值，所以按 `category` 查还要「二级索引 → 主键 → 回表」；这就是 `SELECT *` 比只取需要的列慢的原因。

索引也不是越多越好：每次 insert 都要维护所有 B+ 树，写多读少的表建一堆索引反而拖慢写入。判断标准只有一条——这一列是否高频出现在 `WHERE` / `ORDER BY` / `JOIN` 里，且区分度够高。复合索引 `(category, happened_at)` 比两个单列索引更适合「按分类查、按时间倒序」，因为同分类的记录在树里已经按时间排好，能省掉 `filesort`；但它遵循最左前缀，单独按 `happened_at` 查用不上它。

现象：同一句 SQL，加索引前 `EXPLAIN` 的 `rows` 是 10000，加了之后约 2500；连续执行 20 次，前者 1.8 秒，后者 0.02 秒。

:::hint 索引不是越多越好
索引加速查询，但拖慢写入（每次 insert 要维护 B+ 树），还占空间。判断标准是「高频出现在 WHERE / ORDER BY 里的列」；区分度低的列（比如性别）建了也没用。
:::

:::solution 建表、灌一万行、对比执行计划
```sql
CREATE TABLE account (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  happened_at DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category VARCHAR(32) NOT NULL,
  note VARCHAR(200),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_category (category),
  KEY idx_category_time (category, happened_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET SESSION cte_max_recursion_depth = 10000;
INSERT INTO account (happened_at, amount, category, note)
WITH RECURSIVE seq(n) AS (
  SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 10000
)
SELECT DATE_SUB(CURDATE(), INTERVAL (n % 365) DAY),
       ROUND(10 + (n % 200) * 0.5, 2),
       ELT(1 + n % 4, '餐饮', '交通', '房租', '娱乐'),
       CONCAT('第 ', n, ' 笔')
FROM seq;

EXPLAIN SELECT id, amount FROM account WHERE category = '餐饮' ORDER BY happened_at DESC;
-- type=ref, key=idx_category_time, rows 约 2500, Extra 里没有 Using filesort

ALTER TABLE account DROP INDEX idx_category, DROP INDEX idx_category_time;
EXPLAIN SELECT id, amount FROM account WHERE category = '餐饮' ORDER BY happened_at DESC;
-- type=ALL, key=NULL, rows=10000, Extra 出现 Using filesort
```
:::

逐行看：`ENGINE=InnoDB` 是事务与行锁的前提，MyISAM 没有事务；`utf8mb4` 才能存 emoji，`utf8` 是 MySQL 的历史别名（三字节），别混。递归 CTE 从 1 数到 10000，`DATE_SUB` 把日期打散到一年里，`ELT` 按余数轮流取四个分类，这样数据分布才像真的。`EXPLAIN` 里先看 `type`（`ALL` 是全表扫、`ref` 是索引等值）、再看 `key`（实际用了哪个索引，`NULL` 就是没用）、最后看 `rows`（优化器估算要扫多少行）和 `Extra`（出现 `Using filesort`、`Using temporary` 就要警惕）。删掉索引再跑一次，三个值同时变差，才算真的看懂。若 `possible_keys` 有值而 `key` 是 `NULL`，则是「索引存在但优化器不用」，优先怀疑对列用了函数、隐式类型转换（`VARCHAR` 列传了数字）、或前导模糊 `LIKE '%餐%'`。

:::error 递归 CTE 只灌了一千行
```text
ERROR 3636 (HY000): Recursive query aborted after 1001 iterations.
Try increasing @@cte_max_recursion_depth to a larger value.
```
**根因**：MySQL 默认 `cte_max_recursion_depth` 是 1000，防止写错的递归把数据库拖死；一万行需要显式放宽。
**修复**：在同一条 SQL 前面加 `SET SESSION cte_max_recursion_depth = 10000;`。只对当前会话生效，重连后要重设；如果嫌麻烦，用 `INSERT ... SELECT` 配合数字表，或直接在 Java 里循环插入（但那正好是步骤 6.4 要优化的慢路径）。
:::

#### 步骤 6.2 亲手演示一次 SQL 注入

SQL 是先被数据库**当语法解析**、再执行的。字符串拼接把用户输入混进了语法层：输入 `' OR '1'='1` 会把 `WHERE name='...' AND pwd='...'` 变成恒真条件，密码随便填都能登进去；输入 `'; DROP TABLE account; -- ` 更直接。这不是「输入校验没做好」，而是**结构**和**数据**走了同一个通道。

`PreparedStatement` 把两者分开：SQL 结构先定下来，`?` 只是位置标记，参数通过绑定传进去，数据库永远只把它当值。MySQL Connector/J 默认在客户端做转义（`useServerPrepStmts=false`），打开 `useServerPrepStmts=true` 才走服务端预编译；两条路都不会把参数当语法，前者靠转义、后者靠协议。真正要记住的是：**任何来自外部的值都只能走 `?`**，包括 `ORDER BY` 后面的列名——列名不能用占位符，只能用白名单映射，这是第 11 周接口工程化的伏笔。

现象：拼接版输入 `' OR '1'='1` 返回整张用户表；占位符版同一输入返回 0 行，日志里能看到参数原样带着引号。

:::hint 为什么占位符能防住
拼接时用户输入被当成 SQL 语法解析；`PreparedStatement` 先把语句结构发给数据库，参数走单独通道，输入永远只能是值。
:::

:::solution 同一个登录，两种写法
```java
// ❌ 拼接：输入  ' OR '1'='1  即可绕过
String sql = "SELECT id FROM users WHERE name='" + name + "' AND pwd='" + pwd + "'";
try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(sql)) {
    return rs.next();
}

// ✅ 占位符：参数只当值
String safeSql = "SELECT id FROM users WHERE name = ? AND pwd = ?";
try (PreparedStatement ps = conn.prepareStatement(safeSql)) {
    ps.setString(1, name);
    ps.setString(2, pwd);
    try (ResultSet rs = ps.executeQuery()) {
        return rs.next();
    }
}
```
:::

`Statement` 只适合完全不含外部输入的 SQL（比如建表脚本）。`setString` 的索引从 1 开始，不是 0，这是 JDBC 的历史包袱，写错会报 `Parameter index out of range`。`try-with-resources` 同时关 `PreparedStatement` 和 `ResultSet`，关闭顺序由编译器倒序生成，不用手写 finally。返回 `boolean` 的登录只够演示，真实项目要返回用户 id 并继续查权限。测试时别用真实密码，建两个假账号即可。

:::error 占位符没生效
```text
java.sql.SQLException: Parameter index out of range (1 > number of parameters, which is 0).
```
**根因**：SQL 里根本没有 `?`，却调了 `setString(1, ...)`——最常见的是复制了拼接版 SQL，只把变量换成 `setString`，忘了把 `'" + name + "'` 改成 `?`；另一种是 `?` 的个数少于 `setXxx` 的次数。
**修复**：先数 SQL 里的 `?`，再逐个核对索引。占位符不能包在引号里，写成 `name = '?'` 会被当成字面量问号，同样查不到数据。
:::

#### 步骤 6.3 写一个会回滚的转账

事务把多条写操作捆成一个原子单位：要么全成，要么全败。JDBC 默认 `autoCommit=true`，每条 SQL 自己提交，所以「扣钱成功、加钱失败」会留下半截数据。正确姿势是 `setAutoCommit(false)` 开启事务，全部成功后 `commit()`，任何一步异常都 `rollback()`。

这里有两个容易忽略的细节。第一，**余额判断要写进 UPDATE 的 WHERE**：`UPDATE wallet SET balance = balance - ? WHERE id = ? AND balance >= ?`，靠数据库的行锁保证不超扣；先 `SELECT` 再 `UPDATE` 在并发下一定超扣，这是第 9–12 周订单库存场景里「超卖」的原型。第二，连接是从池里借的，归还前要把 `autoCommit` 恢复成 `true`，否则下一个借到它的人会在一个未提交的事务里操作。隔离级别用默认的 `REPEATABLE READ` 就够，别为了「更安全」升到串行化，那会把并发打没。

现象：把 `setAutoCommit(false)` 注释掉，再让加钱那步抛异常，扣掉的钱不会回来；恢复后同一场景两边余额都与转账前一致。

:::hint 事务的边界在哪
`setAutoCommit(false)` 之后，所有写操作在 commit 之前都不生效，回滚就是把这段区间撤销。生产里这段通常由 `@Transactional` 管理，但你要先手写一遍，才知道它到底包住了什么。
:::

:::solution 转账：判断、扣款、加款、提交
```sql
CREATE TABLE wallet (
  id BIGINT PRIMARY KEY,
  owner VARCHAR(32) NOT NULL,
  balance DECIMAL(12,2) NOT NULL,
  CONSTRAINT ck_balance CHECK (balance >= 0)
) ENGINE=InnoDB;
INSERT INTO wallet VALUES (1, 'A', 100.00), (2, 'B', 0.00);
```
```java
public void transfer(long from, long to, BigDecimal amount) throws SQLException {
    if (amount.signum() <= 0) throw new IllegalArgumentException("金额必须大于 0");
    String debit  = "UPDATE wallet SET balance = balance - ? WHERE id = ? AND balance >= ?";
    String credit = "UPDATE wallet SET balance = balance + ? WHERE id = ?";

    try (Connection conn = dataSource.getConnection()) {
        conn.setAutoCommit(false);
        try (PreparedStatement d = conn.prepareStatement(debit);
             PreparedStatement c = conn.prepareStatement(credit)) {
            d.setBigDecimal(1, amount);
            d.setLong(2, from);
            d.setBigDecimal(3, amount);
            if (d.executeUpdate() != 1) throw new IllegalStateException("余额不足或账户不存在");

            c.setBigDecimal(1, amount);
            c.setLong(2, to);
            if (c.executeUpdate() != 1) throw new IllegalStateException("收款账户不存在");

            conn.commit();
        } catch (SQLException | RuntimeException e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(true);
        }
    }
}
```
:::

`d.executeUpdate()` 返回受影响行数：余额不足时 `WHERE balance >= ?` 不匹配，返回 0，于是抛异常触发回滚——**不要**用 `SELECT balance` 先查再判断，那中间有窗口。`CHECK (balance >= 0)` 是最后一道防线，MySQL 8.0.16 起才真正生效，别指望它替代 `WHERE` 条件。`catch (SQLException | RuntimeException e)` 同时接住数据库异常和业务异常，`throw e` 靠 Java 7 的精确重抛，方法签名只写 `throws SQLException` 就能编译。`finally` 里恢复 `autoCommit` 是给连接池的礼貌，`commit()` 之后再改也不会撤销已提交的数据。

:::error 回滚不了：autocommit=true
```text
java.sql.SQLException: Can't call rollback when autocommit=true
```
**根因**：`conn.rollback()` 之前没执行 `setAutoCommit(false)`，或者中间某处又把它设回了 `true`（常见于「复用连接」的工具方法）。
**修复**：把 `setAutoCommit(false)` 放在借到连接后的第一行，并确保整个事务用的是同一个 `Connection`——换了连接，事务就断了。
:::

#### 步骤 6.4 接上连接池，别让连接泄漏

`DriverManager.getConnection` 每次都新建 TCP、握手、认证，一次几毫秒到几十毫秒；QPS 上百时，光建连接就把数据库打满。连接池预先建好一批连接反复借还，HikariCP 是 Spring Boot 的默认实现，直接用它就能看懂第 9 周之后自动配置替你设了什么。

三个参数最该关心：`maximumPoolSize` 不是越大越好，连接数超过数据库的处理能力只会让它们互相等锁；`connectionTimeout` 决定拿不到连接时等多久，设成 30 秒会让接口一直挂着，3 秒失败更快；`leakDetectionThreshold` 在连接借出超过阈值未归还时打警告，是抓「忘了 close」最有效的手段。批量写入则用 `addBatch` + `executeBatch`，并在 JDBC URL 加 `rewriteBatchedStatements=true`，否则 MySQL 驱动会把一万条 INSERT 一条条发。

现象：单条 `executeUpdate` 循环插一万行要 8 秒，改批处理后 0.6 秒；把某个方法的 `try-with-resources` 去掉，压测 40 秒后出现连接超时。

:::hint 连接池不是越大越好
池子大小的上限是数据库能同时处理的连接数，不是你的线程数。连接借出后必须归还，`try-with-resources` 是最省事的保证；事务里做 HTTP 调用、等锁、睡觉，都会让连接被占着。
:::

:::solution HikariCP 配置、批量插入与分页查询
```java
HikariConfig cfg = new HikariConfig();
cfg.setJdbcUrl("jdbc:mysql://127.0.0.1:3306/budget"
        + "?useSSL=false&serverTimezone=Asia/Shanghai&rewriteBatchedStatements=true");
cfg.setUsername(System.getenv("DB_USER"));
cfg.setPassword(System.getenv("DB_PASSWORD"));
cfg.setMaximumPoolSize(10);
cfg.setConnectionTimeout(3_000);
cfg.setLeakDetectionThreshold(10_000);
HikariDataSource ds = new HikariDataSource(cfg);

public List<Account> page(String category, int page, int size) throws SQLException {
    String sql = "SELECT id, happened_at, amount, category FROM account "
               + "WHERE category = ? ORDER BY happened_at DESC, id DESC LIMIT ? OFFSET ?";
    try (Connection conn = ds.getConnection();
         PreparedStatement ps = conn.prepareStatement(sql)) {
        ps.setString(1, category);
        ps.setInt(2, size);
        ps.setInt(3, (page - 1) * size);
        try (ResultSet rs = ps.executeQuery()) {
            List<Account> out = new ArrayList<>();
            while (rs.next()) out.add(mapRow(rs));
            return out;
        }
    }
}
```
:::

依赖是 `com.zaxxer:HikariCP:5.1.0`（Java 11+）。密码走环境变量，不写进代码，这是第 14 周「配置外置」的提前演练。`LIMIT ? OFFSET ?` 的偏移量越大越慢，因为数据库要跳过前面所有行；深分页改成「记住上一页最后一行的 `(happened_at, id)`，用 `WHERE (happened_at, id) < (?, ?)`」的游标分页，这也是第 11 周分页接口的底层。`mapRow` 里按列名取值，不要按索引，加列时才不会错位。

:::error 连接池借不到连接
```text
java.sql.SQLException: HikariPool-1 - Connection is not available,
request timed out after 3000ms (total=10, active=10, idle=0, waiting=7)
```
**怎么读**：`active=10` 全部借出、`idle=0` 没有空闲、`waiting=7` 有 7 个线程在排队——池子被占满，不是数据库挂了。
**按顺序查**：① 有没有忘了关连接（`leakDetectionThreshold` 的警告会点名借出位置）；② 有没有长事务里夹着 HTTP 调用或 `Thread.sleep`；③ 池子是否真的太小。别第一反应就调大 `maximumPoolSize`，那只是把排队挪到数据库里。
:::

**自测**（合上文档回答）

1. 金额为什么用 `DECIMAL` 而不是 `DOUBLE`？`EXPLAIN` 的 `type`、`key`、`rows` 分别告诉你什么？
2. 拼接 SQL 和 `PreparedStatement` 的本质区别是什么？`useServerPrepStmts` 打开与否，安全性有区别吗？
3. 什么情况下 `rollback()` 会失效？连接池报 `Connection is not available` 时，你先看哪三个数字？

**验收**

- [ ] 同一条按分类查询：有索引时 `EXPLAIN` 的 `key=idx_category_time`、`type=ref`；删索引后 `type=ALL`、`key=NULL`
- [ ] `SELECT COUNT(*) FROM account` 返回 10000，`SELECT COUNT(DISTINCT category)` 返回 4
- [ ] 拼接版登录输入 `' OR '1'='1` 返回多行；占位符版返回 1 行（正确密码）或 0 行（错误密码）
- [ ] 转账中途抛异常后，`SELECT balance FROM wallet WHERE id IN (1,2)` 与转账前完全一致
- [ ] 注释掉 `setAutoCommit(false)` 再调用 `rollback()`，能复现 `Can't call rollback when autocommit=true`
- [ ] 把某个 DAO 方法的 `try-with-resources` 去掉，压 20 并发 40 秒，日志出现 Hikari 连接超时；恢复后消失

---

### 第 7 周：并发

**本周目标**：能说清线程池七个参数、稳定复现一次丢失更新并用 `AtomicInteger` 修好、用 `jstack` 认出一段死锁，并用 `CompletableFuture` 把两个查询并行化且给整体设超时。

**为什么是这些内容**：前六周写的都是「一次只有一个用户」的代码。第 6 周的连接池已经是共享资源，但一个请求一个线程，你还没遇到两个线程同时改同一份数据。Web 服务天生并发：Tomcat 默认两百个线程同时进来，单例 Service、连接池、缓存、计数器全是共享的。并发是 L2 和 L3 最直观的分水岭——不是会不会写 `synchronized`，而是能不能在设计时就指出哪段代码会被两个线程同时执行。不学会的后果很具体：用 `Executors.newFixedThreadPool` 接住无界队列，流量一冲就 OOM；`count++` 在压测里少了几百次，账对不上还复现不了；两把锁顺序反了，死锁后只能重启；把阻塞 IO 丢进公共池，一个慢下游拖垮整台机器。这一周也是第 13 周压测、第 17 周 jstack 诊断的前置：压测压出的问题，最后都要回到线程栈和线程池参数上解释。

#### 步骤 7.1 配一个线程池并触发拒绝策略

七个参数：核心线程数、最大线程数、空闲存活时间、时间单位、工作队列、线程工厂、拒绝策略。提交顺序是固定的：先占核心线程 → 核心满了进队列 → 队列满了才扩到最大线程 → 再满才拒绝。这个顺序解释了两个反直觉现象：队列无界时 `maximumPoolSize` 永远用不上；`newCachedThreadPool` 的最大线程数是 `Integer.MAX_VALUE`，任务一多就无限建线程。阿里规约直接禁用 `Executors` 的这几个工厂方法，原因就在这里。

队列的形状决定系统行为。`ArrayBlockingQueue(2)` 有界，满了立刻触发拒绝，压力马上可见；`LinkedBlockingQueue` 不传容量就是 `Integer.MAX_VALUE`，任务堆在堆内存里，直到 OOM 才报错——那时已经分不清是哪个接口打进来的。拒绝策略也别默认用 `AbortPolicy` 就完事：`CallerRunsPolicy` 让提交任务的线程自己跑，天然把压力反压回上游；`DiscardPolicy` 静默丢任务，最难排查。线程工厂一定要起名，否则 `jstack` 里全是 `pool-1-thread-3`，出问题根本对不上业务。

现象：核心 2、最大 4、队列 2，连续提交 10 个睡 500ms 的任务，前 2 个立刻跑、2 个排队、第 5、6 个把线程扩到 4，剩下 4 个当场抛 `RejectedExecutionException`。

:::hint 七参数里最关键的是队列
任务先占核心线程，满了进队列，队列满了才扩到最大线程，再满才拒绝。所以队列无限大会让最大线程永远用不上，任务堆积到 OOM。
:::

:::solution 显式构造线程池并数清拒绝次数
```java
AtomicInteger seq = new AtomicInteger();
ThreadPoolExecutor pool = new ThreadPoolExecutor(
        2, 4, 60, TimeUnit.SECONDS,
        new ArrayBlockingQueue<>(2),                        // 有界队列：压力可见
        r -> new Thread(r, "order-worker-" + seq.incrementAndGet()), // 起名，jstack 里能认出来
        new ThreadPoolExecutor.AbortPolicy());              // 满了抛异常，不静默丢弃

AtomicInteger rejected = new AtomicInteger();
for (int i = 0; i < 10; i++) {
    final int no = i;
    try {
        pool.submit(() -> { Thread.sleep(500); return no; });
    } catch (RejectedExecutionException e) {
        rejected.incrementAndGet();
        System.out.println("被拒绝：第 " + no + " 个");
    }
}
pool.shutdown();
pool.awaitTermination(5, TimeUnit.SECONDS);
System.out.println("rejected=" + rejected.get());          // 期望 4
```
:::

`submit` 返回 `Future`，任务里的受检异常会被包住，只有 `get()` 时才抛；`execute` 直接抛，调试时更直接。`shutdown` 不再接新任务但会把队列里的跑完，`shutdownNow` 会中断正在跑的线程并返回没跑的任务——生产停机用前者，别用后者硬杀。`awaitTermination` 要设超时，否则主线程可能永远等下去。线程工厂这里用 lambda 简化，真实项目里会给每个线程编号，`order-worker-1`、`order-worker-2`，排查时能对上提交顺序。

:::error 任务被拒，但日志只有一行堆栈
```text
java.util.concurrent.RejectedExecutionException: Task
java.util.concurrent.FutureTask@3f99bd52 rejected from
java.util.concurrent.ThreadPoolExecutor@4f023edb
[Running, pool size = 4, active threads = 4, queued tasks = 2, completed tasks = 0]
```
**怎么读**：`pool size = 4` 到最大了、`active = 4` 都在忙、`queued = 2` 队列也满了——三个数同时到顶，拒绝是设计好的行为。
**根因**：任务提交速度超过消费速度。**修复**：先确认这是「该拒绝」还是「池太小」；该拒绝就配 `CallerRunsPolicy` 或给上游返回 429，池太小再调参数。别把 `AbortPolicy` 换成 `DiscardPolicy` 把证据丢掉。
:::

#### 步骤 7.2 复现竞态并用 Atomic 修好

`count++` 不是一步，是「读 → 加 → 写」三步。两个线程可能同时读到 100，各自加 1 写回 101，两次自增只生效一次，这叫丢失更新。它难查是因为单线程永远正确、低并发大概率正确、压测时才偶尔少几十。`volatile` 只能保证可见性和有序性，**不保证原子性**：它让线程每次读主内存，但「读-改-写」中间仍可被打断，所以给 `count` 加 `volatile` 一点用都没有。

`AtomicInteger.incrementAndGet()` 用 CPU 的 CAS（compare-and-swap）把三步合成一个原子操作：只有内存里的值仍等于预期值时才写入，否则重试。高竞争下 CAS 会空转，JDK 8 的 `LongAdder` 把计数分散到多个单元格最后求和，吞吐更高；但 `sum()` 不是强一致快照，要精确值仍用 `AtomicLong`。`synchronized` 也能修，代价是同一时刻只有一个线程能进，吞吐随核数上不去。

死锁的四个必要条件——互斥、持有并等待、不可抢占、循环等待——破一个就不会死。工程上最容易做的是破循环等待：给所有锁定一个全局顺序，任何线程都按同一顺序加锁。已经死锁时 JVM 不会自己恢复，只能 `jstack` 看：搜 `Found one Java-level deadlock`，它会直接告诉你两个线程各持有什么、在等什么。

现象：8 个线程各加 10 万次，`int` 结果常小于 800000，且每次不同；换 `AtomicInteger` 后稳定 800000。

:::hint i++ 不是原子操作
它由「读 → 加 → 写」三步组成，中间可能被别的线程插进来，两次加只生效一次。`AtomicInteger.incrementAndGet()` 用 CAS 保证三步不可分割；`volatile` 只保证可见性，不保证原子性。
:::

:::solution 同一段代码，两种计数器
```java
public class Counter {
    private int bad;
    private final AtomicInteger good = new AtomicInteger();

    void hit() {
        bad++;                          // 丢失更新
        good.incrementAndGet();         // CAS，原子
    }

    public static void main(String[] args) throws Exception {
        Counter c = new Counter();
        int threads = 8, times = 100_000;
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threads);

        for (int i = 0; i < threads; i++) {
            new Thread(() -> {
                try {
                    start.await();                      // 一起起跑，放大竞争窗口
                    for (int j = 0; j < times; j++) c.hit();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    done.countDown();
                }
            }, "counter-" + i).start();
        }

        start.countDown();
        done.await();
        System.out.println("int=" + c.bad + " atomic=" + c.good.get());
        // 期望 int < 800000，atomic 恰好 800000
    }
}
```
:::

`CountDownLatch` 的 `start` 是一道闸门：所有线程先 `await`，主线程 `countDown` 后同时放行，竞争窗口最大，问题才稳定复现。`done` 反过来等所有线程结束，`finally` 里 `countDown` 保证异常也不会漏。`bad` 没加 `volatile` 也没加锁，多线程读写它是未定义行为；这不是「写法不规范」，而是这个字段本来就不该这样共享。把 `hit` 改成 `synchronized` 也能得到 800000，但可以先想一下：临界区里如果还有 IO，会发生什么。

死锁现场（另起一个类）：把加锁代码放进 `main`，`sleep` 作为类的静态方法，两个线程按相反顺序拿两把锁：

```java
static void sleep(long ms) {
    try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
}

Object a = new Object(), b = new Object();
Thread t1 = new Thread(() -> { synchronized (a) { sleep(100); synchronized (b) { } } }, "t-1");
Thread t2 = new Thread(() -> { synchronized (b) { sleep(100); synchronized (a) { } } }, "t-2");
t1.start(); t2.start();
// 另开终端：jps -l 找 pid，再 jstack <pid> | grep -A 20 "Found one Java-level deadlock"
```

:::error 死锁了，但日志里什么都没有
```text
Found one Java-level deadlock:
=============================
"t-1":
  waiting to lock monitor 0x0000000012345678 (object 0x00000000aaaa0001, a java.lang.Object),
  which is held by "t-2"
"t-2":
  waiting to lock monitor 0x0000000012345690 (object 0x00000000aaaa0002, a java.lang.Object),
  which is held by "t-1"
```
**为什么日志没有**：死锁不是异常，线程只是永远 `BLOCKED`，业务日志当然安静。**怎么发现**：接口全挂、CPU 却不高，就该导线程栈。
**怎么读**：`waiting to lock` 是「我在等谁」，`held by` 是「谁拿着」，两条互相指向就成环。**修复**：统一加锁顺序（按 id 排序后再锁），或 `tryLock(timeout)` 拿不到就放弃并重试。
:::

#### 步骤 7.3 用 CompletableFuture 编排两个查询

场景：任务详情页要用户信息和订单列表，串行 200ms + 300ms 共 500ms，并行只要 300ms。`supplyAsync` 把任务交给线程池，`thenCombine` 等两个都完成再合并，`orTimeout` 到点让 future 异常完成，`exceptionally` 给降级值。

三个关键细节。第一，**不要用默认的 `ForkJoinPool.commonPool` 跑阻塞 IO**：它的并行度默认是 CPU 核数减一，全站共用，几个慢查询就能占满，连 `parallelStream` 都跟着卡；要传自己的池，池要有界队列、有名字。第二，`get(timeout)` 超时抛 `TimeoutException`，但**底层任务不会停**，只是你不等了；`orTimeout` 同样不中断任务。真要停，得让下游客户端自己设连接超时和读超时，否则线程一直被占着。第三，`thenCombine` 的回调运行在「最后完成的那个线程」上，在回调里再同步等另一个 future，很容易把池子耗死。

现象：两个各睡 300ms 的 supplier 串行要 600ms，并行约 300ms；把整体超时设成 100ms，`exceptionally` 在 100ms 左右返回降级对象，但日志显示两个任务仍在跑完。

:::hint 异步不是免费午餐
每多一个线程池，就多一份要配的队列、超时和监控。IO 密集用独立池，别和 CPU 任务共用；有超时必须配降级，否则超时只是把错误换了个地方抛。
:::

:::solution 并行取用户与订单，整体 800ms 超时
```java
ThreadPoolExecutor io = new ThreadPoolExecutor(
        8, 8, 0, TimeUnit.MILLISECONDS,
        new ArrayBlockingQueue<>(200),
        r -> new Thread(r, "io-worker"),
        new ThreadPoolExecutor.CallerRunsPolicy());

CompletableFuture<User> userF =
        CompletableFuture.supplyAsync(() -> userClient.load(uid), io);
CompletableFuture<List<Order>> ordersF =
        CompletableFuture.supplyAsync(() -> orderClient.list(uid), io);

CompletableFuture<Detail> detailF = userF
        .thenCombine(ordersF, Detail::new)
        .orTimeout(800, TimeUnit.MILLISECONDS)
        .exceptionally(e -> {
            log.warn("加载详情降级 uid={}", uid, e);
            return Detail.fallback(uid);
        });

Detail detail = detailF.join();     // 此时一定在 800ms 内完成（成功或降级）
// 应用关闭钩子里再调用 io.shutdown()，不要每个请求都关池
```
:::

`thenCombine` 的两个参数分别是另一个 future 和「两个结果怎么合成」的函数，这里 `Detail::new` 是构造器引用，签名正好是 `(User, List<Order>)`。`orTimeout` 是 Java 9 加的，返回的是**新的** future，原 future 不受影响。`exceptionally` 必须放在 `orTimeout` 之后，否则接不到超时；它接住所有上游异常，包括业务异常和超时，所以日志里要打 `e`，别只打一句「降级了」。`join` 抛的是 `CompletionException` 包装，`get` 抛受检的 `ExecutionException`，在 Controller 层统一处理时要注意这个差别。池子的 `shutdown` 放在应用关闭钩子里，不要在每次请求后关。

:::error join 抛 CompletionException，根因被包了一层
```text
java.util.concurrent.CompletionException: java.util.concurrent.TimeoutException
    at java.base/java.util.concurrent.CompletableFuture.encodeThrowable(CompletableFuture.java:332)
    at java.base/java.util.concurrent.CompletableFuture.completeThrowable(CompletableFuture.java:347)
```
**根因**：`join()` 会把上游异常统一包成 `CompletionException`，直接 `catch (TimeoutException)` 永远接不到。
**修复**：`catch (CompletionException e)` 后看 `e.getCause()`；或者更早用 `exceptionally` / `handle` 把异常转成降级值，让 `join` 只负责拿结果。别用 `printStackTrace` 了事，至少把 `uid` 和耗时打进日志。
:::

**自测**（合上文档回答）

1. 线程池的提交顺序是什么？为什么无界队列会让 `maximumPoolSize` 失效？
2. `volatile` 保证什么、不保证什么？`AtomicInteger` 靠什么指令实现原子自增？
3. `get(timeout)` 超时后任务会停吗？为什么阻塞 IO 不能丢进 `commonPool`？

**验收**

- [ ] 核心 2 / 最大 4 / 队列 2 提交 10 个 500ms 任务，控制台恰好打印 4 行「被拒绝」
- [ ] `jstack <pid>` 里线程名以 `order-worker-` 开头，不是 `pool-1-thread-N`
- [ ] 8 线程各加 10 万次，`int` 结果小于 800000；换 `AtomicInteger` 后连跑 5 次都是 800000
- [ ] 构造死锁后 `jstack` 输出含 `Found one Java-level deadlock`，能指出两个线程各等哪把锁
- [ ] 两个各睡 300ms 的 supplier 并行总耗时小于 500ms；超时设 100ms 时走降级分支且日志有 uid
- [ ] `shutdown()` + `awaitTermination` 后 JVM 能自行退出，没有非守护线程挂住进程

---

### 第 8 周：综合小项目（不用框架）

**本周目标**：交付 `taskmgr`：四层分包、`TaskDao` 接口加 JDBC 与内存两个实现、`mvn test` 至少 15 个测试全绿、别人照 README 十分钟内跑起来。

**为什么是这些内容**：前七周学的是零件——第 2 周的面向对象、第 4 周的 IO、第 5 周的测试、第 6 周的 JDBC、第 7 周的并发。这一周不再学新 API，而是把零件缝成一个别人能接手的东西。缝的规矩比功能重要：依赖只能朝一个方向（`cli → service → dao → model`），接口定在调用方需要的地方，测试替身从接口切进去。为什么坚持不用框架？因为框架会替你决定分层；你还没亲手画过一遍，就分不清哪些是 Spring 的魔法、哪些是你的设计。第 9 周用 Spring 改造这个项目时，Controller / Service / Mapper 会和今天的手写分层一一对应，你能准确说出框架替掉了哪几行。不学会的后果很具体：所有逻辑堆在 `main`，改一个功能要跳五个文件；Service 里直接 `new JdbcTaskDao()`，跑一个校验测试也要连数据库，CI 随机变红；README 少写一步，交付就变成远程陪跑。这一周的验收标准不是功能多，而是结构对、测试全、别人能跑。

#### 步骤 8.1 先定分层和接口，再写实现

先把包画出来，再写第一行代码：

```text
com.example.taskmgr
├── model      Task, Status
├── dao        TaskDao, JdbcTaskDao, InMemoryTaskDao
├── service    TaskService
├── cli        Main
└── config     Db
```

依赖方向 `cli → service → dao → model`，反向一律不允许。自检方法：删掉 `cli` 包，`service`、`dao` 和测试仍能编译运行；删掉 `service`，`dao` 完全不知道 `service` 存在。接口放在 `dao` 包、由 `service` 使用——**接口属于调用方**，所以方法签名按 service 的需要设计，不是按表的列设计。比如 `findById` 返回 `Optional<Task>` 而不是 `null`，就是为了让「任务不存在」在类型上可见，逼调用方处理。

`TaskService` 用构造器注入 `TaskDao`，好处有三个：依赖不为 `null`（`Objects.requireNonNull` 当场失败）、字段能 `final`、测试直接 `new TaskService(new InMemoryTaskDao())`。业务规则放 service：标题非空、完成任务前必须存在、已完成不能再完成。JDBC 实现只管 SQL 和行映射，不写业务判断；异常也分层，DAO 抛 `SQLException`，service 抛 `IllegalArgumentException` / `NoSuchElementException`，`cli` 负责把异常变成人话，不把堆栈倒给用户。

现象：Service 里直接 `new JdbcTaskDao()` 时，跑「空白标题应拒绝」也要先连 MySQL；改成构造器注入后，同一个测试 5 毫秒跑完，且不需要数据库。

:::hint 接口先行是为了能测
`Service` 依赖 `TaskDao` 接口，测试时传一个内存实现，就不需要连数据库。如果 `Service` 里直接 `new JdbcTaskDao()`，这个测试永远跑不快、跑不稳。
:::

:::solution 模型、接口与业务层
```java
public record Task(long id, String title, Status status, Instant createdAt) {
    public Task withId(long newId) {
        return new Task(newId, title, status, createdAt);
    }
}

public enum Status { TODO, DOING, DONE }

public interface TaskDao {
    long insert(Task t) throws SQLException;
    Optional<Task> findById(long id) throws SQLException;
    List<Task> findAll() throws SQLException;
    List<Task> findByStatus(Status s) throws SQLException;
    void updateStatus(long id, Status s) throws SQLException;
    void delete(long id) throws SQLException;
}

public class TaskService {
    private final TaskDao dao;

    public TaskService(TaskDao dao) {
        this.dao = Objects.requireNonNull(dao, "dao");
    }

    public Task create(String title) throws SQLException {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("标题不能为空");
        }
        Task draft = new Task(0, title.trim(), Status.TODO, Instant.now());
        return draft.withId(dao.insert(draft));
    }

    public void complete(long id) throws SQLException {
        Task t = dao.findById(id)
                .orElseThrow(() -> new NoSuchElementException("任务不存在: " + id));
        if (t.status() == Status.DONE) {
            throw new IllegalStateException("任务已完成: " + id);
        }
        dao.updateStatus(id, Status.DONE);
    }
}

public class JdbcTaskDao implements TaskDao {
    private final DataSource ds;

    public JdbcTaskDao(DataSource ds) { this.ds = ds; }

    @Override public long insert(Task t) throws SQLException {
        String sql = "INSERT INTO task (title, status, created_at) VALUES (?, ?, ?)";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, t.title());
            ps.setString(2, t.status().name());
            ps.setTimestamp(3, Timestamp.from(t.createdAt()));
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (!keys.next()) throw new SQLException("没有返回主键");
                return keys.getLong(1);
            }
        }
    }

    @Override public Optional<Task> findById(long id) throws SQLException {
        String sql = "SELECT id, title, status, created_at FROM task WHERE id = ?";
        try (Connection c = ds.getConnection();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(map(rs)) : Optional.empty();
            }
        }
    }

    private Task map(ResultSet rs) throws SQLException {
        return new Task(rs.getLong("id"), rs.getString("title"),
                Status.valueOf(rs.getString("status")),
                rs.getTimestamp("created_at").toInstant());
    }
    // findAll / findByStatus / updateStatus / delete 同理，SQL 一律用 ? 占位符
}
```
:::

`record` 自带 `equals` / `hashCode` / `toString`，适合做不可变模型；`withId` 返回新对象，而不是改字段，避免「id 被谁改过」这种排查噩梦。`JdbcTaskDao` 用 `RETURN_GENERATED_KEYS` 拿自增主键，再把 id 填回返回对象，这样调用方拿到的 `Task` 立刻可用于后续操作；`map` 按列名取值，和 `schema.sql` 的列一一对应。接口方法都声明 `throws SQLException`，是刻意的：这一版不引入自定义异常体系，让受检异常一路传到 `cli`，由它统一打印「数据库暂时不可用」。真实的 Spring 项目会在 Repository 层把 `SQLException` 翻译成 `DataAccessException`，那是第 10 周的事。`complete` 先查再改，中间有并发窗口；本周先接受它，第 10 周用「带条件的 UPDATE + 受影响行数」修掉。分包不是目的，可替换才是：把 `JdbcTaskDao` 换成内存实现，`TaskService` 一行不改，这个项目就同时拥有了生产实现和测试实现。

#### 步骤 8.2 写 README 并按它重跑一遍

README 的顺序就是别人执行的顺序，不是你的编码顺序：前置环境 → 建库 → 配置 → 编译 → 运行 → 测试 → 预期输出 → 常见错误。配置模板 `config.example.properties` 提交进库，真实的 `config.properties` 进 `.gitignore`；密码优先走环境变量覆盖，模板里只留空值。建库脚本 `schema.sql` 要能重复执行（`CREATE TABLE IF NOT EXISTS`），否则别人第二次跑就报「表已存在」。

重跑的方法：换一台干净机器，或至少把项目 `git clone` 到新目录，照 README 一行行敲；**卡住的每一步都要补进 README**，而不是口头告诉对方。判断标准是「别人十分钟能跑起来」，不是「我机器上能跑」。写完让一个没看过代码的人试一遍，他问的每个问题都是文档缺口。

现象：README 只写了 `mvn exec:java`，别人用 `java -cp target/classes` 跑，报 `No suitable driver found`；补上「用 exec 插件或打 fat jar，二选一」之后才通。

:::hint README 是验收工具
你自己跑不卡，不代表别人不卡——你机器上装过的东西、配过的路径，别人都没有。把「别人十分钟能跑起来」当验收标准，你会被迫补全所有隐式前提。
:::

:::solution 建库脚本与 README 模板
```sql
CREATE DATABASE IF NOT EXISTS taskmgr DEFAULT CHARSET utf8mb4;
USE taskmgr;
CREATE TABLE IF NOT EXISTS task (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  status VARCHAR(16) NOT NULL,
  created_at DATETIME(3) NOT NULL
) ENGINE=InnoDB;
```
```markdown
# taskmgr

**前置**：JDK 17、Maven 3.9、MySQL 8.0（本地 3306 端口）

**第一次运行**
1. 建库：`mysql -u root -p < schema.sql`
2. 配置：`cp config.example.properties config.properties`（Windows 用 `copy`），填数据库密码
3. 编译：`mvn -q -DskipTests compile`
4. 运行：`mvn -q exec:java -Dexec.mainClass=com.example.taskmgr.cli.Main -Dexec.args="list"`
5. 测试：`mvn -B test`

**预期输出**：`list` 先打印表头 `ID  TITLE  STATUS`；空库时没有数据行，退出码 0。

**常见问题**
- `No suitable driver found`：运行时 classpath 缺 mysql-connector-j，见 pom 的 runtime scope。
- `Access denied`：config.properties 的密码不对，或账号没有 taskmgr 库权限。
```
:::

`DATETIME(3)` 保留毫秒，任务排序时不会因为同一秒内创建而乱序；`status` 存字符串而不是枚举序号，可读性优先，代价是多几个字节。README 里的命令要能直接复制，别写「配置一下数据库」这种没法执行的句子；每条命令后面最好跟一句预期结果，别人才能判断自己是成功还是静默失败。`config.example.properties` 里写 `DB_PASSWORD=`，并在旁边注明「留空则读环境变量」，两条路都行，但只能留一条在文档里，否则新人会两条都试。还有一条容易忽略：所有命令都要能从仓库根目录执行，路径用相对路径；如果必须 `cd`，就明确写出来，别让人猜。

:::error 驱动没进运行时 classpath
```text
java.sql.SQLException: No suitable driver found for jdbc:mysql://127.0.0.1:3306/taskmgr
```
**根因**：驱动不在运行时 classpath——依赖 scope 写成了 `provided`、用 `java -cp target/classes` 直接跑没带依赖、或 URL 少了 `jdbc:` 前缀。
**修复**：依赖用 `com.mysql:mysql-connector-j:8.4.0`，scope 写 `runtime`（或默认的 `compile`，但别用 `provided`）；运行方式统一成 `mvn exec:java` 或 shade 打出的 fat jar；启动时把脱敏后的 URL 打一行日志，拼错立刻能看见。
:::

#### 步骤 8.3 用内存实现写单测，再跑一次真库

测试分两层。大量服务测试用 `InMemoryTaskDao`，毫秒级，覆盖业务规则；少量 DAO 集成测试连真库，覆盖 SQL 和行映射。全部连库会让测试变慢、变脆、还要人人装 MySQL；全部不连库则 SQL 写错没人发现——列名拼错、类型不匹配，编译器一概不管。

集成测试用 `@EnabledIfEnvironmentVariable(named = "DB_URL", matches = ".+")`：没配环境变量就自动跳过，配了才跑。这样 CI 和新人机器都不会因为它变红，而需要验证时只要导出一个变量。类名不要用 `*IT` 结尾——Surefire 默认只扫 `*Test`，`*IT` 是留给 Failsafe 的；用 `JdbcTaskDaoDbTest` 这种名字，`mvn test` 才会在配了 `DB_URL` 时真的执行它。每个集成测试自己造数据、自己清理，别依赖执行顺序；用唯一的标题前缀（比如 `IT-<uuid>`）标记，`@AfterEach` 里按前缀删掉。15 个测试可以这样分：Service 8 个（创建、空白标题、完成、重复完成、删除、不存在、按状态过滤、分页参数校验），DAO 4 个（insert 回填 id、findById、updateStatus、delete），CLI 1 个（命令解析），集成 2 个（真库 CRUD、事务回滚）。

现象：单测全绿，第一次连真库就报 `Unknown column 'created_at' in 'field list'`——SQL 里的列名没人编译检查，只有集成测试能抓住。

:::hint 测试金字塔不是口号
底层大量快测试保证业务规则，顶层少量真库测试保证 SQL 正确。比例反了，要么慢到没人跑，要么假绿到上线才炸。
:::

:::solution 内存实现与三个边界测试
```java
public class InMemoryTaskDao implements TaskDao {
    private final Map<Long, Task> rows = new LinkedHashMap<>();
    private final AtomicLong seq = new AtomicLong();

    @Override public long insert(Task t) {
        long id = seq.incrementAndGet();
        rows.put(id, t.withId(id));
        return id;
    }
    @Override public Optional<Task> findById(long id) { return Optional.ofNullable(rows.get(id)); }
    @Override public List<Task> findAll() { return List.copyOf(rows.values()); }
    @Override public List<Task> findByStatus(Status s) {
        return rows.values().stream().filter(t -> t.status() == s).toList();
    }
    @Override public void updateStatus(long id, Status s) {
        rows.computeIfPresent(id, (k, t) -> new Task(id, t.title(), s, t.createdAt()));
    }
    @Override public void delete(long id) { rows.remove(id); }
}

class TaskServiceTest {
    private final TaskDao dao = new InMemoryTaskDao();
    private final TaskService service = new TaskService(dao);

    @Test
    void 空白标题应拒绝() {
        assertThrows(IllegalArgumentException.class, () -> service.create("   "));
    }

    @Test
    void 完成后状态为DONE() throws Exception {
        Task t = service.create("写周报");
        service.complete(t.id());
        assertEquals(Status.DONE, dao.findById(t.id()).orElseThrow().status());
    }

    @Test
    void 重复完成应报错() throws Exception {
        Task t = service.create("写周报");
        service.complete(t.id());
        assertThrows(IllegalStateException.class, () -> service.complete(t.id()));
    }
}
```
:::

`LinkedHashMap` 保住插入顺序，`findAll` 的结果才稳定，测试不用排序；`List.copyOf` 返回不可变副本，测试里改它不会污染 DAO。`computeIfPresent` 只有在 key 存在时才替换，天然实现了「不存在就什么都不做」，但 service 的 `complete` 已经先查过，所以这里不会掩盖问题。三个测试分别覆盖「输入非法」「正常路径」「状态非法」，每一条都对应 service 里一个 `if`；如果某个 `if` 删掉测试还绿，说明断言写错了。`throws Exception` 是为了让 lambda 里的受检异常能冒出来，测试方法签名宽一点没关系。测试里不要用 `Thread.sleep` 等结果，也不要用固定端口，用 `@TempDir`、随机端口和唯一前缀，测试才能并行跑而不互相踩。

:::error 真库测试报列名不存在
```text
java.sql.SQLException: Unknown column 'created_at' in 'field list'
```
**根因**：`INSERT` 或 `SELECT` 里写的列名和 `schema.sql` 不一致（下划线、大小写、少一列），编译期完全看不出来。
**修复**：以 `schema.sql` 为唯一真相源，DAO 的列名集中成常量；集成测试启动时先跑一遍建表脚本，保证结构和代码同步。别在测试里 `ALTER TABLE` 临时补列，那会把问题藏到下一次。
:::

**自测**（合上文档回答）

1. 为什么 `TaskService` 依赖 `TaskDao` 接口而不是 `JdbcTaskDao`？换成接口后测试有什么变化？
2. README 应该按什么顺序写？别人卡住时，你先补文档还是先远程帮跑？
3. 哪些测试必须连真库？没有数据库环境时，怎么让它们跳过而不是失败？

**验收**

- [ ] `mvn -B test` 输出 `Tests run` 至少 15、Failures 0；不装 MySQL 也能全绿
- [ ] 导出 `DB_URL` 后多跑 2 个集成测试；不导出时报告里是 skipped，不是 failed
- [ ] `mvn -q exec:java -Dexec.mainClass=com.example.taskmgr.cli.Main -Dexec.args="list"` 打印表头 `ID  TITLE  STATUS`，空库时退出码 0
- [ ] 在空目录按 README 走完建库、配置、编译、运行、测试，全程不超过 10 分钟且无需读源码
- [ ] 删掉 `TaskService.create` 的空标题校验，`mvn test` 变红并点名「空白标题应拒绝」；恢复后变绿
- [ ] `git status --porcelain` 里没有 `target/` 与 `config.properties`，仓库里搜不到真实密码

---

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

**本周目标**：把第 8 周的任务管理器改成 Spring Boot 服务——GET 与 POST 能通，换端口、换数据源、改分页大小都只动配置不动代码。

**为什么是这些内容**：第 8 周你交付了一个分层项目，但对象都是自己 `new` 的：`Main` 里 new Service，Service 里 new DAO。这一周把「创建与装配」交给容器，你只声明需要什么。这是整条路线里最大的一次思维切换，也是后面三周的地基：第 10 周的事务靠代理对象生效，第 11 周的校验靠 MVC 的参数解析，第 12 周的拦截器靠容器注册。只会背注解的人，遇到「注入为 null」「事务不生效」「配置读不到」只能重启和搜索碰运气；知道容器在做什么的人，能从启动日志和 Bean 定义直接定位。配置外置同样是硬要求：同一份 jar 要部署到本地和服务器，密码一旦进了 git 就永远留在历史里。学完的检验标准不是「能写 Controller」，而是能画出一次请求从 socket 到 JSON 的路径，并指出每一步由谁负责。

#### 步骤 9.1 第一个 Controller（构造器注入）

一个请求进来，先由内嵌 Tomcat 接住，交给 Spring 的 `DispatcherServlet`；它问 `HandlerMapping`「这个路径归谁」，找到 `TaskController.list`，再由 `HandlerAdapter` 调用方法。参数带 `@RequestBody` 时，`HttpMessageConverter`（默认 Jackson）把 JSON 读成对象；返回值是 `List<Task>` 时，同一个转换器把它写成 JSON。所以「请求怎么进来、JSON 怎么出去」不是魔法，是这几个组件按固定顺序干活。

构造器注入发生在启动阶段，不是请求阶段。容器扫描到 `@RestController` 和 `@Service`，为每个类创建 Bean；创建 `TaskController` 时发现构造器要一个 `TaskService`，就按类型去容器里找，找到就传进来。找不到启动直接失败——这是好事，错误暴露在启动时而不是第一次请求时。字段写成 `final`，编译器保证它只被赋值一次；测试时 `new TaskController(fakeService)` 就能跑，不用启动 Spring。同一个类型有两个 Bean 时容器报 `NoUniqueBeanDefinitionException`，用 `@Primary` 标默认实现，或给参数加 `@Qualifier("名字")` 指定。

还要记住 Controller 默认是单例：整个应用只有一个实例，所有请求共用。字段只能放无状态的依赖，不能放 `currentUser`、`requestId` 这类请求级数据——两个用户并发时会把对方的数据读走。请求级数据走方法参数、`HttpServletRequest` 或 `ThreadLocal`（用完必须清）。单例省对象、启动快，代价是所有可变字段都要当共享变量对待。

```java
@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    private final TaskService service;

    public TaskController(TaskService service) {   // 只有一个构造器，不用写 @Autowired
        this.service = service;
    }

    @GetMapping
    public List<Task> list() {
        return service.findAll();                  // 返回值由 Jackson 写成 JSON
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Task create(@RequestBody Task task) {   // JSON 由 Jackson 读成 Task
        return service.create(task);
    }
}

@Service
public class TaskService {
    private final TaskDao dao;
    public TaskService(TaskDao dao) { this.dao = dao; }
    public List<Task> findAll() { return dao.findAll(); }
    public Task create(Task task) { return dao.insert(task); }
}
```

`@RestController` 等于 `@Controller` 加 `@ResponseBody`，返回值直接写响应体，不会去找视图模板。类上的 `@RequestMapping("/api/tasks")` 是前缀，与方法上的 `@GetMapping` 拼成完整路径。Spring 4.3 起，类只有一个构造器时自动按类型注入，所以构造器上不写 `@Autowired` 也对。`@RequestBody` 不能省，省了 Jackson 不会读请求体，参数会是 null。`@ResponseStatus(CREATED)` 让创建返回 201；不写就是 200。`TaskService` 必须落在启动类的同包或子包里，否则组件扫描扫不到。

用 `curl` 调 POST 时，`-H 'Content-Type: application/json'` 不能漏：`@RequestBody` 靠这个头选择消息转换器，头不对会返回 415，而不是把 JSON 当表单解析。响应里的字段名由 getter 决定（`getCreatedAt` 写成 `createdAt`），如果发现字段名对不上，先看实体里的 getter，而不是改前端。写完后把返回的 `id` 拿去做一次 GET 列表，确认这条数据真的进了存储，而不是只在内存里绕了一圈。

:::hint 为什么不用 @Autowired 字段注入
构造器注入能保证依赖不为 null、能写成 `final`、也能在测试里直接 `new` 出来。字段注入靠反射赋值，脱离容器就不可用——这是 Spring 官方推荐的写法，也是本项目的写法。
:::

:::solution 验证命令
```bash
curl -si http://127.0.0.1:8080/api/tasks
curl -si -X POST http://127.0.0.1:8080/api/tasks \
  -H 'Content-Type: application/json' -d '{"title":"写代码"}'
```
第一条返回 200 和 JSON 数组；第二条返回 201，响应体字段名与你定义的一致，并且带 `id`。
:::

:::error 启动时找不到 Bean
```text
***************************
APPLICATION FAILED TO START
***************************
Description:
Parameter 0 of constructor in com.example.task.TaskController required a bean
of type 'com.example.task.TaskService' that could not be found.
```
**根因**：`TaskService` 没标 `@Service`/`@Component`；或者它不在启动类所在包及其子包下，组件扫描扫不到；或者你把它写成了接口而实现类没注册。
**修复**：先确认启动类的包名，把 Service 放进它的子包；再给它加 `@Service`。改完重启，启动日志里应出现 `Tomcat started on port 8080`。
:::

#### 步骤 9.2 配置外置与多环境

配置要解决的是「同一份构建产物，在不同环境跑出不同行为」。数据库地址、端口、日志级别都属于环境差异，写进代码就得为每个环境重新打包；而带上密码的 jar 一旦被复制、备份、误传，密码就泄露了。约定是：默认值写在 `application.yml`（跟着 jar 走，不放秘密），环境差异用环境变量或 `application-{profile}.yml` 覆盖（不跟着 jar 走）。

占位符 `${DB_URL:jdbc:mysql://127.0.0.1:3306/demo}` 里冒号后面是默认值：变量存在就用它，不存在用默认。写 `${DB_PASSWORD}` 而不给默认值，变量没设时启动直接报 `Could not resolve placeholder`——这是有意的 fail-fast。别用空默认值把错误藏起来，那会让服务连上一个空密码的库，然后在第一次查询时才炸。YAML 里密码含 `#`、`:`、`@` 时要用单引号包起来，否则会被当成注释或键值分隔；纯数字密码也要加引号，避免被解析成数字。

profile 是一组配置的开关：`application-dev.yml` 只在 `dev` 激活时加载，激活方式有命令行 `--spring.profiles.active=dev`、环境变量 `SPRING_PROFILES_ACTIVE=dev`，或写在 `application.yml` 里（不推荐，等于把环境写死）。优先级从高到低是命令行参数 > 环境变量 > `application-{profile}.yml` > `application.yml`，同名键后者被前者覆盖。排查「为什么读到的不是我写的值」时按这个顺序逐层排除。

```yaml
# application.yml：默认值，可以进 git
spring:
  datasource:
    url: ${DB_URL:jdbc:mysql://127.0.0.1:3306/demo?useSSL=false}
    username: ${DB_USER:root}
    password: ${DB_PASSWORD}
app:
  task:
    page-size: 20
```

```bash
java -jar app.jar --spring.profiles.active=dev
DB_PASSWORD='s3cret' java -jar app.jar          # 只对这个进程生效
java -jar app.jar --server.port=8081            # 命令行参数优先级最高
```

```powershell
$env:DB_PASSWORD = 's3cret'; java -jar app.jar   # PowerShell 写法
```

`${DB_PASSWORD}` 没有默认值，意味着这个变量必须由运行环境提供；`.env` 只用于本地，必须写进 `.gitignore`。bash 里 `VAR=值 命令` 只给这一条命令设环境变量，不会污染当前 shell；PowerShell 要先 `$env:` 赋值。`useSSL=false` 只适合本机回环连接，连远程库时不要照抄。

`application-{profile}.yml` 要和主配置一样放在 `src/main/resources` 或 jar 同级目录；放在别处 Spring 不会自动读，除非用 `--spring.config.additional-location` 指定。改完配置先看启动日志里有没有 `The following 1 profile is active: "dev"`，确认 profile 真的激活了，再排查值为什么不对。

:::hint 配置优先级
命令行参数 > 环境变量 > `application-{profile}.yml` > `application.yml`。**密码永远不进代码、不进 git**；本地用 `.env`，服务器用环境变量。
:::

:::solution 换环境不改代码
```bash
DB_PASSWORD='s3cret' java -jar app.jar --spring.profiles.active=dev --server.port=8081
curl -s http://127.0.0.1:8081/api/tasks
```
端口、profile、密码三样都在启动命令里给，jar 不用重新打。把命令存成 `run-dev.sh`，但别把密码提交上去。
:::

:::error 占位符解析失败
```text
Description:
Failed to bind properties under 'spring.datasource.password' to java.lang.String:
    Value: "${DB_PASSWORD}"
    Reason: Could not resolve placeholder 'DB_PASSWORD' in value "${DB_PASSWORD}"
```
**三个原因**：① 环境变量没设，或设在另一个终端；② 名字拼错（`DB_PASSWD`）；③ IDE 的运行配置没有继承 shell 的环境变量。
**修复**：先在同一个终端 `echo $DB_PASSWORD` 确认能打印出来，再启动；长期方案是本地 `.env` + 启动脚本，服务器用 systemd 的 `EnvironmentFile`。
:::

#### 步骤 9.3 配置变成类型安全的 Bean，启动就校验

`@Value("${app.task.page-size}")` 只有一个值时够用，一旦有五六个相关配置就散落在各个类里：改个键名要全局搜字符串，拼错了只有运行时才发现。`@ConfigurationProperties(prefix = "app.task")` 把一组配置绑定到一个对象：键名按宽松绑定匹配（`page-size`、`pageSize`、`PAGE_SIZE` 都能绑上），IDE 能补全，类型由字段声明决定。

用 record 做配置对象时走构造器绑定，字段不可变，天然线程安全。配 `@Validated` 加 jakarta 校验注解，绑定失败会让应用启动失败，日志直接点名哪个字段不合法。这是「配置即契约」：错的值应该在启动时炸，因为启动失败你立刻能看见，凌晨两点的空指针不能。类型上还有两个好处：`Duration` 能直接写 `3s`、`500ms`，`DataSize` 能写 `10MB`，不用自己解析字符串再乘一千。

`@ConfigurationProperties` 注解本身不会注册 Bean，要配合 `@ConfigurationPropertiesScan` 或 `@EnableConfigurationProperties(TaskProperties.class)`；漏了会得到一个「找不到 TaskProperties」的启动错误。`ApplicationRunner` 在容器启动完成后跑一次，适合打印实际绑定值或做启动自检；生产里更常见的是在启动时校验关键配置，错了就拒绝启动。

```java
@SpringBootApplication
@ConfigurationPropertiesScan          // 扫描 @ConfigurationProperties，不用逐个 @Enable
public class TaskApplication {
    public static void main(String[] args) { SpringApplication.run(TaskApplication.class, args); }
}

@ConfigurationProperties(prefix = "app.task")
@Validated
public record TaskProperties(@Min(1) @Max(100) int pageSize,
                             @NotNull Duration timeout) {}

@Component
class ConfigProbe implements ApplicationRunner {
    private final TaskProperties props;
    ConfigProbe(TaskProperties props) { this.props = props; }

    @Override public void run(ApplicationArguments args) {
        System.out.println("pageSize=" + props.pageSize() + " timeout=" + props.timeout());
    }
}
```

`app.task.page-size` 靠宽松绑定映射到 `pageSize()`；`timeout: 3s` 由 Spring 的转换器转成 `Duration`。record 没有 setter，所以只能走构造器绑定，字段名必须和构造参数一致。`@Validated` 要加在类上，`@Min`、`@Max` 来自 `jakarta.validation.constraints`。`ConfigProbe` 用包级可见性即可被扫描到，不需要 public。

如果想让 IDE 在 `application.yml` 里补全自定义键，引入可选的 `spring-boot-configuration-processor`（`<optional>true</optional>`），它在编译期生成 `META-INF/spring-configuration-metadata.json`；不加也能跑，只是没有提示。校验消息默认是英文，给 `@Min` 写 `message = "每页至少 1 条"` 更利于排查。

:::hint 一组配置用一个对象
散落的 `@Value` 改一个键名要全局搜；配置对象让键名只出现一次，还能在启动时校验。超过三个相关配置就建一个 Properties 类。
:::

:::solution 用坏配置验证 fail-fast
```bash
java -jar app.jar --app.task.page-size=0
# 启动失败：pageSize ... must be greater than or equal to 1

java -jar app.jar --app.task.page-size=200
# 启动失败：must be less than or equal to 100

java -jar app.jar --app.task.timeout=abc
# 启动失败：Failed to convert value of type 'java.lang.String' to 'java.time.Duration'
```
三次都在启动阶段失败、日志点名配置键，才算绑定和校验都生效了。
:::

:::error 配置类没被注册
```text
Parameter 0 of constructor in com.example.task.ConfigProbe required a bean of type
'com.example.task.TaskProperties' that could not be found.
```
**根因**：只写了 `@ConfigurationProperties`，没有 `@ConfigurationPropertiesScan`，也没有 `@EnableConfigurationProperties(TaskProperties.class)`；注解本身只是元数据，不会创建 Bean。
**修复**：在启动类加 `@ConfigurationPropertiesScan`，或显式 `@EnableConfigurationProperties(TaskProperties.class)`。前者更适合配置类分散在多个包的情况。
:::

**自测**（合上文档回答）

1. 一个请求从 Tomcat 到 JSON 响应，依次经过哪些组件？`@RequestBody` 由谁负责？
2. 配置优先级四层怎么排？`${DB_PASSWORD:}` 与 `${DB_PASSWORD}` 在变量缺失时行为差在哪？
3. Controller 是单例，为什么不能把当前登录用户存进字段？请求级数据该放哪？

**验收**

- [ ] `curl -si -X POST .../api/tasks -d '{"title":"写代码"}'` 返回 201，响应体带 `id`
- [ ] 注释掉 `TaskService` 的 `@Service` 重启，启动失败并出现 `required a bean of type 'TaskService'`
- [ ] `--server.port=8081` 启动后 8081 能访问，8080 连接被拒
- [ ] `--app.task.page-size=0` 启动失败，日志点名 `pageSize`
- [ ] `application.yml` 里没有明文密码，`git grep -n "DB_PASSWORD"` 只命中占位符

---

### 第 10 周：持久层（MyBatis-Plus）

**本周目标**：用 `TaskMapper` 完成增删改查与服务端分页，并亲手复现、修复一次 `@Transactional` 失效——能指出这一次事务的边界从哪开始、到哪结束。

**为什么是这些内容**：第 9 周的 Controller 返回的还是内存里的 List，进程一重启数据就没了。这一周把数据写进 MySQL，同时第一次遇到「框架替你做的事，边界在哪」。MyBatis-Plus 把 CRUD 压成一行，代价是 SQL 被藏起来了：不会看它生成的语句，慢查询和全表扫描就无从查起。事务更是分水岭——第 6 周你手写过 `commit`/`rollback`，这周交给 `@Transactional`，而它只在「经过代理对象」时生效。不学会的后果不是报错，而是**没有报错**：钱扣了没加、订单重复、库存对不上，接口却返回成功。这一周还要把分页做成服务端契约，它是第 11 周统一分页返回体的前置，也是第 17 周排查慢 SQL 的入口。

#### 步骤 10.1 Mapper 与条件构造器

MyBatis-Plus 的核心是 `BaseMapper<T>`：继承它就有了 `insert`、`selectById`、`selectList`、`updateById`、`deleteById`，不用为每张表写一遍 XML。实体靠注解和表对齐：`@TableName("task")` 指定表名，`@TableId(type = IdType.AUTO)` 指定自增主键；下划线转驼峰默认开启，所以 `created_at` 列会自动映射到 `createdAt` 字段，不用逐个写 `@TableField`。

条件查询用 `LambdaQueryWrapper`，列名写成方法引用 `Task::getStatus`，字段改名时编译期就报错，不会像字符串那样静默失配。`eq`、`ne`、`gt`、`like`、`in`、`orderByDesc` 都能链式调用；带 `condition` 参数的重载（如 `like(hasText(keyword), ...)`）可以在条件不成立时跳过这一段，省掉一堆 `if`。只查列表需要的列时用 `.select(...)`，别把大字段一起拉回来。

两个坑必须提前知道。第一，`updateById` 默认只更新非 null 字段（`FieldStrategy.NOT_NULL`），所以它**不能把某列改成 NULL**；要置空得用 `LambdaUpdateWrapper.set(Task::getNote, null)`。第二，`#{}` 是占位符、`${}` 是字符串替换，后者能拼出 SQL 注入；Wrapper 的 `apply("...")`、`last("...")` 里如果塞了用户输入，等于把第 6 周学过的注入又请回来。

```java
@TableName("task")
public class Task {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
    private String status;
    private String note;
    private LocalDateTime createdAt;
    // getter / setter 省略
}

public interface TaskMapper extends BaseMapper<Task> {}

// 条件查询：方法引用编译期查错，字段改名不会静默失配
List<Task> todo = mapper.selectList(new LambdaQueryWrapper<Task>()
        .select(Task::getId, Task::getTitle, Task::getStatus)   // 只查需要的列
        .eq(Task::getStatus, "TODO")
        .like(StringUtils.hasText(keyword), Task::getTitle, keyword)
        .orderByDesc(Task::getCreatedAt));

// 局部更新：updateById 会忽略 null 字段
Task patch = new Task();
patch.setId(1L);
patch.setStatus("DONE");
mapper.updateById(patch);

// 想把 note 改成 NULL，必须显式 set
mapper.update(null, new LambdaUpdateWrapper<Task>()
        .eq(Task::getId, 1L)
        .set(Task::getNote, null));
```

`@TableName` 只在表名和类名不一致时才需要；`IdType.AUTO` 对应数据库自增，插入后主键会回填到对象里。`selectList` 返回的是实体列表，不是 `Map`，字段名由 getter 决定。`updateById` 生成的 SQL 只包含非 null 列，这正是「置空失败」的原因；`update(null, wrapper)` 的第一个参数传 null 表示不基于实体，更新内容全由 `.set` 决定。生产里还要在 `application.yml` 打开 SQL 日志（`mybatis-plus.configuration.log-impl: org.apache.ibatis.logging.stdout.StdOutImpl`），确认参数是 `?`，不是拼接进去的值。

Mapper 的注册有两种写法：每个接口加 `@Mapper`，或在启动类上加一次 `@MapperScan("com.example.task.mapper")`。项目里 Mapper 多起来之后用后者，少写一堆注解。SQL 日志打开后每次查询都会打印 `Preparing`、`Parameters`、`Total` 三行，这三行就是排查慢查询和「条件没生效」的第一手证据；上线前记得把日志级别调回，别把参数里的用户数据打进生产日志。

:::hint 什么时候用 Wrapper，什么时候写 SQL
单表条件查询用 Wrapper，可读、防拼错字段；多表关联 / 复杂统计写 XML 或 `@Select`。**永远不要拼字符串 SQL**，参数一律 `#{}`。
:::

:::solution 一个能跑通的查询
```java
@SpringBootTest
class TaskMapperTest {
    @Autowired TaskMapper mapper;

    @Test
    void 按状态查并按时间倒序() {
        List<Task> list = mapper.selectList(new LambdaQueryWrapper<Task>()
                .eq(Task::getStatus, "TODO")
                .orderByDesc(Task::getCreatedAt));
        assertFalse(list.isEmpty());
        assertTrue(list.stream().allMatch(t -> "TODO".equals(t.getStatus())));
    }
}
```
用 `@SpringBootTest` 会真的连库，测试库里先插两条 TODO 再跑；断言只校验状态，不写死 id 和条数。
:::

:::error Invalid bound statement (not found)
```text
org.apache.ibatis.binding.BindingException: Invalid bound statement (not found):
com.example.task.mapper.TaskMapper.selectById
```
**根因**：① Mapper 接口没被注册——启动类缺 `@MapperScan("com.example.task.mapper")`，接口上也没有 `@Mapper`；② 你写了同名 XML，但 `namespace` 或 `id` 和接口对不上，XML 覆盖了 BaseMapper 的默认实现；③ XML 不在 `classpath*:/mapper/**/*.xml` 能扫到的位置。
**修复**：先只留接口、去掉 XML 跑一次；能跑说明是 XML 冲突，再逐个核对 namespace。启动日志里搜 `Mapped Statements collection` 能看到实际注册了哪些语句。
:::

#### 步骤 10.2 复现 `@Transactional` 失效

`@Transactional` 不是编译器插进去的代码，而是容器给你注入了一个**代理对象**：外部调用先进代理，代理开事务、调真实方法、按结果提交或回滚。所以「注解生效」的前提是调用经过了代理。同一个类里 `this.inner()` 拿的是原始对象，绕过了代理，注解等于没写——方法照常执行，异常照常抛，就是不开事务。

还有三种常见失效：方法是 `private` 或 `final`（CGLIB 无法覆写）、异常被 `catch` 吞掉（代理看不到异常，自然提交）、抛的是受检异常（默认只回滚 `RuntimeException` 和 `Error`，要写 `rollbackFor = Exception.class`）。另外 `readOnly = true` 只是给驱动一个提示，不是只读锁；传播行为默认 `REQUIRED`，表示「有事务就加入，没有就新开」，需要「业务失败但日志必须留下」时才用 `REQUIRES_NEW`。

复现方式很直接：Controller 调 `outer()`，`outer()` 用 `this` 调带注解的 `inner()`，`inner()` 先插一条再抛异常。预期是回滚，实际表里多一行。修法有三种：拆到另一个 Bean（推荐，边界最清楚）、注入自身代理（`@Lazy`，能跑但绕）、用 `TransactionTemplate` 手动划边界（适合一段代码而不是一个方法）。拆 Bean 之所以最好，是因为它让「事务方法」成为一个可被独立调用、独立测试的单元。

```java
@Service
public class TaskService {
    private final TaskMapper mapper;
    public TaskService(TaskMapper mapper) { this.mapper = mapper; }

    public void create(Task task) {
        this.saveAndNotify(task);      // ❌ 原始对象调用，不经过代理
    }

    @Transactional(rollbackFor = Exception.class)
    public void saveAndNotify(Task task) {
        mapper.insert(task);
        throw new IllegalStateException("通知服务不可用");   // 期望回滚，实际没有
    }
}
```

```java
// ✅ 拆到独立 Bean：调用方注入 TaskTxService，调用一定经过代理
@Service
public class TaskTxService {
    private final TaskMapper mapper;
    public TaskTxService(TaskMapper mapper) { this.mapper = mapper; }

    @Transactional(rollbackFor = Exception.class)
    public void saveAndNotify(Task task) {
        mapper.insert(task);
        throw new IllegalStateException("通知服务不可用");
    }
}

@Service
public class TaskService {
    private final TaskTxService tx;
    public TaskService(TaskTxService tx) { this.tx = tx; }
    public void create(Task task) { tx.saveAndNotify(task); }
}
```

第一段里 `this.saveAndNotify` 和直接写方法体没有区别，注解只是元数据。第二段把事务方法挪到另一个 Bean，`TaskService` 拿到的是 `TaskTxService` 的代理，调用才会进事务拦截器。注意 `@Transactional` 要写在 `public` 方法上，且被 Spring 管理的 Bean 调用；在 `new` 出来的对象上调用同样不生效。

判断事务有没有生效，别靠肉眼看代码：更可靠的是在测试里用 `JdbcTemplate` 查一次，或者在 SQL 日志里确认插入之后确实回滚了。事务里不要做 HTTP 调用、不要 `sleep`，长事务会占着连接和行锁，把整个库拖慢。

:::hint 为什么自调用失效
Spring 的事务靠**代理对象**：外部调用先进代理 → 开事务 → 调真实方法。类内部 `this.xxx()` 走的是原始对象，绕过了代理，注解等于没写。修法：拆到另一个 Bean，或注入自己（`@Lazy`），或改用 `TransactionTemplate`。
:::

:::error 抛了异常但没回滚
```text
java.lang.IllegalStateException: 通知服务不可用
    at com.example.task.TaskService.saveAndNotify(TaskService.java:41)
```
**现象**：接口返回 500，日志里有这行异常，但 `task` 表多了一行。
**三个原因，按顺序查**：① 自调用——同一个类里 `this.inner()`，绕过了代理；② 异常被吞——`catch (Exception e) { log.warn(...) }`，代理根本看不到异常；③ 只回滚运行时异常——受检异常要写 `@Transactional(rollbackFor = Exception.class)`。
**修复**：先把事务方法拆到独立 Bean 再复测；仍不回滚就检查有没有 catch，以及异常类型是不是受检异常。
:::

#### 步骤 10.3 分页插件与 count 查询

分页必须在服务端做：`selectList` 查出十万行再在 Java 里 `subList`，数据库白搬了十万行，内存也跟着涨。MyBatis-Plus 的分页靠拦截器改写 SQL，在最后拼上 `LIMIT`，并自动生成一条 `COUNT` 查总数。没注册拦截器时 `selectPage` 不会报错，只是 SQL 里没有 `LIMIT`、`total` 为 0——这是最容易被忽略的「假分页」。

注册方式是往容器里放一个 `MybatisPlusInterceptor`，加 `PaginationInnerInterceptor(DbType.MYSQL)`。`setMaxLimit` 限制单页上限，防止有人传 `size=100000` 把库拖垮；`setOverflow(false)` 让页码越界时返回空页，而不是偷偷回到第一页。count 语句默认会做优化（去掉 order by、必要时简化 join），多表统计对不上时再关掉 `optimizeCountSql` 或写自定义 count。

深分页是另一个问题：`LIMIT 100000, 10` 要先扫过前十万行再丢掉，越翻越慢。数据量大时改用游标（keyset）：`WHERE id > 上一页最后一个 id ORDER BY id LIMIT 10`，每页都能走主键索引。代价是不能随机跳页，适合「下拉加载」而不是「跳第 500 页」。返回体的 `offset` 用 `(current - 1) * size` 算，前端拿 `items + total + limit + offset` 就能自己算页码。

```java
@Configuration
public class MybatisConfig {
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        PaginationInnerInterceptor page = new PaginationInnerInterceptor(DbType.MYSQL);
        page.setMaxLimit(100L);       // 单页最多 100 条
        page.setOverflow(false);      // 页码越界返回空页
        interceptor.addInnerInterceptor(page);
        return interceptor;
    }
}
```

```java
public record PageResult<T>(List<T> items, long total, int limit, int offset) {}

public PageResult<Task> page(int pageNo, int size, String status) {
    int limit = Math.min(Math.max(size, 1), 100);
    Page<Task> query = new Page<>(Math.max(pageNo, 1), limit);
    Page<Task> result = mapper.selectPage(query, new LambdaQueryWrapper<Task>()
            .eq(status != null, Task::getStatus, status)
            .orderByDesc(Task::getId));
    return new PageResult<>(result.getRecords(), result.getTotal(), limit,
            (int) ((result.getCurrent() - 1) * limit));
}
```

`Page` 的 `current` 从 1 开始，`size` 是每页条数；`selectPage` 返回的 `Page` 里 `records` 是本页数据、`total` 是总数。`Math.min` 和 `Math.max` 在服务端收敛参数，不指望前端守规矩。`orderByDesc(Task::getId)` 必须有稳定排序，否则翻页时同一条记录可能重复出现或漏掉。`PageResult` 这个形状第 11 周还会用，先把它定下来。

:::hint 分页的 count 也要看
`total` 来自自动生成的 `COUNT`，它可能比列表查询还慢。看 SQL 日志里有没有 `SELECT COUNT(*)`，多表时确认 join 被优化掉没有。
:::

:::solution 验证分页真的下发
```bash
curl -s 'http://127.0.0.1:8080/api/tasks?page=2&size=10'
```
返回 10 条，`total` 与库里 TODO 总数一致；同时在 SQL 日志里应看到 `LIMIT ?,?` 和一条 `SELECT COUNT(*)`。两条都有，才算分页插件生效。
:::

:::error 分页没生效，返回了全量
```text
==>  Preparing: SELECT id,title,status,created_at FROM task WHERE status = ?
==> Parameters: TODO(String)
<==      Total: 1000
```
**根因**：`MybatisPlusInterceptor` 没注册，或注册了但没 `addInnerInterceptor` 分页插件；`selectPage` 会退化成普通查询，`total` 为 0。
**修复**：确认配置类在启动类扫描范围内，日志里能看到拦截器生效。MyBatis-Plus 3.5.9 起 jsqlparser 被拆成独立依赖，只引 starter 会在分页时抛 `NoClassDefFoundError: net/sf/jsqlparser/...`，按官方说明补 `mybatis-plus-jsqlparser` 即可。
:::

**自测**（合上文档回答）

1. `updateById` 为什么不能把某列改成 NULL？要置空该用什么写法？
2. 同一个类里 `this` 调用带 `@Transactional` 的方法，为什么事务不生效？拆 Bean 与 `TransactionTemplate` 各适合什么场景？
3. 分页插件没注册时，SQL 日志和 `total` 分别是什么表现？深分页为什么越翻越慢？

**验收**

- [ ] 打开 SQL 日志后能看到 `Preparing: SELECT ... WHERE status = ?`，参数单独出现，没有拼接进 SQL
- [ ] `GET /api/tasks?page=2&size=10` 返回 10 条，SQL 带 `LIMIT`，`total` 与库中总数一致
- [ ] 复现自调用：接口返回 500，表里多一行；拆成独立 Bean 后同样调用，表里没有新行
- [ ] `updateById` 把 `note` 设为 null 不生效，换 `LambdaUpdateWrapper.set` 后生效
- [ ] `size=100000` 被 `setMaxLimit` 收敛到 100 条，响应里的 `limit` 也是 100

---

### 第 11 周：接口工程化

**本周目标**：让接口从「能返回数据」变成「别人敢调用」——非法入参统一返回 400、错误体有稳定形状、分页有明确边界、重复请求不会产生重复数据，并且这些都能用一条命令验证。

**为什么是这些内容**：第 9、10 周你已经能让接口读写数据库，但调用方关心的不是你的 Service 写得多漂亮，而是「我传错了会拿到什么」「我超时重试会不会多下一单」「我翻到第 500 页还灵不灵」。这三件事分别对应参数校验、幂等和分页契约。它们的位置很关键：校验要挡在业务之前，否则每个 Service 里都要写一遍 `if (title == null)`；错误体要在一个地方统一，否则前端要为每个接口写一套解析；幂等要靠数据库唯一约束，而不是「先查再插」——后者在并发下一定漏。不学会的后果是联调时靠猜、重试时靠运气、出问题时返回一整段堆栈给用户看。这一周也是第 12 周鉴权的地基：401/403 要复用同一套错误体，第 13 周的日志要往同一个出口加 traceId。

#### 步骤 11.1 参数校验 + 统一异常

校验的第一原则是**入口即拒绝**：请求体进 Service 之前就要合法。Spring 用 Jakarta Bean Validation 做这件事：DTO 字段上写 `@NotBlank`、`@Size`、`@Min`、`@Max`，Controller 参数上加 `@Valid`，校验不通过时 MVC 抛 `MethodArgumentNotValidException`，根本不会进你的方法。`@Valid` 漏写是最高频的失误——注解都在，校验就是不跑，脏数据一路进库。

三个注解别混：`@NotNull` 只要求不是 null，空字符串能过；`@NotEmpty` 要求非 null 且长度大于 0，纯空格能过；`@NotBlank` 要求非 null 且去掉首尾空白后还有内容，字符串校验基本都用它。嵌套对象要在字段上再标一个 `@Valid`，否则只校验外层。`@RequestParam`、`@PathVariable` 上的约束需要类上加 `@Validated` 才生效，这是另一条链路（`ConstraintViolationException`），别和请求体校验混在一起。

统一异常处理用 `@RestControllerAdvice`：一个方法拦一类异常，返回固定形状的错误体。错误体至少要有 `code`（给程序判断）、`message`（给人看）和 `traceId`（给排查用，第 13 周填真值）。兜底的 `Exception` 处理器只把堆栈写日志，响应里给一句通用文案——堆栈里有类名、SQL、文件路径，返回给调用方既是泄露，也帮不上他。

```java
public record TaskCreateReq(
        @NotBlank(message = "标题不能为空") @Size(max = 100) String title,
        @Min(1) @Max(5) int priority) {}

@RestController
@RequestMapping("/api/tasks")
@Validated
public class TaskController {
    private final TaskService service;
    public TaskController(TaskService service) { this.service = service; }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskVo create(@Valid @RequestBody TaskCreateReq req) {
        return service.create(req);
    }

    @GetMapping("/{id}")
    public TaskVo get(@PathVariable long id) {
        return service.get(id);          // 不存在时抛 TaskNotFoundException
    }
}
```

```java
@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> invalid(MethodArgumentNotValidException e) {
        String fields = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return ResponseEntity.badRequest()
                .body(new ApiError("PARAM_INVALID", fields, null));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> malformed(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest()
                .body(new ApiError("BAD_JSON", "请求体不是合法 JSON", null));
    }

    @ExceptionHandler(TaskNotFoundException.class)
    public ResponseEntity<ApiError> notFound(TaskNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiError("NOT_FOUND", e.getMessage(), null));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> fallback(Exception e) {
        log.error("未处理异常", e);                 // 堆栈只进日志
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiError("INTERNAL", "服务器内部错误", null));
    }
}

public record ApiError(String code, String message, String traceId) {}
```

`@Valid` 放在 `@RequestBody` 前面或后面都行，但它必须在，否则注解只是装饰。`getFieldErrors` 只包含字段级错误；类级约束（如「开始时间必须早于结束时间」）在 `getGlobalErrors` 里，需要的话两个都读。`HttpMessageNotReadableException` 覆盖 JSON 语法错误、类型不匹配（比如 `priority` 传了字符串），不处理会落到兜底变成 500。兜底处理器返回 500 而不是 400，是因为走到它说明是我们没预料到的问题，不该把责任推给调用方。

:::hint 为什么不能把 Entity 直接返回
Entity 里有 `password`、`deleted` 这类字段，直接返回等于泄露；而且字段一改，前端跟着崩。用 DTO 进、VO 出，**接口形状由你控制**，不由数据库表决定。
:::

:::solution 三条 curl 验证
```bash
curl -si -X POST localhost:8080/api/tasks -H 'Content-Type: application/json' \
  -d '{"title":"","priority":9}'          # 400，body 里有 PARAM_INVALID
curl -si -X POST localhost:8080/api/tasks -H 'Content-Type: application/json' \
  -d '{oops'                              # 400，body 里有 BAD_JSON
curl -si localhost:8080/api/tasks/999999  # 404，body 里有 NOT_FOUND
```
三条都不能出现 `Exception`、类名或堆栈。
:::

:::error 校验注解全写了，却还是创建成功
```text
POST /api/tasks  {"title":"","priority":9}
201 Created
{"id":7,"title":"","priority":9}
```
**根因**：Controller 参数上漏了 `@Valid`；或者 DTO 是普通类但没有 getter，Bean Validation 读不到字段；或者嵌套对象没有在字段上标 `@Valid`。
**修复**：给 `@RequestBody` 参数补 `@Valid`，DTO 用 record 或补齐 getter。改完再发一次，400 必须出现在 SQL 之前——日志里连 `Preparing: INSERT` 都不该有。
:::

#### 步骤 11.2 分页与幂等

分页要定成一个契约，而不是每个接口各写一套。统一返回 `{items, total, limit, offset}`：`items` 是当前页，`total` 是满足条件的总数，`limit` 是服务端实际允许的条数，`offset` 是偏移量。`page` 和 `size` 在入口就收敛：`page < 1` 当 1，`size` 夹在 1 到 100 之间。别信任前端传来的 `size=100000`，那等于给了对方一个拖垮数据库的开关。排序必须有稳定列（通常是主键），否则翻页时同一条记录可能重复出现或被跳过。

幂等的判断标准是：同一个请求发 N 次，结果与发 1 次相同。实现只能靠数据库唯一约束：客户端生成 `requestId`，表上建 `uk_user_request(user_id, request_id)`，插入时如果撞上唯一键就捕获 `DuplicateKeyException`，把已经存在的那条查出来返回。**「先 select 再 insert」在并发下一定漏**：两个请求同时查、都查不到、都插入，除非有唯一索引兜底。唯一索引是原子的仲裁者，代码只是处理仲裁结果。

还有几个细节决定这套方案能不能用：`requestId` 的作用域要带用户（否则 A 的 key 能挡 B 的请求）；同一个 key 但请求体不同，应该返回 409 而不是悄悄返回旧结果；幂等记录要能过期清理，否则表会无限增长；第一次返回 201、重放返回 200，调用方一看就知道是不是重放。把这些写进接口文档，比在代码里加注释有用。

```java
public record PageQuery(Integer page, Integer size) {
    public int pageNo() { return page == null || page < 1 ? 1 : page; }
    public int pageSize() { return size == null ? 10 : Math.min(Math.max(size, 1), 100); }
}

public record CreateOrderReq(@NotBlank String sku, @Min(1) int qty,
                             @NotBlank String requestId) {}

@Transactional
public Order create(CreateOrderReq req, long userId) {
    try {
        Order order = new Order(userId, req.sku(), req.qty(), req.requestId());
        orderMapper.insert(order);                    // uk_user_request 唯一索引
        return order;
    } catch (DuplicateKeyException e) {
        return orderMapper.selectOne(new LambdaQueryWrapper<Order>()
                .eq(Order::getUserId, userId)
                .eq(Order::getRequestId, req.requestId()));
    }
}
```

`PageQuery` 用包装类型 `Integer` 是为了区分「没传」和「传了 0」；`pageNo`、`pageSize` 把非法值收敛成合法值。`@Transactional` 包住 insert 和 catch 后的 select：MySQL 下单条语句失败不会让整个事务失效，所以同一个事务里还能查；换成 PostgreSQL 时这里要改成独立事务，否则后续查询会报事务已中止。`selectOne` 依赖唯一索引保证最多一条，索引不唯一时它会抛 `TooManyResultsException`。

:::hint 幂等的判断标准
同一个请求重复发 N 次，结果与发 1 次相同。做法：客户端带 `requestId`，服务端对 `requestId` 建唯一索引，插入冲突时直接返回上次结果。**没有唯一约束的「先查再插」在并发下一定漏**。
:::

:::solution 用两次 curl 验证幂等
```bash
rid=$(date +%s)
for i in 1 2; do
  curl -s -X POST localhost:8080/api/orders -H 'Content-Type: application/json' \
    -d "{\"sku\":\"A-1\",\"qty\":1,\"requestId\":\"$rid\"}"
  echo
done
```
两次返回同一个 `id`，`select count(*) from orders where request_id='$rid'` 结果是 1。
:::

:::error 重试一次，多出一单
```text
org.springframework.dao.DuplicateKeyException:
### Error updating database. Cause: java.sql.SQLIntegrityConstraintViolationException:
Duplicate entry '42-1730000000' for key 'order.uk_user_request'
```
**根因**：唯一索引已经挡住了重复插入，但代码没有捕获这个异常，于是 500；调用方以为失败又重试，或者看到 500 后人工补单，最终对不上。
**修复**：捕获 `DuplicateKeyException` 后按 `(user_id, request_id)` 查回原记录返回；同时确认唯一索引真的建了——`SHOW INDEX FROM orders` 里能看到 `uk_user_request`。
:::

#### 步骤 11.3 把契约钉成一次 HTTP 自测

Service 测试全绿，不代表接口对：状态码可能写错、异常可能没被 advice 接住、序列化可能把 `null` 写成 `"null"`、错误体可能带出堆栈。这些只有真的发一次 HTTP 才能发现。做法是写一个只依赖 `curl` 的冒烟脚本，放在仓库里，每次改完接口和部署后各跑一次。

脚本只做两件事：拿状态码、看响应体。`curl -s -o body.json -w '%{http_code}'` 把响应体写文件、把状态码打到标准输出；再用 `[ "$code" = "期望" ]` 断言。每个用例都同时查状态码和关键字段，比如 400 必须带 `PARAM_INVALID`，404 必须带 `NOT_FOUND`，所有响应体都不能出现 `Exception` 或包名。这样前端联调前你就知道契约没破。

不要用 `curl -f`：它把 4xx/5xx 当成传输失败，直接退出并丢掉响应体，你既看不到状态码也看不到错误信息。也不要在脚本里 `set -e` 之后用 `grep ... && 报错` 这种写法——`grep` 没匹配到会返回 1，整个脚本会莫名其妙退出；用 `if grep -q ...; then ... fi`。Windows 上用 Git Bash 跑，PowerShell 里对应的 `Invoke-WebRequest` 要加 `-SkipHttpErrorCheck`（PowerShell 7）才能拿到 4xx 的响应体。

```bash
#!/usr/bin/env bash
set -euo pipefail
base=http://127.0.0.1:8080/api/tasks
body=$(mktemp)

code() { curl -s -o "$body" -w '%{http_code}' "$@"; }
expect() {
  [ "$1" = "$2" ] || { echo "✗ 期望 $2，实得 $1"; cat "$body"; exit 1; }
  if grep -qi 'exception\|com\.example' "$body"; then
    echo "✗ 响应体泄露了内部信息"; cat "$body"; exit 1
  fi
  echo "✓ $3"
}

expect "$(code -X POST "$base" -H 'Content-Type: application/json' \
  -d '{"title":"写代码","priority":3}')" 201 "创建返回 201"
expect "$(code -X POST "$base" -H 'Content-Type: application/json' \
  -d '{"title":"","priority":3}')" 400 "空标题返回 400"
expect "$(code "$base/999999")" 404 "不存在的 id 返回 404"
expect "$(code -X POST "$base" -H 'Content-Type: application/json' \
  -d '{oops')" 400 "坏 JSON 返回 400"
echo "4/4 通过"
rm -f "$body"
```

`code` 把参数原样转给 `curl`，所以 `-X POST`、`-H`、`-d` 都能直接写。`expect` 的第一个参数是命令替换的结果（状态码），第二个是期望值，第三个只用于打印。`grep -qi` 的 `-i` 让大小写都命中，`com\.example` 用来抓包名泄露。最后删临时文件；如果中途 `exit`，文件留在 `/tmp`，影响不大。

:::hint 冒烟脚本是接口的回归测试
不用启动 Spring 测试上下文，只要服务在跑，一条 `bash smoke.sh` 就能验证状态码、错误码、有没有泄露堆栈。改接口前先跑一遍，改完再跑一遍。
:::

:::error curl 看不到 400 的响应体
```text
curl: (22) The requested URL returned error: 400
```
**根因**：命令里带了 `-f`（或 `--fail`）。`curl` 把 4xx 当失败，直接以非 0 退出，并且不输出响应体；脚本里只会看到一句错误，拿不到 `PARAM_INVALID`。
**修复**：去掉 `-f`，用 `-s -o 文件 -w '%{http_code}'` 自己判断状态码。确实需要失败即退出时，用 `--fail-with-body`（curl 7.76+）保留响应体。
:::

**自测**（合上文档回答）

1. `@NotNull`、`@NotEmpty`、`@NotBlank` 各拦什么？`@Valid` 漏写会有什么现象？
2. 幂等为什么必须落在唯一索引上？同一个 `requestId` 第二次请求应该返回什么，请求体不同时又该返回什么？
3. Service 测试全绿为什么还要 HTTP 自测？`curl -f` 会带来什么问题？

**验收**

- [ ] 空标题 POST 返回 400，body 含 `PARAM_INVALID` 和字段名，且不含 `Exception`
- [ ] 坏 JSON 返回 400 `BAD_JSON`；`GET /api/tasks/999999` 返回 404 `NOT_FOUND`
- [ ] 同一个 `requestId` 连发两次，两次返回同一个 `id`，库中只有一行
- [ ] `page=0&size=100000` 不报错，实际 `limit` 为 100，且 SQL 带 `LIMIT`
- [ ] `bash smoke.sh` 输出 4/4 通过；把 `@Valid` 注释掉后重跑，脚本在 400 用例处失败

---

### 第 12 周：鉴权

**本周目标**：用 HMAC 签名的 HttpOnly Cookie 完成登录，让未登录请求得到 401、越权请求被挡住，并让登出立刻生效。

**为什么是这些内容**：第 11 周把接口的形状、校验和错误码定下来了，但那时任何人都能调——没有「谁」的概念，`/api/tasks` 对全世界开放。鉴权是「接口能被别人安全调用」的另一半，也是第 13 周日志里 `uid` 字段、第 16 周真实上线的前提。这一周要建立三个以后天天用的判断：认证回答「你是谁」，授权回答「你能动谁的资源」，两者都只能在服务端做；凭证要放在 JS 读不到的地方；token 一旦发出去，就必须有办法收回。不学会的后果不是「少个登录页」，而是三类真实事故：token 放 localStorage 被 XSS 一把梭；只在列表接口过滤 userId，详情接口被人改个 id 就读走别人的数据；用户点了登出、改了密码，旧 token 还能再用七天。这三类问题在代码评审里都很隐蔽，因为功能测试全绿。还有一个隐性收益：从这一周起，每条请求都有了明确的身份，第 13 周的日志能记 `uid`，第 13 周压测时也才能区分匿名流量和登录流量；第 14 周给 Cookie 加 `Secure`、把服务搬到 HTTPS，本质上也是这一周凭证设计的延续。

#### 步骤 12.1 登录 + 拦截器

登录的本质不是「比对密码」，而是「换取一个服务端能验证的凭证」。两种存法：服务端 session 有状态、能随时删；签名 token 无状态、只验签名。本周用后者：payload 是 `uid.exp`，签名是 `HMAC-SHA256(payload, secret)`，拼成 `payload.sig` 放进 Cookie。服务端不用查库就能判断真伪，代价是「发出去就收不回」——12.3 用版本号补上。密码本身只存 BCrypt 哈希（cost 10 左右），登录时用 `matches` 比对；不要自己写 sha256 加盐，在 GPU 撞库面前它和明文差不多。

验签要做三件事，顺序不能反：先看格式（段数与能否解析），再验签名，最后看过期。签名比较必须用 `MessageDigest.isEqual` 这类常量时间比较；普通 `String.equals` 在第一个不同字节就返回，理论上可被计时攻击逐字节猜出签名。payload 是明文拼接，签名用 Base64URL 编码只是为了能安全放进 Cookie、方便排查；两者都不提供保密性——token 里不要放手机号、角色列表这类信息，签名只防篡改。

拦截器实现 `HandlerInterceptor`，在 `preHandle` 里解析 Cookie；失败时直接写 401 JSON 并 `return false`，不要 `sendRedirect` 到登录页——前端会收到 200 的 HTML，误以为请求成功。成功时把 uid 放进 request attribute，Controller 用 `@RequestAttribute` 取。别用 ThreadLocal 存当前用户：Tomcat 线程是复用的，忘了 `remove` 就会串号，而 request attribute 的生命周期天然跟着请求。

拦截器要注册才生效：在 `WebMvcConfigurer.addInterceptors` 里 `addPathPatterns("/api/**")`，同时 `excludePathPatterns("/api/login")`，漏掉排除项就表现为「永远登不上」。登录接口本身要有失败计数：同一账号或同一 IP 连续失败 5 次就限速几分钟，否则 BCrypt 再慢也挡不住在线撞库。失败提示统一写「用户名或密码错误」，不要区分「用户不存在」和「密码错」，那等于免费送一个账号枚举接口。

:::hint 为什么用 HttpOnly Cookie
`localStorage` 里的 token 能被任意 JS 读走，XSS 一打就中。`HttpOnly` 让 JS 根本读不到，浏览器自动携带；再配 `SameSite=Lax` 挡 CSRF。签名用 HMAC，密钥只在服务端，客户端改不了内容。
:::

:::solution TokenService 与拦截器
```java
public record Session(long uid, long exp) {}

@Component
public class TokenService {
    private final byte[] secret;

    public TokenService(@Value("${app.secret}") String secret) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException("app.secret must be at least 32 chars");
        }
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    public String issue(long uid, Duration ttl) {
        long exp = Instant.now().plus(ttl).getEpochSecond();
        String payload = uid + "." + exp;
        return payload + "." + sign(payload);
    }

    public Optional<Session> verify(String token) {
        String[] p = token == null ? new String[0] : token.split("\\.");
        if (p.length != 3) return Optional.empty();
        String payload = p[0] + "." + p[1];
        boolean same = MessageDigest.isEqual(
                sign(payload).getBytes(StandardCharsets.UTF_8),
                p[2].getBytes(StandardCharsets.UTF_8));
        if (!same) return Optional.empty();
        Session s = new Session(Long.parseLong(p[0]), Long.parseLong(p[1]));
        return s.exp() > Instant.now().getEpochSecond() ? Optional.of(s) : Optional.empty();
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 unavailable", e);
        }
    }
}

@Component
public class AuthInterceptor implements HandlerInterceptor {
    private final TokenService tokens;

    public AuthInterceptor(TokenService tokens) { this.tokens = tokens; }

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler)
            throws IOException {
        String raw = null;
        if (req.getCookies() != null) {
            for (Cookie c : req.getCookies()) {
                if (c.getName().equals("session")) raw = c.getValue();
            }
        }
        Optional<Session> session = tokens.verify(raw);
        if (session.isEmpty()) {
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"error\":\"unauthorized\"}");
            return false;
        }
        req.setAttribute("uid", session.get().uid());
        return true;
    }
}
```
:::

:::solution 登录时写 Cookie
```java
ResponseCookie cookie = ResponseCookie.from("session", tokens.issue(user.id(), Duration.ofDays(7)))
        .httpOnly(true)
        .secure(true)               // HTTPS only
        .path("/")
        .sameSite("Lax")
        .maxAge(Duration.ofDays(7))
        .build();
response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
```
:::

:::error 登录 200，下一个请求还是 401
```text
This Set-Cookie was blocked because it had the "Secure" attribute
but was not received over a secure connection.
```
**根因**：本地用 `http://127.0.0.1` 调试，却给 Cookie 设了 `secure=true`，浏览器直接丢弃。表现是登录接口 200、响应头里也有 `Set-Cookie`，但下一次请求不带 Cookie，一直 401。
**修复**：按 profile 区分，本地关掉 secure、生产必须开；`SameSite=None` 必须同时 `Secure`，否则同样被丢。排查顺序是 DevTools → Application → Cookies 看有没有 session，再看 Network 里请求头带没带 Cookie——先确认浏览器收下了，再去怀疑签名。
:::

#### 步骤 12.2 用两个账号验证越权

认证做完，很多人就以为鉴权做完了。`GET /api/tasks/{id}` 只要登录就能读任何人的任务，这种漏洞叫 IDOR（不安全的直接对象引用）：攻击者不用破解密码，只要把 URL 里的 1 改成 2。它难被发现，是因为正常路径永远只点自己的数据，功能测试也只用自己的账号点。

修法不是加一堆 if，而是让「归属」成为查询条件：`where id = ? and user_id = ?`，查不到就返回 404。为什么不返回 403？403 等于告诉对方「这个 id 存在，只是不属于你」，攻击者可以靠状态码枚举全站数据量；404 不泄露存在性。只有当「存在但无权」本身是业务信息时（比如协作空间），才返回 403 并记审计日志。列表接口的过滤不能替代单条校验——详情、修改、删除、导出，每一个按 id 的入口都要过同一道检查。

把越权验证写成可重复的三条断言，而不是手点：无 cookie → 401；A 用自己的 cookie 读自己的 → 200；B 拿 A 的资源 id → 404。以后每加一个按 id 的接口就补一行。用两个 cookie 文件最省事：`curl -c a.txt` 登录、`curl -b a.txt` 请求。

归属判断最好只写一次：在 Service 层提供 `findOwned(id, uid)`、`requireOwned(id, uid)`，所有 Controller 都调它，而不是每个方法自己拼 Wrapper。这样新增接口时，只要用了这个名字就默认带上归属条件；漏写会显得很扎眼。再进一步，用 `@PreAuthorize` 或在拦截器里统一做「资源归属」检查也行，但前提是资源类型和归属字段能统一描述——小项目先用 Service 方法收敛，成本最低。

:::hint 越权要测「别人的资源 id」
把 id 换成别人的，服务端必须校验 `task.userId == 当前用户`。只在列表接口做过滤是不够的——详情、修改、删除每一个按 id 操作的接口都要校验。
:::

:::solution 查询里带归属条件
```java
@GetMapping("/{id}")
public Task get(@PathVariable long id, @RequestAttribute long uid) {
    return service.findOwned(id, uid)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
}
```
```java
public Optional<Task> findOwned(long id, long uid) {
    return Optional.ofNullable(mapper.selectOne(new LambdaQueryWrapper<Task>()
            .eq(Task::getId, id)
            .eq(Task::getUserId, uid)));
}
```
```bash
curl -s -c a.txt -X POST 127.0.0.1:8080/api/login \
  -H 'Content-Type: application/json' -d '{"name":"a","pwd":"..."}'
curl -s -c b.txt -X POST 127.0.0.1:8080/api/login \
  -H 'Content-Type: application/json' -d '{"name":"b","pwd":"..."}'

curl -s -o /dev/null -w '%{http_code}\n' 127.0.0.1:8080/api/tasks/1            # 401
curl -s -b a.txt -o /dev/null -w '%{http_code}\n' 127.0.0.1:8080/api/tasks/1   # 200
curl -s -b b.txt -o /dev/null -w '%{http_code}\n' 127.0.0.1:8080/api/tasks/1   # 404
```
:::

:::error 401 和 403 别混
| 状态码 | 含义 | 常见原因 |
|---|---|---|
| **401** | 没登录 / 会话过期 | Cookie 没带上、跨域没带 `credentials`、token 过期 |
| **403** | 登录了，但没这个权限 | 角色没勾这页、接口要求超管、资源不属于你 |

最容易误判的一种：后端把未登录 **302 跳到登录页**，前端只看到 200 的 HTML，于是「请求成功但没有数据」。看响应头里的 `Location`，或者用 `fetch` 的 `redirect: "manual"` 判断。另一个坑是拿 403 当「资源不存在」用，等于免费给攻击者一个枚举接口。
:::

#### 步骤 12.3 会话过期、登出与密钥轮换

无状态 token 的代价是「发出去就收不回」。用户点了登出、改了密码、被封号，旧 token 在 exp 之前依然有效——你删掉浏览器里的 Cookie，攻击者手里那份还在。解法不是退回 session 表，而是给用户加一列 `token_version`，签发时把它写进 payload，每次校验比对数据库；登出、改密、封号就 +1，所有旧 token 立刻失效。多一次查询可以接受；嫌慢就缓存，但要接受最长一个缓存 TTL 的失效延迟。

过期时间要分层：单 token 七天是「便利优先」，生产更常见的是 access 15–30 分钟加 refresh 7–30 天，refresh 存库、可撤销、可轮换。个人项目可以先用单 token，但要把过期后的行为定清楚：401、前端跳登录、不要静默重试成死循环。exp 只信服务端时钟，校验时留 30–60 秒 skew，避免两台机器差几秒就互踢。

密钥放环境变量，至少 32 字节随机，别用 `secret123`。轮换时同时保留新旧两把：新密钥签发，验签先新后旧，等最长 token 过期再删旧的；不保留旧密钥，轮换瞬间全员掉线。这是安全与可用之间的取舍，要写进发布说明，而不是上线当天临时决定。

如果不想每次请求都查库，也可以维护一张「已失效 token」黑名单，只存登出且尚未过期的那些，量很小；但改密、封号这类「撤掉全部会话」的场景，版本号更干净。两种方案都要回答同一个问题：撤销的传播延迟有多长，用户能不能接受。

:::hint 登出不是删前端 Cookie
删 Cookie 只清掉当前浏览器，服务端手里的 token 依然有效。要让服务端「不认」，就得有个可变的版本号或黑名单。
:::

:::solution 版本号校验与登出
```java
// Session 增加 ver 字段，payload 变成 uid.exp.ver，token 变四段
public record Session(long uid, long exp, long ver) {}

public String issue(long uid, long ver, Duration ttl) {
    long exp = Instant.now().plus(ttl).getEpochSecond();
    String payload = uid + "." + exp + "." + ver;
    return payload + "." + sign(payload);
}
```
```java
public Optional<Session> verify(String token) {
    Optional<Session> parsed = verifySignatureAndExp(token);   // 12.1 的三步校验抽成私有方法
    return parsed.filter(s -> s.ver() == userMapper.selectTokenVersion(s.uid()));
}
```
```java
@PostMapping("/logout")
public void logout(@RequestAttribute long uid) {
    userMapper.bumpTokenVersion(uid);      // 所有旧 token 立即失效
}
```
:::

:::error 刚登录就提示过期
```text
WARN  token rejected: exp=1750000000 now=1750000000123
```
**根因**：签发用秒、校验用毫秒（或反过来）。`System.currentTimeMillis()` 是毫秒，`Instant.now().getEpochSecond()` 是秒，两者差一千倍，于是 token 要么一签发就过期，要么几十年不过期。
**修复**：全链路只用 `Instant`/`getEpochSecond()`，签发与校验各写一个单元测试；日志里同时打 exp 与 now，一眼能看出量级不对。
:::

**自测**（合上文档回答）

1. HMAC 签名能防篡改，为什么防不了「别人看到 token 内容」？payload 里不该放什么？
2. 为什么详情接口查不到资源时返回 404 而不是 403？只在列表接口过滤 userId 会漏掉哪些入口？
3. 用户登出后旧 token 为什么还有效？`token_version` 怎么让它失效？密钥轮换为什么要留旧密钥？

**验收**

- [ ] 未登录 `curl -i 127.0.0.1:8080/api/tasks` 返回 401，响应体是 JSON 而不是 302
- [ ] 登录响应头里有 `Set-Cookie: session=...; HttpOnly; SameSite=Lax`，下一个请求自动带上
- [ ] 把 token 的签名改一个字符再请求，返回 401
- [ ] A、B 两个账号：A 读自己 200，B 读 A 的资源 404，无 cookie 401
- [ ] 登出后再用旧 cookie 请求返回 401，重新登录恢复 200
- [ ] 把 ttl 改成 2 秒，等 3 秒后请求返回 401
- [ ] 全项目搜不到明文密码与密钥，密钥只从配置/环境变量读

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

**本周目标**：让一次请求能用 requestId 从日志里还原，让核心接口有 QPS/P95/错误率数据，并能指出瓶颈在哪。

**为什么是这些内容**：第 12 周的服务已经能挡住越权，但它现在是个黑盒：用户说「刚才很慢」，你只能猜。日志、指标、压测是「坏了能查」的三件套，也是第 16 周真实上线、第 17 周 JVM 诊断的前提。三者回答不同的问题：日志解决「这一次发生了什么」，是单条请求的因果链；指标解决「整体现在什么状态」，是速率、分位和错误率；压测解决「能撑到哪」，是容量与拐点。缺一个都会瘸：只有日志，你不知道 P95 是 200ms 还是 2 秒；只有指标，你不知道慢的那次是哪个用户、哪条 SQL；只有压测数字，没有 requestId 就落不到具体代码。不学会的后果是线上只能重启和回滚，永远说不出「慢在哪」。这一周还要顺手治一个坏习惯：用平均值汇报性能。三件事的投入也是递增的：日志几行配置，指标一个依赖，压测要写脚本和留数据；但回报同样递增——日志让你能回答单个用户的追问，指标让你在用户报障前发现问题，压测让你在扩容和优化之间做选择而不是拍脑袋。

#### 步骤 13.1 用 MDC 串起一个请求

并发时日志是交错的：一个接口打五条日志，中间插进了另外三个请求的日志，出了事只能按时间点猜哪几条是自己的。requestId 解决这个问题：入口生成一个 id（优先接受上游传的 `X-Request-Id`，方便网关和前端串起来），放进 MDC，日志格式用 `%X{rid}` 输出，响应头再回传一份。用户报障时给你一个 id，`grep` 一下就是完整链路。外部传进来的 id 要做长度和字符校验，别让换行符混进日志——伪造的 requestId 能把日志行拆开，这叫日志注入。

MDC 底层是 ThreadLocal，所以必须在 `finally` 里 `remove`。Tomcat 的工作线程是复用的，不清理就会把上一个请求的 rid 带到下一个请求的日志里——这种「串号」比没有 id 更糟，它会让你顺着错误的线索查半天。过滤器里用 `try/finally` 包住 `chain.doFilter`，保证异常时也清理。

异步线程是第二个坑：`@Async`、自定义线程池、`CompletableFuture` 都不会继承 MDC，日志里 rid 变成空。正确做法是用 `TaskDecorator` 在提交任务时复制当前 MDC、执行时写入、结束后清空；不要指望 `InheritableThreadLocal`，线程池里的线程是复用的，继承只发生在创建那一刻。跨服务调用则把 rid 放进请求头传下去。

日志内容也要有纪律：INFO 记入口和出口（方法、路径、状态码、耗时、uid、rid），DEBUG 记参数，ERROR 只留给「需要人看一眼」的异常。密码、token、完整手机号永远不进日志；异常只在一处打堆栈，别每层 catch 都打印一遍。文件按天和大小滚动，保留 7–14 天并设总量上限，日志把磁盘打满是线上最常见的事故之一。

日志格式在本地用可读的文本，上了规模再换 JSON：一行一个 JSON 对象，`jq` 能按字段过滤，ELK/Loki 也能直接建索引。换格式的时机是「需要按 uid、status 聚合」的时候，不是越早越好；文本格式用 `grep` 就够用的阶段，JSON 只会让你多敲几个引号。异步 appender 能降低日志对 RT 的影响，但队列满了会丢日志，要么接受丢弃并计数，要么就别开异步。

:::hint 没有请求 ID 的日志等于没有
一个接口打 5 条日志，并发时全混在一起。有了 requestId，出问题时先拿到客户端的时间点和参数，再 grep 这一个 ID，整条链路一目了然。
:::

:::solution 过滤器、日志格式与异步装饰器
```java
@Component
public class RequestIdFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String rid = req.getHeader("X-Request-Id");
        if (rid == null || rid.isBlank()) {
            rid = UUID.randomUUID().toString().substring(0, 8);
        }
        MDC.put("rid", rid);
        res.setHeader("X-Request-Id", rid);
        try {
            chain.doFilter(req, res);
        } finally {
            MDC.remove("rid");
        }
    }
}
```
```xml
<pattern>%d{HH:mm:ss.SSS} %-5level [%thread] [%X{rid}] %logger{36} - %msg%n</pattern>
```
```java
@Bean
ThreadPoolTaskExecutor taskExecutor() {
    ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
    ex.setCorePoolSize(8);
    ex.setTaskDecorator(task -> {
        Map<String, String> ctx = MDC.getCopyOfContextMap();
        return () -> {
            if (ctx != null) MDC.setContextMap(ctx);
            try {
                task.run();
            } finally {
                MDC.clear();
            }
        };
    });
    ex.initialize();
    return ex;
}
```
:::

:::error 日志里的 rid 是空的
```text
14:02:11.318  INFO [task-1] [] c.e.TaskService - recalculating stats
14:02:11.319  INFO [task-2] [] c.e.TaskService - recalculating stats
```
**根因**：这两行来自 `@Async` 方法或自定义线程池，MDC 是 ThreadLocal，没有跟着任务走；主线程里 rid 正常，异步线程里就是空。
**修复**：给线程池配 `TaskDecorator`（如上），或把 rid 作为参数显式传进异步方法。修完再压一次并发，确认每条日志的 rid 与响应头 `X-Request-Id` 一致，而不是都为空。
:::

#### 步骤 13.2 压测找拐点

压测不是「开 100 并发看看会不会挂」，而是找拐点：QPS 随并发上升，到某一点 P95 开始非线性上涨、错误率从 0 变正，那个点就是这套配置的容量上限。方法比工具重要：固定堆（`-Xms` 等于 `-Xmx`，否则测的是扩容不是业务）、先预热 30 秒、每档跑 1–2 分钟、记录 QPS、P95、P99、错误率、CPU、连接池活跃数。别压生产；压测库的数据量和索引要和线上同量级，否则数字没有意义。

工具上，`wrk` 轻但 Windows 不好装，`k6` 跨平台、脚本化，还能用阈值让 CI 直接失败。`stages` 做阶梯加压，`thresholds` 写 `p(95)<500`、`http_req_failed<0.01`，跑完退出码非 0 就说明没达标。压测脚本要带登录态：第 12 周之后 `/api/tasks` 需要 cookie，在 `setup` 里登一次、把 session 传给每个 VU，否则你压的是 401，数字好看但毫无意义。

拐点之后要归因，而不是先加机器：CPU 打满 → 找热点方法（第 17 周）；CPU 不高但 P95 高 → 在等锁、等连接、等 IO，查连接池 pending、线程池队列、慢 SQL；错误率先涨 → 看 4xx/5xx 分布和超时设置。结论要写成一句可执行的话，例如「并发 100 时 P95 480ms，瓶颈是 Hikari 默认 10 个连接，调到 20 后 P95 降到 210ms」，这才叫有数据。还要确认压测客户端自己没先成为瓶颈：单机 k6 的 CPU 打满时，你测到的是客户端的极限。

每次压测的结果要留档，和 jar 版本、机器规格、JVM 参数写在一起；下次改完代码再压，才有可比的基线。只记「QPS 比上次高」没有意义，要记「在同样的 100 并发下，P95 从 480ms 降到 210ms」。这也是第 16 周上线前要交的数据之一：说不清容量，就不知道半夜要不要起来扩容。

:::hint 先看错误率，再看 P95，最后看饱和度
错误率从 0 开始涨的那一档就是容量边界；平均值会骗人，P95 才代表大多数用户的体感；饱和度高说明资源到顶，饱和度高但 QPS 不涨说明有串行点。
:::

:::solution k6 阶梯压测
```js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = 'http://127.0.0.1:8080';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export function setup() {
  const res = http.post(`${BASE}/api/login`,
    JSON.stringify({ name: 'load', pwd: __ENV.PWD }),
    { headers: { 'Content-Type': 'application/json' } });
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  return { cookie: res.cookies.session[0].value };
}

export default function (data) {
  const res = http.get(`${BASE}/api/tasks`, {
    headers: { Cookie: `session=${data.cookie}` },
  });
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(0.5);
}
```
```bash
k6 run -e PWD=*** load-test.js
k6 run --summary-export result.json load-test.js
```
:::

:::error 压到一半全是 500：Connection is not available
```text
java.sql.SQLTransientConnectionException: HikariPool-1 - Connection is not available,
request timed out after 30000ms.
```
**根因**：并发上来后每个请求都占着连接等慢 SQL，连接池默认只有 10 个，后来的请求排队 30 秒后超时。它不是「数据库挂了」，而是「池太小或事务太长」。
**修复**：先看 `HikariPool-1 - Active: 10, Idle: 0, Waiting: 40` 确认是排队；再查慢 SQL 和事务里有没有远程调用；最后才调 `maximum-pool-size`。只调大池子会把压力原样转给数据库，常常只是把 500 换成更慢的 500。
:::

#### 步骤 13.3 把压测结论变成常驻指标

压测给的是一次性的快照，指标给的是持续的曲线。Spring Boot Actuator 加 Micrometer 自带 `http.server.requests`，按 `uri`、`status`、`method` 打 tag，能算 QPS、P95、错误率；再加上 JVM 内存、GC、Hikari 连接池指标，正好覆盖上一节归因要看的几个维度。依赖只需 `spring-boot-starter-actuator`，不写一行代码就有数据。

暴露范围要克制：默认只开 `health`，需要时加 `metrics`，生产环境别把 `env`、`heapdump`、`threaddump` 开到公网——`env` 会泄露配置，`heapdump` 能拖走内存里的密钥。要长期看曲线就接 Prometheus + Grafana，Micrometer 负责埋点，Prometheus 负责抓取和算分位；本地先用 `/actuator/metrics/http.server.requests` 看 count、totalTime、max 足够了。

除了技术指标，业务指标也要有：登录失败数、下单数、库存扣减失败数。技术指标说明「服务活着」，业务指标说明「事情对不对」，两者一起看才知道该不该报警。命名用「业务.动作.单位」，tag 只放低基数的枚举（status、result），别把用户 id、订单号塞进 tag，时序库会被高基数打爆。

健康检查从这一周开始就该分清：liveness 只回答「进程要不要重启」，readiness 回答「能不能接流量」，把数据库、Redis 检查放在 readiness，别让数据库抖一下就把整个进程重启掉。第 14 周的发布脚本会直接依赖 `/actuator/health` 做探活。

指标只有配上阈值才叫监控：错误率 5 分钟内超过 1%、P95 连续 5 分钟超过 500ms、连接池 pending 持续大于 0，这三条就值得报警；CPU 从 30% 涨到 50% 不值得。报警要能指向动作——看哪个面板、查哪条日志、要不要回滚，写不出动作的报警就删掉，否则一周后所有人都会忽略它。

:::hint health 是绿的，不代表服务是好的
`/actuator/health` 只证明依赖连得上；QPS、P95、错误率才说明用户在经历什么。把健康检查当监控用，是上线后最常见的误判。
:::

:::solution 打开指标并埋一个业务计时器
```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```
```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,metrics,info
  endpoint:
    health:
      show-details: when-authorized
  metrics:
    distribution:
      percentiles:
        http.server.requests: 0.95,0.99
      percentiles-histogram:
        http.server.requests: true
```
```java
Timer.Sample sample = Timer.start(meterRegistry);
try {
    orderService.create(cmd);
    sample.stop(meterRegistry.timer("order.create", "result", "ok"));
} catch (RuntimeException e) {
    sample.stop(meterRegistry.timer("order.create", "result", "fail"));
    throw e;
}
```
:::

:::error /actuator/metrics 返回 404
```text
{"timestamp":"2026-10-21T04:00:00.000+00:00","status":404,"error":"Not Found",
 "path":"/actuator/metrics"}
```
**根因**：两种可能——没加 `spring-boot-starter-actuator` 依赖，或加了但端点没暴露（Spring Boot 默认只暴露 `health`）。
**修复**：先 `curl /actuator` 看有哪些端点；再在配置里 `include: health,metrics,info`。别图省事写 `include: "*"`，那等于把 env、heapdump 一起送到公网。
:::

**自测**（合上文档回答）

1. requestId 为什么必须在 `finally` 里 remove？`@Async` 里为什么丢了，`TaskDecorator` 补的是什么？
2. 为什么汇报性能用 P95 而不是平均值？错误率和饱和度分别回答什么问题？
3. 压测怎么找拐点？QPS 上不去但 CPU 不高，按顺序查哪三个地方？

**验收**

- [ ] 一次请求的日志里 rid 相同，`grep <rid>` 能拿到入口、出口、业务日志三条以上
- [ ] 并发 10 个请求时 rid 不串，每条日志的 rid 与响应头 `X-Request-Id` 一致
- [ ] `curl 127.0.0.1:8080/actuator/health` 返回 `{"status":"UP"}`，`/actuator/metrics/http.server.requests` 有 count
- [ ] k6 跑完 10/50/100 三档，产出一张含 QPS、P95、错误率的表
- [ ] 能指出拐点在第几档，并给出一个证据（CPU、连接池或 GC）
- [ ] 把连接池调到 1 重跑同一档，P95 明显变差——证明你的归因方法能区分瓶颈

---

### 第 14 周：部署

**本周目标**：把同一个 jar 用环境变量配置、以 systemd 守护、经 nginx 反代跑起来，并能一条命令回滚到上一版。

**为什么是这些内容**：第 13 周你有了日志、指标和压测数据，但服务还跑在 IDE 里——合上电脑就没了。部署是把「我这儿能跑」变成「别人能用」的那一步，也是这条路线里第一次真正面对线上：进程会崩、机器会重启、配置会泄、发版会坏。这一周的五件事各自防一种事故：外置配置防「密码跟着 jar 被复制」；fat jar 防「服务器上缺依赖」；systemd 防「重启后服务不见了、崩了没人拉」；nginx 防「把 8080 直接暴露公网」；回滚防「发版坏了只能熬夜修」。第 16 周的真实上线就是把这套流程再走一遍，所以这里的命令要练到不用查。不学会的后果很具体：改一个端口要重新打包、服务器重启后服务消失、出了事只能 revert 再等一次构建。这一周也是「可运维性」的起点：第 17 周要在线上抓线程栈、读 GC 日志，前提是服务被 systemd 管着、日志有落点、进程号找得到。还有一条练习要求：所有命令都要能在本地 WSL 或一台便宜的云主机上复现——只在别人的服务器上跟着点过一次，不算会部署。

#### 步骤 14.1 打包并外置配置

Spring Boot 的 `spring-boot-maven-plugin` 会在 `package` 阶段执行 `repackage`：把依赖一起打进去，改写 `MANIFEST.MF` 的 `Main-Class` 和 `Start-Class`，产物才是能 `java -jar` 的 fat jar。判断标准只有一条：`jar tf app.jar` 能看到 `BOOT-INF/`；看不到就是普通 jar，运行时必然报 `no main manifest attribute`。`target/` 是构建产物，不进 git，也不要 commit 任何 jar。

配置的优先级从高到低是：命令行参数、环境变量、`application-{profile}.yml`、`application.yml`。Spring 的 relaxed binding 会把 `server.port` 映射到 `SERVER_PORT`、`app.secret` 映射到 `APP_SECRET`，所以「同一份 jar 在两台机器上跑出不同行为」是完全可以做到的——这也正是配置外置是否成功的判据。密码只从环境变量或 `EnvironmentFile` 来，仓库里只放 `.env.example`；打包后要用 `jar tf` 确认 `BOOT-INF/classes/` 里没有带密码的本地配置文件。

构建命令也要有分工：本地快速迭代可以 `-DskipTests`，但发布前必须跑一次 `mvn -B verify`，让测试真正当门禁；`-Dmaven.test.skip=true` 连测试代码都不编译，不要用在发布流水线。JVM 参数固定 `-Xms` 等于 `-Xmx`，避免运行期反复扩堆；时区和编码显式写 `-Duser.timezone=Asia/Shanghai`、`-Dfile.encoding=UTF-8`，否则服务器是 UTC、日志时间对不上，中文还会乱码。

为什么不用 Docker？容器不是替代品，而是另一套打包方式：镜像把 JDK 和 jar 一起冻结，解决了「服务器 JDK 版本不一致」，代价是多一层网络、存储、镜像仓库和编排。这一周先学裸机进程，因为容器里最终跑的还是一条 `java -jar` 命令；看不懂 systemd 的人，通常也看不懂容器为什么起不来。选型标准：一台机器一个服务，systemd 足够；多环境、多副本、要滚动发布，再上容器。

密钥最后再强调一次：`.env` 只放运行期配置，`chmod 600`、属主是运行用户、绝不进 git；`APP_SECRET` 用 `openssl rand -base64 32` 生成，轮换按第 12 周的双密钥方案过渡。检查泄露不要只看 git，还要看构建产物和日志：代码里搜不到明文，不代表 jar 里没有，解压 `BOOT-INF/classes/` 确认才作数。

:::hint 配置外置的判据
不是「配置文件放在 jar 外面」就算外置，而是「同一个 jar 不改一行代码，能在两台机器上跑出不同行为」。做不到，就还有配置被编译进去了。
:::

:::solution 打包、验证与用环境变量启动
```xml
<plugin>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-maven-plugin</artifactId>
  <executions>
    <execution>
      <goals><goal>repackage</goal></goals>
    </execution>
  </executions>
</plugin>
```
```bash
mvn -B verify
mvn -B -DskipTests package
jar tf target/app.jar | grep BOOT-INF/ | head        # Windows: findstr BOOT-INF
```
```bash
APP_SECRET=$(openssl rand -base64 32) \
APP_VERSION=1.0.0 SERVER_PORT=8081 \
java -jar target/app.jar
```
:::

:::error jar 里没有主类
```text
no main manifest attribute, in app.jar
```
**原因**：这个 jar 不是 Spring Boot 的 fat jar。要么没配 `spring-boot-maven-plugin` 的 `repackage`，要么打出来的是原始 jar（没有把依赖一起打进去）。
**判断**：`java -jar` 能跑起来的 jar，`BOOT-INF/` 目录一定存在；没有就回去看 `pom.xml` 的插件配置和构建日志里有没有 `repackage`。
:::

#### 步骤 14.2 systemd 守护 + nginx 反代

`nohup` 有三个硬伤：机器重启后进程没了、进程崩了没人拉起、日志无限增长。systemd 用 unit 文件描述「怎么启动、以谁的身份、失败怎么办」：`Restart=on-failure` 加 `RestartSec=5` 负责自动拉起，`systemctl enable` 负责开机自启，`journalctl -u myapp` 统一看日志。改完 unit 要 `systemctl daemon-reload` 再 restart，否则跑的还是旧配置。

unit 里的安全基线：用专用用户 `User=myapp`（不给登录 shell）、`WorkingDirectory` 和 `ExecStart` 全用绝对路径、密码放 `EnvironmentFile=/opt/myapp/.env` 且 `chmod 600`、属主是运行用户。`TimeoutStopSec=30` 给优雅停机留时间——Spring 收到 SIGTERM 会先停止接新请求、处理完在途请求再退出；直接 `kill -9` 会丢请求。`LimitNOFILE` 要调大，否则高并发下会报 `Too many open files`。

nginx 负责把公网 80/443 转到 `127.0.0.1:8080`，应用本身只监听本机，别把 8080 开到公网。这一步最容易漏：`server.address=127.0.0.1` 要配上，云服务器安全组只放 80/443，最后用 `ss -ltnp` 确认 8080 没有绑在 `0.0.0.0`。很多人以为 nginx 挡住了，其实后面的端口还对着公网。`proxy_pass` 不带尾斜杠时保留原始路径；要传 `Host`、`X-Real-IP`、`X-Forwarded-For`、`X-Forwarded-Proto`，否则应用生成的绝对 URL、日志里的客户端 IP 全是错的，第 12 周的 `Secure` Cookie 也会因为协议判断错误而失效。SSE 或大文件下载要 `proxy_buffering off`，普通接口则让 `proxy_read_timeout` 大于最慢接口耗时。改完先 `nginx -t`，通过再 `systemctl reload nginx`；HTTPS 用 certbot 申请并确认自动续期。

日志落点也要一起定：systemd 把 stdout 收进 journald，journald 默认会无限增长，要配 `SystemMaxUse=500M`、`MaxRetentionSec=2week`；应用自己的滚动文件则配 `maxHistory` 和 `totalSizeCap`。两条链路选一条为主即可，但必须有一个总量上限——一次死循环打日志就能把磁盘写满，服务跟着挂。

顺序上还有一条经验：先 restart 应用、确认 health 是 UP，再 reload nginx。反过来的话，nginx 会在应用没起来时接流量，用户看到一批 502。需要灰度就再进一步：让 nginx 先只把一部分流量转到新端口，验证没问题再切全量。

:::hint 为什么不用 nohup
`nohup` 起的进程，机器重启就没了、崩了也不会拉起、日志还会无限增长。systemd 负责自启、自动重启、日志轮转，这是生产的最低要求。
:::

:::solution unit 文件与 nginx 配置
```ini
[Unit]
Description=myapp API
After=network-online.target
Wants=network-online.target

[Service]
User=myapp
Group=myapp
WorkingDirectory=/opt/myapp
EnvironmentFile=/opt/myapp/.env
ExecStart=/usr/bin/java -Xms512m -Xmx512m -Duser.timezone=Asia/Shanghai \
  -Dfile.encoding=UTF-8 -jar /opt/myapp/current/app.jar
Restart=on-failure
RestartSec=5
SuccessExitStatus=143
TimeoutStopSec=30
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```
```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
    client_max_body_size 10m;
}
```
```bash
systemctl daemon-reload
systemctl enable --now myapp
systemctl status myapp --no-pager
nginx -t && systemctl reload nginx
```
:::

:::error systemd 启动失败：status=203/EXEC
```text
myapp.service: Failed at step EXEC spawning /usr/bin/java: No such file or directory
```
**根因**：unit 里写的 `ExecStart` 路径不存在，或该文件没有执行权限。systemd 不读 PATH、不展开 `~` 和 shell 变量，所以 `ExecStart=java -jar ...` 一定失败；常见于 JDK 装在 `/opt/jdk17` 而不是 `/usr/bin`。
**修复**：`readlink -f $(which java)` 拿到真实路径填进 unit；`systemctl cat myapp` 看 systemd 实际读到的配置；`journalctl -u myapp -n 50 --no-pager` 看完整报错。改完必须 `daemon-reload`。
:::

#### 步骤 14.3 探活、发布与回滚

发布不是 `scp` 覆盖 jar 再 restart：覆盖的瞬间旧版本已经没了，新版本起不来就只能现场修。正确做法是按版本放目录：`/opt/myapp/releases/20261021-1/app.jar`，`current` 是指向某个版本的软链，systemd 的 `ExecStart` 指向 `current/app.jar`。发布脚本上传新版本、切链、restart、探活；探活失败就切回上一版再 restart。回滚因此是一条命令，而且不需要重新构建——构建可能已经坏了，回滚恰恰发生在最不能构建的时候。

探活要探依赖，不只是端口：`/actuator/health` 默认包含数据库等检查，端口通但 health 是 DOWN 的情况很常见（数据库连不上、迁移没跑）。脚本循环 30 次、每秒一次，等到 `"status":"UP"` 才算成功；超时就回滚。`show-details` 设成 `when-authorized`，别让匿名用户看到连接串之类的细节。

还要让线上版本可见：`info.app.version=${APP_VERSION:dev}` 加 `/actuator/info`，发布后用 curl 确认跑的是哪个版本；出了问题先看这个，而不是猜。回滚必须演练：发一版、curl 看到新版本、执行回滚、curl 看到旧版本、health 仍为 UP。没演练过的回滚等于没有回滚。

发布窗口也要有纪律：发版前确认没有正在跑的长任务，发布时要么先摘流量，要么接受几十秒的 502。有数据变更的版本必须写清「能不能回滚」——只加字段的回滚通常没问题，删字段或改语义的回滚会让旧代码读不懂新数据。数据库变更永远向前兼容：先加列、再双写、再切读、最后删旧列，别指望回滚能撤销 DDL。

脚本里有个容易写错的细节：`systemctl restart` 的退出码只说明命令有没有下发成功，不代表进程真的起来了，所以要用 `|| true` 接住，再由 health 决定成败。否则 `set -e` 会在最该回滚的时候直接退出，留下一个起不来的服务。

发布后十分钟是检查时间：health、info、一条真实业务请求、错误日志里没有新异常、P95 没有明显抬升。检查完再离开，别发完就关终端。

:::hint 回滚是「切链 + restart」
不是重新构建上一版，也不是 `git revert` 后等流水线。回滚要能在构建坏掉、网络很差的时候，一分钟内完成。
:::

:::solution 发布脚本与版本信息
```bash
#!/usr/bin/env bash
set -euo pipefail

APP=myapp
BASE=/opt/$APP
JAR=$1
REL=$BASE/releases/$(date +%Y%m%d-%H%M%S)
PREV=$(readlink -f "$BASE/current" 2>/dev/null || true)

install -d "$REL"
install -m 644 "$JAR" "$REL/app.jar"
ln -sfn "$REL" "$BASE/current"
systemctl restart "$APP" || true

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8080/actuator/health | grep -q '"status":"UP"'; then
    echo "deployed $REL"
    exit 0
  fi
  sleep 1
done

if [ -n "$PREV" ] && [ -d "$PREV" ]; then
  ln -sfn "$PREV" "$BASE/current"
  systemctl restart "$APP" || true
  echo "health check failed, rolled back to $PREV" >&2
else
  echo "health check failed and no previous release to roll back to" >&2
fi
exit 1
```
```bash
# rollback: point current at the previous release, then restart
ln -sfn /opt/myapp/releases/<previous> /opt/myapp/current
systemctl restart myapp
curl -fsS 127.0.0.1:8080/actuator/info
```
```yaml
info:
  app:
    name: myapp
    version: ${APP_VERSION:dev}

management:
  info:
    env:
      enabled: true
  endpoints:
    web:
      exposure:
        include: health,info,metrics
```
:::

:::error 发布后 nginx 返回 502
```text
502 Bad Gateway
nginx/1.24.0
```
**根因**：nginx 连不上 `127.0.0.1:8080`。可能是应用启动失败、端口不对、只监听了别的网卡，或 systemd 里新版本根本没起来。502 是「上游不可达」，不是「接口报错」。
**修复**：按顺序 `systemctl status myapp` → `journalctl -u myapp -n 100 --no-pager` → `ss -ltnp | grep 8080` → `curl -v 127.0.0.1:8080/actuator/health`。四步里哪一步断，问题就在哪一层；别先去改 nginx 配置。
:::

**自测**（合上文档回答）

1. 配置优先级从高到低是什么？怎么用命令证明密码没有被打进 jar？
2. `nohup` 和 systemd 的差别？`Restart=on-failure` 与 `Restart=always` 各适合什么场景？
3. 为什么用 `releases` 加 `current` 软链，而不是直接覆盖 jar？探活为什么看 health 而不是端口？

**验收**

- [ ] `jar tf target/app.jar | findstr BOOT-INF` 有输出；`BOOT-INF/classes/` 里没有含真实密码的本地配置
- [ ] 同一个 jar 分别用 `--server.port=8081` 和 `SERVER_PORT=8082` 启动，端口各自生效且未重新打包
- [ ] 不设 `APP_SECRET` 启动会失败并指出缺少 `app.secret`，不会带着空密钥跑起来
- [ ] `/actuator/health` 返回 UP；`APP_VERSION=1.1.0` 启动后 `/actuator/info` 显示 1.1.0
- [ ] WSL（`/etc/wsl.conf` 里开启 systemd）或一台 Linux 主机上，`systemctl is-enabled myapp` 为 enabled；`kill -9` 后 10 秒内自动拉起
- [ ] `nginx -t` 通过，`curl 127.0.0.1/api/tasks` 返回 401 而不是 502
- [ ] 发布 1.1.0 后 info 是新版本；执行回滚后回到 1.0.0，health 仍为 UP

---

### 第 15 周：综合项目（毕业设计）

**本周目标**：把短链服务做成一件交付物——别人照 README 能在 30 分钟内跑起来，五个接口的契约与实现逐条对得上，压测能报出 QPS 与 P95。

**为什么是这些内容**：前十四周学的都是零件：测试、事务、线程池、日志、部署。零件会装不等于会交付。真实项目里代码只占一半，另一半是「别人能不能用、出了问题能不能查、数字能不能拿出来」。这一周不引入新 API，只做三件事：先把契约写死（步骤 15.1），再让一个不知道你机器配置的人跑起来（步骤 15.2），最后用压测把「快」变成数字（步骤 15.3）。不学会的后果很具体：字段靠口头约定，联调时 `code` 与 `shortCode` 对不上，改一次字段前端全崩；README 只写「启动项目」，换台机器就卡在数据库连不上；被问「你这接口能扛多少」只能回答「挺快的」。这三件事也是后两周的底座：第 16 周要读真实项目并上线，第 17 周要诊断性能，前提都是你手里有一个自己写的、能压、能看日志的服务。选题别贪大，短链或文件分享，五个接口一张表，够用。

#### 步骤 15.1 先写接口文档，再写代码

先写实现再补文档，最典型的翻车现场是联调当天：前端按你上周口头说的 `shortCode` 接了字段，你实现里叫 `code`，前端拿到 `undefined`，拼出的短链是 `https://x.cn/undefined`，打开是 404，两边都以为是对方的问题。契约不是文档洁癖，它是你和调用方之间唯一可执行的约定：字段名、类型、可空性、失败时的状态码，任何一条没写清，都会在联调时变成一次争论。

短链只需要五个接口，但每个都要把「失败」写清楚。`POST /api/links` 传非法 URL 是 400 还是 422；`GET /{code}` 命中返回 302 而不是 200，因为浏览器要跳转；链接过期返回 410 而不是 404——404 的意思是「从来没存在过」，410 才是「存在过，没了」，这直接决定用户该重试还是该重新生成。分页接口要写清 `page` 从 1 还是 0 开始、`size` 上限多少，否则调用方传 `size=100000` 就能把库拖死。删除要写清软删还是硬删，软删之后 `GET /{code}` 返回什么。

写契约的顺序：先列路径与方法，再逐条填「入参 / 成功 / 失败 / 权限」，最后自己当一次调用方，只看这张表写三行 `curl`。写不出来，说明契约有洞。

```text
POST   /api/links              {url, expireDays?}  → 201 {code,shortUrl,createdAt,expiresAt}  400 非法 URL / 401 未登录
GET    /{code}                 —                   → 302 Location                    404 不存在 / 410 已过期
GET    /api/links?page=&size=  {page,size}         → 200 {items,total,page,size}      401 未登录
DELETE /api/links/{code}       —                   → 204 无响应                       403 不是你的 / 404
GET    /api/links/{code}/stats —                   → 200 {code,clicks,lastAccessAt}   403 / 404
```

表里的 `?` 表示可空，这也是契约的一部分：不传 `expireDays` 默认 30 天，必须写进文档，否则调用方会以为永不过期。`shortUrl` 是完整地址（含域名），不要让前端自己拼——域名换一次，前端就得跟着发版。

还有一件只能写进契约、不能留到实现时再决定的事：短码怎么生成。直接把自增 id 转成 Base62 看着省事，但 id 连续，别人从 `a`、`b`、`c` 就能把你全站的链接按顺序遍历一遍——这是信息泄露，不是性能问题。用随机 7 位（62 的 7 次方约 3.5 万亿）加唯一索引兜底，冲突了重试一次即可；`uk_code` 保证并发下也不会出现两个相同的码。契约里写明「短码由服务端生成、7 位、大小写敏感」，调用方就不会自作聪明去猜规律。

:::hint 契约里最贵的不是字段名，是「失败时返回什么」
调用方八成代码在处理异常分支。把 400/401/403/404/410 各自的触发条件写清楚，比多写两个成功字段有用。
:::

:::solution 请求与响应对象
```java
import jakarta.validation.constraints.*;

public record CreateLinkReq(
        @NotBlank @Size(max = 2048)
        @Pattern(regexp = "^https?://.*", message = "只支持 http/https") String url,
        @Min(1) @Max(365) Integer expireDays) { }   // null = 默认 30 天

public record LinkResp(String code, String shortUrl, Instant createdAt, Instant expiresAt) { }
```
`record` 让 DTO 不可变，也省掉 getter。校验注解只有在 Controller 参数上加 `@Valid` 才生效，否则它们只是注释。`expireDays` 用包装类型 `Integer`，是因为「不传」和「传 0」必须能区分：`int` 的默认值 0 会让 `@Min(1)` 把「不传」也判成非法。响应里不要放自增 `id`，`code` 才是对外标识，暴露连续 id 等于把「一共多少条」和「可以按 id 遍历」送给别人。
:::

#### 步骤 15.2 让别人按 README 跑一遍

你自己跑通不算数。你的机器上装过 JDK、配过 `JAVA_HOME`、`~/.m2` 里有缓存、MySQL 里早就有库——这些隐式前提一条都没写进 README。换一台干净机器，或找一个没参与的人，只看 README 操作，他卡住的每一处都是你的 bug。

README 只需要五段，但每段都要能直接复制：① 前置条件（JDK 17、MySQL 8，给出 `java -version` 的期望输出）；② 建库；③ 配置（复制示例文件，列出必须改的键，密码走环境变量）；④ 启动（一条命令，写清端口）；⑤ 验证（一条 `curl` 加期望输出）。再加一段「常见问题」，把被问过的都写进去。

最容易漏的是建库和配置之间的顺序：先启动后建库，Spring 启动时连库失败会直接退出，报 `Unknown database`，新手看到一屏堆栈就卡住了。解决办法不是加注释，而是让建表脚本自己 `CREATE DATABASE IF NOT EXISTS`，或者把建库和启动写成同一个代码块，让人一次复制完。

「可重复执行」是硬要求：`CREATE TABLE` 不带 `IF NOT EXISTS`，第二次跑就报 `Table already exists`，而别人很可能跑了两遍。脚本幂等和第 11 周的接口幂等是同一个思路——重复执行不产生副作用。

:::hint 验收标准是「别人 10 分钟能跑起来」
不是「我写完了」。你自己跑不卡，只说明依赖恰好都在你机器上。
:::

:::solution 建表与启动
```sql
CREATE DATABASE IF NOT EXISTS shortlink DEFAULT CHARACTER SET utf8mb4;
USE shortlink;

CREATE TABLE IF NOT EXISTS link (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  code       VARCHAR(12)   NOT NULL,
  url        VARCHAR(2048) NOT NULL,
  owner_id   BIGINT        NOT NULL,
  clicks     BIGINT        NOT NULL DEFAULT 0,
  expires_at DATETIME      NULL,
  created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code (code),
  KEY idx_owner_created (owner_id, created_at)
);
```
```bash
# bash / cmd 用重定向；PowerShell 换成 Get-Content schema.sql | mysql -u root -p
mysql -u root -p < schema.sql
export DB_PASSWORD='***'
java -jar target/shortlink.jar --server.port=8080
curl -i -X POST localhost:8080/api/links -H 'Content-Type: application/json' -d '{"url":"https://example.com"}'
```

`uk_code` 是短码的唯一约束，也是 15.1 里「一个短码只指向一个地址」的落地。`idx_owner_created` 给「我的链接按时间倒序」用，联合索引顺序不能反：先等值列 `owner_id`，再排序列。`utf8mb4` 不是可选，用户粘贴的 URL 里可能带 emoji 或中文路径，三字节的 `utf8` 存不下。`curl` 加 `-i` 是为了看到状态码与 `Location` 头，只看 body 会漏掉 302。

:::error 建库脚本没跑，启动直接退出
```text
java.sql.SQLSyntaxErrorException: Unknown database 'shortlink'
    at com.mysql.cj.jdbc.exceptions.SQLError.createSQLException(SQLError.java:120)
```
**根因**：库没建，或建在了另一个实例上——`3306` 上可能同时有本机 mysqld 和 Docker 映射的 MySQL。**修复**：先 `mysql -u root -p -e "SHOW DATABASES LIKE 'shortlink'"` 确认；不在就按 README 跑 `schema.sql`；在却连不上，就核对 `DB_URL` 的端口和建库时用的端口是不是同一个。这条报错九成是环境，不是程序，别急着改代码。
:::

#### 步骤 15.3 用压测把「快」变成数字

「接口挺快的」不是结论。压测要回答三个数：多少并发下 QPS 多少、P95 延迟多少、从哪一档并发开始错误率不为零。这三个数才是交付物。

做法：先低并发跑 30 秒热身，让 JIT 和连接池预热；再按 10 → 50 → 100 → 200 阶梯加压，每档 30 秒，记 QPS、P95、错误率；找到 P95 超过 500ms 或错误率超过 1% 的那一档，前一档就是容量。压测机不要和被压服务挤在同一台小机器上——压测本身吃 CPU，两边抢核，测出来的是压测机的极限。

看指标的顺序：先看错误率，它从 0 开始涨的点就是第一次过载；再看 P95，别看平均值，平均值会被大量快请求拉平，掩盖长尾；最后看瓶颈在哪，`top` 看 CPU，`jstack` 看线程是不是都卡在连接池，慢查询日志看 SQL，GC 日志看是不是在频繁 Full。压测接口要选有代表性的：一个写接口加一个读接口，别压首页静态资源。

k6 比 wrk 更适合当交付物，因为脚本是代码，能进 git、能断言、能进 CI。脚本里不要加 `sleep`——压测测的是服务上限；但要另跑一轮带 `sleep(1)` 的模拟真实流量，两个数字用途不同，报告里都要写明。

:::hint 数字必须连环境一起报
「QPS 1200」没有意义；「2 核 4G、堆 512m、MySQL 同机、100 并发下 QPS 1200、P95 180ms」才是结论。
:::

:::solution 压测脚本与取数
```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },    // 热身
    { duration: '30s', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '30s', target: 200 },
  ],
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<500'] },
};

export default function () {
  const body = JSON.stringify({ url: 'https://example.com/' + __VU + '/' + __ITER });
  const res = http.post('http://127.0.0.1:8080/api/links', body,
    { headers: { 'Content-Type': 'application/json' } });
  check(res, { '201': (r) => r.status === 201 });
}
```
```bash
k6 run --summary-export=result.json load.js
node -e "const m=require('./result.json').metrics;console.log(m.http_reqs.values.rate, m.http_req_duration.values['p(95)'])"
```

`stages` 是阶梯加压，`target` 是虚拟用户数，每段内部线性爬升，所以报数取该段最后 10 秒，否则会把爬升期算进去，数字偏低。`thresholds` 让 k6 在 P95 超 500ms 时以非 0 退出，这样它能挂进 CI 当门禁，而不是靠人看报告。URL 里拼 `__VU` 和 `__ITER` 是为了避开唯一约束——同一个 URL 重复创建若被幂等逻辑拦下，你压的是「返回已有结果」的分支，数字会虚高。

报告只要一张表：四行对应四档并发，五列写 QPS、P95、P99、错误率、服务端 CPU。P99 必须留，它专门暴露长尾；CPU 一列用来解释「为什么这一档开始掉」——QPS 上不去而 CPU 打满，是算力到顶；CPU 没满而 P95 飙升，是锁、连接池或下游。这张表和接口文档、README 一起构成第 15 周的交付物，缺一样都算没做完。

:::

**自测**（合上文档回答）

1. `GET /{code}` 成功为什么返回 302 而不是 200？过期为什么用 410 而不是 404？
2. `expireDays` 为什么声明成 `Integer` 而不是 `int`？写成 `int` 会出什么错？
3. 压测为什么要先热身？为什么报 P95 而不是平均值？容量拐点怎么判定？

**验收**

- [ ] 契约表里五个接口都能用 `curl` 复现出文档写的状态码，含 400、404、410 各一次
- [ ] 删掉本地库，只按 README 的命令重跑，服务能启动并返回 201
- [ ] 连续执行两次 `schema.sql` 不报错（幂等）
- [ ] `k6` 输出里有 QPS 与 P95，并能说出 10/50/100/200 四档里哪一档开始错误率大于 0
- [ ] 接口文档的字段名与 `LinkResp` 逐字一致（复制比对，不靠记忆）

---

### 第 16 周：读真实项目，做一次真实提交

**本周目标**：能在 10 分钟内说清一个陌生 Spring 项目的请求链路，并把一个小需求从「会失败的测试」送到线上，再完整演练一次回滚。

**为什么是这些内容**：前十五周你都在自己写的项目里工作，而真实工作的起点往往是接手别人的项目。读代码的能力就是定位问题的能力：线上报错时没人给你画调用图，你得自己从一行日志倒推回某个方法。这一周练三件事。第一件是读法（步骤 16.1）：从一个能打到的接口倒推，而不是从启动类顺着读，后者的结局通常是读到第二十个文件就迷路。第二件是发布流程（步骤 16.2）：很多人把 `git push` 当成上线，真正的上线还包括构建、部署、探活、观测。第三件是回滚（步骤 16.3），它是「敢发版」的前提，也是第 17 周诊断时的退路。不学会的后果：改一处牵连三处，说不出为什么；发布靠勇气，出事只会重启；回滚现场现想，越急越乱。这一周之后，你应该能对任何一个中等规模的 Spring 项目说「我知道请求是怎么进来的」。

#### 步骤 16.1 走通 `notelab-java` 的一条链路

不要从启动类开始往下读。正确顺序是从一个你能打到的接口倒推：先 `curl`，看返回什么；再找 Controller，看它调了谁；再往下追 Service、DAO、SQL；最后看返回体是怎么拼出来的。读一条链路，比读十个文件有用；读完第一条，第二条会快得多，因为 Spring 项目的形状高度相似。

以 `GET /api/menu` 为例，五个问题必须能在纸上答出来：① 请求从哪进来——nginx 把 `/api/` 转到 `127.0.0.1:8001`，Spring MVC 按 `@RequestMapping` 分发；② 鉴权在哪一层——拦截器管登录，Controller 里再用 `AuthUtil` 取当前用户，两层，别以为过了拦截器就安全；③ 数据从哪出——`PermService` 到静态门面 DAO 再到 MyBatis-Plus Mapper 和 MySQL，出口统一是 `Map`；④ 出错时返回什么——有统一异常处理，还是每个 Controller 自己 catch；⑤ 有没有副作用——写库、发消息、改缓存，这一格决定这个接口能不能重放、能不能压测。五格填不满，说明你只是看过了。

读的时候手边开三样东西：IDE 的 Find Usages、终端里的 `curl -i`、服务的日志。每读一层就打一次接口，把日志行和代码对上。这比只看代码可靠，因为 AOP、拦截器、`@Transactional` 代理都在你看不见的地方插了逻辑。看到 `@Transactional` 就在心里标记「这里多一层代理，自调用会失效」（第 10 周），看到 `@Async` 就标记「这里换了线程，MDC 会丢」（第 13 周）。

:::hint 先找入口再找出口，中间的自然会浮出来
入口是 URL 映射，出口是响应体。这两头定住，中间每一层都只剩「它调了谁」一个问题。
:::

:::solution 追踪命令与链路笔记
```bash
curl -i -s 'http://127.0.0.1:8001/api/menu' | head -20
# 401 说明要登录态，带上 cookie 再打一次
curl -i -s 'http://127.0.0.1:8001/api/menu' -b 'notelab_session=<token>' | head -40
```
```text
接口：GET /api/menu
入口：MenuController#menu
鉴权：ApiPermInterceptor 校验登录 → Controller 内 AuthUtil.user() 取 uid，为空直接 401
依赖：UiConfigService.getConfig / buildMenuItems → PermService.allowedPagePaths → PermDao
出口：Map{menu, pages, background}
副作用：只读；缓存若存在则记在 UiConfigService 层
```
`-i` 打印响应头，`-b` 带 cookie，两个参数配合才能区分「401 没登录」和「200 但菜单为空」。笔记不要写成散文，按固定五个格子填：入口、鉴权、依赖、出口、副作用。副作用那一格最容易漏——它决定了这个接口能不能压测、能不能重放。

:::error 本地起不来，报找不到配置类
```text
java.lang.IllegalStateException: Unable to find a @SpringBootConfiguration,
you need to use @ContextConfiguration or @SpringBootTest(classes=...) with your test
```
**根因**：测试类不在启动类所在包或子包下，Spring Boot 的自动扫描向上找不到 `@SpringBootApplication`。**修复**：把测试类放回 `src/test/java` 下的对应包路径，或用 `@SpringBootTest(classes = NoteLabApplication.class)` 显式指定。别用 `@ComponentScan("com")` 糊过去，那会把测试变慢十倍。
:::

#### 步骤 16.2 做一次真实上线

需求选最小的：给已有接口加一个只读字段，或加一个可选查询参数。不要选重构——重构没有验收标准，也没法回滚。

顺序是固定的七步：写一个会失败的测试（证明你理解当前行为）→ 改代码让它绿 → 本地 `mvn -B verify` → 一个 commit 只做一件事 → push → 部署 → 线上验证。任何一步跳过，出事时就少一条线索。测试先行的意义在这一步最明显：你改的是别人的代码，测试是你唯一能确认「没改坏别的分支」的证据。

提交信息按项目约定写：类型加一句话，正文分「产生原因 / 解决方案 / 影响范围」三段。三个月后 `git log` 是唯一的考古线索，`fix bug` 这种信息等于没写；而「加了 lastLoginAt，影响 /api/menu 的响应体」能让下一个人直接判断要不要回滚。

真实项目的部署脚本通常带保护：分支不对不跑、工作区脏不跑、构建失败不重启。这些保护看着碍事，其实是安全网。工作区脏被拒，说明有人绕过流程在服务器上手改过代码，这时要做的是查清来源，而不是想办法 `--force`。构建失败不重启，意味着推上去的代码可能根本没生效，所以「部署完必须验证」不是形式主义。

线上验证要用可观察的证据：状态码、响应体里的新字段、日志里新增的那一行。不要用「页面看起来没问题」——页面有缓存，接口才是真相。验证完把命令和输出贴进提交说明或周复盘，下次回滚时你就知道该验什么。

:::hint 上线前回答三问
坏了会怎样？我怎么发现？怎么回滚？三个都答不上，就不要上线。这个项目的规范是「构建失败不重启，老进程继续服务」，知道这一点才敢发版。
:::

:::solution 从提交到线上验证
```bash
mvn -B -q verify
git add src/ && git commit -m "feat: /api/menu 返回 lastLoginAt"
git push origin main
bash ops/sync-notelab-java.sh          # 同步 + 构建 + 重启，一条命令
# 探活：/api/menu 返回 401 即为正常（本服务没有 /api/health）
curl -i -s 'https://haolo.cloud/api/menu' | head -3
```
`verify` 比 `package` 多跑集成测试阶段，是 CI 的默认入口；`-q` 只留错误和摘要，输出短才愿意每次都跑。`git add src/` 而不是 `-A`，避免把本地配置、`target/` 之类的脏东西带进去。部署脚本是幂等的，重复执行只会「已是最新」然后跳过构建；探活看 401 而不是 200，因为该接口要求登录，401 恰好证明服务在、路由通、鉴权在工作。Windows 上 `bash` 不在 PATH 时，用仓里的 `ops\sync.cmd notelab-java` 兜底。

#### 步骤 16.3 先想好回滚，再发版

回滚必须在上线前写好，不能出事了现场想。分三层：应用层用 `git revert` 加重新部署，分钟级，最常用；配置层改环境变量重启，秒级，适合开关和限流阈值；数据层最难，所以加列、改表一律设计成向后兼容——新列可空、先发 DDL 再发代码、旧代码不认识的列不去碰。这样应用回滚不会因为「列不存在」炸掉。

顺序有讲究。加列：先执行 `ALTER TABLE`（旧代码不受影响），再发新代码。删列：先确认没有旧版本在跑，再删。改字段类型：加新列、双写、回填、切读、删旧列，五步，不能一步到位。这些不是理论，是「回滚要能在十分钟内完成」这个要求推出来的。

演练一次：把新字段故意改坏（返回错误值），走一遍 `git revert`、部署、验证，计时。演练的价值是暴露「回滚也要二十分钟」这种事实——如果回滚比修复还慢，发布策略就得改，比如加灰度或开关。发版后头十分钟还要盯三个信号：5xx 比例、关键接口 P95、日志里新出现的异常。没有监控面板就用命令凑：`curl` 打关键接口、`grep -c ERROR` 对比发布前后、`jstack` 抓一次看线程状态有没有异常堆积。

:::hint 不能回滚的改动不要一次上
先让它可回滚，再让它上线。灰度、开关、双写都是「把一次大变更切成可以停下来的小步」。
:::

:::solution 加列与回滚
```sql
-- 新列必须可空或有默认值：旧代码 INSERT 不带它也不会失败
ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL;
```
```bash
git revert --no-edit <sha>
git push origin main
bash ops/sync-notelab-java.sh
curl -i -s 'https://haolo.cloud/api/menu' | head -3   # 401 = 服务活着
```
`--no-edit` 用默认的 revert 提交信息；回滚 merge commit 要加 `-m 1`，否则 git 不知道保留哪一边。`git revert` 只改代码，不改正在运行的进程，所以后面那步部署不能省——这是最常见的「回滚了但没生效」。

:::error 新代码上线，报 Unknown column
```text
java.sql.SQLSyntaxErrorException: Unknown column 'last_login_at' in 'field list'
```
**根因**：代码先上、DDL 没跑，或 DDL 跑在了另一个库。**修复**：迁移先行——先加可空列（旧代码照常跑），再发新代码；回滚时反过来，先回滚代码，列留着不删。**别做的事**：把这个异常 catch 掉当字段不存在，那会让「上线顺序错了」变成一个永远查不出来的隐性 bug。
:::

**自测**（合上文档回答）

1. 读一条链路时，为什么从 `curl` 倒推比从启动类正向读更快？必答的四个问题是什么？
2. 「构建失败不重启」对发布意味着什么？看到「推了但线上没变」应该先查哪里？
3. 加列为什么必须允许 NULL？代码回滚与 schema 回滚的先后顺序是什么？

**验收**

- [ ] 10 分钟内画出 `/api/menu` 的链路图，五格（入口、鉴权、依赖、出口、副作用）都填满
- [ ] 有一个只加了一个字段的 commit，`git show --stat` 只涉及 1–2 个文件
- [ ] 部署后线上 `curl` 能看到新字段，日志里能按 requestId 找到这次请求
- [ ] 完整演练一次 `git revert` 加重新部署，从决定回滚到服务恢复计时并记下秒数
- [ ] 三问都有具体答案：「怎么发现」写的是命令或指标，不是「看监控」

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

**本周目标**：拿到一个「有点慢」的服务，10 分钟内用 GC 日志、线程栈、CPU 采样定位到一个具体方法，并写出一份别人照着能复现的诊断报告。

**为什么是这些内容**：前十六周解决「写对」和「交付」，这一周解决「跑着跑着不对劲」。L3 和 L2 最直观的分界线就在这里：L2 遇到慢只会重启、加机器、猜；L3 能说出是哪个线程、哪段代码、哪次 GC。三件工具对应三类症状，不是三个独立知识点：内存问题看 GC 日志与堆直方图，卡住看线程栈，CPU 高看采样。它们又都和前面几周咬合——线程池参数配错会在 `jstack` 里变成一堆线程卡在同一个等待点，连接池拿不到连接会表现为大面积的 `TIMED_WAITING`，第 15 周压测里「CPU 没满但 P95 飙升」的答案就在步骤 17.2。不学会的后果是只能做「重启工程师」：问题复现不了、根因说不清、修复靠改参数。诊断报告之所以是产出物，是因为它把「感觉慢」变成可复核的证据链：现象、数据、根因、修复、回归。没有报告，同一个问题下周还会再来一次。这一周也是收官，验收即毕业自评：不是「学完了」，而是能拿出证据。

#### 步骤 17.1 打开 GC 日志并读懂它在说什么

先制造一个可观察的现象：固定堆 `-Xms512m -Xmx512m`，用 `-Xlog:gc*` 把日志写到文件，跑第 15 周那套压测。固定堆有两个理由：堆动态伸缩本身带来额外停顿；伸缩之后你无法判断「内存涨了」是业务涨还是堆还没扩。日志要配轮转（`filecount` 与 `filesize`），否则一个长跑服务能把磁盘写满，而磁盘满会连带把日志和临时文件一起搞坏。

一行日志分几段：时间戳、运行秒数、级别与标签、GC 编号与类型、`回收前->回收后(总容量)` 与停顿。`Pause Young` 频繁、单次 10–30ms 属于正常，新生代对象朝生夕死，复制算法很快。要警惕三种：出现 `Pause Full`，说明老年代也满了，G1 做整堆回收，停顿会从毫秒跳到秒；回收后占用几乎不降，比如 `480M->470M`，说明对象一直活着，是泄漏不是不够；Young GC 间隔越来越短，说明分配速率在涨，通常是某段代码在循环里造对象。

判断堆够不够，别看绝对值，看回收后的水位。每次 Young GC 后老年代持续抬升、最终触发 Full，那才需要更大堆或修泄漏；如果能回到两成以下，堆是够的，慢的地方不在 GC。

把日志和压测对齐：`uptime` 是进程启动后的秒数，压测的开始时间也是相对的，两者能对上才能说「这一档并发下 GC 变密了」。简单判据：Young GC 频率超过每秒五次，或单次超过 50ms，就该去看分配速率了，通常是循环里造对象、日志拼接、或一次查太多。

`GC.class_histogram` 按总字节排序，只能告诉你「谁占得多」，不能告诉你「谁在引用」。后者要靠 hprof 加 MAT 看 GC Root 链。也别在线上随手 dump：一次 hprof 可能几个 G，dump 期间进程会停，磁盘也可能被写满。

:::hint 最重要的不是停顿时间，是「回收后还剩多少」
`210M->48M` 说明堆够，慢的原因不在这；`480M->470M` 是泄漏，加 `-Xmx` 只是把爆炸推迟。
:::

:::solution 启动参数与读法
```bash
java -Xms512m -Xmx512m \
     -Xlog:gc*:file=/var/log/app/gc.log:time,uptime,level,tags:filecount=5,filesize=50M \
     -jar app.jar
```
```text
[2026-10-19T10:00:01.120+0800][1.2s][info][gc] GC(12) Pause Young (Normal) (G1 Evacuation Pause) 210M->48M(512M) 12.417ms
[2026-10-19T10:03:44.001+0800][223.4s][info][gc] GC(88) Pause Full (System.gc()) 480M->470M(512M) 3800.512ms
```
第一行 162M 被回收，12.4ms 对在线服务无感。第二行三个信号同时出现：`Full`、3800ms、几乎不降，基本可判定有对象被长期持有，下一步不是加 `-Xmx`，而是拿 `jcmd <pid> GC.class_histogram` 看谁在占。装饰器 `time,uptime,level,tags` 缺一不可：没有 `uptime` 就没法把 GC 和压测时间点对齐，没有 `tags` 就分不清 GC 与 safepoint 日志。

#### 步骤 17.2 用 jstack 找阻塞与死锁

接口慢但 CPU 不高，八成在等：等锁、等连接、等 IO。这时看 CPU 采样没用，要看线程在干什么。`jstack` 打一份栈，先数状态：`grep -c "java.lang.Thread.State: BLOCKED"`。几十个线程都 `BLOCKED` 在同一把锁上，吞吐上不去的原因就找到了。

状态要认得准：`RUNNABLE` 不代表在算，可能在跑 `socketRead`；`BLOCKED` 是等 `synchronized` 监视器锁；`WAITING` 是 `wait()`/`join()` 无限等；`TIMED_WAITING` 是带超时的等，连接池拿连接通常是这个。死锁时 JVM 会直接输出 `Found one Java-level deadlock` 和环路，不用自己拼。线程名也要能认人——线程池用 `ThreadFactory` 起名，否则栈里全是 `pool-1-thread-7`，你分不清它属于哪个业务。

单次快照会骗人：你抓的那一瞬间，线程可能正好在正常等 IO。正确做法是连抓三次、间隔五秒，看同一个栈帧是否一直在。连续出现才是阻塞点；三次都不同，说明是流量分布，不是锁。

另一种更常见的「不卡但慢」：大量线程停在 `TIMED_WAITING`，栈顶是 `HikariPool.getConnection`。这不是锁问题，是连接池不够或连接没还——先查有没有长事务占着连接、有没有忘记 `close`，再谈调大池子；调大只是把排队往后挪。要确认锁的持有者，就在同一份栈里搜锁地址：`waiting to lock <0x...>` 与另一个线程的 `locked <0x...>` 是同一个地址，那个线程就是持有者。

:::hint 找「很多线程卡在同一个地方」，比找「一个线程在干什么」有用
一个线程慢是个例，二十个线程停在同一个方法上就是系统性瓶颈。
:::

:::solution 抓栈与读环路
```bash
jps -l                                  # 找 pid
jstack <pid> > /tmp/stack1.txt
sleep 5; jstack <pid> > /tmp/stack2.txt
grep -c "java.lang.Thread.State: BLOCKED" /tmp/stack1.txt
grep -A 12 "Found one Java-level deadlock" /tmp/stack1.txt
```
```text
"pool-1-thread-3" #23 waiting to lock <0x000000076ab1> (a java.lang.Object)
   held by thread "pool-1-thread-1"
```
`jps -l` 输出主类全名，一台机器跑多个 Java 进程时靠它区分。`-A 12` 是死锁段落多打 12 行，够覆盖两个线程。读 `held by` 的链路：A 等 B 持有的锁、B 又在等 A，才叫死锁；单向等待只是阻塞，持锁线程跑完就恢复。

#### 步骤 17.3 用采样找出 CPU 热点

CPU 高却不知道高在哪，用采样：每隔一小段时间抓一次所有线程的栈，统计哪个方法出现最多。采样开销低，适合线上；插桩式 profiler 会改执行时序，只在本地用。JDK 自带 JFR，零依赖，`jcmd` 可以挂到运行中的进程上，不用重启。

采完看火焰图：横轴是样本占比，越宽越热；纵轴是调用栈，越深越底层。找最宽的「塔」，但要结合业务判断——`String.hashCode` 在哈希大量 key 时本来就热，那不是 bug。把热点落到代码行才算有效：知道 `ReportService.export` 热没有用，要继续往下看它调了谁，是循环里的 `String.format`、`BigDecimal` 除法，还是日志拼接。改法通常三种：减少次数（批量、缓存）、换实现（`StringBuilder` 替 `+`）、挪走（异步、预计算）。改完用同一份脚本再压一次，对比 P95，闭环才算完成。

线上采样要控制时长：JFR 默认开销约百分之一，但配置更重时开销会上来，别在高峰期采十分钟以上。采完的 jfr 文件动辄几百 MB，当天清理；也别顺手开 `-XX:+PrintCompilation` 这类诊断日志，它输出的量能把磁盘和 IO 一起拖慢。火焰图默认看的是 CPU 时间，所以 CPU 不高而接口慢时它一片平——这时改用 wall-clock 采样（`asprof -e wall`），最宽的那段就变成阻塞点而不是计算点。

:::hint 采样给的是比例，不是耗时
「这个方法占 40% CPU」要乘上总 CPU 时间才是绝对值；比例高但总量小，不值得优化。
:::

:::solution JFR 与火焰图
```bash
# 方式一：JFR（JDK 自带，可挂运行中的进程）
jcmd <pid> JFR.start duration=60s filename=/tmp/app.jfr
jfr print --events jdk.ExecutionSample /tmp/app.jfr | head -50

# 方式二：async-profiler（火焰图更直观）
./asprof -d 30 -f /tmp/flame.html <pid>
```
`jdk.ExecutionSample` 只含 CPU 样本；要看「等在哪」，加 `jdk.JavaMonitorEnter` 与 `jdk.ThreadPark`，三个一起看才是完整的「在算什么、在等什么」。`-d 30` 是采 30 秒，`-f` 直接出 HTML，浏览器打开后按住可放大到具体栈帧。

报告固定五段，每段一到三行：现象（什么时间、哪个接口、错误率或延迟多少）、证据（GC 日志行、栈片段、火焰图、命令输出）、根因（哪段代码、为什么）、修复（改了什么、为什么这么改）、回归（同一脚本压测前后 P95 对比）。证据必须能原样贴出来，不能写「看起来是 GC 问题」。这份报告就是本周的产出物，也是毕业自评里「性能」那一维的材料。

:::error OutOfMemoryError: Java heap space
```text
java.lang.OutOfMemoryError: Java heap space
Dumping heap to java_pid1234.hprof ...
```
**根因三类**：一次查太多（`findAll()` 没分页、一次性 `readAllBytes`）；集合只加不清（本地缓存无上限）；真泄漏（静态 Map 里存了请求对象）。**定位顺序**：先看报错时的堆占用与 `-Xmx`，再 `jcmd <pid> GC.class_histogram | head -20` 看实例数与总字节最大的类，最后用 MAT 打开 hprof 看 GC Root 引用链。**别做**：第一反应调大 `-Xmx`，那只是把 OOM 推迟到流量更大的时候。
:::

**自测**（合上文档回答）

1. `480M->470M(512M) 3800ms` 这三个数字分别说明什么？为什么此时不该先调大 `-Xmx`？
2. `BLOCKED`、`WAITING`、`TIMED_WAITING` 各是什么场景？为什么单次 `jstack` 快照可能误导？
3. 采样与插桩的区别？拿到 CPU 热点比例后，怎么落到具体代码行并验证改好了？

**验收**（毕业自评：每条都要有可复现的证据，不接受「理解了」）

- [ ] 一页诊断报告：现象、证据（GC 日志行 / 栈 / 火焰图）、根因、修复、回归数据
- [ ] 报出自己服务的 Young GC 次数、单次停顿、有无 Full GC，并贴出对应日志行
- [ ] 制造一次死锁，用 `jstack` 指出 `held by` 环路，说出修复方式并验证不再复现
- [ ] 用 JFR 或 async-profiler 给出 CPU 占比最高的三个方法，落到一处代码改动，改后 P95 有前后对比
- [ ] 制造一次 OOM（或读一次现成 hprof），用 `GC.class_histogram` 说出占用最大的类
- [ ] 五维自评至少四维各有 1 条证据：设计（链路图或表结构）、正确性（测试数）、性能（QPS/P95）、可维护（README 与回滚步骤）、交付（一次真实上线）
- [ ] 重做开篇 7 题能力定位，现场答对至少 6 题且每题能举本周的例子

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

**相关项目**（点开即可看完整需求与参考实现）：
[订单与库存](/admin/study/projects?p=java/order-inventory) ·
[库存预占与超时释放](/admin/study/projects?p=java/stock-reservation) ·
[支付回调与日终对账](/admin/study/projects?p=java/payment-reconcile) ·
[退款与分账对账](/admin/study/projects?p=java/refund-settlement) ·
[多租户数据隔离](/admin/study/projects?p=java/multi-tenant-isolation) ·
[审批流引擎](/admin/study/projects?p=java/approval-workflow) ·
[百万行报表导出](/admin/study/projects?p=java/report-export)

每个项目末尾都有**「验收脚本」**折叠块：复制到本地，把 `BASE` 指向你的服务就能跑一遍验收。

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
