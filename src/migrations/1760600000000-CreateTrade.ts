import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTrade1760600000000 implements MigrationInterface {
  name = 'CreateTrade1760600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ENUM types
    await queryRunner.query(
      `CREATE TYPE "public"."trades_orderside_enum" AS ENUM('BUY', 'SELL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."trades_liquidityflag_enum" AS ENUM('M', 'T')`,
    );

    // Create trades table
    await queryRunner.query(`
      CREATE TABLE "trades" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "symbol" text NOT NULL,
        "maker_order_id" character varying NOT NULL,
        "taker_order_id" character varying NOT NULL,
        "maker_user_id" integer NOT NULL,
        "taker_user_id" integer NOT NULL,
        "taker_side" "public"."trades_orderside_enum" NOT NULL,
        "liquidity" "public"."trades_liquidityflag_enum" NOT NULL,
        "price" numeric(38,18) NOT NULL,
        "quantity" numeric(38,18) NOT NULL,
        "quote_quantity" numeric(38,18) NOT NULL,
        "maker_fee" numeric(38,18) NOT NULL DEFAULT '0',
        "maker_fee_asset" text,
        "taker_fee" numeric(38,18) NOT NULL DEFAULT '0',
        "taker_fee_asset" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_trades_maker_user_id" FOREIGN KEY ("maker_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_trades_taker_user_id" FOREIGN KEY ("taker_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_trades_symbol" FOREIGN KEY ("symbol") REFERENCES "symbols"("symbol") ON DELETE RESTRICT
      )
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX "IDX_trades_symbol_created_at" ON "trades" ("symbol", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_trades_maker_user_id_created_at" ON "trades" ("maker_user_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_trades_taker_user_id_created_at" ON "trades" ("taker_user_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_trades_maker_order_id" ON "trades" ("maker_order_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_trades_taker_order_id" ON "trades" ("taker_order_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_trades_taker_side_symbol_created_at" ON "trades" ("taker_side", "symbol", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "trades" CASCADE`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."trades_orderside_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."trades_liquidityflag_enum"`,
    );
  }
}
