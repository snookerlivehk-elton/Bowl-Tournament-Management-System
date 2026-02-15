import { Module } from '@nestjs/common'
import { PrismaService } from '../../prisma.service.js'
import { DictionaryController } from './dictionary.controller.js'
import { DictionaryService } from './dictionary.service.js'

@Module({
  providers: [PrismaService, DictionaryService],
  controllers: [DictionaryController],
  exports: [DictionaryService],
})
export class DictionaryModule {}
