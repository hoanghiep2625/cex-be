import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1761189961267 implements MigrationInterface {
  name = 'Migration1761189961267';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Thêm cột name với default value là code (tạm thời)
    await queryRunner.query(
      `ALTER TABLE "assets" ADD "name" text NOT NULL DEFAULT ''`,
    );

    // Update name = code cho tất cả existing assets
    await queryRunner.query(
      `UPDATE "assets" SET "name" = "code" WHERE "name" = ''`,
    );

    // Xóa default value sau khi update
    await queryRunner.query(
      `ALTER TABLE "assets" ALTER COLUMN "name" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "assets" DROP COLUMN "name"`);
  }
}
