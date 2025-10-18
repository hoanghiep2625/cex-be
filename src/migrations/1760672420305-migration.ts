import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1760672420305 implements MigrationInterface {
    name = 'Migration1760672420305'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."trades_taker_side_enum" AS ENUM('BUY', 'SELL')`);
        await queryRunner.query(`CREATE TYPE "public"."trades_liquidity_enum" AS ENUM('M', 'T')`);
        await queryRunner.query(`CREATE TABLE "trades" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "symbol" text NOT NULL, "maker_order_id" character varying NOT NULL, "taker_order_id" character varying NOT NULL, "maker_user_id" integer NOT NULL, "taker_user_id" integer NOT NULL, "taker_side" "public"."trades_taker_side_enum" NOT NULL, "liquidity" "public"."trades_liquidity_enum" NOT NULL, "price" numeric(38,18) NOT NULL, "quantity" numeric(38,18) NOT NULL, "quote_quantity" numeric(38,18) NOT NULL, "maker_fee" numeric(38,18) NOT NULL DEFAULT '0', "maker_fee_asset" text, "taker_fee" numeric(38,18) NOT NULL DEFAULT '0', "taker_fee_asset" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c6d7c36a837411ba5194dc58595" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6055cc9a84741f8e9d8892a62e" ON "trades" ("taker_side", "symbol", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_2a60ab74154d9cf3c9b6d707f7" ON "trades" ("taker_order_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_90aa85c756d868da86928de544" ON "trades" ("maker_order_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_bf6d0a22b1d800f16ccf548406" ON "trades" ("taker_user_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_29649d75db69fba68600c1079e" ON "trades" ("maker_user_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_a662f185dd2fa4547624773635" ON "trades" ("symbol", "created_at") `);
        await queryRunner.query(`ALTER TABLE "trades" ADD CONSTRAINT "FK_e9b9146cd986af67855fbb5c5d8" FOREIGN KEY ("maker_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trades" ADD CONSTRAINT "FK_965f55d182f7abd80b4a9fc47b5" FOREIGN KEY ("taker_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "trades" ADD CONSTRAINT "FK_b8d8c2afc2b81a723e0d8cd4af6" FOREIGN KEY ("symbol") REFERENCES "symbols"("symbol") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trades" DROP CONSTRAINT "FK_b8d8c2afc2b81a723e0d8cd4af6"`);
        await queryRunner.query(`ALTER TABLE "trades" DROP CONSTRAINT "FK_965f55d182f7abd80b4a9fc47b5"`);
        await queryRunner.query(`ALTER TABLE "trades" DROP CONSTRAINT "FK_e9b9146cd986af67855fbb5c5d8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a662f185dd2fa4547624773635"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_29649d75db69fba68600c1079e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf6d0a22b1d800f16ccf548406"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_90aa85c756d868da86928de544"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2a60ab74154d9cf3c9b6d707f7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6055cc9a84741f8e9d8892a62e"`);
        await queryRunner.query(`DROP TABLE "trades"`);
        await queryRunner.query(`DROP TYPE "public"."trades_liquidity_enum"`);
        await queryRunner.query(`DROP TYPE "public"."trades_taker_side_enum"`);
    }

}
