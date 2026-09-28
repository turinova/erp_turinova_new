/**
 * Több dokumentumban ismétlődő blokkok. A 45/2014. Korm. rendelet 1–3. mellékletének szövege
 * (minta-tájékoztatók, nyilatkozatminta) jogszabályszöveg, ezért szó szerint vettük át, kitöltve.
 */

import {
  CONCILIATION_LIST_URL,
  CONSUMER_AUTHORITY_URL,
  legalPath,
  PAYMENT_METHODS,
  WITHDRAWAL_ANCHOR,
  WITHDRAWAL_LABEL
} from '@/lib/webshop/legal/constants'
import {
  dayRange,
  dl,
  ft,
  h3,
  link,
  mail,
  note,
  p,
  table,
  ul
} from '@/lib/webshop/legal/templates/helpers'
import type { LegalContext, LegalNode } from '@/lib/webshop/legal/types'

type Nodes = (LegalNode | null)[]

export function url(ctx: LegalContext, path: string): string {
  return `${ctx.shopUrl}${path}`
}

export function withdrawalUrl(ctx: LegalContext): string {
  return `${url(ctx, legalPath('elallas'))}#${WITHDRAWAL_ANCHOR}`
}

export function contactLine(ctx: LegalContext): string {
  const s = ctx.seller
  return [s.name, s.address, s.phone ? `telefon: ${s.phone}` : null, s.email ? `e-mail: ${s.email}` : null]
    .filter(Boolean)
    .join(', ')
}

export function sellerRows(ctx: LegalContext, opts: { bank?: boolean } = {}): LegalNode | null {
  const s = ctx.seller
  return dl([
    ['Név', s.name],
    ['Székhely', s.address],
    ['Levelezési és ügyfélszolgálati cím', ctx.serviceAddress && ctx.serviceAddress !== s.address ? ctx.serviceAddress : null],
    [s.registrationLabel, s.registrationNumber],
    ['Nyilvántartó', s.registryCourt],
    ['Adószám', s.taxNumber],
    ['Közösségi adószám', s.vatId],
    ['E-mail', s.email ? mail(s.email) : null],
    ['Telefon', s.phone],
    ['Ügyfélszolgálat', ctx.supportHours],
    ['Bankszámlaszám', opts.bank && ctx.payments.includes('transfer') ? ctx.bankAccount : null],
    ['Weboldal', ctx.shopUrl]
  ])
}

export function hostingRows(ctx: LegalContext): LegalNode | null {
  const h = ctx.hosting
  return dl([
    ['Tárhely-szolgáltató', h.name],
    ['Címe', h.address],
    ['E-mail', h.email ? mail(h.email) : null]
  ])
}

export function shippingFeeText(ctx: LegalContext): string | null {
  const { feeGross, freeFromGross } = ctx.shipping
  if (feeGross == null) return null
  if (feeGross === 0) return 'Ingyenes'
  return freeFromGross != null ? `${ft(feeGross)} (${ft(freeFromGross)} felett ingyenes)` : ft(feeGross)
}

