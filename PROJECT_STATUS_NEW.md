# AutoTestDesign 项目完成情况对照表

> 对照 `软件测试课程期末项目要求.md` 中的 FR1-FR9 编号整理。目标应用为 `newbee-mall`，当前导出结果位于 `results/`。

---

## 一、课程功能性需求完成情况

| 编号 | 功能类别 | 课程要求摘要 | 当前实现状态 | 实现与证据 |
|:---:|:---|:---|:---:|:---|
| FR1 | 输入/解析 | 从 CSV、纯文本或直接用户输入等来源导入软件需求 | ✅ 已完成 | 前端支持上传 `.xlsx/.csv/.txt` 与手工粘贴文本；后端接口 `POST /api/projects/{id}/requirements/import` 解析并写入 `requirements`。当前 `results/autotestdesign-1.json` 中有 70 条需求。 |
| FR2 | 需求结构化 | 解析原始文本，识别输入字段、数据范围、条件、预期动作等关键组成部分 | ✅ 已完成 | 后端接口 `POST /api/projects/{id}/requirements/structure` 生成 `input_fields`、`data_ranges`、`conditions_text`、`expected_actions`、`expected_results`、`risk_hints` 等结构化字段。 |
| FR3 | 风险分析与优先级排序 | 为每条需求分配风险评分和 High/Medium/Low 优先级 | ✅ 已完成 | 后端接口 `POST /api/projects/{id}/risk/analyze` 生成风险矩阵。当前导出中 70 条风险评估：High 40、Medium 25、Low 5。 |
| FR4 | 黑盒测试设计 | 自动应用并生成至少三种 ISO 29119-4 核心黑盒技术的测试用例 | ✅ 已完成 | 已覆盖等价类划分、边界值分析、决策表，并扩展状态转换、风险驱动等方法。当前导出中 156 条测试用例，其中等价类 70、边界值 27、决策表 4、状态转换 43。 |
| FR5* | 白盒测试建模 | 对系统行为建模，并根据覆盖准则生成测试序列 | ✅ 已实现基础能力 | 后端接口 `POST /api/projects/{id}/white-box/model` 生成购物车/订单状态模型，包含 Cart Empty、Order Created、Pending Payment、Paid、Shipped、Closed 等状态及转换建议。当前导出中有 1 个白盒模型。 |
| FR6* | 测试预言生成 | 针对需求和测试数据合成预期结果 | ✅ 已完成基础能力 | 测试用例生成阶段输出 `expected_result` 和 `oracle_explanation`；前端支持人工审查和修订测试预言。 |
| FR7 | 输出与导出 | 以 JSON、Excel/CSV 等结构化格式生成测试工件 | ✅ 已完成 | 后端接口 `POST /api/projects/{id}/exports/{format}` 支持 JSON、CSV、XLSX。导出内容包括需求、风险、覆盖项、策略、测试用例、优化套件、Prompt 记录、人工审查记录、执行证据。 |
| FR8* | 测试套件优化 | 基于风险或覆盖效率对测试套件排序或最小化 | ✅ 已完成 | 后端接口 `POST /api/projects/{id}/suite/optimize` 生成 Full Suite、High Risk Suite、Minimal Coverage Suite。当前导出中 Full 156 条；High Risk 108 条，减少 30.8%；Minimal Coverage 126 条，减少 19.2%。 |
| FR9 | 交互式审查能力 | 允许设计者审查、修订、更改覆盖项、策略、测试用例，并基于证据改进 | ✅ 已实现，需演示时实际操作留痕 | 前端已支持修改覆盖项、策略、测试用例字段，新增 evidence-based 覆盖项和测试用例，并在 Execution Evidence 中记录目标应用执行证据；后端通过 `PATCH /api/review-items/{id}`、`POST /api/projects/{id}/review-items`、`POST /api/projects/{id}/execution-evidence` 保存记录。注意：当前 `results/autotestdesign-1.json` 中 `reviewRevisions=0`、`executionEvidence=0`，说明导出文件是在 FR9 操作留痕前生成的。建议完成 FR9 演示操作后重新导出。 |

