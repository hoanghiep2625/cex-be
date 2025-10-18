import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import {
  Ledger,
  LedgerType,
  BalanceChangeType,
} from './entities/ledger.entity';

export interface CreateLedgerParams {
  user_id: number;
  currency: string;
  type: LedgerType;
  change_type: BalanceChangeType;
  amount: string | number;
  balance_before: string | number;
  balance_after: string | number;
  reference_type?: string;
  reference_id?: string;
  description?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(Ledger)
    private readonly ledgerRepository: Repository<Ledger>,
  ) {}

  /**
   * 📝 Record a ledger entry
   * @param params - Ledger parameters
   */
  async recordLedger(params: CreateLedgerParams): Promise<Ledger> {
    const ledger = this.ledgerRepository.create({
      user_id: params.user_id,
      currency: params.currency,
      type: params.type,
      change_type: params.change_type,
      amount: new Decimal(params.amount).toString(),
      balance_before: new Decimal(params.balance_before).toString(),
      balance_after: new Decimal(params.balance_after).toString(),
      reference_type: params.reference_type,
      reference_id: params.reference_id,
      description: params.description,
      metadata: params.metadata || {},
    });

    return this.ledgerRepository.save(ledger);
  }

  /**
   * 📝 Record multiple ledger entries (batch)
   * Useful for trades where 2 users are affected
   */
  async recordLedgerBatch(entries: CreateLedgerParams[]): Promise<Ledger[]> {
    const ledgers = entries.map((entry) =>
      this.ledgerRepository.create({
        user_id: entry.user_id,
        currency: entry.currency,
        type: entry.type,
        change_type: entry.change_type,
        amount: new Decimal(entry.amount).toString(),
        balance_before: new Decimal(entry.balance_before).toString(),
        balance_after: new Decimal(entry.balance_after).toString(),
        reference_type: entry.reference_type,
        reference_id: entry.reference_id,
        description: entry.description,
        metadata: entry.metadata || {},
      }),
    );

    return this.ledgerRepository.save(ledgers);
  }
}
