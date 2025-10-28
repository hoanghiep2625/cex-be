import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1761555767723 implements MigrationInterface {
    name = 'Migration1761555767723'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candles" DROP CONSTRAINT "CHK_f12a3dcc24f1da369c30908724"`);
        await queryRunner.query(`ALTER TABLE "candles" DROP CONSTRAINT "PK_51487d0946f705bd3df19d2f04e"`);
        await queryRunner.query(`ALTER TABLE "candles" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "candles" ADD CONSTRAINT "PK_c775a4bc83c67c83f3a8fe61a4f" PRIMARY KEY ("symbol_id", "timeframe", "open_time")`);
        await queryRunner.query(`ALTER TABLE "candles" ADD CONSTRAINT "CHK_0b0874b3f59314c366145dc7d9" CHECK (timeframe IN ('1m','5m','15m','30m','1h','4h','1d','1w','1M'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candles" DROP CONSTRAINT "CHK_0b0874b3f59314c366145dc7d9"`);
        await queryRunner.query(`ALTER TABLE "candles" DROP CONSTRAINT "PK_c775a4bc83c67c83f3a8fe61a4f"`);
        await queryRunner.query(`ALTER TABLE "candles" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "candles" ADD CONSTRAINT "PK_51487d0946f705bd3df19d2f04e" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "candles" ADD CONSTRAINT "CHK_f12a3dcc24f1da369c30908724" CHECK ((timeframe = ANY (ARRAY['1m'::text, '5m'::text, '15m'::text, '30m'::text, '1h'::text, '4h'::text, '1d'::text, '1w'::text, '1M'::text])))`);
    }

}