> `*` 为课程选做加分项。当前项目对 FR5、FR6、FR8 均有实现，其中 FR8 最完整，FR5/FR6 更适合作为“加分能力/基础实现”展示。

---

## 二、当前导出结果概览

| 工件 | 当前数量 | 说明 |
|:---|---:|:---|
| Requirements | 70 | 来自 `newbee-mall/NewBeeMall_Testable_Areas.xlsx` |
| Risk Assessments | 70 | 每条需求 1 条风险评估 |
| Coverage Items | 156 | 覆盖有效输入、无效输入、边界、状态转换、权限/安全、数据一致性、错误处理、性能/NFR |
| Coverage Strategies | 156 | 每个覆盖项对应策略与测试技术 |
| Test Cases | 156 | 包含步骤、测试数据、预期结果、预言解释、可追溯性 |
| White-box Models | 1 | 购物车与订单状态模型 |
| Suite Variants | 3 | Full / High Risk / Minimal Coverage |
| Prompt Runs | 7 | 记录各生成阶段的提示词调用或 fallback |
| Review Revisions | 0 | 当前导出尚未包含 FR9 人工修改留痕，需进行 FR9 运行，运行方法参见 [说明：关于 FR9 交互式审查能力 的运行演示](文档大纲与演示脚本.md) |
| Execution Evidence | 0 | 当前导出尚未包含目标应用执行证据，需进行 FR9 运行，运行方法参见 [说明：关于 FR9 交互式审查能力 的运行演示](文档大纲与演示脚本.md) |

---

## 三、风险分析结果

| 优先级 | 数量 | 占比/说明 |
|:---:|---:|:---|
| High | 40 | 集中在搜索安全、文件上传、CSRF/未授权修改、订单/库存/支付、后台权限等高影响模块 |
| Medium | 25 | 多为普通业务流程、管理功能、页面行为和输入校验 |
| Low | 5 | 影响范围较小或可检测性较高的功能 |

重点高风险需求示例：

| 需求编号 | 模块 | 风险点 | 风险分数 | 优先级 |
|:---|:---|:---|---:|:---:|
| TA-004 | 商品搜索 | SQL 注入、特殊字符、分页边界、搜索输入安全 | 25 | High |
| TA-053 | 商品管理 | 图片/富文本上传、非图片、超大文件、路径穿越 | 25 | High |
| TA-067 | CSRF/未授权状态修改 | POST/PUT/DELETE 未授权修改与伪造请求 | 25 | High |
| TA-028 | 订单生成 | 下单、扣库存、清购物车、事务一致性 | 20 | High |
| TA-035 | 支付成功回调 | 重复回调、非法 payType、支付状态错误 | 20 | High |
| TA-038 | 后台权限 | 未登录访问后台、权限绕过 | 20 | High |
| TA-070 | 库存与订单事务一致性 | 下单、取消、关闭订单中的库存一致性 | 20 | High |

---

## 四、测试设计方法覆盖情况

| 测试方法 | 当前用例数 | 对应要求 | 适用场景 |
|:---|---:|:---:|:---|
| Equivalence Partitioning（等价类划分） | 70 | FR4 | 登录、注册、搜索、商品状态、订单状态、后台表单 |
| Boundary Value Analysis（边界值分析） | 27 | FR4 | 分页、购物车数量、商品价格、库存、rank、ids 数组 |
| Decision Table（决策表） | 4 | FR4 | 权限、订单状态、支付方式、输入组合 |
| State Transition Testing（状态转换测试） | 43 | FR5* / 扩展方法 | 购物车、订单、支付、配货、出库、关闭订单 |
| Statement/Branch/Path Coverage（语句/分支/路径覆盖） | 7 | FR5* / 扩展方法 | 状态判断、异常分支、权限分支 |
| Risk-based Prioritization（风险驱动优先） | 5 | FR3 / FR8* | 高风险安全与交易路径优先执行 |

---

## 五、AI 流水线与接口完成情况

