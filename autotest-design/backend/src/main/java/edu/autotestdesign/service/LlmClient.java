package edu.autotestdesign.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Component
public class LlmClient {
    private final ObjectMapper mapper;
    private final RestClient restClient;
    private final String apiKey;
    private final String defaultModel;

    public LlmClient(ObjectMapper mapper,
                     @Value("${llm.base-url}") String baseUrl,
                     @Value("${llm.api-key}") String apiKey,
                     @Value("${llm.model}") String model,
                     @Value("${llm.timeout-seconds}") long timeoutSeconds) {
        this.mapper = mapper;
        this.apiKey = apiKey;
        this.defaultModel = model;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(timeoutSeconds));
        factory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .requestFactory(factory)
                .build();
    }

    public String model() {
        return defaultModel;
    }

    public boolean configured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public JsonNode generateJson(String systemPrompt, String userPrompt) {
        return generateJson(systemPrompt, userPrompt, null);
    }

    public JsonNode generateJson(String systemPrompt, String userPrompt, String requestedModel) {
        if (!configured()) {
            throw new IllegalStateException("LLM_API_KEY is not configured");
        }
        String activeModel = model(requestedModel);
        Map<String, Object> request = Map.of(
                "model", activeModel,
                "temperature", 0.2,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", userPrompt)
                )
        );
        String raw = restClient.post()
                .uri("/chat/completions")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .body(request)
                .retrieve()
                .body(String.class);
        try {
            JsonNode root = mapper.readTree(raw);
            String content = root.at("/choices/0/message/content").asText();
            return mapper.readTree(content);
        } catch (Exception ex) {
            throw new IllegalStateException("LLM response was not valid JSON", ex);
        }
    }

    public String model(String requestedModel) {
        return requestedModel == null || requestedModel.isBlank() ? defaultModel : requestedModel.trim();
    }
}