export function shippingNodes(ctx: LegalContext): Nodes {
  const sh = ctx.shipping
  const fee = shippingFeeText(ctx) ?? 'A pénztárban látható'
  const days = dayRange(sh.daysMin, sh.daysMax)
  const rows = sh.carriers.map((c) => [
    c.label,
    c.company ? c.company.name : ctx.seller.name,
    fee,
    days ?? '—'
  ])
  if (sh.pickup.enabled) {
    rows.push(['Személyes átvétel', ctx.seller.name, 'Ingyenes', sh.pickup.label ?? ctx.seller.address ?? '—'])
  }
  const greener = sh.pickup.enabled || sh.carriers.some((c) => c.kind === 'locker' || c.kind === 'point')
  return [
    table(['Szállítási mód', 'Szolgáltató', 'Díj (bruttó)', 'Átfutás'], rows),
    p(
      'A szállítási díjat a kosár és a rendelés összesítője a termékek ára mellett, külön soron mutatja, még a megrendelés elküldése előtt. ' +
        'További, előre nem jelzett költség nem terheli.'
    ),
    p(
      (days
        ? `A megrendelést a visszaigazolástól számítva általában ${days} alatt kézbesítjük. `
        : 'A várható kézbesítési időt a termékoldal és a rendelés összesítője mutatja. ') +
        'Ha a termékoldal eltérő határidőt jelez (például beszállítótól rendelt terméknél az érkezés napját), az az irányadó. ' +
        'Legkésőbb a szerződés megkötésétől számított 30 napon belül teljesítünk. Ha a termék nem szállítható, erről haladéktalanul értesítjük, ' +
        'és a már kifizetett összeget legkésőbb 30 napon belül visszatérítjük.'
    ),
    sh.pickup.enabled
      ? p(
          `Személyes átvétel: ${sh.pickup.label ?? ctx.seller.address ?? 'a visszaigazolásban megadott címen'}. ` +
            'Az átvehetőségről e-mailben értesítjük.'
        )
      : null,
    p(
      greener
        ? 'Környezetbarátabb szállítási lehetőség: a csomagautomata, az átvételi pont és a személyes átvétel kevesebb kiszállítási utat igényel, mint a házhoz szállítás.'
        : 'Külön környezetbarát szállítási lehetőséget jelenleg nem kínálunk.'
    ),
    p(
      'Átvételkor ellenőrizze a csomag épségét. Sérült csomag esetén kérjen jegyzőkönyvet a futártól, vagy tagadja meg az átvételt. ' +
        'A termékkel kapcsolatos kárveszély akkor száll át Önre, amikor Ön vagy az Ön által kijelölt, a fuvarozótól eltérő személy a terméket átveszi.'
    )
  ]
}

export function paymentNodes(ctx: LegalContext): Nodes {
  const out: Nodes = []
  for (const code of ctx.payments) {
    const label = PAYMENT_METHODS[code].label
    if (code === 'card') {
      out.push(
        p(
          `${label}: a fizetés a Stripe biztonságos fizetési felületén, a megrendelés elküldésekor történik. ` +
            'A kártyaadatok nem jutnak el hozzánk; a Stripe csak a fizetés eredményét és azonosítóját küldi meg.'
        )
      )
    } else if (code === 'transfer') {
      out.push(
        p(
          `${label}: a megrendelés után e-mailben díjbekérőt küldünk` +
            (ctx.bankAccount ? `. Bankszámlaszámunk: ${ctx.bankAccount}` : '') +
            '. Közleményként kérjük, adja meg a rendelésszámot. ' +
            `A terméket a jóváírásig legfeljebb ${ctx.transferHoldDays} munkanapig lefoglaljuk; ha addig nem érkezik meg az összeg, ` +
            'a megrendelést töröljük, és erről e-mailben értesítjük. Feladás vagy átadás a jóváírás után történik.'
        )
      )
    } else if (code === 'cod') {
      out.push(p(`${label}: a vételárat és a szállítási díjat a futárnak fizeti a csomag átvételekor. Az utánvét díját a rendelés összesítője mutatja.`))
    } else {
      out.push(p(`${label}.`))
    }
  }
  if (out.length === 0) out.push(p('A választható fizetési módokat a pénztár oldal mutatja.'))
  out.push(
    p(
      ctx.features.invoicing
        ? 'A vásárlásról elektronikus számlát állítunk ki, és e-mailben küldjük meg.'
        : 'A vásárlásról számlát állítunk ki.'
    ),
    p('Az árak magyar forintban értendők, és tartalmazzák az általános forgalmi adót.')
  )
  return out
}

function returnAddressLine(ctx: LegalContext): string {
  return ctx.returns.address ? `${ctx.seller.name}, ${ctx.returns.address}` : ctx.seller.name
}

