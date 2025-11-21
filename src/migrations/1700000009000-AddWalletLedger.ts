import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWalletLedger1700000009000 implements MigrationInterface {
    name = 'AddWalletLedger1700000009000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`wallet_ledger\` (
                \`id\` varchar(36) NOT NULL,
                \`wallet_id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NOT NULL,
                \`entry_type\` varchar(10) NOT NULL,
                \`amount\` decimal(15,2) NOT NULL,
                \`balance_after\` decimal(15,2) NOT NULL,
                \`reference\` varchar(100) NULL,
                \`transaction_id\` varchar(36) NULL,
                \`context\` varchar(50) NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                INDEX \`IDX_wallet_ledger_wallet_id\` (\`wallet_id\`),
                INDEX \`IDX_wallet_ledger_user_id\` (\`user_id\`),
                INDEX \`IDX_wallet_ledger_created_at\` (\`created_at\`)
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`wallet_ledger\``);
    }
}


