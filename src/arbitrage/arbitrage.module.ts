import { Module } from '@nestjs/common';
import { ArbitrageService } from './arbitrage.service';
import { AlorModule } from '../alor/alor.module';
import { CtraderModule } from '../ctrader/ctrader.module';

@Module({
  imports: [AlorModule, CtraderModule],
  providers: [ArbitrageService],
  exports: [ArbitrageService],
})
export class ArbitrageModule {}

