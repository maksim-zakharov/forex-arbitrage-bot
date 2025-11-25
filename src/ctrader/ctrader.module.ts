import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CtraderService } from './ctrader.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [CtraderService],
  exports: [CtraderService],
})
export class CtraderModule {}

