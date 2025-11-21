import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWinningCriteriaAndContestCompletionFields1700000006000 implements MigrationInterface {
    name = 'AddWinningCriteriaAndContestCompletionFields1700000006000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add judging_method column to contests table
        await queryRunner.query(`
            ALTER TABLE \`contests\`
            ADD \`judging_method\` varchar(20) NULL DEFAULT 'engagement'
        `);

        // Add engagement_weights column to contests table
        await queryRunner.query(`
            ALTER TABLE \`contests\`
            ADD \`engagement_weights\` json NULL
        `);

        // Add winner_count column to contests table
        await queryRunner.query(`
            ALTER TABLE \`contests\`
            ADD \`winner_count\` int NOT NULL DEFAULT 1
        `);

        // Add prize_distribution column to contests table
        await queryRunner.query(`
            ALTER TABLE \`contests\`
            ADD \`prize_distribution\` json NULL
        `);

        // Add platform column to contests table (if not already exists)
        await queryRunner.query(`
            ALTER TABLE \`contests\`
            ADD \`platform\` varchar(50) NULL
        `);

        // Add post_id and platform columns to contest_submissions table
        await queryRunner.query(`
            ALTER TABLE \`contest_submissions\`
            ADD \`post_id\` varchar(255) NULL,
            ADD \`platform\` varchar(20) NULL
        `);

        // Add metrics columns to social_media_accounts table
        await queryRunner.query(`
            ALTER TABLE \`social_media_accounts\`
            ADD \`follower_count\` int NOT NULL DEFAULT 0,
            ADD \`following_count\` int NOT NULL DEFAULT 0,
            ADD \`likes_count\` int NOT NULL DEFAULT 0,
            ADD \`video_count\` int NOT NULL DEFAULT 0,
            ADD \`views_count\` bigint NOT NULL DEFAULT 0,
            ADD \`tweet_count\` int NOT NULL DEFAULT 0
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove metrics columns from social_media_accounts table
        await queryRunner.query(`
            ALTER TABLE \`social_media_accounts\`
            DROP COLUMN \`tweet_count\`,
            DROP COLUMN \`views_count\`,
            DROP COLUMN \`video_count\`,
            DROP COLUMN \`likes_count\`,
            DROP COLUMN \`following_count\`,
            DROP COLUMN \`follower_count\`
        `);

        // Remove post_id and platform columns from contest_submissions table
        await queryRunner.query(`
            ALTER TABLE \`contest_submissions\`
            DROP COLUMN \`platform\`,
            DROP COLUMN \`post_id\`
        `);

        // Remove platform column from contests table
        await queryRunner.query(`
            ALTER TABLE \`contests\`
            DROP COLUMN \`platform\`
        `);

        // Remove prize_distribution column from contests table
        await queryRunner.query(`
            ALTER TABLE \`contests\`
            DROP COLUMN \`prize_distribution\`
        `);

        // Remove winner_count column from contests table
        await queryRunner.query(`
            ALTER TABLE \`contests\`
            DROP COLUMN \`winner_count\`
        `);

        // Remove engagement_weights column from contests table
        await queryRunner.query(`
            ALTER TABLE \`contests\`
            DROP COLUMN \`engagement_weights\`
        `);

        // Remove judging_method column from contests table
        await queryRunner.query(`
            ALTER TABLE \`contests\`
            DROP COLUMN \`judging_method\`
        `);
    }
}