| 阶段 | API 端点 | 数据表 | 当前结果 | 状态 |
|:---|:---|:---|---:|:---:|
| 1. 创建项目 | `POST /api/projects` | `projects` | 1 个项目 | ✅ |
| 2. 需求导入 | `POST /api/projects/{id}/requirements/import` | `requirements` | 70 条 | ✅ |
| 3. 需求结构化 | `POST /api/projects/{id}/requirements/structure` | `requirements` | 70 条 | ✅ |
| 4. 风险分析 | `POST /api/projects/{id}/risk/analyze` | `risk_assessments` | 70 条 | ✅ |
| 5. 覆盖项识别 | `POST /api/projects/{id}/coverage/generate` | `coverage_items` | 156 条 | ✅ |
| 6. 策略生成 | `POST /api/projects/{id}/strategies/generate` | `coverage_strategies` | 156 条 | ✅ |
| 7. 测试用例生成 | `POST /api/projects/{id}/test-cases/generate` | `test_cases` | 156 条 | ✅ |
| 8. 白盒建模 | `POST /api/projects/{id}/white-box/model` | `whitebox_models` | 1 条 | ✅ |
| 9. 套件优化 | `POST /api/projects/{id}/suite/optimize` | `suite_variants` | 3 条 | ✅ |
| 10. 人工审查修改 | `PATCH /api/review-items/{id}` | `review_revisions` | 功能已实现 | ✅ |
| 11. 新增改进项 | `POST /api/projects/{id}/review-items` | `coverage_items` / `test_cases` / `review_revisions` | 功能已实现 | ✅ |
| 12. 执行证据记录 | `POST /api/projects/{id}/execution-evidence` | `execution_evidence` | 功能已实现 | ✅ |
| 13. 导出工件 | `POST /api/projects/{id}/exports/{format}` | `export_artifacts` | JSON/CSV/XLSX | ✅ |

---

## 六、测试套件优化结果（FR8*）

| 套件名称 | 原始用例数 | 优化后用例数 | 删除用例数 | 减少比例 | 覆盖说明 |
|:---|---:|---:|---:|---:|:---|
| Full Suite | 156 | 156 | 0 | 0% | 保留全部用例，适合完整验收和审计 |
| High Risk Suite | 156 | 108 | 48 | 30.8% | 优先保留高风险需求相关用例，适合高风险快速回归 |
| Minimal Coverage Suite | 156 | 126 | 30 | 19.2% | 保留需求覆盖、技术覆盖和高风险覆盖，适合压缩回归 |

优化逻辑：

1. Full Suite 保留所有生成用例，用作完整基线。
2. High Risk Suite 根据风险优先级和测试用例优先级筛选高风险相关用例。
3. Minimal Coverage Suite 使用贪心策略保留每个需求的代表性用例，并补齐测试技术与高风险覆盖。

---

## 七、导出功能完成情况（FR7）

| 导出格式 | API 端点 | 内容 | 状态 |
|:---|:---|:---|:---:|
| JSON | `POST /api/projects/{id}/exports/json` | 全量项目快照，适合追溯和归档 | ✅ |
| CSV | `POST /api/projects/{id}/exports/csv` | 测试用例表，适合导入测试管理工具 | ✅ |
| XLSX | `POST /api/projects/{id}/exports/xlsx` | 多 Sheet 测试工件，适合课程报告和展示 | ✅ |

XLSX 导出包含：

- Requirements
- Risk Matrix
- Coverage Matrix
- Strategies
- Test Cases
- Optimized Suites
- Execution Evidence
- Prompt Runs
- Review Changes

---

## 八、FR9 交互式审查与执行证据说明

当前程序已支持以下 FR9 操作：

1. 修改覆盖项：`coverage_type`、`description`、`rationale`。
2. 修改策略：`techniques`、`rationale`。
3. 修改测试用例：`technique`、`steps`、`expected_result`、`traceability`。
4. 新增基于证据的覆盖项。
5. 新增基于证据的测试用例。
6. 记录目标应用执行证据，包括测试框架、执行命令、PASS/FAIL、期望结果、实际结果、证据文本、缺陷编号和改进动作。

当前 `results/autotestdesign-1.json` 中 `reviewRevisions=0`、`executionEvidence=0`，因此建议在最终提交前执行一次 FR9 操作并重新导出：

