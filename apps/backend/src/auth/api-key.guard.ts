import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest()
    const key = process.env.API_KEY
    if (!key) return true
    const header = req.headers['x-api-key']
    if (typeof header === 'string' && header === key) return true
    throw new UnauthorizedException()
  }
}
