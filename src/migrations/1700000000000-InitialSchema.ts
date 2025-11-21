import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1700000000000 implements MigrationInterface {
    name = 'InitialSchema1700000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create users table
        await queryRunner.query(`
            CREATE TABLE \`users\` (
                \`id\` varchar(36) NOT NULL,
                \`email\` varchar(255) NOT NULL,
                \`username\` varchar(255) NOT NULL,
                \`password\` varchar(255) NOT NULL,
                \`user_type\` varchar(20) NOT NULL DEFAULT 'creator',
                \`is_verified\` tinyint NOT NULL DEFAULT 0,
                \`is_active\` tinyint NOT NULL DEFAULT 1,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                UNIQUE INDEX \`IDX_users_email\` (\`email\`),
                UNIQUE INDEX \`IDX_users_username\` (\`username\`),
                INDEX \`IDX_users_user_type\` (\`user_type\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Create user_profiles table
        await queryRunner.query(`
            CREATE TABLE \`user_profiles\` (
                \`id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NOT NULL,
                \`first_name\` varchar(255) NULL,
                \`last_name\` varchar(255) NULL,
                \`bio\` text NULL,
                \`avatar_url\` varchar(500) NULL,
                \`phone\` varchar(20) NULL,
                \`date_of_birth\` date NULL,
                \`location\` varchar(255) NULL,
                \`website\` varchar(500) NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                UNIQUE INDEX \`REL_user_profiles_user_id\` (\`user_id\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Create contests table
        await queryRunner.query(`
            CREATE TABLE \`contests\` (
                \`id\` varchar(36) NOT NULL,
                \`brand_id\` varchar(36) NOT NULL,
                \`title\` varchar(255) NOT NULL,
                \`description\` text NOT NULL,
                \`rules\` text NULL,
                \`contest_type\` varchar(50) NOT NULL,
                \`prize_pool\` decimal(10,2) NOT NULL DEFAULT 0,
                \`entry_fee\` decimal(10,2) NOT NULL DEFAULT 0,
                \`submission_deadline\` datetime NULL,
                \`requirements\` text NULL,
                \`judging_criteria\` text NULL,
                \`tags\` json NULL,
                \`cover_image_url\` varchar(500) NULL,
                \`status\` varchar(20) NOT NULL DEFAULT 'draft',
                \`start_date\` datetime NULL,
                \`end_date\` datetime NULL,
                \`max_participants\` int NULL,
                \`min_followers\` int NULL,
                \`hashtags\` json NULL,
                \`brand_name\` varchar(255) NULL,
                \`brand_logo\` varchar(500) NULL,
                \`is_boosted\` tinyint NOT NULL DEFAULT 0,
                \`boost_amount\` decimal(10,2) NULL,
                \`entries_count\` int NOT NULL DEFAULT 0,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                INDEX \`IDX_contests_brand_id\` (\`brand_id\`),
                INDEX \`IDX_contests_status\` (\`status\`),
                INDEX \`IDX_contests_contest_type\` (\`contest_type\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Create contest_participants table
        await queryRunner.query(`
            CREATE TABLE \`contest_participants\` (
                \`id\` varchar(36) NOT NULL,
                \`contest_id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NOT NULL,
                \`joined_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`status\` varchar(20) NOT NULL DEFAULT 'active',
                INDEX \`IDX_contest_participants_contest_id\` (\`contest_id\`),
                INDEX \`IDX_contest_participants_user_id\` (\`user_id\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Create contest_submissions table
        await queryRunner.query(`
            CREATE TABLE \`contest_submissions\` (
                \`id\` varchar(36) NOT NULL,
                \`contest_id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NOT NULL,
                \`post_url\` varchar(500) NOT NULL,
                \`post_content\` text NULL,
                \`media_urls\` json NULL,
                \`status\` varchar(20) NOT NULL DEFAULT 'submitted',
                \`prize_amount\` decimal(10,2) NULL,
                \`submitted_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`reviewed_at\` datetime(6) NULL,
                \`reviewed_by\` varchar(36) NULL,
                INDEX \`IDX_contest_submissions_contest_id\` (\`contest_id\`),
                INDEX \`IDX_contest_submissions_user_id\` (\`user_id\`),
                INDEX \`IDX_contest_submissions_status\` (\`status\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Create wallets table
        await queryRunner.query(`
            CREATE TABLE \`wallets\` (
                \`id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NOT NULL,
                \`balance\` decimal(15,2) NOT NULL DEFAULT 0,
                \`pending_balance\` decimal(15,2) NOT NULL DEFAULT 0,
                \`total_deposited\` decimal(15,2) NOT NULL DEFAULT 0,
                \`total_earned\` decimal(15,2) NOT NULL DEFAULT 0,
                \`currency\` varchar(3) NOT NULL DEFAULT 'NGN',
                \`is_active\` tinyint NOT NULL DEFAULT 1,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                UNIQUE INDEX \`REL_wallets_user_id\` (\`user_id\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Create transactions table
        await queryRunner.query(`
            CREATE TABLE \`transactions\` (
                \`id\` varchar(36) NOT NULL,
                \`wallet_id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NOT NULL,
                \`transaction_type\` varchar(50) NOT NULL,
                \`amount\` decimal(15,2) NOT NULL,
                \`description\` varchar(500) NULL,
                \`reference\` varchar(255) NULL,
                \`status\` varchar(20) NOT NULL DEFAULT 'pending',
                \`metadata\` json NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                INDEX \`IDX_transactions_wallet_id\` (\`wallet_id\`),
                INDEX \`IDX_transactions_user_id\` (\`user_id\`),
                INDEX \`IDX_transactions_type\` (\`transaction_type\`),
                INDEX \`IDX_transactions_status\` (\`status\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Create social_media_accounts table
        await queryRunner.query(`
            CREATE TABLE \`social_media_accounts\` (
                \`id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NOT NULL,
                \`platform\` varchar(20) NOT NULL,
                \`platform_user_id\` varchar(255) NOT NULL,
                \`username\` varchar(255) NOT NULL,
                \`access_token\` text NOT NULL,
                \`refresh_token\` text NULL,
                \`is_active\` tinyint NOT NULL DEFAULT 1,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                INDEX \`IDX_social_media_accounts_user_id\` (\`user_id\`),
                INDEX \`IDX_social_media_accounts_platform\` (\`platform\`),
                INDEX \`IDX_social_media_accounts_platform_user_id\` (\`platform_user_id\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Create support_tickets table
        await queryRunner.query(`
            CREATE TABLE \`support_tickets\` (
                \`id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NOT NULL,
                \`subject\` varchar(255) NOT NULL,
                \`description\` text NOT NULL,
                \`priority\` varchar(20) NOT NULL DEFAULT 'medium',
                \`status\` varchar(20) NOT NULL DEFAULT 'open',
                \`category\` varchar(100) NULL,
                \`attachments\` json NULL,
                \`assigned_to\` varchar(36) NULL,
                \`resolution\` text NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                INDEX \`IDX_support_tickets_user_id\` (\`user_id\`),
                INDEX \`IDX_support_tickets_status\` (\`status\`),
                INDEX \`IDX_support_tickets_priority\` (\`priority\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Create support_messages table
        await queryRunner.query(`
            CREATE TABLE \`support_messages\` (
                \`id\` varchar(36) NOT NULL,
                \`ticket_id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NULL,
                \`message\` text NOT NULL,
                \`is_from_support\` tinyint NOT NULL DEFAULT 0,
                \`attachments\` json NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX \`IDX_support_messages_ticket_id\` (\`ticket_id\`),
                INDEX \`IDX_support_messages_user_id\` (\`user_id\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Create notifications table
        await queryRunner.query(`
            CREATE TABLE \`notifications\` (
                \`id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NULL,
                \`title\` varchar(255) NOT NULL,
                \`message\` text NOT NULL,
                \`type\` varchar(100) NOT NULL,
                \`is_read\` tinyint NOT NULL DEFAULT 0,
                \`data\` json NULL,
                \`target_users\` json NULL,
                \`target_user_type\` varchar(20) NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX \`IDX_notifications_user_id\` (\`user_id\`),
                INDEX \`IDX_notifications_type\` (\`type\`),
                INDEX \`IDX_notifications_is_read\` (\`is_read\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        // Add foreign key constraints
        await queryRunner.query(`ALTER TABLE \`user_profiles\` ADD CONSTRAINT \`FK_user_profiles_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`contests\` ADD CONSTRAINT \`FK_contests_brand_id\` FOREIGN KEY (\`brand_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`contest_participants\` ADD CONSTRAINT \`FK_contest_participants_contest_id\` FOREIGN KEY (\`contest_id\`) REFERENCES \`contests\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`contest_participants\` ADD CONSTRAINT \`FK_contest_participants_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`contest_submissions\` ADD CONSTRAINT \`FK_contest_submissions_contest_id\` FOREIGN KEY (\`contest_id\`) REFERENCES \`contests\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`contest_submissions\` ADD CONSTRAINT \`FK_contest_submissions_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`wallets\` ADD CONSTRAINT \`FK_wallets_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`transactions\` ADD CONSTRAINT \`FK_transactions_wallet_id\` FOREIGN KEY (\`wallet_id\`) REFERENCES \`wallets\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`transactions\` ADD CONSTRAINT \`FK_transactions_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`social_media_accounts\` ADD CONSTRAINT \`FK_social_media_accounts_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`support_tickets\` ADD CONSTRAINT \`FK_support_tickets_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`support_messages\` ADD CONSTRAINT \`FK_support_messages_ticket_id\` FOREIGN KEY (\`ticket_id\`) REFERENCES \`support_tickets\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`support_messages\` ADD CONSTRAINT \`FK_support_messages_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`notifications\` ADD CONSTRAINT \`FK_notifications_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraints first
        await queryRunner.query(`ALTER TABLE \`notifications\` DROP FOREIGN KEY \`FK_notifications_user_id\``);
        await queryRunner.query(`ALTER TABLE \`support_messages\` DROP FOREIGN KEY \`FK_support_messages_user_id\``);
        await queryRunner.query(`ALTER TABLE \`support_messages\` DROP FOREIGN KEY \`FK_support_messages_ticket_id\``);
        await queryRunner.query(`ALTER TABLE \`support_tickets\` DROP FOREIGN KEY \`FK_support_tickets_user_id\``);
        await queryRunner.query(`ALTER TABLE \`social_media_accounts\` DROP FOREIGN KEY \`FK_social_media_accounts_user_id\``);
        await queryRunner.query(`ALTER TABLE \`transactions\` DROP FOREIGN KEY \`FK_transactions_user_id\``);
        await queryRunner.query(`ALTER TABLE \`transactions\` DROP FOREIGN KEY \`FK_transactions_wallet_id\``);
        await queryRunner.query(`ALTER TABLE \`wallets\` DROP FOREIGN KEY \`FK_wallets_user_id\``);
        await queryRunner.query(`ALTER TABLE \`contest_submissions\` DROP FOREIGN KEY \`FK_contest_submissions_user_id\``);
        await queryRunner.query(`ALTER TABLE \`contest_submissions\` DROP FOREIGN KEY \`FK_contest_submissions_contest_id\``);
        await queryRunner.query(`ALTER TABLE \`contest_participants\` DROP FOREIGN KEY \`FK_contest_participants_user_id\``);
        await queryRunner.query(`ALTER TABLE \`contest_participants\` DROP FOREIGN KEY \`FK_contest_participants_contest_id\``);
        await queryRunner.query(`ALTER TABLE \`contests\` DROP FOREIGN KEY \`FK_contests_brand_id\``);
        await queryRunner.query(`ALTER TABLE \`user_profiles\` DROP FOREIGN KEY \`FK_user_profiles_user_id\``);

        // Drop tables
        await queryRunner.query(`DROP TABLE \`notifications\``);
        await queryRunner.query(`DROP TABLE \`support_messages\``);
        await queryRunner.query(`DROP TABLE \`support_tickets\``);
        await queryRunner.query(`DROP TABLE \`social_media_accounts\``);
        await queryRunner.query(`DROP TABLE \`transactions\``);
        await queryRunner.query(`DROP TABLE \`wallets\``);
        await queryRunner.query(`DROP TABLE \`contest_submissions\``);
        await queryRunner.query(`DROP TABLE \`contest_participants\``);
        await queryRunner.query(`DROP TABLE \`contests\``);
        await queryRunner.query(`DROP TABLE \`user_profiles\``);
        await queryRunner.query(`DROP TABLE \`users\``);
    }
}
