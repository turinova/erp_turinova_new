'use client'

import FronttervezoQuoteDetailClient, {
  type FronttervezoQuoteDetail
} from '../../fronttervezo-quotes/[id]/FronttervezoQuoteDetailClient'

type FeeType = {
  id: string
  name: string
  net_price: number
  [key: string]: unknown
}

interface Props {
  initialQuoteData: FronttervezoQuoteDetail
  feeTypes: FeeType[]
}

export default function FronttervezoOrderDetailClient({ initialQuoteData, feeTypes }: Props) {
  return (
    <FronttervezoQuoteDetailClient
      initialQuoteData={initialQuoteData}
      feeTypes={feeTypes}
      isOrderView
    />
  )
}
