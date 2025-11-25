import { Module } from '@nestjs/common';
import { AlorService } from './alor.service';

@Module({
  providers: [AlorService],
  exports: [AlorService],
})
export class AlorModule {}

