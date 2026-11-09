import type { MeDto } from '../../../../contracts/users'
import { useContainer } from '../../../container'
import { defineApiHandler, requireUserId } from '../../../shared/infrastructure/http'

export default defineApiHandler(async (event): Promise<MeDto> => {
    const { access, users } = useContainer()
    const user = await users.get.execute(await requireUserId(event, access))
    return { id: user.id, name: user.displayName }
})
