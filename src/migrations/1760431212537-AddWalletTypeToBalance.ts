import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWalletTypeToBalance1760431212537 implements MigrationInterface {
    name = 'AddWalletTypeToBalance1760431212537'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_48e65054dbd579704f42a72713"`);
        await queryRunner.query(`ALTER TABLE "balances" ADD "wallet_type" text NOT NULL DEFAULT 'spot'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5c4ac7bba8bcfeaf3244903a55" ON "balances" ("user_id", "currency", "wallet_type") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_5c4ac7bba8bcfeaf3244903a55"`);
        await queryRunner.query(`ALTER TABLE "balances" DROP COLUMN "wallet_type"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_48e65054dbd579704f42a72713" ON "balances" ("currency", "user_id") `);
    }

}
