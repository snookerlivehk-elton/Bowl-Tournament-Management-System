import { Body, Controller, Get, Post, Query, Headers, UseGuards } from '@nestjs/common'
import { PrismaService } from '../../prisma.service.js'
import { ApiKeyGuard } from '../../auth/api-key.guard.js'
import { Prisma } from '@prisma/client'

@Controller('api/entries')
export class EntriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Body() body: any, @Headers('Idempotency-Key') idem?: string) {
    const amt = Number(body.amount)
    const flow = body.flow === 'expense' ? 'expense' : body.flow === 'income' ? 'income' : null
    const data = {
      date: body.date ? new Date(body.date) : new Date(),
      categoryId: body.categoryId,
      companyId: body.companyId,
      handlerId: body.handlerId,
      fundId: body.fundId,
      content: body.content,
      amount: flow === 'expense' ? -Math.abs(amt) : flow === 'income' ? Math.abs(amt) : amt,
      note: body.note ?? null,
      createdBy: body.createdBy ?? null,
      idempotencyKey: idem || body.idempotencyKey || null,
    }
    if (data.idempotencyKey) {
      const existing = await this.prisma.entry.findUnique({ where: { idempotencyKey: data.idempotencyKey } })
      if (existing) return existing
    }
    const entry = await this.prisma.entry.create({ data })
    return entry
  }

  @Get()
  async list(
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('category') category?: string,
    @Query('company') company?: string,
    @Query('handler') handler?: string,
    @Query('fund') fund?: string,
    @Query('keyword') keyword?: string,
    @Query('min_amount') minAmount?: string,
    @Query('max_amount') maxAmount?: string,
    @Query('flow') flow?: string,
    @Query('has_receipt') hasReceipt?: string
  ) {
    const where: any = {}
    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date.gte = new Date(dateFrom)
      if (dateTo) where.date.lte = new Date(dateTo)
    }
    if (category) where.categoryId = Number(category)
    if (company) where.companyId = Number(company)
    if (handler) where.handlerId = Number(handler)
    if (fund) where.fundId = Number(fund)
    if (keyword) where.OR = [{ content: { contains: keyword, mode: Prisma.QueryMode.insensitive } }, { note: { contains: keyword, mode: Prisma.QueryMode.insensitive } }]
    if (minAmount) where.amount = { ...(where.amount || {}), gte: Number(minAmount) }
    if (maxAmount) where.amount = { ...(where.amount || {}), lte: Number(maxAmount) }
    if (flow === 'income') where.amount = { ...(where.amount || {}), gt: 0 }
    if (flow === 'expense') where.amount = { ...(where.amount || {}), lt: 0 }
    if (hasReceipt === 'true') where.attachments = { some: {} }
    if (hasReceipt === 'false') where.attachments = { none: {} }
    const items = await this.prisma.entry.findMany({
      where,
      include: { attachments: true, category: true, company: true, handler: true, fund: true },
      orderBy: { date: 'desc' },
    })
    return items
  }

  @UseGuards(ApiKeyGuard)
  @Post('batch')
  async batch(@Body() body: any[]) {
    const results = []
    for (const b of Array.isArray(body) ? body : []) {
      const amt = Number(b.amount)
      const flow = b.flow === 'expense' ? 'expense' : b.flow === 'income' ? 'income' : null
      const data = {
        date: b.date ? new Date(b.date) : new Date(),
        categoryId: b.categoryId,
        companyId: b.companyId,
        handlerId: b.handlerId,
        fundId: b.fundId,
        content: b.content,
        amount: flow === 'expense' ? -Math.abs(amt) : flow === 'income' ? Math.abs(amt) : amt,
        note: b.note ?? null,
        createdBy: b.createdBy ?? null,
        idempotencyKey: b.idempotencyKey || null,
      }
      if (data.idempotencyKey) {
        const existing = await this.prisma.entry.findUnique({ where: { idempotencyKey: data.idempotencyKey } })
        if (existing) {
          results.push(existing)
          continue
        }
      }
      const entry = await this.prisma.entry.create({ data })
      results.push(entry)
    }
    return { ok: true, count: results.length, items: results }
  }
}
