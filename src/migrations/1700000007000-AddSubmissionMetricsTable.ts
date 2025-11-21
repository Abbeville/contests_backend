import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSubmissionMetricsTable1700000007000 implements MigrationInterface {
    name = 'AddSubmissionMetricsTable1700000007000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create submission_metrics table
        await queryRunner.query(`
            CREATE TABLE \`submission_metrics\` (
                \`id\` varchar(36) NOT NULL,
                \`submission_id\` varchar(36) NOT NULL,
                \`likes\` int NOT NULL DEFAULT 0,
                \`comments\` int NOT NULL DEFAULT 0,
                \`shares\` int NOT NULL DEFAULT 0,
                \`views\` bigint NOT NULL DEFAULT 0,
                \`engagement_score\` decimal(10,2) NOT NULL DEFAULT 0,
                \`raw_metrics\` json NULL,
                \`platform\` varchar(20) NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                INDEX \`IDX_submission_metrics_submission_id\` (\`submission_id\`),
                INDEX \`IDX_submission_metrics_created_at\` (\`created_at\`),
                CONSTRAINT \`FK_submission_metrics_submission_id\` FOREIGN KEY (\`submission_id\`) REFERENCES \`contest_submissions\`(\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop submission_metrics table
        await queryRunner.query(`
            DROP TABLE \`submission_metrics\`
        `);
    }
}
