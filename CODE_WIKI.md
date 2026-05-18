# AutoTestDesign Code Wiki

## 项目概述

AutoTestDesign 是一款由 AI 驱动的测试设计工作台，集成需求分析、风险评估、覆盖率识别、测试策略生成、测试用例生成、白盒建模、测试套件优化及多格式导出等功能。系统遵循 ISTQB/ISO 29119 标准，支持人类评审与可追溯性管理。

---

## 1. 技术栈

### 1.1 前端
- **框架**: Next.js 16.2.6 (App Router)
- **语言**: TypeScript 5.7.2
- **UI 库**: Lucide React (图标)
- **构建**: Turbopack (开发) / Webpack (生产)

### 1.2 后端
- **框架**: Spring Boot 3.3.5
- **语言**: Java 21
- **数据库**: MySQL (JDBC)
- **HTTP**: Spring Web + RestClient

### 1.3 AI 集成
- **LLM**: OpenAI-compatible API (DeepSeek V4)
- **协议**: Chat Completions API
- **fallback**: 当 API Key 未配置时使用确定性降级算法

---

## 2. 项目架构

```
FINAL/
├── autotest-design/          # AI 测试设计工作台 (主项目)
│   ├── backend/             # Spring Boot 后端
│   │   ├── src/main/java/edu/autotestdesign/
│   │   │   ├── AutoTestDesignApplication.java   # 应用入口
│   │   │   ├── api/ApiController.java            # REST API 控制器
│   │   │   ├── service/
│   │   │   │   ├── AutoTestDesignService.java   # 核心业务逻辑
│   │   │   │   └── LlmClient.java               # LLM 调用客户端
│   │   │   └── config/CorsConfig.java           # 跨域配置
│   │   └── src/main/resources/
│   │       ├── application.yml                   # 配置文件
│   │       └── schema.sql                        # 数据库 Schema
│   └── frontend/            # Next.js 前端
│       └── app/
│           ├── page.tsx                         # 主页面组件
│           ├── layout.tsx                       # 根布局
│           └── globals.css                      # 全局样式
└── newbee-mall/             # 被测系统 (参考项目)
    └── NewBeeMall_Testable_Areas.xlsx           # 测试区域导入文件
```

---

## 3. 数据库设计

### 3.1 核心表结构

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `projects` | 测试项目 | id, name, description, target_app |
| `requirements` | 需求项 | id, requirement_key, raw_text, module, role_name, expected_results |
| `risk_assessments` | 风险评估 | id, requirement_id, impact, likelihood, complexity, detectability, risk_score, priority |
| `coverage_items` | 覆盖率项 | id, requirement_id, coverage_type, description |
| `coverage_strategies` | 测试策略 | id, coverage_item_id, techniques |
| `test_cases` | 测试用例 | id, test_case_key, technique, priority, steps, expected_result |
| `whitebox_models` | 白盒模型 | id, name, states_json, transitions_json |
| `suite_variants` | 测试套件变体 | id, variant_name, test_case_ids_json |
| `prompt_runs` | Prompt 运行记录 | id, stage, model, prompt, success |
| `review_revisions` | 评审修改记录 | id, item_type, item_id, field_name, old_value, new_value |
| `export_artifacts` | 导出产物 | id, format, file_name, content |

### 3.2 数据关联

```
projects (1) ──┬── (*) requirements ── (*) risk_assessments
              │            │
              │            └── (*) coverage_items ── (*) coverage_strategies
              │
              ├── (*) test_cases ── (*) suite_variants
              │
              ├── (*) whitebox_models
              ├── (*) prompt_runs
              ├── (*) review_revisions
              └── (*) export_artifacts
```

---

## 4. 后端模块详解

### 4.1 入口类

**AutoTestDesignApplication.java**

- **包**: `edu.autotestdesign`
- **功能**: Spring Boot 应用启动类
- **关键方法**:
  - `main(String[] args)`: 启动应用

