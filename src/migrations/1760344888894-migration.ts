import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1760344888894 implements MigrationInterface {
    name = 'Migration1760344888894'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('USER', 'ADMIN', 'SUPER_ADMIN')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "username" character varying NOT NULL, "password" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "balances" ("id" BIGSERIAL NOT NULL, "user_id" integer NOT NULL, "currency" text NOT NULL, "available" numeric(38,18) NOT NULL DEFAULT '0', "locked" numeric(38,18) NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_141357578d9f7f13b5830f8eca" CHECK (locked >= 0), CONSTRAINT "CHK_ac602af79d595ef4ceef601c76" CHECK (available >= 0), CONSTRAINT "PK_74904758e813e401abc3d4261c2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_48e65054dbd579704f42a72713" ON "balances" ("user_id", "currency") `);
        await queryRunner.query(`CREATE INDEX "idx_balances_user" ON "balances" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "assets" ("code" text NOT NULL, "precision" integer NOT NULL DEFAULT '8', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bff60c1b89bff7edff592d85ea4" PRIMARY KEY ("code"))`);
        await queryRunner.query(`CREATE TABLE "symbols" ("id" SERIAL NOT NULL, "symbol" text NOT NULL, "base_asset" text NOT NULL, "quote_asset" text NOT NULL, "tick_size" numeric(20,8) NOT NULL, "lot_size" numeric(20,8) NOT NULL, "min_notional" numeric(20,8) NOT NULL, "max_notional" numeric(20,8), "min_qty" numeric(20,8) NOT NULL, "max_qty" numeric(20,8), "status" character varying(20) NOT NULL DEFAULT 'TRADING', "is_spot_trading_allowed" boolean NOT NULL DEFAULT true, "is_margin_trading_allowed" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_8537c94ae17acdcbd2cc15c99a0" UNIQUE ("symbol"), CONSTRAINT "PK_f9967bf9e35433b0a81ad95f8bf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cf511b4541f3f2241cc13fc295" ON "symbols" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_4bbfdc6d45c42281c5319dd5ba" ON "symbols" ("quote_asset") `);
        await queryRunner.query(`CREATE INDEX "IDX_e6ce9775abec1cbf9334cfe6f0" ON "symbols" ("base_asset") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8537c94ae17acdcbd2cc15c99a" ON "symbols" ("symbol") `);
        await queryRunner.query(`CREATE TYPE "public"."orders_side_enum" AS ENUM('BUY', 'SELL')`);
        await queryRunner.query(`CREATE TYPE "public"."orders_type_enum" AS ENUM('LIMIT', 'MARKET')`);
        await queryRunner.query(`CREATE TYPE "public"."orders_status_enum" AS ENUM('NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED')`);
        await queryRunner.query(`CREATE TYPE "public"."orders_tif_enum" AS ENUM('GTC', 'IOC', 'FOK')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" character varying(50) NOT NULL, "user_id" integer NOT NULL, "symbol" text NOT NULL, "side" "public"."orders_side_enum" NOT NULL, "type" "public"."orders_type_enum" NOT NULL, "price" numeric(38,18), "qty" numeric(38,18) NOT NULL, "filled_qty" numeric(38,18) NOT NULL DEFAULT '0', "status" "public"."orders_status_enum" NOT NULL DEFAULT 'NEW', "tif" "public"."orders_tif_enum" NOT NULL DEFAULT 'GTC', "client_order_id" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "CHK_55870aa0f133ae1ae8ab0e5b22" CHECK (filled_qty >= 0 AND filled_qty <= qty), CONSTRAINT "CHK_95dffecb8e8c5e3c0f140bc851" CHECK (qty > 0), CONSTRAINT "CHK_f7a5ede0d27155e9f4130cd511" CHECK ((type <> 'MARKET') OR (price IS NULL)), CONSTRAINT "CHK_4ed9a9b6c095c779267bec409c" CHECK ((type <> 'LIMIT') OR (price IS NOT NULL)), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7eddab37d238a7c0a7264b8b52" ON "orders" ("symbol", "side", "price") `);
        await queryRunner.query(`CREATE INDEX "IDX_fbfc1475fc6797244d160068cb" ON "orders" ("user_id", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_aa7681faf368387da9fff1e575" ON "orders" ("symbol", "status", "created_at") `);
        await queryRunner.query(`ALTER TABLE "balances" ADD CONSTRAINT "FK_864b90e3b151018347577be4f97" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "balances" ADD CONSTRAINT "FK_d923ec17ed1821f967736bdc0e7" FOREIGN KEY ("currency") REFERENCES "assets"("code") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "symbols" ADD CONSTRAINT "FK_e6ce9775abec1cbf9334cfe6f05" FOREIGN KEY ("base_asset") REFERENCES "assets"("code") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "symbols" ADD CONSTRAINT "FK_4bbfdc6d45c42281c5319dd5ba2" FOREIGN KEY ("quote_asset") REFERENCES "assets"("code") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_a922b820eeef29ac1c6800e826a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_90792f050aed15682318b108f86" FOREIGN KEY ("symbol") REFERENCES "symbols"("symbol") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_90792f050aed15682318b108f86"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_a922b820eeef29ac1c6800e826a"`);
        await queryRunner.query(`ALTER TABLE "symbols" DROP CONSTRAINT "FK_4bbfdc6d45c42281c5319dd5ba2"`);
        await queryRunner.query(`ALTER TABLE "symbols" DROP CONSTRAINT "FK_e6ce9775abec1cbf9334cfe6f05"`);
        await queryRunner.query(`ALTER TABLE "balances" DROP CONSTRAINT "FK_d923ec17ed1821f967736bdc0e7"`);
        await queryRunner.query(`ALTER TABLE "balances" DROP CONSTRAINT "FK_864b90e3b151018347577be4f97"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa7681faf368387da9fff1e575"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fbfc1475fc6797244d160068cb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7eddab37d238a7c0a7264b8b52"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "public"."orders_tif_enum"`);
        await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."orders_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."orders_side_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8537c94ae17acdcbd2cc15c99a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6ce9775abec1cbf9334cfe6f0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4bbfdc6d45c42281c5319dd5ba"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cf511b4541f3f2241cc13fc295"`);
        await queryRunner.query(`DROP TABLE "symbols"`);
        await queryRunner.query(`DROP TABLE "assets"`);
        await queryRunner.query(`DROP INDEX "public"."idx_balances_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_48e65054dbd579704f42a72713"`);
        await queryRunner.query(`DROP TABLE "balances"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
