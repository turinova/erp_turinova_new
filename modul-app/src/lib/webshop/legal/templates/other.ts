import { legalPath, LEGAL_DOCS, WITHDRAWAL_ANCHOR } from '@/lib/webshop/legal/constants'
import { dl, link, mail, note, p, section, table, ul } from '@/lib/webshop/legal/templates/helpers'
import {
  complaintNodes,
  hostingRows,
  paymentNodes,
  sellerRows,
  shippingNodes,
  summaryOf,
  url,
  warrantyNodes,
  withdrawalExceptionNodes,
  withdrawalInfoNodes,
  withdrawalTemplateNodes
} from '@/lib/webshop/legal/templates/shared'
import type { LegalContext, LegalDoc } from '@/lib/webshop/legal/types'

export function elallasDoc(ctx: LegalContext): LegalDoc {
  const title = LEGAL_DOCS.elallas.title
  if (ctx.audience === 'business') {
    return {
      kind: 'elallas',
      title,
      summary: [],
      intro: [
        'Webáruházunk kizárólag vállalkozások részére értékesít, ezért a fogyasztókat megillető 14 napos elállási jog nem alkalmazható. ' +
          'Visszáru ügyében kérjük, keresse ügyfélszolgálatunkat.'
      ],
      sections: [section('kapcsolat', 'Kapcsolat', [sellerRows(ctx)])]
    }
  }
  return {
    kind: 'elallas',
    title,
    summary: [
      { label: 'Határidő', value: `${ctx.returns.days} nap az átvételtől` },
      { label: 'Visszatérítés', value: '14 napon belül' },
      {
        label: 'Visszaküldés',
        value: ctx.returns.paidBy === 'seller' ? 'A költséget mi álljuk' : 'A költség a vásárlót terheli'
      }
    ],
    intro: [
      `Fogyasztóként a terméket az átvételtől számított ${ctx.returns.days} napon belül indoklás nélkül visszaküldheti. ` +
        'Az elállást az alábbi űrlapon, regisztráció nélkül jelentheti be; a beérkezést e-mailben azonnal visszaigazoljuk.'
    ],
    sections: [
      section(WITHDRAWAL_ANCHOR, 'Elállás bejelentése online', [{ t: 'form', id: 'withdrawal' }]),
      section('tajekoztato', 'Tájékoztató az elállási jogról', withdrawalInfoNodes(ctx)),
      section('kivetelek', 'Kivételek', withdrawalExceptionNodes(ctx)),
      section('minta', 'Elállás postán vagy e-mailben', [
        p('Ha nem az online űrlapot használja, az alábbi mintát kitöltve postán vagy e-mailben is elküldheti. A minta használata nem kötelező.'),
        ...withdrawalTemplateNodes(ctx)
      ])
    ]
  }
}

export function szallitasFizetesDoc(ctx: LegalContext): LegalDoc {
  return {
    kind: 'szallitas-es-fizetes',
    title: LEGAL_DOCS['szallitas-es-fizetes'].title,
    summary: summaryOf(ctx).filter((r) => r.label === 'Szállítás' || r.label === 'Fizetés'),
    intro: ['Az alábbi szállítási és fizetési módok közül a pénztárban választhat. A végösszeget a megrendelés elküldése előtt látja.'],
    sections: [
      section('szallitas', 'Szállítás', shippingNodes(ctx)),
      section('fizetes', 'Fizetés', paymentNodes(ctx)),
      section('tovabbi', 'További információ', [
        p(`A részletes feltételeket az ${link(LEGAL_DOCS.aszf.title, url(ctx, legalPath('aszf')))} tartalmazza.`)
      ])
    ]
  }
}

export function panaszkezelesDoc(ctx: LegalContext): LegalDoc {
  return {
    kind: 'panaszkezeles',
    title: LEGAL_DOCS.panaszkezeles.title,
    summary: ctx.seller.email ? [{ label: 'Kérdés, panasz', value: ctx.seller.email }] : [],
    intro: ['Ha elégedetlen a vásárlással vagy a termékkel, kérjük, először forduljon hozzánk: a legtöbb problémát gyorsan meg tudjuk oldani.'],
    sections: [
      section('panasz', 'Panasz bejelentése', complaintNodes(ctx)),
      ...(ctx.audience === 'consumer' ? [section('szavatossag', 'Szavatosság és jótállás', warrantyNodes(ctx))] : [])
    ]
  }
}

export function impresszumDoc(ctx: LegalContext): LegalDoc {
  return {
    kind: 'impresszum',
    title: LEGAL_DOCS.impresszum.title,
    summary: [],
    intro: ['Az elektronikus kereskedelmi szolgáltatásokról szóló 2001. évi CVIII. törvény 4. §-a szerinti adatok.'],
    sections: [
      section('szolgaltato', 'Szolgáltató', [sellerRows(ctx)]),
      section('tarhely', 'Tárhely-szolgáltató', [hostingRows(ctx)])
    ]
  }
}

