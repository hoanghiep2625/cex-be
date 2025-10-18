import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ledger } from './entities/ledger.entity';
import { LedgerService } from './ledger.service';
import { Balance } from '../balances/entities/balance.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ledger, Balance])],
  controllers: [],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
