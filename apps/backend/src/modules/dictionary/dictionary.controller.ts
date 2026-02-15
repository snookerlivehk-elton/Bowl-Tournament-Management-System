import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { DictionaryService } from './dictionary.service.js'

@Controller('api')
export class DictionaryController {
  constructor(private readonly svc: DictionaryService) {}

  @Get('categories')
  listCategories(@Query('q') q?: string) {
    return this.svc.list('category', q)
  }

  @Post('categories/quick-create')
  createCategory(@Body('name') name: string) {
    return this.svc.quickCreate('category', name)
  }

  @Get('companies')
  listCompanies(@Query('q') q?: string) {
    return this.svc.list('company', q)
  }

  @Post('companies/quick-create')
  createCompany(@Body('name') name: string) {
    return this.svc.quickCreate('company', name)
  }

  @Get('handlers')
  listHandlers(@Query('q') q?: string) {
    return this.svc.list('handler', q)
  }

  @Post('handlers/quick-create')
  createHandler(@Body('name') name: string) {
    return this.svc.quickCreate('handler', name)
  }

  @Get('funds')
  listFunds(@Query('q') q?: string) {
    return this.svc.list('fund', q)
  }

  @Post('funds/quick-create')
  createFund(@Body('name') name: string, @Body('direction') direction?: string) {
    return this.svc.quickCreate('fund', name, direction)
  }
}
