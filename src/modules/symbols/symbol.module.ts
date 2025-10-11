import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SymbolController } from './symbol.controller';
import { SymbolService } from './symbol.service';
import { Symbol } from './entities/symbol.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Symbol])],
  controllers: [SymbolController],
  providers: [SymbolService],
  exports: [SymbolService],
})
export class SymbolModule {}
