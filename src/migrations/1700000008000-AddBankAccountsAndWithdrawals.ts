import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBankAccountsAndWithdrawals1700000008000 implements MigrationInterface {
    name = 'AddBankAccountsAndWithdrawals1700000008000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create bank_accounts table
        await queryRunner.query(`
            CREATE TABLE \`bank_accounts\` (
                \`id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NOT NULL,
                \`account_name\` varchar(100) NOT NULL,
                \`account_number\` varchar(20) NOT NULL,
                \`bank_name\` varchar(100) NOT NULL,
                \`bank_code\` varchar(20) NOT NULL,
                \`account_type\` varchar(10) NOT NULL,
                \`routing_number\` varchar(20) NULL,
                \`currency\` varchar(10) NOT NULL DEFAULT 'NGN',
                \`is_active\` tinyint NOT NULL DEFAULT 1,
                \`is_verified\` tinyint NOT NULL DEFAULT 0,
                \`verification_token\` varchar(50) NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                INDEX \`IDX_bank_accounts_user_id\` (\`user_id\`),
                INDEX \`IDX_bank_accounts_is_active\` (\`is_active\`),
                CONSTRAINT \`FK_bank_accounts_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        // Create withdrawals table
        await queryRunner.query(`
            CREATE TABLE \`withdrawals\` (
                \`id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NOT NULL,
                \`bank_account_name\` varchar(100) NOT NULL,
                \`bank_account_number\` varchar(20) NOT NULL,
                \`bank_name\` varchar(100) NOT NULL,
                \`bank_code\` varchar(20) NOT NULL,
                \`amount\` decimal(15,2) NOT NULL,
                \`fee\` decimal(15,2) NOT NULL,
                \`net_amount\` decimal(15,2) NOT NULL,
                \`currency\` varchar(10) NOT NULL DEFAULT 'NGN',
                \`status\` varchar(20) NOT NULL DEFAULT 'pending',
                \`rejection_reason\` varchar(255) NULL,
                \`external_reference\` varchar(255) NULL,
                \`admin_notes\` varchar(255) NULL,
                \`processed_by\` varchar(36) NULL,
                \`transaction_id\` varchar(36) NULL,
                \`processed_at\` datetime NULL,
                \`completed_at\` datetime NULL,
                \`requested_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                INDEX \`IDX_withdrawals_user_id\` (\`user_id\`),
                INDEX \`IDX_withdrawals_status\` (\`status\`),
                INDEX \`IDX_withdrawals_requested_at\` (\`requested_at\`),
                CONSTRAINT \`FK_withdrawals_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
                CONSTRAINT \`FK_withdrawals_transaction_id\` FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\`(\`id\`) ON DELETE SET NULL
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop withdrawals table
        await queryRunner.query(`
            DROP TABLE \`withdrawals\`
        `);

        // Drop bank_accounts table
        await queryRunner.query(`
            DROP TABLE \`bank_accounts\`
        `);
    }
}

