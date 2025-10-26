import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1761378855561 implements MigrationInterface {
    name = 'Migration1761378855561'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" integer NOT NULL, "listen_key" character varying(255) NOT NULL, "ip_address" character varying(255), "user_agent" character varying(255), "expires_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_501020ef1327588798944ecaf33" UNIQUE ("listen_key"), CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dbc81ff542b1b3366bae195f2a" ON "user_sessions" ("expires_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_501020ef1327588798944ecaf3" ON "user_sessions" ("listen_key") `);
        await queryRunner.query(`CREATE INDEX "IDX_2c8a3ef6b4e721c6cdf08aaaad" ON "user_sessions" ("user_id", "listen_key") `);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_e9658e959c490b0a634dfc54783"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2c8a3ef6b4e721c6cdf08aaaad"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_501020ef1327588798944ecaf3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dbc81ff542b1b3366bae195f2a"`);
        await queryRunner.query(`DROP TABLE "user_sessions"`);
    }

}
