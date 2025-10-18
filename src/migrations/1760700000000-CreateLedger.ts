import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateLedger1760700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'ledgers',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: [
              'trade_buy',
              'trade_sell',
              'trade_fee',
              'deposit',
              'withdrawal',
              'transfer_in',
              'transfer_out',
              'order_lock',
              'order_unlock',
              'order_cancel_refund',
              'rebate',
              'airdrop',
              'staking_reward',
              'adjustment',
            ],
            isNullable: false,
          },
          {
            name: 'change_type',
            type: 'enum',
            enum: ['increase', 'decrease'],
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'numeric',
            precision: 38,
            scale: 18,
            isNullable: false,
          },
          {
            name: 'balance_before',
            type: 'numeric',
            precision: 38,
            scale: 18,
            isNullable: false,
          },
          {
            name: 'balance_after',
            type: 'numeric',
            precision: 38,
            scale: 18,
            isNullable: false,
          },
          {
            name: 'reference_type',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'reference_id',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'ledgers',
      new TableIndex({
        name: 'idx_ledgers_user_created',
        columnNames: ['user_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'ledgers',
      new TableIndex({
        name: 'idx_ledgers_user_currency_created',
        columnNames: ['user_id', 'currency', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'ledgers',
      new TableIndex({
        name: 'idx_ledgers_type_created',
        columnNames: ['type', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'ledgers',
      new TableIndex({
        name: 'idx_ledgers_reference_id',
        columnNames: ['reference_id'],
      }),
    );

    await queryRunner.createIndex(
      'ledgers',
      new TableIndex({
        name: 'idx_ledgers_currency_created',
        columnNames: ['currency', 'created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('ledgers');
  }
}