/** 45/2014. Korm. r. 1. melléklet (Elállási/Felmondási minta-tájékoztató), áru adásvételére kitöltve. */
export function withdrawalInfoNodes(ctx: LegalContext): Nodes {
  const days = ctx.returns.days
  return [
    h3('Elállási jog'),
    p(`Ön ${days} napon belül jogosult indokolás nélkül elállni e szerződéstől.`),
    p(
      `Az elállási határidő attól a naptól számított ${days} nap elteltével jár le, amelyen Ön vagy az Ön által megjelölt, ` +
        'a fuvarozótól eltérő harmadik személy az árut átveszi. Több áru szolgáltatásakor az utolsó áru, több tételből vagy darabból ' +
        'álló áru szolgáltatásakor az utolsó tétel vagy darab átvételének napjától kell számítani. ' +
        'Az elállási jogot a szerződés megkötése és az áru átvétele közötti időszakban is gyakorolhatja.'
    ),
    p(
      'Ha Ön elállási jogával élni kíván, elállási szándékát tartalmazó egyértelmű nyilatkozatát köteles eljuttatni ' +
        `(például postán vagy elektronikus úton küldött levél útján) az alábbi címre: ${contactLine(ctx)}. ` +
        'Ebből a célból felhasználhatja a lenti elállásinyilatkozat-mintát is.'
    ),
    p(
      `Az elállási jogát Ön online is gyakorolhatja a következő címen: ${link(WITHDRAWAL_LABEL, withdrawalUrl(ctx))}. ` +
        'Ha ezt az online funkciót veszi igénybe, az elállás megérkezését – az elállás tartalmát, valamint napját és időpontját is ' +
        'feltüntetve – tartós adathordozón (például elektronikus levélben) haladéktalanul visszaigazoljuk Önnek.'
    ),
    p('Ön határidőben gyakorolja elállási jogát, ha a fent megjelölt határidő lejárta előtt elküldi elállási nyilatkozatát.'),
    h3('Az elállás joghatásai'),
    p(
      'Ha Ön eláll ettől a szerződéstől, haladéktalanul, de legkésőbb az Ön elállási nyilatkozatának kézhezvételétől számított ' +
        '14 napon belül visszatérítjük az Ön által teljesített valamennyi ellenszolgáltatást, ideértve a fuvarozási költséget is ' +
        '(kivéve azokat a többletköltségeket, amelyek amiatt merültek fel, hogy Ön az általunk felkínált, legolcsóbb szokásos ' +
        'fuvarozási módtól eltérő fuvarozási módot választott). A visszatérítés során az eredeti ügylet során alkalmazott fizetési ' +
        'móddal egyező fizetési módot alkalmazunk, kivéve, ha Ön más fizetési mód igénybevételéhez kifejezetten a hozzájárulását adja; ' +
        'e visszatérítési mód alkalmazásából kifolyólag Önt semmilyen többletköltség nem terheli.'
    ),
    p(
      'A visszatérítést mindaddig visszatarthatjuk, amíg vissza nem kaptuk az árut, vagy Ön nem igazolta, hogy azt visszaküldte: ' +
        'a kettő közül a korábbi időpontot kell figyelembe venni.'
    ),
    p(
      `Ön köteles számunkra (${returnAddressLine(ctx)}) az árut indokolatlan késedelem nélkül, de legkésőbb elállási nyilatkozatának ` +
        'közlésétől számított 14 napon belül visszaküldeni vagy átadni. A határidő betartottnak minősül, ha a 14 napos határidő ' +
        'letelte előtt elküldi az árut.' +
        (ctx.shipping.pickup.enabled
          ? ` Ha az elállást üzletünkben személyesen jelenti be, az árut ott egyúttal vissza is adhatja${ctx.shipping.pickup.label ? ` (${ctx.shipping.pickup.label})` : ''}.`
          : '')
    ),
    p(
      ctx.returns.paidBy === 'seller'
        ? 'Az áru visszaküldésének költségeit mi viseljük.'
        : 'Az áru visszaküldésének közvetlen költségét Ön viseli.'
    ),
    p(
      'Ön kizárólag akkor vonható felelősségre az áruban bekövetkezett értékcsökkenésért, ha az az áru jellegének, ' +
        'tulajdonságainak és működésének megállapításához szükséges használatot meghaladó használat miatt következett be.'
    )
  ]
}