### 4.2 API 控制器

**ApiController.java**

- **包**: `edu.autotestdesign.api`
- **注解**: `@RestController`, `@RequestMapping("/api")`
- **依赖注入**: `AutoTestDesignService`

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/projects` | POST | 创建项目 |
| `/api/projects` | GET | 列出所有项目 |
| `/api/projects/{id}` | GET | 获取项目快照 |
| `/api/projects/{id}/requirements/import` | POST | 导入需求 |
| `/api/projects/{id}/requirements/structure` | POST | 结构化需求 |
| `/api/projects/{id}/risk/analyze` | POST | 分析风险 |
| `/api/projects/{id}/coverage/generate` | POST | 生成覆盖率项 |
| `/api/projects/{id}/strategies/generate` | POST | 生成测试策略 |
| `/api/projects/{id}/test-cases/generate` | POST | 生成测试用例 |
| `/api/projects/{id}/white-box/model` | POST | 生成白盒模型 |
| `/api/projects/{id}/suite/optimize` | POST | 优化测试套件 |
| `/api/review-items/{id}` | PATCH | 评审修改 |
| `/api/projects/{id}/exports/{format}` | POST | 导出项目 |

### 4.3 核心业务服务

**AutoTestDesignService.java**

- **包**: `edu.autotestdesign.service`
- **依赖**: `JdbcTemplate`, `ObjectMapper`, `LlmClient`
- **功能**: 核心业务逻辑处理

#### 主要方法:

| 方法 | 说明 |
|------|------|
| `createProject(Map)` | 创建新项目 |
| `listProjects()` | 列出所有项目 |
| `projectSnapshot(long)` | 获取项目完整快照 |
| `importRequirements(long, file, text, sourceType)` | 导入需求 (支持 XLSX/CSV/TXT) |
| `structureRequirements(long, model)` | LLM 结构化需求 |
| `analyzeRisk(long, model)` | 风险分析 |
| `generateCoverage(long, model)` | 覆盖率识别 |
| `generateStrategies(long, model)` | 测试策略生成 |
| `generateTestCases(long, model)` | 测试用例生成 |
| `generateWhiteBoxModel(long, model)` | 白盒状态建模 |
| `optimizeSuite(long)` | 测试套件优化 |
| `patchReviewItem(long, Map)` | 评审项修改 |
| `exportProject(long, format)` | 导出项目 (JSON/CSV/XLSX) |

#### Fallback 降级算法:

| 方法 | 触发条件 | 行为 |
|------|----------|------|
| `fallbackStructured()` | LLM 调用失败 | 推断模块/角色/输入/风险 |
| `fallbackRisk()` | LLM 调用失败 | 基于关键词计算风险分数 |
| `fallbackCoverage()` | LLM 调用失败 | 生成 valid/invalid/state transition 覆盖率项 |
| `fallbackStrategies()` | LLM 调用失败 | 根据覆盖率类型选择技术 |
| `fallbackTestCases()` | LLM 调用失败 | 生成标准测试用例模板 |

#### 测试技术常量:

```java
List.of(
    "Equivalence Partitioning",           // 等价类划分
    "Boundary Value Analysis",            // 边界值分析
    "Decision Table",                     // 判定表
    "State Transition Testing",           // 状态转换测试
    "Statement/Branch/Path Coverage",     // 语句/分支/路径覆盖
    "Risk-based Prioritization"           // 风险驱动优先
)
```

#### 套件优化策略:

1. **Full Suite**: 保留所有生成的测试用例
2. **High Risk Suite**: 高风险相关用例优先
3. **Minimal Coverage Suite**: 
   - 每个需求保留一个最强代表性用例
   - 确保所有测试技术都被覆盖
   - 保留所有高风险用例

### 4.4 LLM 客户端

**LlmClient.java**

- **包**: `edu.autotestdesign.service`
- **注解**: `@Component`
- **功能**: 与 DeepSeek API 交互

| 方法 | 说明 |
|------|------|
| `configured()` | 检查 API Key 是否配置 |
| `model(requestedModel)` | 获取活跃模型名称 |
| `generateJson(systemPrompt, userPrompt)` | 生成 JSON 响应 |
| `generateJson(systemPrompt, userPrompt, requestedModel)` | 指定模型生成 |

- **默认配置**:
  - Model: `deepseek-v4-flash`
  - Temperature: `0.2`
  - Timeout: `90s`
  - API: `/chat/completions`

### 4.5 跨域配置

**CorsConfig.java**

- **包**: `edu.autotestdesign.config`
- **允许来源**: `http://localhost:28111` (前端)
- **允许方法**: GET, POST, PATCH, PUT, DELETE, OPTIONS
- **暴露头**: Content-Disposition

