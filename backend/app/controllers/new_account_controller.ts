import User from '#models/user'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import UserTransformer from '#transformers/user_transformer'

export default class NewAccountController {
  async store({ request, serialize }: HttpContext) {
    const { firstName, lastName, nickname, email, password } =
      await request.validateUsing(signupValidator)
    const user = await User.create({
      firstName,
      lastName,
      nickname,
      fullName: `${firstName} ${lastName}`,
      email,
      password,
    })
    // The token provider uses its own connection, so create it after the user commits.
    const token = await User.accessTokens.create(user)

    return serialize({
      user: UserTransformer.transform(user),
      token: token.value!.release(),
    })
  }
}
