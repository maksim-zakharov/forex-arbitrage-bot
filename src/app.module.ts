import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebhookModule } from './webhook/webhook.module';
import { AlorModule } from './alor/alor.module';
import { CtraderModule } from './ctrader/ctrader.module';
import { ArbitrageModule } from './arbitrage/arbitrage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    WebhookModule,
    AlorModule,
    CtraderModule,
    ArbitrageModule,
  ],
})
export class AppModule {}