1. 在前端 `Risk & Coverage` 页面修改 1 个覆盖项并保存。
2. 在 `Strategy Map` 修改 1 个策略并保存。
3. 在 `Evidence-Based Coverage Improvement` 新增 1 个覆盖项。
4. 在 `Test Cases` 页面修改 1 个测试用例并保存。
5. 在 `Evidence-Based Test Case Improvement` 新增 1 个测试用例。
6. 在 `Execution Evidence` 页面录入一次 `newbee-mall/tools/smoke_test_newbee.py` 或手工测试执行结果。
7. 重新导出 JSON、CSV、XLSX，替换 `results/` 中旧结果。

这样最终导出文件中应出现：

- `reviewRevisions > 0`
- `executionEvidence > 0`

---

## 九、非功能性需求完成情况

| 非功能类别 | 当前实现 | 说明 |
|:---|:---:|:---|
| 性能 | ✅ 基础支持 | 生成过程分阶段执行，可单步或一键运行；高风险/最小覆盖套件可减少回归执行规模。最终报告中应补充生成耗时或演示观察。 |
| 可用性（UX/UI） | ✅ 已实现 | 前端提供项目创建、需求导入、流水线执行、分区审查、执行证据、导出等完整工作台页面。 |
| 安全性 | ✅ 基础支持 | 风险分析和覆盖项中包含权限、CSRF、上传、SQL 注入、XSS 等安全测试点；后端人工修改接口使用字段白名单。 |
| 可维护性与技术 | ✅ 已实现 | Spring Boot 后端、Next.js 前端、MySQL 数据模型分层清晰；支持 LLM fallback，便于离线演示。 |

---

## 十、运行与验证命令

后端测试：

```bash
cd autotest-design/backend
./mvnw test
```

前端检查：

```bash
cd autotest-design/frontend
npm run typecheck
npm run lint
npm run build
```

目标应用执行证据建议：

```bash
cd newbee-mall
python3 tools/smoke_test_newbee.py
```

将脚本输出录入前端 `Execution Evidence` 页面后重新导出结果。

---

## 十一、与被测系统关联

| 被测系统 | 类型 | 导入文件 | 需求数量 |
|:---|:---|:---|---:|
| newbee-mall | 电商 Web 应用 | `newbee-mall/NewBeeMall_Testable_Areas.xlsx` | 70 |

主要模块：

- 首页
- 商品分类
- 商品搜索
- 商品详情
- 会员注册/登录/验证码
- 个人中心
- 购物车
- 订单生成/取消/详情/确认收货
- 支付
- 后台登录/权限
- 商品管理
- 订单管理
- 会员管理
- 安全与非功能测试项

---

## 十二、完成度总结

| 维度 | 状态 | 说明 |
|:---|:---:|:---|
| 必做功能 FR1-FR4、FR7、FR9 | ✅ 已实现 | FR9 需要通过前端实际操作并重新导出，形成最终证据。 |
| 选做功能 FR5、FR6、FR8 | ✅ 已实现基础/增强能力 | FR8 完整；FR5/FR6 可作为加分项展示。 |
| 目标应用关联 | ✅ 已完成 | 使用 `newbee-mall` 作为独立被测应用，导入 70 条测试需求。 |
| 测试技术覆盖 | ✅ 已完成 | 覆盖等价类、边界值、决策表，并扩展状态转换、分支/路径、风险驱动。 |
| 导出工件 | ✅ 已完成 | 支持 JSON、CSV、XLSX，`results/` 中已有当前导出。 |
| 执行验证证据 | ⚠️ 功能已实现，当前导出待补录 | 需在前端 Execution Evidence 页面录入一次执行结果后重新导出。 |

---

## 十三、结论

项目已按照 `软件测试课程期末项目要求.md` 中 FR1-FR9 重新对齐。当前工具功能层面已覆盖课程必做要求，并实现了三个选做能力的基础或完整版本。

最终提交前的重点是：完成一次 FR9 人工审查操作和一次目标应用执行证据录入，然后重新导出 `results` 文件。这样文档、演示视频和答辩展示中的“交互式审查能力”和“目标应用执行验证”都有可追溯数据支撑。

---

*文档更新时间：2026-05-26*
*项目版本：AutoTestDesign Backend 0.1.0 / Frontend 0.1.0*