/** 45/2014. 29. § (1) — az áruvásárlásnál előforduló kivételek. */
export function withdrawalExceptionNodes(ctx: LegalContext): Nodes {
  return [
    h3('Mikor nem illeti meg az elállási jog?'),
    ctx.madeToOrder
      ? note(
          'Egyedi méretre gyártott vagy vágott termékeinket az Ön utasítása alapján állítjuk elő, ezért ezekre nem vonatkozik az elállási jog. ' +
            'Ezt a termékoldalon és a rendelés összesítőjében is jelöljük.'
        )
      : null,
    p('Nem gyakorolhatja az elállási jogot különösen:'),
    ul([
      'olyan nem előre gyártott áru esetében, amelyet az Ön utasítása alapján vagy kifejezett kérésére állítottak elő, vagy amelyet egyértelműen az Ön személyére szabtak;',
      'romlandó vagy minőségét rövid ideig megőrző áru esetében;',
      'olyan zárt csomagolású áru esetében, amely egészségvédelmi vagy higiéniai okokból az átadást követő felbontása után nem küldhető vissza;',
      'olyan áru esetében, amely jellegénél fogva az átadást követően elválaszthatatlanul vegyül más áruval;',
      'lezárt csomagolású hang-, illetve képfelvétel vagy számítógépes szoftver esetében, ha a csomagolást felbontotta.'
    ])
  ]
}

/** 45/2014. Korm. r. 2. melléklet. */
export function withdrawalTemplateNodes(ctx: LegalContext): Nodes {
  const s = ctx.seller
  return [
    h3('Elállásinyilatkozat-minta'),
    p('(csak a szerződéstől való elállási szándék esetén töltse ki és juttassa vissza)'),
    p(`Címzett: ${[s.name, s.address, s.email].filter(Boolean).join(', ')}`),
    p(
      'Alulírott(ak) kijelentem/kijelentjük, hogy gyakorlom/gyakoroljuk elállási jogomat/jogunkat az alábbi áru(k) adásvételére ' +
        'irányuló szerződés tekintetében:'
    ),
    ul([
      'Áru(k) megnevezése, rendelésszám: …',
      'Szerződéskötés időpontja / átvétel időpontja: …',
      'A fogyasztó(k) neve: …',
      'A fogyasztó(k) címe: …',
      'A fogyasztó(k) aláírása (kizárólag papír alapon tett nyilatkozat esetén): …',
      'Kelt: …'
    ])
  ]
}

