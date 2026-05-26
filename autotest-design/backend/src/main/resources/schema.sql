CREATE DATABASE IF NOT EXISTS autotest_design_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE autotest_design_db;

CREATE TABLE IF NOT EXISTS projects (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  target_app VARCHAR(160),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS requirements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  requirement_key VARCHAR(64) NOT NULL,
  raw_text TEXT NOT NULL,
  module VARCHAR(160),
  role_name VARCHAR(120),
  input_fields TEXT,
  data_ranges TEXT,
  conditions_text TEXT,
  expected_actions TEXT,
  expected_results TEXT,
  related_endpoints TEXT,
  risk_hints TEXT,
  status VARCHAR(32) DEFAULT 'REVIEW',
  confidence DECIMAL(5,2) DEFAULT 0.70,
  source_type VARCHAR(32) DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_requirements_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS risk_assessments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  requirement_id BIGINT NOT NULL,
  impact INT NOT NULL,
  likelihood INT NOT NULL,
  complexity INT NOT NULL,
  detectability INT NOT NULL,
  risk_score INT NOT NULL,
  priority VARCHAR(16) NOT NULL,
  rationale TEXT,
  status VARCHAR(32) DEFAULT 'REVIEW',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_risk_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_risk_requirement FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coverage_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  requirement_id BIGINT NOT NULL,
  coverage_type VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  rationale TEXT,
  status VARCHAR(32) DEFAULT 'REVIEW',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cov_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_cov_requirement FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coverage_strategies (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  coverage_item_id BIGINT NOT NULL,
  techniques TEXT NOT NULL,
  rationale TEXT,
  status VARCHAR(32) DEFAULT 'REVIEW',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_strategy_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_strategy_coverage FOREIGN KEY (coverage_item_id) REFERENCES coverage_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS test_cases (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  test_case_key VARCHAR(80) NOT NULL,
  requirement_id BIGINT NOT NULL,
  coverage_item_id BIGINT,
  technique VARCHAR(160),
  priority VARCHAR(16),
  preconditions TEXT,
  test_data TEXT,
  steps TEXT,
  expected_result TEXT,
  oracle_explanation TEXT,
  automation_candidate VARCHAR(16),
  traceability TEXT,
  status VARCHAR(32) DEFAULT 'REVIEW',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tc_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_tc_requirement FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE CASCADE,
  CONSTRAINT fk_tc_coverage FOREIGN KEY (coverage_item_id) REFERENCES coverage_items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whitebox_models (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  name VARCHAR(160) NOT NULL,
  states_json JSON NOT NULL,
  transitions_json JSON NOT NULL,
  coverage_suggestions_json JSON NOT NULL,
  status VARCHAR(32) DEFAULT 'REVIEW',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_whitebox_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suite_variants (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  variant_name VARCHAR(80) NOT NULL,
  description TEXT,
  test_case_ids_json JSON NOT NULL,
  optimization_rationale TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_suite_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prompt_runs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  stage VARCHAR(80) NOT NULL,
  model VARCHAR(120),
  prompt MEDIUMTEXT,
  input_summary TEXT,
  output_summary TEXT,
  success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prompt_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS review_revisions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  item_type VARCHAR(80) NOT NULL,
  item_id BIGINT NOT NULL,
  field_name VARCHAR(120) NOT NULL,
  old_value MEDIUMTEXT,
  new_value MEDIUMTEXT,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS execution_evidence (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  test_case_id BIGINT,
  target_module VARCHAR(160),
  framework VARCHAR(120),
  command_text TEXT,
  execution_status VARCHAR(24) NOT NULL,
  expected_result TEXT,
  actual_result TEXT,
  evidence_text MEDIUMTEXT,
  defect_ref VARCHAR(160),
  improvement_action TEXT,
  reviewer VARCHAR(120),
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_evidence_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_evidence_test_case FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS export_artifacts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  format VARCHAR(16) NOT NULL,
  file_name VARCHAR(220) NOT NULL,
  content_type VARCHAR(120) NOT NULL,
  content LONGBLOB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_export_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
