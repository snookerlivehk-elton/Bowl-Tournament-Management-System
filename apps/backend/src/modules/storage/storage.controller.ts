import { Body, Controller, Post } from '@nestjs/common'
import { StorageService } from './storage.service.js'
import { PrismaService } from '../../prisma.service.js'

@Controller('api/uploads')
export class StorageController {
  constructor(private readonly storage: StorageService, private readonly prisma: PrismaService) {}

  @Post('sign')
  async sign(@Body() body: any) {
    const mime = body.mime || 'application/octet-stream'
    const size = Number(body.size || 10485760)
    return this.storage.createUploadPost(mime, size)
  }

  @Post('complete')
  async complete(@Body() body: any) {
    const entryId = Number(body.entryId)
    if (!entryId) return { ok: false }
    const att = await this.prisma.attachment.create({
      data: {
        entryId,
        storageKey: body.key,
        filename: body.filename,
        mime: body.mime,
        size: Number(body.size || 0),
        pages: Number(body.pages || 0),
      },
    })
    return att
  }
}
