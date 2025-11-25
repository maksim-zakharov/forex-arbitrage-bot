import { Module } from '@nestjs/common';
import { WebhookModule } from './webhook/webhook.module';
import { AlorModule } from './alor/alor.module';
import { CtraderModule } from './ctrader/ctrader.module';
import { ArbitrageModule } from './arbitrage/arbitrage.module';

@Module({
  imports: [
    WebhookModule,
    AlorModule,
    CtraderModule,
    ArbitrageModule,
  ],
})
export class AppModule {}

