import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1760345455711 implements MigrationInterface {
    name = 'Migration1760345455711'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "CHK_4ed9a9b6c095c779267bec409c"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "CHK_38926307352a9a1c7a2f377853" CHECK ((type <> 'LIMIT') OR (price IS NOT NULL AND price > 0))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "CHK_38926307352a9a1c7a2f377853"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "id" character varying(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "CHK_4ed9a9b6c095c779267bec409c" CHECK (((type <> 'LIMIT'::orders_type_enum) OR (price IS NOT NULL)))`);
    }

}