---

## 5. 前端模块详解

### 5.1 应用入口

**layout.tsx**

- **功能**: 根布局组件，配置元数据
- **元数据**: 标题 "AutoTestDesign"，描述 "AI-driven test design workbench"

### 5.2 主页面

**page.tsx**

- **组件类型**: `"use client"` (客户端组件)
- **主要功能模块**:

#### 状态管理:

| 状态 | 类型 | 说明 |
|------|------|------|
| `projectName` | string | 项目名称 |
| `targetApp` | string | 目标应用 |
| `description` | string | 测试概念描述 |
| `projectId` | number | 当前项目 ID |
| `snapshot` | Snapshot | 项目数据快照 |
| `manualText` | string | 手动输入文本 |
| `file` | File | 上传文件 |
| `busy` | string | 当前操作状态 |
| `error` | string | 错误信息 |
| `selectedModel` | string | 选中的 LLM 模型 |
| `activeView` | ViewId | 当前视图 |
| `sidebarWidth` | number | 侧边栏宽度 |

#### 视图区域:

| ViewId | 标签 | 功能 |
|--------|------|------|
| `overview` | Overview | 项目设置、导入、AI 流水线 |
| `requirements` | Requirements | 结构化需求和评审 |
| `analysis` | Risk & Coverage | 风险矩阵、覆盖率项、策略 |
| `cases` | Test Cases | 测试用例和评审 |
| `models` | Artifacts & Export | 白盒模型、套件、导出 |
| `logs` | Prompt Log | Prompt 运行日志 |

#### 核心函数:

| 函数 | 功能 |
|------|------|
| `api(path, init)` | 封装 API 调用 |
| `createProject()` | 创建项目 |
| `importRequirements()` | 导入需求 |
| `generate(path, label, nextView)` | 调用后端生成接口 |
| `exportFile(format)` | 导出文件 |
| `patchItem(itemType, id, field, value)` | 更新评审项 |
| `refresh(id)` | 刷新项目数据 |
| `run(label, action)` | 执行操作并管理 busy 状态 |

### 5.3 组件结构

#### PanelTable 组件
- **功能**: 通用数据表格展示
- **Props**: `title`, `subtitle`, `rows`, `columns`, `editable`
- **特性**: 
  - 可编辑单元格
  - Priority/Status 徽章样式
  - 空状态处理

#### SuiteOptimizer 组件
- **功能**: 测试套件优化展示
- **显示内容**:
  - 原始/优化/删除用例数
  - 覆盖率统计 (需求、技术、高风险)
  - 选择原因

#### EditableCell 组件
- **功能**: 可编辑表格单元格
- **支持**: 单行输入、多行文本编辑
- **操作**: 保存修改到后端

### 5.4 样式系统

**globals.css**

- **设计风格**: 深色侧边栏 + 浅色主内容区
- **配色方案**:
  - 主色: `#12715f` (深青绿)
  - 强调: `#b56f18` (琥珀色), `#2f5f9b` (蓝色)
  - 背景: `#eef2ef` (浅灰绿)
  - 侧边栏: `#15211e` (深墨绿)