/** 45/2014. Korm. r. 3. melléklet (mintatájékoztató), a Szolgáltatóra kitöltve. */
export function warrantyNodes(ctx: LegalContext): Nodes {
  const out: Nodes = [
    h3('Kellékszavatosság'),
    p('Ön a Szolgáltató hibás teljesítése esetén a vállalkozással szemben kellékszavatossági igényt érvényesíthet a Polgári Törvénykönyv szabályai szerint.'),
    p(
      'Ön – választása szerint – kérhet kijavítást vagy kicserélést, kivéve, ha az ezek közül az Ön által választott igény teljesítése ' +
        'lehetetlen vagy a vállalkozás számára más igénye teljesítéséhez képest aránytalan többletköltséggel járna. Ha a kijavítást vagy ' +
        'a kicserélést nem kérte, illetve nem kérhette, úgy igényelheti az ellenszolgáltatás arányos leszállítását, vagy – végső esetben – ' +
        'a szerződéstől is elállhat. Fogyasztóként a hibát a vállalkozás költségére maga nem javíthatja ki, illetve mással sem javíttathatja ki. ' +
        'Választott kellékszavatossági jogáról egy másikra is áttérhet, az áttérés költségét azonban Ön viseli, kivéve, ha az indokolt volt, ' +
        'vagy arra a vállalkozás adott okot.'
    ),
    p(
      'Ön köteles a hibát annak felfedezése után haladéktalanul, de nem később, mint a hiba felfedezésétől számított kettő hónapon belül közölni. ' +
        'A szerződés teljesítésétől számított két éves elévülési határidőn túl kellékszavatossági jogait már nem érvényesítheti. ' +
        'Használt termék esetén ez a határidő egy év.'
    ),
    p(
      'A teljesítéstől számított egy éven belül a kellékszavatossági igénye érvényesítésének a hiba közlésén túl nincs egyéb feltétele, ' +
        'ha Ön igazolja, hogy a terméket a Szolgáltató nyújtotta. A teljesítéstől számított egy év eltelte után azonban már Ön köteles ' +
        'bizonyítani, hogy az Ön által felismert hiba már a teljesítés időpontjában is megvolt.'
    ),
    h3('Termékszavatosság'),
    p(
      'Ingó dolog (termék) hibája esetén Ön – választása szerint – kellékszavatossági vagy termékszavatossági igényt érvényesíthet. ' +
        'Termékszavatossági igényként a hibás termék kijavítását vagy kicserélését kérheti a termék előállítójától vagy forgalmazójától (gyártó). ' +
        'A termék akkor hibás, ha nem felel meg a forgalomba hozatalakor hatályos minőségi követelményeknek, vagy ha nem rendelkezik a gyártó ' +
        'által adott leírásban szereplő tulajdonságokkal.'
    ),
    p(
      'Termékszavatossági igényét a termék gyártó általi forgalomba hozatalától számított két éven belül érvényesítheti; ennek során Önnek ' +
        'kell bizonyítania, hogy a termékhiba a forgalomba hozatal időpontjában fennállt. A gyártó akkor mentesül, ha bizonyítja, hogy a terméket ' +
        'nem üzleti tevékenysége körében gyártotta vagy hozta forgalomba, a hiba a tudomány és a technika állása szerint a forgalomba hozatal ' +
        'időpontjában nem volt felismerhető, vagy a hiba jogszabály vagy kötelező hatósági előírás alkalmazásából ered.'
    ),
    p(
      'Ugyanazon hiba miatt a vállalkozással szemben kellékszavatossági és a gyártóval szemben termékszavatossági igényt egyszerre, ' +
        'egymással párhuzamosan is érvényesíthet. Termékszavatossági igényének eredményes érvényesítése esetén a kicserélt termékre, illetve ' +
        'a javítással érintett részre vonatkozó kellékszavatossági igényét a továbbiakban már csak a gyártóval szemben érvényesítheti.'
    )
  ]
  if (ctx.warranty.mandatory || ctx.warranty.voluntaryMonths) {
    out.push(h3('Jótállás'))
    if (ctx.warranty.mandatory) {
      out.push(
        p(
          'A kötelező jótállás alá tartozó új, tartós fogyasztási cikkek (a termékoldalon jelöljük) esetén Ön hibás teljesítés miatt ' +
            'a kellékszavatossági jogokat az egyes tartós fogyasztási cikkekre vonatkozó kötelező jótállásról szóló kormányrendelet feltételeivel ' +
            'érvényesítheti. A jótállási idő alatt elsősorban kijavítást igényelhet; kicserélésnek van helye, ha a termék nem javítható, ha a ' +
            'kijavítás a bejelentéstől számított harminc napon belül nem történik meg, vagy ha a termék három javítás után ismét meghibásodik. ' +
            'Ha kicserélésre nincs lehetőség, a vételár visszatérítését kérheti.'
        ),
        p('A jótállás időtartama 10 000 forinttól 250 000 forintig terjedő eladási ár esetén két év, 250 000 forint feletti eladási ár esetén három év.')
      )
    }
    if (ctx.warranty.voluntaryMonths) {
      out.push(
        p(
          `Önkéntes jótállás: termékeinkre az átadástól számított ${ctx.warranty.voluntaryMonths} hónap jótállást vállalunk. ` +
            'A jótállási idő alatt a kellékszavatossági jogokkal azonos jogok illetik meg, és csak akkor mentesülünk, ha bizonyítjuk, ' +
            'hogy a hiba oka a teljesítés után keletkezett.'
        )
      )
    }
    out.push(
      p(
        'A jótállásból eredő jogait a jótállási jeggyel vagy – ennek hiányában – a vásárlást igazoló számlával gyakorolhatja. ' +
          'A jótállási igény teljesítésének nem feltétele a felbontott csomagolás visszaszolgáltatása. Ugyanazon hiba miatt ' +
          'kellékszavatossági és jótállási igényt, valamint termékszavatossági és jótállási igényt egyszerre is érvényesíthet; ha azonban ' +
          'egy adott hiba miatt egyszer sikerrel érvényesítette igényét, ugyanezen hiba tekintetében más jogi alapon erre már nem tarthat igényt.'
      )
    )
  }
  out.push(
    p(
      'Szavatossági vagy jótállási igényét az ügyfélszolgálatunkon jelentheti be. Az igényről jegyzőkönyvet veszünk fel, és arra ' +
        'törekszünk, hogy a kijavítást vagy kicserélést legkésőbb 15 napon belül elvégezzük.'
    )
  )
  return out
}

