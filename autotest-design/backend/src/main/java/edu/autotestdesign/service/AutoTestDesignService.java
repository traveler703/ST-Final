package edu.autotestdesign.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AutoTestDesignService {
    private static final List<String> TECHNIQUES = List.of(
            "Equivalence Partitioning",
            "Boundary Value Analysis",
            "Decision Table",
            "State Transition Testing",
            "Statement/Branch/Path Coverage",
            "Risk-based Prioritization"
    );

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final LlmClient llm;

    public AutoTestDesignService(JdbcTemplate jdbc, ObjectMapper mapper, LlmClient llm) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.llm = llm;
    }

    public record ExportFile(String fileName, String contentType, byte[] content) {}

    public Map<String, Object> createProject(Map<String, Object> body) {
        String name = string(body.get("name"), "newbee-mall");
        String description = string(body.get("description"), "AI-assisted test design project");
        String targetApp = string(body.get("targetApp"), name);
        long id = insert("""
                INSERT INTO projects(name, description, target_app) VALUES (?, ?, ?)
                """, name, description, targetApp);
        return getProject(id);
    }

    public List<Map<String, Object>> listProjects() {
        return rows("SELECT * FROM projects ORDER BY updated_at DESC, id DESC");
    }

    public Map<String, Object> projectSnapshot(long projectId) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("project", getProject(projectId));
        snapshot.put("requirements", rows("SELECT * FROM requirements WHERE project_id=? ORDER BY id", projectId));
        snapshot.put("riskAssessments", rows("SELECT * FROM risk_assessments WHERE project_id=? ORDER BY id", projectId));
        snapshot.put("coverageItems", rows("SELECT * FROM coverage_items WHERE project_id=? ORDER BY id", projectId));
        snapshot.put("coverageStrategies", rows("SELECT * FROM coverage_strategies WHERE project_id=? ORDER BY id", projectId));
        snapshot.put("testCases", rows("SELECT * FROM test_cases WHERE project_id=? ORDER BY id", projectId));
        snapshot.put("whiteboxModels", rows("SELECT * FROM whitebox_models WHERE project_id=? ORDER BY id", projectId));
        snapshot.put("suiteVariants", suiteVariants(projectId));
        snapshot.put("promptRuns", rows("SELECT * FROM prompt_runs WHERE project_id=? ORDER BY id DESC", projectId));
        snapshot.put("reviewRevisions", rows("""
                SELECT rr.* FROM review_revisions rr
                WHERE EXISTS (SELECT 1 FROM requirements r WHERE r.id=rr.item_id AND rr.item_type='requirement' AND r.project_id=?)
                   OR EXISTS (SELECT 1 FROM risk_assessments r WHERE r.id=rr.item_id AND rr.item_type='risk' AND r.project_id=?)
                   OR EXISTS (SELECT 1 FROM coverage_items c WHERE c.id=rr.item_id AND rr.item_type='coverage' AND c.project_id=?)
                   OR EXISTS (SELECT 1 FROM test_cases t WHERE t.id=rr.item_id AND rr.item_type='testCase' AND t.project_id=?)
                ORDER BY rr.id DESC
                """, projectId, projectId, projectId, projectId));
        return snapshot;
    }

    public Map<String, Object> importRequirements(long projectId, MultipartFile file, String manualText, String sourceType) throws IOException {
        requireProject(projectId);
        List<Map<String, String>> imported = new ArrayList<>();
        if (file != null && !file.isEmpty()) {
            String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
            if (filename.endsWith(".xlsx")) {
                imported.addAll(parseXlsx(file));
                sourceType = "xlsx";
            } else if (filename.endsWith(".csv")) {
                imported.addAll(parseCsv(file));
                sourceType = "csv";
            } else {
                imported.addAll(parsePlainText(new String(file.getBytes(), StandardCharsets.UTF_8)));
                sourceType = "txt";
            }
        }
        if (manualText != null && !manualText.isBlank()) {
            imported.addAll(parsePlainText(manualText));
            sourceType = "manual";
        }
        int before = count("SELECT COUNT(*) FROM requirements WHERE project_id=?", projectId);
        int index = before + 1;
        for (Map<String, String> item : imported) {
            String key = item.getOrDefault("requirementId", "REQ-" + index);
            String raw = item.getOrDefault("rawText", "");
            String module = item.getOrDefault("module", "");
            String role = item.getOrDefault("role", "");
            String endpoint = item.getOrDefault("endpoint", "");
            if (raw.isBlank()) continue;
            jdbc.update("""
                    INSERT INTO requirements(project_id, requirement_key, raw_text, module, role_name, related_endpoints, source_type)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, projectId, key, raw, module, role, endpoint, sourceType);
            index++;
        }
        return Map.of("imported", imported.size(), "project", projectSnapshot(projectId));
    }

    public Map<String, Object> structureRequirements(long projectId, String model) {
        List<Map<String, Object>> requirements = rows("SELECT * FROM requirements WHERE project_id=? ORDER BY id", projectId);
        String prompt = """
                Structure each software requirement. Return JSON only: {"items":[{"id": database id number,
                "requirementKey":"...", "module":"...", "roleName":"...", "inputFields":"...",
                "dataRanges":"...", "conditions":"...", "expectedActions":"...", "expectedResults":"...",
                "relatedEndpoints":"...", "riskHints":"...", "confidence":0.0-1.0}]}.
                """;
        JsonNode out = generateOrFallback(projectId, "Requirement Structuring", prompt, requirements, model, () -> fallbackStructured(requirements));
        for (JsonNode item : arrayAt(out, "items")) {
            long id = item.path("id").asLong();
            jdbc.update("""
                    UPDATE requirements SET module=?, role_name=?, input_fields=?, data_ranges=?, conditions_text=?,
                    expected_actions=?, expected_results=?, related_endpoints=?, risk_hints=?, confidence=?, status='REVIEW'
                    WHERE id=? AND project_id=?
                    """,
                    text(item, "module"), text(item, "roleName"), text(item, "inputFields"),
                    text(item, "dataRanges"), text(item, "conditions"), text(item, "expectedActions"),
                    text(item, "expectedResults"), text(item, "relatedEndpoints"), text(item, "riskHints"),
                    item.path("confidence").asDouble(0.75), id, projectId);
        }
        return projectSnapshot(projectId);
    }

    public Map<String, Object> analyzeRisk(long projectId, String model) {
        jdbc.update("DELETE FROM risk_assessments WHERE project_id=?", projectId);
        List<Map<String, Object>> requirements = rows("SELECT * FROM requirements WHERE project_id=? ORDER BY id", projectId);
        String prompt = """
                Analyze risk for requirements. Return JSON only: {"items":[{"requirementId": database id,
                "impact":1-5, "likelihood":1-5, "complexity":1-5, "detectability":1-5,
                "riskScore": integer, "priority":"High|Medium|Low", "rationale":"..."}]}.
                Higher detectability means harder to detect.
                """;
        JsonNode out = generateOrFallback(projectId, "Risk Analysis", prompt, requirements, model, () -> fallbackRisk(requirements));
        for (JsonNode item : arrayAt(out, "items")) {
            long reqId = item.path("requirementId").asLong();
            jdbc.update("""
                    INSERT INTO risk_assessments(project_id, requirement_id, impact, likelihood, complexity,
                    detectability, risk_score, priority, rationale)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, projectId, reqId, item.path("impact").asInt(3), item.path("likelihood").asInt(3),
                    item.path("complexity").asInt(3), item.path("detectability").asInt(3),
                    item.path("riskScore").asInt(36), text(item, "priority", "Medium"), text(item, "rationale"));
        }
        return projectSnapshot(projectId);
    }

    public Map<String, Object> generateCoverage(long projectId, String model) {
        jdbc.update("DELETE FROM coverage_items WHERE project_id=?", projectId);
        List<Map<String, Object>> requirements = rows("SELECT * FROM requirements WHERE project_id=? ORDER BY id", projectId);
        String prompt = """
                Identify coverage items. Return JSON only: {"items":[{"requirementId": database id,
                "coverageType":"valid input|invalid input|boundary|state transition|permission/security|data consistency|error handling|performance/NFR",
                "description":"...", "rationale":"..."}]}.
                Generate 2-4 meaningful coverage items per requirement.
                """;
        JsonNode out = generateOrFallback(projectId, "Coverage Identification", prompt, requirements, model, () -> fallbackCoverage(requirements));
        for (JsonNode item : arrayAt(out, "items")) {
            jdbc.update("""
                    INSERT INTO coverage_items(project_id, requirement_id, coverage_type, description, rationale)
                    VALUES (?, ?, ?, ?, ?)
                    """, projectId, item.path("requirementId").asLong(), text(item, "coverageType", "valid input"),
                    text(item, "description"), text(item, "rationale"));
        }
        return projectSnapshot(projectId);
    }

    public Map<String, Object> generateStrategies(long projectId, String model) {
        jdbc.update("DELETE FROM coverage_strategies WHERE project_id=?", projectId);
        List<Map<String, Object>> coverage = rows("SELECT * FROM coverage_items WHERE project_id=? ORDER BY id", projectId);
        String prompt = """
                Choose test design techniques for coverage items. Return JSON only:
                {"items":[{"coverageItemId": database id, "techniques":"Technique A; Technique B", "rationale":"..."}]}.
                Use at least these across the whole project: Equivalence Partitioning, Boundary Value Analysis,
                Decision Table, State Transition Testing, Statement/Branch/Path Coverage, Risk-based Prioritization.
                """;
        JsonNode out = generateOrFallback(projectId, "Coverage Strategy", prompt, coverage, model, () -> fallbackStrategies(coverage));
        for (JsonNode item : arrayAt(out, "items")) {
            jdbc.update("""
                    INSERT INTO coverage_strategies(project_id, coverage_item_id, techniques, rationale)
                    VALUES (?, ?, ?, ?)
                    """, projectId, item.path("coverageItemId").asLong(), text(item, "techniques"), text(item, "rationale"));
        }
        return projectSnapshot(projectId);
    }

    public Map<String, Object> generateTestCases(long projectId, String model) {
        jdbc.update("DELETE FROM test_cases WHERE project_id=?", projectId);
        List<Map<String, Object>> input = rows("""
                SELECT c.id coverage_id, c.requirement_id, c.coverage_type, c.description coverage_description,
                       r.requirement_key, r.module, r.raw_text, s.techniques
                FROM coverage_items c
                JOIN requirements r ON r.id=c.requirement_id
                LEFT JOIN coverage_strategies s ON s.coverage_item_id=c.id
                WHERE c.project_id=?
                ORDER BY c.id
                """, projectId);
        String prompt = """
                Generate test cases. Return JSON only:
                {"items":[{"testCaseKey":"TC-001", "requirementId": database id, "coverageItemId": database id,
                "technique":"...", "priority":"High|Medium|Low", "preconditions":"...", "testData":"...",
                "steps":"...", "expectedResult":"...", "oracleExplanation":"...", "automationCandidate":"Yes|Partial|No",
                "traceability":"Requirement -> Coverage item -> Technique -> Test case"}]}.
                Create concise, executable test cases.
                """;
        JsonNode out = generateOrFallback(projectId, "Test Case Generation", prompt, input, model, () -> fallbackTestCases(input));
        int i = 1;
        for (JsonNode item : arrayAt(out, "items")) {
            jdbc.update("""
                    INSERT INTO test_cases(project_id, test_case_key, requirement_id, coverage_item_id, technique, priority,
                    preconditions, test_data, steps, expected_result, oracle_explanation, automation_candidate, traceability)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, projectId, text(item, "testCaseKey", "TC-" + String.format("%03d", i++)),
                    item.path("requirementId").asLong(), nullableLong(item.path("coverageItemId")),
                    text(item, "technique"), text(item, "priority", "Medium"), text(item, "preconditions"),
                    text(item, "testData"), text(item, "steps"), text(item, "expectedResult"),
                    text(item, "oracleExplanation"), text(item, "automationCandidate", "Yes"), text(item, "traceability"));
        }
        return projectSnapshot(projectId);
    }

    public Map<String, Object> generateWhiteBoxModel(long projectId, String model) {
        jdbc.update("DELETE FROM whitebox_models WHERE project_id=?", projectId);
        List<String> states = List.of("Cart Empty", "Cart Updated", "Order Created", "Pending Payment", "Paid", "Packed", "Shipped", "Finished", "Closed");
        List<Map<String, String>> transitions = List.of(
                Map.of("from", "Cart Empty", "to", "Cart Updated", "event", "Add product to cart"),
                Map.of("from", "Cart Updated", "to", "Order Created", "event", "Submit order"),
                Map.of("from", "Order Created", "to", "Pending Payment", "event", "Open payment selection"),
                Map.of("from", "Pending Payment", "to", "Paid", "event", "Payment success"),
                Map.of("from", "Paid", "to", "Packed", "event", "Admin marks order packed"),
                Map.of("from", "Packed", "to", "Shipped", "event", "Admin marks order shipped"),
                Map.of("from", "Shipped", "to", "Finished", "event", "Customer confirms receipt"),
                Map.of("from", "Pending Payment", "to", "Closed", "event", "Customer cancels order"),
                Map.of("from", "Paid", "to", "Closed", "event", "Admin closes order")
        );
        List<String> suggestions = List.of(
                "All States: cover every order/cart state at least once.",
                "All Transitions: execute each transition, including cancel/close branches.",
                "Branch Coverage: verify success and failure branches for stock, address, permission, and order status checks."
        );
        jdbc.update("""
                INSERT INTO whitebox_models(project_id, name, states_json, transitions_json, coverage_suggestions_json)
                VALUES (?, ?, CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON))
                """, projectId, "Cart and Order State Model", json(states), json(transitions), json(suggestions));
        logPrompt(projectId, "White-box Modeling", llm.model(model), "Default cart/order state model", "newbee-mall order flow", "Generated default state model", true);
        return projectSnapshot(projectId);
    }

    public Map<String, Object> optimizeSuite(long projectId) {
        jdbc.update("DELETE FROM suite_variants WHERE project_id=?", projectId);
        List<Map<String, Object>> tests = rows("""
                SELECT t.id, t.priority, t.technique, t.requirement_id, t.coverage_item_id,
                       COALESCE(ra.priority, t.priority, 'Medium') risk_priority,
                       COALESCE(ra.risk_score, 0) risk_score
                FROM test_cases t
                LEFT JOIN risk_assessments ra ON ra.requirement_id=t.requirement_id AND ra.project_id=t.project_id
                WHERE t.project_id=?
                ORDER BY t.id
                """, projectId);
        List<Long> all = tests.stream().map(t -> number(t.get("id")).longValue()).toList();
        List<Long> high = tests.stream().filter(this::isHighRiskTest)
                .map(t -> number(t.get("id")).longValue()).toList();

        Set<Long> coveredRequirements = new LinkedHashSet<>();
        List<Long> minimal = new ArrayList<>();
        tests.stream()
                .sorted(this::compareSuiteCandidates)
                .forEach(test -> {
                    long requirementId = number(test.get("requirement_id")).longValue();
                    if (coveredRequirements.add(requirementId)) {
                        minimal.add(number(test.get("id")).longValue());
                    }
                });

        Set<String> seenTechniques = techniquesFor(projectId, minimal);
        for (Map<String, Object> test : tests) {
            String tech = string(test.get("technique"), "");
            if (!tech.isBlank() && seenTechniques.add(tech)) {
                minimal.add(number(test.get("id")).longValue());
            }
        }
        for (Map<String, Object> test : tests) {
            if (isHighRiskTest(test)) {
                long id = number(test.get("id")).longValue();
                if (!minimal.contains(id)) minimal.add(id);
            }
        }
        if (minimal.isEmpty()) minimal.addAll(all.stream().limit(Math.min(5, all.size())).toList());
        insertSuite(projectId, "Full Suite", "All generated and reviewed test cases.", all,
                "Baseline suite: keeps every generated case for auditability and maximum coverage.");
        insertSuite(projectId, "High Risk Suite", "Risk-prioritized subset for fast regression checks.",
                high.isEmpty() ? all.stream().limit(Math.min(8, all.size())).toList() : high,
                "Selected cases tied to High priority test cases or High risk requirements, ordered before lower-risk work.");
        insertSuite(projectId, "Minimal Coverage Suite", "Reduced set that preserves requirement, technique, and high-risk coverage.",
                minimal.stream().distinct().toList(),
                "Greedy minimization: keeps the strongest representative per requirement, adds missing techniques, and preserves every high-risk item.");
        return projectSnapshot(projectId);
    }

    public Map<String, Object> patchReviewItem(long itemId, Map<String, Object> body) {
        String itemType = string(body.get("itemType"), "");
        String fieldName = string(body.get("fieldName"), "");
        String newValue = string(body.get("newValue"), "");
        String note = string(body.get("note"), "Human review update");
        TableField tableField = tableField(itemType, fieldName);
        String oldValue = queryString("SELECT " + tableField.field() + " FROM " + tableField.table() + " WHERE id=?", itemId);
        jdbc.update("UPDATE " + tableField.table() + " SET " + tableField.field() + "=?, status='REVIEWED' WHERE id=?", newValue, itemId);
        jdbc.update("""
                INSERT INTO review_revisions(item_type, item_id, field_name, old_value, new_value, note)
                VALUES (?, ?, ?, ?, ?, ?)
                """, itemType, itemId, fieldName, oldValue, newValue, note);
        return Map.of("updated", true, "itemType", itemType, "itemId", itemId, "field", fieldName);
    }

    public ExportFile exportProject(long projectId, String format) throws IOException {
        Map<String, Object> snapshot = projectSnapshot(projectId);
        String normalized = format.toLowerCase(Locale.ROOT);
        ExportFile file = switch (normalized) {
            case "json" -> new ExportFile("autotestdesign-project-" + projectId + ".json", "application/json", mapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(snapshot));
            case "csv" -> new ExportFile("autotestdesign-test-cases-" + projectId + ".csv", "text/csv", exportCsv(snapshot).getBytes(StandardCharsets.UTF_8));
            case "xlsx", "excel" -> new ExportFile("autotestdesign-export-" + projectId + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", exportXlsx(snapshot));
            default -> throw new IllegalArgumentException("Unsupported export format: " + format);
        };
        jdbc.update("""
                INSERT INTO export_artifacts(project_id, format, file_name, content_type, content)
                VALUES (?, ?, ?, ?, ?)
                """, projectId, normalized, file.fileName(), file.contentType(), file.content());
        return file;
    }

    private JsonNode generateOrFallback(long projectId, String stage, String prompt, Object payload, String model, Fallback fallback) {
        String input = safeJson(payload);
        String activeModel = llm.model(model);
        if (llm.configured()) {
            try {
                JsonNode node = llm.generateJson("""
                        You are AutoTestDesign, an ISTQB/ISO 29119 aligned software testing design assistant.
                        Return strict JSON only. Do not include markdown.
                        """, prompt + "\nInput:\n" + input, activeModel);
                validateItems(node, stage);
                logPrompt(projectId, stage, activeModel, prompt, summarize(input), summarize(node.toString()), true);
                return node;
            } catch (Exception ex) {
                logPrompt(projectId, stage, activeModel, prompt, summarize(input), "LLM failed; used fallback: " + ex.getMessage(), false);
            }
        } else {
            logPrompt(projectId, stage, activeModel + " (demo-fallback)", prompt, summarize(input), "LLM_API_KEY missing; used deterministic fallback", false);
        }
        return fallback.get();
    }

    private void validateItems(JsonNode node, String stage) {
        if (!node.has("items") || !node.get("items").isArray()) {
            throw new IllegalArgumentException(stage + " JSON must include an items array");
        }
    }

    private JsonNode fallbackStructured(List<Map<String, Object>> requirements) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> req : requirements) {
            String raw = string(req.get("raw_text"), "");
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", req.get("id"));
            item.put("requirementKey", req.get("requirement_key"));
            item.put("module", firstNonBlank(string(req.get("module"), ""), inferModule(raw)));
            item.put("roleName", firstNonBlank(string(req.get("role_name"), ""), inferRole(raw)));
            item.put("inputFields", inferInputs(raw));
            item.put("dataRanges", "normal values; empty values; boundary values; invalid values");
            item.put("conditions", "User role and preconditions must match the feature workflow.");
            item.put("expectedActions", raw);
            item.put("expectedResults", "System completes the requested behavior or returns a clear validation/error result.");
            item.put("relatedEndpoints", string(req.get("related_endpoints"), ""));
            item.put("riskHints", inferRisk(raw));
            item.put("confidence", 0.72);
            items.add(item);
        }
        return mapper.valueToTree(Map.of("items", items));
    }

    private JsonNode fallbackRisk(List<Map<String, Object>> requirements) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> req : requirements) {
            String raw = string(req.get("raw_text"), "").toLowerCase(Locale.ROOT);
            boolean high = raw.matches(".*(order|payment|cart|stock|login|permission|upload|delete|password).*");
            int impact = high ? 5 : 3;
            int likelihood = raw.contains("boundary") || raw.contains("invalid") ? 4 : 3;
            int complexity = high ? 4 : 2;
            int detectability = raw.contains("security") || raw.contains("permission") ? 4 : 3;
            int score = impact * likelihood + complexity * detectability;
            items.add(Map.of(
                    "requirementId", req.get("id"),
                    "impact", impact,
                    "likelihood", likelihood,
                    "complexity", complexity,
                    "detectability", detectability,
                    "riskScore", score,
                    "priority", score >= 32 ? "High" : score >= 20 ? "Medium" : "Low",
                    "rationale", "Risk estimated from business criticality, state changes, validation complexity, and failure visibility."
            ));
        }
        return mapper.valueToTree(Map.of("items", items));
    }

    private JsonNode fallbackCoverage(List<Map<String, Object>> requirements) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> req : requirements) {
            long id = number(req.get("id")).longValue();
            String raw = string(req.get("raw_text"), "");
            items.add(Map.of("requirementId", id, "coverageType", "valid input", "description", "Verify the happy path for: " + raw, "rationale", "Confirms intended behavior."));
            items.add(Map.of("requirementId", id, "coverageType", "invalid input", "description", "Verify invalid or missing data is rejected for: " + raw, "rationale", "Confirms validation behavior."));
            if (raw.toLowerCase(Locale.ROOT).matches(".*(order|cart|payment|status|stock|login|lock).*")) {
                items.add(Map.of("requirementId", id, "coverageType", "state transition", "description", "Verify allowed and forbidden state changes for: " + raw, "rationale", "Protects workflow integrity."));
            } else {
                items.add(Map.of("requirementId", id, "coverageType", "boundary", "description", "Verify minimum, maximum, and out-of-range values for: " + raw, "rationale", "Covers edge behavior."));
            }
        }
        return mapper.valueToTree(Map.of("items", items));
    }

    private JsonNode fallbackStrategies(List<Map<String, Object>> coverage) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> item : coverage) {
            String type = string(item.get("coverage_type"), "");
            String technique = switch (type) {
                case "boundary" -> "Boundary Value Analysis; Equivalence Partitioning";
                case "state transition" -> "State Transition Testing; Statement/Branch/Path Coverage";
                case "permission/security" -> "Decision Table; Risk-based Prioritization";
                case "invalid input" -> "Equivalence Partitioning; Decision Table";
                default -> "Equivalence Partitioning; Risk-based Prioritization";
            };
            items.add(Map.of("coverageItemId", item.get("id"), "techniques", technique, "rationale", "Technique selected to match the coverage item type and risk profile."));
        }
        return mapper.valueToTree(Map.of("items", items));
    }

    private JsonNode fallbackTestCases(List<Map<String, Object>> input) {
        List<Map<String, Object>> items = new ArrayList<>();
        int i = 1;
        for (Map<String, Object> row : input) {
            String key = "TC-" + String.format("%03d", i++);
            String coverage = string(row.get("coverage_description"), "coverage item");
            String technique = firstTechnique(string(row.get("techniques"), "Equivalence Partitioning"));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("testCaseKey", key);
            item.put("requirementId", row.get("requirement_id"));
            item.put("coverageItemId", row.get("coverage_id"));
            item.put("technique", technique);
            item.put("priority", coverage.toLowerCase(Locale.ROOT).matches(".*(order|payment|cart|stock|login|permission).*") ? "High" : "Medium");
            item.put("preconditions", "Target application is running and required role/session/data state is prepared.");
            item.put("testData", "Use representative valid, invalid, and boundary data for the selected coverage item.");
            item.put("steps", "1. Navigate to the related feature. 2. Prepare the required state. 3. Execute: " + coverage + " 4. Observe result.");
            item.put("expectedResult", "System behavior matches the requirement, and incorrect data or forbidden transitions are rejected with a clear result.");
            item.put("oracleExplanation", "Expected result is derived from the requirement, selected coverage item, and testing technique.");
            item.put("automationCandidate", "Yes");
            item.put("traceability", row.get("requirement_key") + " -> " + row.get("coverage_id") + " -> " + technique + " -> " + key);
            items.add(item);
        }
        return mapper.valueToTree(Map.of("items", items));
    }

    private List<Map<String, String>> parseCsv(MultipartFile file) throws IOException {
        List<Map<String, String>> result = new ArrayList<>();
        try (CSVParser parser = CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).build()
                .parse(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            int i = 1;
            for (CSVRecord record : parser) {
                Map<String, String> item = new LinkedHashMap<>();
                item.put("requirementId", value(record, "Requirement ID", "ID", "id", "requirementId", "REQ-" + i));
                item.put("module", value(record, "Module", "module", "系统区域", "模块", ""));
                item.put("role", value(record, "Role", "role", "前置条件/角色", ""));
                item.put("endpoint", value(record, "Endpoint", "入口页面/API", "url", ""));
                item.put("rawText", firstNonBlank(value(record, "Requirement Description", "Description", "可测试功能点", "rawText", ""), record.toString()));
                result.add(item);
                i++;
            }
        }
        return result;
    }

    private List<Map<String, String>> parseXlsx(MultipartFile file) throws IOException {
        List<Map<String, String>> result = new ArrayList<>();
        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null || sheet.getLastRowNum() < 1) return result;
            Map<String, Integer> headers = new LinkedHashMap<>();
            Row header = sheet.getRow(0);
            for (Cell cell : header) headers.put(cell.getStringCellValue().trim(), cell.getColumnIndex());
            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                String id = cell(row, headers, "ID", "Requirement ID");
                String module = firstNonBlank(cell(row, headers, "模块"), cell(row, headers, "系统区域"), cell(row, headers, "Module"));
                String endpoint = firstNonBlank(cell(row, headers, "入口页面/API"), cell(row, headers, "Endpoint"));
                String role = firstNonBlank(cell(row, headers, "前置条件/角色"), cell(row, headers, "Role"));
                String feature = firstNonBlank(cell(row, headers, "可测试功能点"), cell(row, headers, "Requirement Description"), cell(row, headers, "Description"));
                String typical = cell(row, headers, "典型测试点");
                if (feature.isBlank()) continue;
                result.add(Map.of(
                        "requirementId", id.isBlank() ? "REQ-" + r : id,
                        "module", module,
                        "role", role,
                        "endpoint", endpoint,
                        "rawText", feature + (typical.isBlank() ? "" : " | Typical tests: " + typical)
                ));
            }
        }
        return result;
    }

    private List<Map<String, String>> parsePlainText(String text) {
        List<Map<String, String>> result = new ArrayList<>();
        String[] lines = text.split("\\R+");
        int i = 1;
        for (String line : lines) {
            String cleaned = line.replaceFirst("^\\s*[-*\\d.)]+\\s*", "").trim();
            if (cleaned.isBlank()) continue;
            result.add(Map.of("requirementId", "REQ-" + i, "rawText", cleaned, "module", "", "role", "", "endpoint", ""));
            i++;
        }
        return result;
    }

    private String exportCsv(Map<String, Object> snapshot) {
        StringBuilder out = new StringBuilder("\uFEFFTest Case ID,Requirement ID,Coverage Item ID,Technique,Priority,Preconditions,Test Data,Steps,Expected Result,Oracle Explanation,Automation Candidate,Traceability\n");
        list(snapshot.get("testCases")).forEach(row -> out.append(csv(row.get("test_case_key"))).append(',')
                .append(csv(row.get("requirement_id"))).append(',')
                .append(csv(row.get("coverage_item_id"))).append(',')
                .append(csv(row.get("technique"))).append(',')
                .append(csv(row.get("priority"))).append(',')
                .append(csv(row.get("preconditions"))).append(',')
                .append(csv(row.get("test_data"))).append(',')
                .append(csv(row.get("steps"))).append(',')
                .append(csv(row.get("expected_result"))).append(',')
                .append(csv(row.get("oracle_explanation"))).append(',')
                .append(csv(row.get("automation_candidate"))).append(',')
                .append(csv(row.get("traceability"))).append('\n'));
        return out.toString();
    }

    private byte[] exportXlsx(Map<String, Object> snapshot) throws IOException {
        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            sheet(wb, "Requirements", list(snapshot.get("requirements")), List.of("id", "requirement_key", "module", "role_name", "raw_text", "expected_results", "status"));
            sheet(wb, "Risk Matrix", list(snapshot.get("riskAssessments")), List.of("requirement_id", "impact", "likelihood", "complexity", "detectability", "risk_score", "priority", "rationale"));
            sheet(wb, "Coverage Matrix", list(snapshot.get("coverageItems")), List.of("id", "requirement_id", "coverage_type", "description", "rationale", "status"));
            sheet(wb, "Strategies", list(snapshot.get("coverageStrategies")), List.of("coverage_item_id", "techniques", "rationale", "status"));
            sheet(wb, "Test Cases", list(snapshot.get("testCases")), List.of("test_case_key", "requirement_id", "coverage_item_id", "technique", "priority", "preconditions", "test_data", "steps", "expected_result", "oracle_explanation", "automation_candidate", "traceability"));
            sheet(wb, "Optimized Suites", suiteExportRows(list(snapshot.get("suiteVariants"))), List.of("variant_name", "original_cases", "optimized_cases", "removed_cases", "reduction_ratio", "covered_requirements", "covered_techniques", "covered_high_risk_items", "selection_reason"));
            sheet(wb, "Prompt Runs", list(snapshot.get("promptRuns")), List.of("stage", "model", "input_summary", "output_summary", "success", "created_at"));
            sheet(wb, "Review Changes", list(snapshot.get("reviewRevisions")), List.of("item_type", "item_id", "field_name", "old_value", "new_value", "note", "created_at"));
            wb.write(out);
            return out.toByteArray();
        }
    }

    private void sheet(Workbook wb, String name, List<Map<String, Object>> rows, List<String> columns) {
        Sheet sheet = wb.createSheet(name);
        Row header = sheet.createRow(0);
        for (int i = 0; i < columns.size(); i++) header.createCell(i).setCellValue(columns.get(i));
        int r = 1;
        for (Map<String, Object> row : rows) {
            Row xlsxRow = sheet.createRow(r++);
            for (int i = 0; i < columns.size(); i++) xlsxRow.createCell(i).setCellValue(string(row.get(columns.get(i)), ""));
        }
        for (int i = 0; i < columns.size(); i++) sheet.autoSizeColumn(i);
    }

    private List<Map<String, Object>> suiteExportRows(List<Map<String, Object>> suites) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> suite : suites) {
            Map<String, Object> summary = map(suite.get("optimization_summary"));
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("variant_name", suite.get("variant_name"));
            row.put("original_cases", summary.get("originalCaseCount"));
            row.put("optimized_cases", summary.get("optimizedCaseCount"));
            row.put("removed_cases", summary.get("removedCaseCount"));
            row.put("reduction_ratio", summary.get("reductionRatio"));
            row.put("covered_requirements", joinField(list(summary.get("coveredRequirements")), "requirement_key"));
            row.put("covered_techniques", joinField(list(summary.get("coveredTechniques")), "technique"));
            row.put("covered_high_risk_items", joinField(list(summary.get("coveredHighRiskItems")), "requirement_key"));
            row.put("selection_reason", summary.get("selectionReason"));
            rows.add(row);
        }
        return rows;
    }

    private void insertSuite(long projectId, String name, String description, List<Long> ids, String rationale) {
        jdbc.update("""
                INSERT INTO suite_variants(project_id, variant_name, description, test_case_ids_json, optimization_rationale)
                VALUES (?, ?, ?, CAST(? AS JSON), ?)
                """, projectId, name, description, json(ids), rationale);
    }

    private List<Map<String, Object>> suiteVariants(long projectId) {
        List<Map<String, Object>> suites = rows("SELECT * FROM suite_variants WHERE project_id=? ORDER BY id", projectId);
        int originalCount = count("SELECT COUNT(*) FROM test_cases WHERE project_id=?", projectId);
        for (Map<String, Object> suite : suites) {
            List<Long> ids = suiteIds(suite.get("test_case_ids_json"));
            Map<String, Object> summary = suiteSummary(projectId, ids, originalCount, string(suite.get("optimization_rationale"), ""));
            suite.put("optimization_summary", summary);
        }
        return suites;
    }

    private Map<String, Object> suiteSummary(long projectId, List<Long> testCaseIds, int originalCount, String rationale) {
        Map<String, Object> summary = new LinkedHashMap<>();
        int optimizedCount = testCaseIds.size();
        int removedCount = Math.max(0, originalCount - optimizedCount);
        double reductionRatio = originalCount == 0 ? 0.0 : (removedCount * 100.0) / originalCount;
        summary.put("originalCaseCount", originalCount);
        summary.put("optimizedCaseCount", optimizedCount);
        summary.put("removedCaseCount", removedCount);
        summary.put("reductionRatio", Math.round(reductionRatio * 10.0) / 10.0);
        summary.put("coveredRequirements", suiteCoverageRows(projectId, testCaseIds, "requirements"));
        summary.put("coveredTechniques", suiteCoverageRows(projectId, testCaseIds, "techniques"));
        summary.put("coveredHighRiskItems", suiteCoverageRows(projectId, testCaseIds, "highRisk"));
        summary.put("selectionReason", rationale);
        return summary;
    }

    private List<Map<String, Object>> suiteCoverageRows(long projectId, List<Long> testCaseIds, String mode) {
        if (testCaseIds.isEmpty()) return List.of();
        String placeholders = testCaseIds.stream().map(id -> "?").collect(Collectors.joining(","));
        List<Object> args = new ArrayList<>();
        args.add(projectId);
        args.addAll(testCaseIds);
        return switch (mode) {
            case "requirements" -> rows("""
                    SELECT DISTINCT r.id, r.requirement_key, r.module, LEFT(r.raw_text, 180) label
                    FROM test_cases t
                    JOIN requirements r ON r.id=t.requirement_id
                    WHERE t.project_id=? AND t.id IN (""" + placeholders + ") ORDER BY r.id", args.toArray());
            case "techniques" -> rows("""
                    SELECT COALESCE(NULLIF(t.technique, ''), 'Unspecified') technique, COUNT(*) test_count
                    FROM test_cases t
                    WHERE t.project_id=? AND t.id IN (""" + placeholders + ") GROUP BY COALESCE(NULLIF(t.technique, ''), 'Unspecified') ORDER BY technique", args.toArray());
            case "highRisk" -> rows("""
                    SELECT DISTINCT r.id, r.requirement_key,
                           CASE WHEN UPPER(COALESCE(ra.priority, ''))='HIGH' OR UPPER(COALESCE(t.priority, ''))='HIGH'
                                THEN 'High' ELSE COALESCE(ra.priority, t.priority, 'Medium') END priority,
                           COALESCE(ra.risk_score, 0) risk_score, LEFT(r.raw_text, 180) label
                    FROM test_cases t
                    JOIN requirements r ON r.id=t.requirement_id
                    LEFT JOIN risk_assessments ra ON ra.requirement_id=t.requirement_id AND ra.project_id=t.project_id
                    WHERE t.project_id=? AND t.id IN (""" + placeholders + """
                    ) AND (UPPER(COALESCE(ra.priority, ''))='HIGH' OR UPPER(COALESCE(t.priority, ''))='HIGH')
                    ORDER BY risk_score DESC, r.id
                    """, args.toArray());
            default -> List.of();
        };
    }

    private List<Long> suiteIds(Object value) {
        try {
            JsonNode node = mapper.readTree(string(value, "[]"));
            if (!node.isArray()) return List.of();
            List<Long> ids = new ArrayList<>();
            for (JsonNode item : node) ids.add(item.asLong());
            return ids;
        } catch (Exception ex) {
            return List.of();
        }
    }

    private Set<String> techniquesFor(long projectId, List<Long> testCaseIds) {
        if (testCaseIds.isEmpty()) return new LinkedHashSet<>();
        String placeholders = testCaseIds.stream().map(id -> "?").collect(Collectors.joining(","));
        List<Object> args = new ArrayList<>();
        args.add(projectId);
        args.addAll(testCaseIds);
        return rows("SELECT DISTINCT technique FROM test_cases WHERE project_id=? AND id IN (" + placeholders + ")", args.toArray())
                .stream()
                .map(row -> string(row.get("technique"), ""))
                .filter(value -> !value.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private int compareSuiteCandidates(Map<String, Object> left, Map<String, Object> right) {
        return Comparator
                .comparing((Map<String, Object> test) -> isHighRiskTest(test)).reversed()
                .thenComparing(test -> number(test.get("risk_score")).intValue(), Comparator.reverseOrder())
                .thenComparing(test -> "High".equalsIgnoreCase(string(test.get("priority"), "")), Comparator.reverseOrder())
                .thenComparing(test -> number(test.get("id")).longValue())
                .compare(left, right);
    }

    private boolean isHighRiskTest(Map<String, Object> test) {
        return "High".equalsIgnoreCase(string(test.get("priority"), ""))
                || "High".equalsIgnoreCase(string(test.get("risk_priority"), ""));
    }

    private void logPrompt(long projectId, String stage, String model, String prompt, String inputSummary, String outputSummary, boolean success) {
        jdbc.update("""
                INSERT INTO prompt_runs(project_id, stage, model, prompt, input_summary, output_summary, success)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, projectId, stage, model, prompt, inputSummary, outputSummary, success);
    }

    private long insert(String sql, Object... args) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            return ps;
        }, keyHolder);
        return Objects.requireNonNull(keyHolder.getKey()).longValue();
    }

    private Map<String, Object> getProject(long id) {
        return jdbc.queryForMap("SELECT * FROM projects WHERE id=?", id);
    }

    private void requireProject(long id) {
        getProject(id);
    }

    private List<Map<String, Object>> rows(String sql, Object... args) {
        return jdbc.queryForList(sql, args);
    }

    private int count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private String queryString(String sql, Object... args) {
        try {
            Object value = jdbc.queryForObject(sql, Object.class, args);
            return string(value, "");
        } catch (EmptyResultDataAccessException ex) {
            return "";
        }
    }

    private TableField tableField(String itemType, String fieldName) {
        Map<String, Set<String>> allowed = Map.of(
                "requirement", Set.of("raw_text", "module", "role_name", "input_fields", "data_ranges", "conditions_text", "expected_actions", "expected_results", "related_endpoints", "risk_hints"),
                "risk", Set.of("impact", "likelihood", "complexity", "detectability", "risk_score", "priority", "rationale"),
                "coverage", Set.of("coverage_type", "description", "rationale"),
                "strategy", Set.of("techniques", "rationale"),
                "testCase", Set.of("technique", "priority", "preconditions", "test_data", "steps", "expected_result", "oracle_explanation", "automation_candidate", "traceability")
        );
        Map<String, String> tables = Map.of(
                "requirement", "requirements",
                "risk", "risk_assessments",
                "coverage", "coverage_items",
                "strategy", "coverage_strategies",
                "testCase", "test_cases"
        );
        if (!allowed.containsKey(itemType) || !allowed.get(itemType).contains(fieldName)) {
            throw new IllegalArgumentException("Unsupported review target: " + itemType + "." + fieldName);
        }
        return new TableField(tables.get(itemType), fieldName);
    }

    private record TableField(String table, String field) {}

    @FunctionalInterface
    private interface Fallback {
        JsonNode get();
    }

    private static String value(CSVRecord record, String... keysAndDefault) {
        String fallback = keysAndDefault[keysAndDefault.length - 1];
        for (int i = 0; i < keysAndDefault.length - 1; i++) {
            String key = keysAndDefault[i];
            if (record.isMapped(key) && record.get(key) != null && !record.get(key).isBlank()) return record.get(key).trim();
        }
        return fallback;
    }

    private static String cell(Row row, Map<String, Integer> headers, String... keys) {
        for (String key : keys) {
            Integer idx = headers.get(key);
            if (idx == null) continue;
            Cell cell = row.getCell(idx);
            if (cell == null) continue;
            String value = switch (cell.getCellType()) {
                case STRING -> cell.getStringCellValue();
                case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
                case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
                default -> "";
            };
            if (!value.isBlank()) return value.trim();
        }
        return "";
    }

    private Iterable<JsonNode> arrayAt(JsonNode node, String field) {
        JsonNode array = node.get(field);
        if (array == null || !array.isArray()) return List.of();
        return array;
    }

    private static String text(JsonNode node, String field) {
        return text(node, field, "");
    }

    private static String text(JsonNode node, String field, String fallback) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? fallback : value.asText(fallback);
    }

    private static Long nullableLong(JsonNode node) {
        return node == null || node.isNull() || node.asText().isBlank() ? null : node.asLong();
    }

    private String json(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private String safeJson(Object value) {
        try {
            return mapper.writerWithDefaultPrettyPrinter().writeValueAsString(value);
        } catch (Exception ex) {
            return String.valueOf(value);
        }
    }

    private static String summarize(String value) {
        if (value == null) return "";
        return value.length() <= 900 ? value : value.substring(0, 900) + "...";
    }

    private static String string(Object value, String fallback) {
        return value == null ? fallback : String.valueOf(value);
    }

    private static Number number(Object value) {
        if (value instanceof Number n) return n;
        return Long.parseLong(String.valueOf(value));
    }

    private static String firstNonBlank(String... values) {
        return Arrays.stream(values).filter(v -> v != null && !v.isBlank()).findFirst().orElse("");
    }

    private static String firstTechnique(String techniques) {
        return techniques.split(";")[0].trim();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Object value) {
        return value instanceof List<?> l ? (List<Map<String, Object>>) l : List.of();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        return value instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    }

    private static String joinField(List<Map<String, Object>> rows, String field) {
        return rows.stream()
                .map(row -> string(row.get(field), ""))
                .filter(value -> !value.isBlank())
                .distinct()
                .collect(Collectors.joining("; "));
    }

    private static String csv(Object value) {
        String s = string(value, "");
        return "\"" + s.replace("\"", "\"\"") + "\"";
    }

    private static String inferModule(String raw) {
        String lower = raw.toLowerCase(Locale.ROOT);
        if (lower.contains("order") || raw.contains("订单")) return "Order";
        if (lower.contains("cart") || raw.contains("购物车")) return "Shopping Cart";
        if (lower.contains("login") || lower.contains("register") || raw.contains("登录")) return "User Authentication";
        if (lower.contains("goods") || lower.contains("product") || raw.contains("商品")) return "Goods";
        if (lower.contains("admin") || raw.contains("后台")) return "Admin";
        return "General";
    }

    private static String inferRole(String raw) {
        String lower = raw.toLowerCase(Locale.ROOT);
        if (lower.contains("admin") || raw.contains("管理员")) return "Administrator";
        if (lower.contains("member") || lower.contains("user") || raw.contains("会员")) return "Mall User";
        return "Visitor/User";
    }

    private static String inferInputs(String raw) {
        String lower = raw.toLowerCase(Locale.ROOT);
        List<String> fields = new ArrayList<>();
        if (lower.contains("login")) fields.addAll(List.of("loginName", "password", "verifyCode"));
        if (lower.contains("order")) fields.addAll(List.of("orderNo", "orderStatus", "payType"));
        if (lower.contains("cart")) fields.addAll(List.of("goodsId", "goodsCount", "cartItemId"));
        if (lower.contains("search")) fields.addAll(List.of("keyword", "page", "categoryId"));
        return fields.isEmpty() ? "feature-specific input fields" : String.join(", ", fields);
    }

    private static String inferRisk(String raw) {
        String lower = raw.toLowerCase(Locale.ROOT);
        if (lower.matches(".*(order|payment|stock|cart).*")) return "Transaction, stock, and state consistency risk.";
        if (lower.matches(".*(login|password|permission|upload).*")) return "Authentication, authorization, and security risk.";
        return "Functional correctness and usability risk.";
    }
}
