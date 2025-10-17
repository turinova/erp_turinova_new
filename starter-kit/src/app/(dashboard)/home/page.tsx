import UnderMaintenance from '@/views/UnderMaintenance'
import { getMode } from '@core/utils/serverHelpers'

export default async function Page() {
  const mode = await getMode()
  
  return <UnderMaintenance mode={mode} />
}