export function complaintNodes(ctx: LegalContext): Nodes {
  const s = ctx.seller
  const address = ctx.serviceAddress ?? s.address
  const body = ctx.conciliation
  const out: Nodes = [
    p('Panaszát az alábbi elérhetőségeken teheti meg:'),
    ul([
      s.email ? `e-mailben: ${mail(s.email)}` : null,
      s.phone ? `telefonon: ${s.phone}${ctx.supportHours ? ` (${ctx.supportHours})` : ''}` : null,
      address ? `postai úton: ${s.name}, ${address}` : null,
      `online elállás: ${link(WITHDRAWAL_LABEL, withdrawalUrl(ctx))}`
    ]),
    p(
      'A szóbeli panaszt azonnal megvizsgáljuk, és szükség szerint orvosoljuk. Ha Ön a panasz kezelésével nem ért egyet, vagy az azonnali ' +
        'kivizsgálás nem lehetséges, a panaszról jegyzőkönyvet veszünk fel, és annak másolatát – telefonon közölt panasz esetén – legkésőbb ' +
        'az érdemi válasszal együtt megküldjük. Telefonon közölt panasz esetén egyedi azonosítószámot adunk.'
    ),
    p(
      'Az írásbeli panaszra a beérkezésétől számított 30 napon belül írásban, érdemben válaszolunk. A panasz elutasítását megindokoljuk. ' +
        'A panaszról felvett jegyzőkönyvet és a válasz másolatát három évig megőrizzük.'
    )
  ]
  if (ctx.audience === 'business') return out

  out.push(
    h3('Fogyasztóvédelmi hatóság'),
    p(
      'Ha fogyasztói jogai megsértését észleli, a lakóhelye szerint illetékes vármegyei kormányhivatal fogyasztóvédelmi hatóságához ' +
        `fordulhat. Elérhetőségek: ${link('kormanyhivatalok.hu', CONSUMER_AUTHORITY_URL)}.`
    ),
    h3('Békéltető testület'),
    p(
      'Ha panaszát elutasítjuk, Ön a termék minőségével, biztonságosságával, a termékfelelősségi szabályok alkalmazásával, valamint a ' +
        'szerződés megkötésével és teljesítésével kapcsolatos jogvitában bírósági eljáráson kívül, ingyenesen békéltető testülethez fordulhat. ' +
        'Illetékes a lakóhelye vagy tartózkodási helye szerinti testület; kérelmére a kérelemben megjelölt testület is eljár.'
    ),
    body
      ? p('A székhelyünk szerint illetékes békéltető testület:')
      : p(`A békéltető testületek listája: ${link('bekeltetes.hu', CONCILIATION_LIST_URL)}.`),
    body
      ? dl([
          ['Név', body.name],
          ['Cím', body.address],
          ['Telefon', body.phone ?? null],
          ['E-mail', body.email ? mail(body.email) : null],
          ['Weboldal', body.website ? link(body.website.replace(/^https?:\/\//, ''), body.website) : null]
        ])
      : null,
    body ? p(`Az összes békéltető testület elérhetősége és az online kérelem: ${link('bekeltetes.hu', CONCILIATION_LIST_URL)}.`) : null,
    p(
      'A békéltető testületi eljárásban együttműködési kötelezettség terhel minket: a testület felhívására írásban válaszolunk, és a ' +
        'meghallgatáson egyezség létrehozatalára jogosult személy vesz részt.'
    ),
    h3('Bírósági eljárás'),
    p('Jogvita esetén Ön a polgári perrendtartás szabályai szerint illetékes bírósághoz is fordulhat.')
  )
  return out
}

export function summaryOf(ctx: LegalContext): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  if (ctx.audience === 'consumer') {
    out.push({ label: 'Elállás', value: `${ctx.returns.days} nap, indoklás nélkül` })
    out.push({ label: 'Szavatosság', value: '2 év kellékszavatosság' })
  }
  const fee = shippingFeeText(ctx)
  if (fee) out.push({ label: 'Szállítás', value: fee })
  if (ctx.payments.length) {
    out.push({ label: 'Fizetés', value: ctx.payments.map((c) => PAYMENT_METHODS[c].label).join(' · ') })
  }
  if (ctx.seller.email) out.push({ label: 'Kérdés, panasz', value: ctx.seller.email })
  return out
}