- **圆角**: `8px`
- **阴影**: 多层次柔和阴影效果

---

## 6. API 接口详解

### 6.1 项目管理

#### 创建项目
```
POST /api/projects
Content-Type: application/json

Body: {
  "name": "project-name",
  "description": "description",
  "targetApp": "target-app"
}

Response: {
  "id": 1,
  "name": "...",
  "created_at": "..."
}
```

#### 获取项目快照
```
GET /api/projects/{id}

Response: {
  "project": {...},
  "requirements": [...],
  "riskAssessments": [...],
  "coverageItems": [...],
  "coverageStrategies": [...],
  "testCases": [...],
  "whiteboxModels": [...],
  "suiteVariants": [...],
  "promptRuns": [...],
  "reviewRevisions": [...]
}
```

### 6.2 需求导入

#### 导入需求
```
POST /api/projects/{id}/requirements/import
Content-Type: multipart/form-data

Params:
  - file: Excel/CSV/TXT 文件
  - manualText: 手动输入文本
  - sourceType: "xlsx" | "csv" | "txt" | "manual"
```

**支持的 Excel 表头** (NewBeeMall_Testable_Areas.xlsx):
- `ID` / `Requirement ID`
- `模块` / `Module` / `系统区域`
- `入口页面/API` / `Endpoint`
- `前置条件/角色` / `Role`
- `可测试功能点` / `Requirement Description` / `Description`
- `典型测试点`

### 6.3 AI 生成流水线

#### 结构化需求
```
POST /api/projects/{id}/requirements/structure
Content-Type: application/json

Body: { "model": "deepseek-v4-flash" }
```

#### 风险分析
```
POST /api/projects/{id}/risk/analyze
Content-Type: application/json

Body: { "model": "deepseek-v4-flash" }
```

#### 生成覆盖率项
```
POST /api/projects/{id}/coverage/generate
Content-Type: application/json

Body: { "model": "deepseek-v4-flash" }
```

#### 生成测试策略
```
POST /api/projects/{id}/strategies/generate
Content-Type: application/json

Body: { "model": "deepseek-v4-flash" }
```

#### 生成测试用例
```
POST /api/projects/{id}/test-cases/generate
Content-Type: application/json

Body: { "model": "deepseek-v4-flash" }
```

#### 生成白盒模型
```
POST /api/projects/{id}/white-box/model
Content-Type: application/json

Body: { "model": "deepseek-v4-flash" }
```

#### 优化测试套件
```
POST /api/projects/{id}/suite/optimize
```

### 6.4 评审与导出

#### 修改评审项
```
PATCH /api/review-items/{id}
Content-Type: application/json

Body: {
  "itemType": "requirement" | "risk" | "coverage" | "strategy" | "testCase",
  "fieldName": "expected_results",
  "newValue": "new content",
  "note": "Human review update"
}
```

#### 导出项目
```
POST /api/projects/{id}/exports/{format}

format: json | csv | xlsx

Response: 文件下载
```

---

## 7. 配置说明

### 7.1 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AUTOTEST_DB_URL` | `jdbc:mysql://localhost:3306/autotest_design_db?...` | 数据库连接 URL |
| `AUTOTEST_DB_USER` | `root` | 数据库用户名 |
| `AUTOTEST_DB_PASSWORD` | `123456` | 数据库密码 |
| `LLM_BASE_URL` | `https://api.deepseek.com` | LLM API 地址 |
| `LLM_API_KEY` | `your-deepseek-key` | LLM API Key |
| `LLM_MODEL` | `deepseek-v4-flash` | 默认模型 |
| `LLM_TIMEOUT_SECONDS` | `90` | LLM 超时时间 |
| `AUTOTEST_CORS_ORIGIN` | `http://localhost:28111` | 允许的跨域来源 |

### 7.2 端口配置

| 服务 | 端口 |
|------|------|
| 后端 | 28110 |
| 前端 | 28111 |

