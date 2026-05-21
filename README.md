# ST-Final

软件测试课程期末项目：AutoTestDesign，一个面向测试设计流程的 AI 辅助工作台。

项目围绕需求导入、风险分析、覆盖项识别、测试策略生成、测试用例生成、白盒模型、测试套件优化、人工评审和多格式导出等环节，形成一套可演示、可追踪的测试设计流程。

## 项目结构

```text
ST-Final/
├── autotest-design/
│   ├── backend/        # Spring Boot 后端
│   └── frontend/       # Next.js 前端
├── CODE_WIKI.md        # 代码与功能说明
├── PROJECT_STATUS.md   # 功能完成情况记录
└── README.md
```

`newbee-mall/` 是本项目演示用的被测系统/测试对象，保持为本地独立仓库，不纳入 `ST-Final` 的 Git 跟踪。

## 技术栈

- 后端：Spring Boot 3.3.5, Java 21, JDBC, MySQL, Apache POI, Commons CSV
- 前端：Next.js 16, React 19, TypeScript, Lucide React
- AI 接口：OpenAI-compatible Chat Completions API，默认配置指向 DeepSeek 兼容接口

## 核心功能

- 项目与需求管理
- 需求结构化与风险评估
- 覆盖项、测试策略和测试用例生成
- 白盒状态模型生成
- Full / High Risk / Minimal 三类测试套件优化
- 人工评审修改记录
- JSON / CSV / XLSX 导出
- Prompt 调用记录与可追踪管理

## 环境要求

- Java 21
- Maven
- Node.js 20+
- MySQL 8+

## 后端启动

```powershell
cd autotest-design/backend

# 可选：按本机数据库配置环境变量
$env:AUTOTEST_DB_URL="jdbc:mysql://localhost:3306/autotest_design_db?createDatabaseIfNotExist=true&useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true"
$env:AUTOTEST_DB_USER="root"
$env:AUTOTEST_DB_PASSWORD="123456"

# 可选：配置 LLM，未配置时系统使用确定性 fallback
$env:LLM_BASE_URL="https://api.deepseek.com"
$env:LLM_API_KEY="your-api-key"
$env:LLM_MODEL="deepseek-v4-flash"

./mvnw spring-boot:run
```

未安装全局 `mvn` 时，使用项目自带的 `./mvnw` 即可（首次运行会自动下载 Maven 3.9.9）。若已安装 Maven，也可改用 `mvn spring-boot:run`。

后端默认地址：`http://localhost:28110`

## 前端启动

```powershell
cd autotest-design/frontend
npm install
npm run dev
```

前端默认地址：`http://localhost:28111`

## 演示流程

1. 启动 MySQL、后端和前端。
2. 在系统中创建测试项目。
3. 导入测试对象的需求或测试区域数据。
4. 依次执行结构化、风险分析、覆盖生成、策略生成、用例生成、白盒建模和套件优化。
5. 进行人工评审修改。
6. 导出 JSON、CSV 或 XLSX 结果。

## 说明

- 根目录 `.gitignore` 已排除依赖、构建产物、运行日志、临时数据库文件以及本地测试对象目录。
- `CODE_WIKI.md` 和 `PROJECT_STATUS.md` 提供更详细的实现说明与课程要求对照。
