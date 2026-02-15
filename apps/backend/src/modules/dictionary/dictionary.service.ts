import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma.service.js'

type DictType = 'category' | 'company' | 'handler' | 'fund'

@Injectable()
export class DictionaryService {
  constructor(private readonly prisma: PrismaService) {}

  list(type: DictType, q?: string) {
    const where = q
      ? { name: { contains: q, mode: 'insensitive' }, active: true }
      : { active: true }
    switch (type) {
      case 'category':
        return this.prisma.category.findMany({ where, orderBy: { name: 'asc' } })
      case 'company':
        return this.prisma.company.findMany({ where, orderBy: { name: 'asc' } })
      case 'handler':
        return this.prisma.handler.findMany({ where, orderBy: { name: 'asc' } })
      case 'fund':
        return this.prisma.fund.findMany({ where, orderBy: { name: 'asc' } })
    }
  }

  async quickCreate(type: DictType, name: string, direction?: string) {
    const n = name?.trim()
    if (!n) return { ok: false }
    const data: any = { name: n, active: true }
    if (type === 'fund' && direction) data.direction = direction
    switch (type) {
      case 'category':
        return this.prisma.category.upsert({
          where: { name: n },
          update: { active: true },
          create: data,
        })
      case 'company':
        return this.prisma.company.upsert({
          where: { name: n },
          update: { active: true },
          create: data,
        })
      case 'handler':
        return this.prisma.handler.upsert({
          where: { name: n },
          update: { active: true },
          create: data,
        })
      case 'fund':
        return this.prisma.fund.upsert({
          where: { name: n },
          update: { active: true, direction: data.direction },
          create: data,
        })
    }
  }
}
