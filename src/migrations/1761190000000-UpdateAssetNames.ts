import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateAssetNames1761190000000 implements MigrationInterface {
  name = 'UpdateAssetNames1761190000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update asset names với tên thực tế
    await queryRunner.query(
      `UPDATE "assets" SET "name" = 'Bitcoin' WHERE "code" = 'BTC'`,
    );
    await queryRunner.query(
      `UPDATE "assets" SET "name" = 'Ethereum' WHERE "code" = 'ETH'`,
    );
    await queryRunner.query(
      `UPDATE "assets" SET "name" = 'Tether' WHERE "code" = 'USDT'`,
    );
    await queryRunner.query(
      `UPDATE "assets" SET "name" = 'Binance Coin' WHERE "code" = 'BNB'`,
    );
    await queryRunner.query(
      `UPDATE "assets" SET "name" = 'Cardano' WHERE "code" = 'ADA'`,
    );
    await queryRunner.query(
      `UPDATE "assets" SET "name" = 'Solana' WHERE "code" = 'SOL'`,
    );
    await queryRunner.query(
      `UPDATE "assets" SET "name" = 'Dogecoin' WHERE "code" = 'DOGE'`,
    );
    await queryRunner.query(
      `UPDATE "assets" SET "name" = 'XRP' WHERE "code" = 'XRP'`,
    );
    await queryRunner.query(
      `UPDATE "assets" SET "name" = 'Polkadot' WHERE "code" = 'DOT'`,
    );
    await queryRunner.query(
      `UPDATE "assets" SET "name" = 'Litecoin' WHERE "code" = 'LTC'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: set name = code
    await queryRunner.query(`UPDATE "assets" SET "name" = "code"`);
  }
}