---

## 8. 运行方式

### 8.1 后端启动

```powershell
cd E:\College\3down\ST\FINAL\autotest-design\backend
mvn spring-boot:run
```

健康检查: http://localhost:28110/api/health

### 8.2 前端启动

```powershell
cd E:\College\3down\ST\FINAL\autotest-design\frontend
npm install
npm run dev
```

访问地址: http://localhost:28111

### 8.3 演示流程

1. 创建项目 `newbee-mall`
2. 导入 `newbee-mall/NewBeeMall_Testable_Areas.xlsx`
3. 依次执行: Structure → Risk → Coverage → Strategies → Test Cases → White-box → Optimize
4. 编辑至少两个评审项
5. 导出 JSON、CSV、Excel

---

## 9. 依赖关系

### 9.1 后端依赖 (pom.xml)

| 依赖 | 版本 | 用途 |
|------|------|------|
| `spring-boot-starter-web` | 3.3.5 | REST API |
| `spring-boot-starter-jdbc` | 3.3.5 | JDBC 访问 |
| `mysql-connector-j` | runtime | MySQL 驱动 |
| `poi-ooxml` | 5.3.0 | Excel 读写 |
| `commons-csv` | 1.12.0 | CSV 处理 |
| `spring-boot-starter-test` | 3.3.5 | 测试框架 |

### 9.2 前端依赖 (package.json)

| 依赖 | 版本 | 用途 |
|------|------|------|
| `next` | 16.2.6 | React 框架 |
| `react` | 19.2.6 | UI 库 |
| `lucide-react` | ^0.468.0 | 图标库 |

---

## 10. 测试设计方法论

### 10.1 支持的测试技术

| 技术 | 说明 | 适用场景 |
|------|------|----------|
| 等价类划分 | 将输入域划分为有效/无效等价类 | 输入验证 |
| 边界值分析 | 测试边界条件 | 数值范围 |
| 判定表 | 测试条件组合 | 业务规则 |
| 状态转换测试 | 测试状态迁移 | 工作流/订单 |
| 覆盖准则 | 语句/分支/路径覆盖 | 代码级测试 |
| 风险驱动 | 基于风险评估优先级 | 资源优化 |

### 10.2 覆盖率类型

| 类型 | 说明 |
|------|------|
| `valid input` | 有效输入验证 |
| `invalid input` | 无效/缺失数据 |
| `boundary` | 边界值条件 |
| `state transition` | 状态转换 |
| `permission/security` | 权限安全 |
| `data consistency` | 数据一致性 |
| `error handling` | 错误处理 |
| `performance/NFR` | 性能/非功能需求 |

### 10.3 风险评分算法

```
risk_score = impact * likelihood + complexity * detectability

优先级判定:
- High: risk_score >= 32
- Medium: 20 <= risk_score < 32
- Low: risk_score < 20
```

---

## 11. 文件结构总结

```
autotest-design/
├── backend/
│   ├── pom.xml                                    # Maven 配置
│   └── src/main/
│       ├── java/edu/autotestdesign/
│       │   ├── AutoTestDesignApplication.java    # 启动类
│       │   ├── api/
│       │   │   └── ApiController.java            # API 控制器 (21 个端点)
│       │   ├── service/
│       │   │   ├── AutoTestDesignService.java    # 核心服务 (902 行)
│       │   │   └── LlmClient.java                # LLM 客户端
│       │   └── config/
│       │       └── CorsConfig.java              # 跨域配置
│       └── resources/
│           ├── application.yml                   # 配置
│           └── schema.sql                        # 数据库 Schema
└── frontend/
    ├── package.json                              # npm 配置
    ├── next.config.js                           # Next.js 配置
    └── app/
        ├── layout.tsx                           # 根布局
        ├── page.tsx                             # 主页面 (693 行)
        └── globals.css                          # 全局样式 (903 行)
```
