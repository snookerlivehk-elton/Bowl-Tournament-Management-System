import { Module } from '@nestjs/common'
import { StorageService } from './storage.service.js'
import { StorageController } from './storage.controller.js'
import { PrismaService } from '../../prisma.service.js'

@Module({
  providers: [PrismaService, StorageService],
  controllers: [StorageController],
  exports: [StorageService],
})
export class StorageModule {}
