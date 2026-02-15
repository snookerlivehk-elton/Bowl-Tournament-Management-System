import { Module } from '@nestjs/common'
import { PrismaService } from '../../prisma.service.js'
import { EntriesController } from './entries.controller.js'

@Module({
  controllers: [EntriesController],
  providers: [PrismaService],
})
export class EntriesModule {}
