import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { isUniqueViolation } from '#services/channel_service'

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction

  async handle(error: unknown, ctx: HttpContext) {
    if (isUniqueViolation(error)) {
      return ctx.response.conflict({
        errors: [{ code: 'E_ALREADY_EXISTS', message: 'That name or email is already in use' }],
      })
    }
    const failure = error as { code?: string; status?: number; message?: string }
    if (
      failure.code?.startsWith('E_') &&
      failure.status &&
      failure.status < 500 &&
      failure.code !== 'E_VALIDATION_ERROR'
    ) {
      return ctx.response
        .status(failure.status)
        .send({ errors: [{ code: failure.code, message: failure.message }] })
    }
    return super.handle(error, ctx)
  }

  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