export function sutikDoc(ctx: LegalContext): LegalDoc {
  const card = ctx.payments.includes('card')
  return {
    kind: 'sutik',
    title: LEGAL_DOCS.sutik.title,
    summary: [{ label: 'Követő sütik', value: 'Nincsenek' }],
    intro: [
      'Webáruházunk nem használ hirdetési, követő vagy statisztikai sütit, és nem ad át böngészési adatot harmadik félnek. ' +
        'Ezért süti-hozzájárulást sem kérünk.'
    ],
    sections: [
      section('helyi', 'Mit tárolunk a böngészőjében?', [
        p('A vásárlás kényelméhez néhány adatot kizárólag az Ön böngészőjében (helyi tárolóban) őrzünk. Ezek nem jutnak el hozzánk, amíg meg nem rendel:'),
        table(
          ['Név', 'Tartalom', 'Cél', 'Időtartam'],
          [
            ['bolt-kosar-v1', 'a kosárba tett termékek és mennyiségek', 'a kosár megőrzése', 'amíg ki nem üríti'],
            ['bolt-latott-v1', 'a legutóbb megnézett termékek', '„Nemrég megnézett” lista', 'amíg ki nem törli'],
            ['bolt-keresesek-v1', 'a legutóbbi keresések', 'gyors újrakeresés', 'amíg ki nem törli']
          ]
        ),
        p('Ezek a webáruház Ön által kért funkcióihoz feltétlenül szükségesek, ezért nem igényelnek hozzájárulást (Eht. 155. § (4)).')
      ]),
      card
        ? section('fizetes', 'Online fizetés', [
            p(
              'Kártyás fizetéskor a Stripe fizetési felületére irányítjuk, amely a csalásmegelőzéshez és a biztonságos fizetéshez saját, ' +
                `szükséges sütiket használ. Ezekről a ${link('Stripe süti-tájékoztatója', 'https://stripe.com/cookie-settings')} ad tájékoztatást.`
            )
          ])
        : section('fizetes', 'Harmadik felek', [p('Harmadik féltől származó sütit a webáruház nem tölt be.')]),
      section('torles', 'Hogyan törölheti?', [
        p('A helyi tárolót a böngésző beállításaiban, a „Webhelyadatok” vagy „Sütik és webhelyadatok” menüpontban törölheti.'),
        p(`A személyes adatok kezeléséről az ${link(LEGAL_DOCS.adatkezeles.title, url(ctx, legalPath('adatkezeles')))} tájékoztat.`)
      ])
    ]
  }
}

export function akadalymentessegDoc(ctx: LegalContext): LegalDoc {
  const s = ctx.seller
  return {
    kind: 'akadalymentesseg',
    title: LEGAL_DOCS.akadalymentesseg.title,
    summary: [{ label: 'Célkitűzés', value: 'WCAG 2.1 AA' }],
    intro: [
      `A(z) ${s.name} elkötelezett amellett, hogy webáruháza mindenki számára használható legyen, a termékek és szolgáltatások ` +
        'akadálymentességi követelményeiről szóló 2022. évi LII. törvény és az EN 301 549 szabvány (WCAG 2.1 AA szint) szerint.'
    ],
    sections: [
      section('allapot', 'Megfelelés', [
        ul([
          'Az oldalak billentyűzettel teljes egészében kezelhetők, a fókusz mindig látható.',
          'Az űrlapmezők felirata a mező felett, látható módon szerepel; a hibaüzenetek szövegesek.',
          'Az állapotokat (például készlet, rendelés állapota) nem csak színnel, hanem szöveggel is jelezzük.',
          'A termékképekhez helyettesítő szöveget adunk meg.',
          'A szöveg a böngészőben 200%-ig nagyítható a tartalom elvesztése nélkül.'
        ]),
        note(
          'Ismert korlát: a termékképek helyettesítő szövege a termék nevéből készül, ezért nem mindig írja le a kép tartalmát. ' +
            'Ha egy termékről részletesebb leírásra van szüksége, kérjük, keressen minket.'
        ),
        ctx.microEnterprise
          ? p(
              'Mikrovállalkozásként a törvény szolgáltatásokra vonatkozó követelményei alól mentesülünk; az akadálymentességet ' +
                'ettől függetlenül vállaljuk.'
            )
          : null
      ]),
      section('visszajelzes', 'Visszajelzés és kapcsolat', [
        p('Ha akadályba ütközik, vagy egy tartalmat más formában szeretne megkapni, jelezze nekünk; 30 napon belül válaszolunk.'),
        dl([
          ['E-mail', s.email ? mail(s.email) : null],
          ['Telefon', s.phone],
          ['Postacím', ctx.serviceAddress ?? s.address]
        ])
      ]),
      section('hatosag', 'Jogérvényesítés', [
        p(
          'Ha válaszunkkal nem elégedett, a fogyasztóvédelmi hatósághoz (a vármegyei kormányhivatalhoz) fordulhat, amely a ' +
            'termékek és szolgáltatások akadálymentességének piacfelügyeleti hatósága.'
        )
      ])
    ]
  }
}
