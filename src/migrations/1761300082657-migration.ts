import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1761300082657 implements MigrationInterface {
    name = 'Migration1761300082657'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "candles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "symbol_id" integer NOT NULL, "timeframe" text NOT NULL, "open_time" TIMESTAMP WITH TIME ZONE NOT NULL, "close_time" TIMESTAMP WITH TIME ZONE NOT NULL, "open" numeric(20,8) NOT NULL, "high" numeric(20,8) NOT NULL, "low" numeric(20,8) NOT NULL, "close" numeric(20,8) NOT NULL, "volume" numeric(38,8) NOT NULL, "quote_volume" numeric(38,8) NOT NULL, "number_of_trades" integer NOT NULL DEFAULT '0', "taker_buy_base_volume" numeric(38,8) NOT NULL DEFAULT '0', "taker_buy_quote_volume" numeric(38,8) NOT NULL DEFAULT '0', "is_closed" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_f12a3dcc24f1da369c30908724" CHECK (timeframe IN ('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M')), CONSTRAINT "PK_51487d0946f705bd3df19d2f04e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c775a4bc83c67c83f3a8fe61a4" ON "candles" ("symbol_id", "timeframe", "open_time") `);
        await queryRunner.query(`ALTER TABLE "candles" ADD CONSTRAINT "FK_3bd80e40e1865f8d4123755dfb6" FOREIGN KEY ("symbol_id") REFERENCES "symbols"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candles" DROP CONSTRAINT "FK_3bd80e40e1865f8d4123755dfb6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c775a4bc83c67c83f3a8fe61a4"`);
        await queryRunner.query(`DROP TABLE "candles"`);
    }

}
