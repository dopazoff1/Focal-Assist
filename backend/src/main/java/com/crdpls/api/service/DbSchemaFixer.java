package com.crdpls.api.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Lightweight DB patcher to keep older local/prod schemas compatible with the current JPA model.
 *
 * We intentionally keep this extremely defensive (best-effort, never crash startup) because
 * the project currently relies on Hibernate ddl-auto=update (no migrations).
 */
@Component
public class DbSchemaFixer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DbSchemaFixer.class);

    private final JdbcTemplate jdbcTemplate;

    public DbSchemaFixer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        // Never block application boot on schema drift.
        try {
            fixConversationTagsJoinTable();
        } catch (Exception ex) {
            log.warn("DB schema fixer failed (non-fatal): {}", ex.getMessage());
            log.debug("DB schema fixer failure details", ex);
        }
    }

    /**
     * Some older schemas have `cem_conversation_tags` referencing a legacy `cem_tags` table with a NOT NULL `tag_id`
     * column (conversation_id, tag_id) PK. Our current mapping uses (conversation_id, tag_node_id) instead.
     *
     * If that legacy column exists, Hibernate will try to insert only (conversation_id, tag_node_id) which fails
     * with "Field 'tag_id' doesn't have a default value".
     *
     * Fix strategy:
     * - If `tag_id` column exists: DROP the join table and recreate it with the expected columns/constraints.
     *   (Case tags could not have been saved before this fix anyway, because inserts fail.)
     */
    private void fixConversationTagsJoinTable() {
        if (!tableExists("cem_conversation_tags")) {
            return;
        }

        if (!columnExists("cem_conversation_tags", "tag_id")) {
            return;
        }

        log.warn("Detected legacy schema for cem_conversation_tags (has tag_id). Recreating join table...");

        // Drop + recreate is the simplest deterministic fix and avoids a lot of MySQL DDL edge cases.
        // This join table only links tags to conversations; old rows are not compatible with the new model.
        safeExecute("DROP TABLE cem_conversation_tags");

        safeExecute("""
            CREATE TABLE cem_conversation_tags (
              conversation_id BIGINT(20) NOT NULL,
              tag_node_id BIGINT(20) NOT NULL,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
              PRIMARY KEY (conversation_id, tag_node_id),
              KEY fk_cem_conversation_tags_conversation (conversation_id),
              KEY fk_cem_conversation_tags_tag_node (tag_node_id),
              CONSTRAINT fk_cem_conversation_tags_conversation
                FOREIGN KEY (conversation_id) REFERENCES cem_conversations(id) ON DELETE CASCADE,
              CONSTRAINT fk_cem_conversation_tags_tag_node
                FOREIGN KEY (tag_node_id) REFERENCES case_tag_nodes(id)
            )
            """);

        log.info("Recreated cem_conversation_tags successfully.");
    }

    private boolean tableExists(String tableName) {
        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(*)
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                """,
            Integer.class,
            tableName
        );
        return count != null && count > 0;
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject(
            """
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                  AND COLUMN_NAME = ?
                """,
            Integer.class,
            tableName,
            columnName
        );
        return count != null && count > 0;
    }

    private void safeExecute(String sql) {
        try {
            jdbcTemplate.execute(sql);
        } catch (Exception ex) {
            // If DROP fails because the table is already gone or CREATE fails because it already exists,
            // we still want the app to boot. Log and continue.
            log.warn("DB schema fixer SQL failed (non-fatal). SQL=[{}] error={}", oneLine(sql), ex.getMessage());
            log.debug("DB schema fixer SQL failure details", ex);
        }
    }

    private String oneLine(String sql) {
        if (sql == null) return "";
        return sql.replace("\r", " ").replace("\n", " ").trim();
    }
}

