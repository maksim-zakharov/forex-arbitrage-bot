import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { ArbitrageModule } from '../arbitrage/arbitrage.module';

@Module({
  imports: [ArbitrageModule],
  controllers: [WebhookController],
})
export class WebhookModule {}

