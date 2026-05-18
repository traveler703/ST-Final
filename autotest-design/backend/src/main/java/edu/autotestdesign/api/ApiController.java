package edu.autotestdesign.api;

import edu.autotestdesign.service.AutoTestDesignService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final AutoTestDesignService service;

    public ApiController(AutoTestDesignService service) {
        this.service = service;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("status", "ok", "service", "autotest-design-backend");
    }

    @PostMapping("/projects")
    public Map<String, Object> createProject(@RequestBody Map<String, Object> body) {
        return service.createProject(body);
    }

    @GetMapping("/projects")
    public List<Map<String, Object>> projects() {
        return service.listProjects();
    }

    @GetMapping("/projects/{id}")
    public Map<String, Object> project(@PathVariable long id) {
        return service.projectSnapshot(id);
    }

    @PostMapping(value = "/projects/{id}/requirements/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> importRequirements(@PathVariable long id,
                                                  @RequestParam(value = "file", required = false) MultipartFile file,
                                                  @RequestParam(value = "manualText", required = false) String manualText,
                                                  @RequestParam(value = "sourceType", required = false, defaultValue = "manual") String sourceType) throws IOException {
        return service.importRequirements(id, file, manualText, sourceType);
    }

    @PostMapping("/projects/{id}/requirements/structure")
    public Map<String, Object> structure(@PathVariable long id,
                                         @RequestBody(required = false) Map<String, Object> body) {
        return service.structureRequirements(id, modelFrom(body));
    }

    @PostMapping("/projects/{id}/risk/analyze")
    public Map<String, Object> risk(@PathVariable long id,
                                    @RequestBody(required = false) Map<String, Object> body) {
        return service.analyzeRisk(id, modelFrom(body));
    }

    @PostMapping("/projects/{id}/coverage/generate")
    public Map<String, Object> coverage(@PathVariable long id,
                                        @RequestBody(required = false) Map<String, Object> body) {
        return service.generateCoverage(id, modelFrom(body));
    }

    @PostMapping("/projects/{id}/strategies/generate")
    public Map<String, Object> strategies(@PathVariable long id,
                                          @RequestBody(required = false) Map<String, Object> body) {
        return service.generateStrategies(id, modelFrom(body));
    }

    @PostMapping("/projects/{id}/test-cases/generate")
    public Map<String, Object> testCases(@PathVariable long id,
                                         @RequestBody(required = false) Map<String, Object> body) {
        return service.generateTestCases(id, modelFrom(body));
    }

    @PostMapping("/projects/{id}/white-box/model")
    public Map<String, Object> whiteBox(@PathVariable long id,
                                        @RequestBody(required = false) Map<String, Object> body) {
        return service.generateWhiteBoxModel(id, modelFrom(body));
    }

    @PostMapping("/projects/{id}/suite/optimize")
    public Map<String, Object> optimize(@PathVariable long id) {
        return service.optimizeSuite(id);
    }

    @PatchMapping("/review-items/{id}")
    public Map<String, Object> review(@PathVariable long id, @RequestBody Map<String, Object> body) {
        return service.patchReviewItem(id, body);
    }

    @PostMapping("/projects/{id}/exports/{format}")
    public ResponseEntity<byte[]> export(@PathVariable long id, @PathVariable String format, HttpServletResponse response) throws IOException {
        AutoTestDesignService.ExportFile file = service.exportProject(id, format);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.fileName() + "\"")
                .contentType(MediaType.parseMediaType(file.contentType()))
                .body(file.content());
    }

    private static String modelFrom(Map<String, Object> body) {
        if (body == null) return null;
        Object model = body.get("model");
        return model == null ? null : String.valueOf(model);
    }
}
