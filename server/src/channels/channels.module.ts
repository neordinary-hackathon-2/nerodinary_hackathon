import { Module } from '@nestjs/common';
import { ResilienceModule } from '@nestjs/resilience';
import { ChannelsController } from './channels.controller.js';
import { ChannelsService } from './channels.service.js';

@Module({
  imports: [ResilienceModule.forRoot()],
  controllers: [ChannelsController],
  providers: [ChannelsService],
})
export class ChannelsModule {}
