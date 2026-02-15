import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma.service.js'
import { HealthController } from './health.controller.js'
import { DictionaryModule } from './dictionary/dictionary.module.js'
import { EntriesModule } from './entries/entries.module.js'
import { StorageModule } from './storage/storage.module.js'

@Module({
  imports: [DictionaryModule, EntriesModule, StorageModule],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
