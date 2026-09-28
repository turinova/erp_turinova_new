import { legalPath, LEGAL_DOCS, NAIH } from '@/lib/webshop/legal/constants'
import { dl, h3, link, mail, p, section, table, ul } from '@/lib/webshop/legal/templates/helpers'
import { sellerRows, url } from '@/lib/webshop/legal/templates/shared'
import type { LegalContext, LegalDoc } from '@/lib/webshop/legal/types'

type Purpose = [cel: string, adatok: string, jogalap: string, ido: string]

function purposes(ctx: LegalContext): Purpose[] {
  const out: Purpose[] = [
    [
      'Megrendelés, szerződés teljesítése',
      'név, e-mail cím, telefonszám, szállítási és számlázási cím, a rendelt termékek, a rendelés időpontja, a fizetés módja és állapota',
      'GDPR 6. cikk (1) b) – szerződés teljesítése',
      'a teljesítéstől számított 5 év (a Ptk. szerinti elévülés)'
    ],
    [
      'Számlázás',
      'név, számlázási cím, cég esetén adószám, a vásárlás tételei és összege',
      'GDPR 6. cikk (1) c) – jogi kötelezettség (az Áfa tv. és a számviteli törvény 169. §-a)',
      '8 év'
    ]
  ]
  if (ctx.shipping.carriers.length > 0) {
    out.push([
      'Kiszállítás',
      'név, szállítási cím, telefonszám, e-mail cím, a csomag adatai',
      'GDPR 6. cikk (1) b) – szerződés teljesítése',
      'a kézbesítésig; utána a megrendelés adataival együtt'
    ])
  }
  if (ctx.payments.includes('card')) {
    out.push([
      'Online fizetés',
      'a fizetés azonosítója, összege, időpontja és eredménye (a kártyaadatot nem látjuk)',
      'GDPR 6. cikk (1) b) – szerződés teljesítése',
      '8 év (számviteli bizonylat)'
    ])
  }
  if (ctx.payments.includes('transfer')) {
    out.push([
      'Átutalás azonosítása',
      'a befizető neve, bankszámlaszáma, az összeg és a közlemény',
      'GDPR 6. cikk (1) b) és c)',
      '8 év (számviteli bizonylat)'
    ])
  }
  out.push(
    [
      'Ügyfélszolgálat, panaszkezelés',
      'név, elérhetőség, a kérdés vagy panasz tartalma, a jegyzőkönyv és a válasz',
      'GDPR 6. cikk (1) c) – a fogyasztóvédelmi törvény 17/A. §-a',
      '3 év'
    ],
    [
      'Elállási nyilatkozat',
      'név, e-mail cím, rendelésszám, az érintett termékek, megjegyzés, a visszautaláshoz megadott bankszámlaszám, a beküldés időpontja, az IP-cím kivonata',
      'GDPR 6. cikk (1) c) – 45/2014. Korm. rendelet 22. §; 6. cikk (1) f) – a beküldés igazolhatósága',
      '5 év'
    ]
  )
  if (ctx.features.reviews) {
    out.push([
      'Termékértékelés',
      'a megjelenített név, az e-mail cím (nem jelenik meg), az értékelés szövege és pontszáma',
      'GDPR 6. cikk (1) a) – hozzájárulás',
      'a hozzájárulás visszavonásáig vagy az értékelés törléséig'
    ])
  }
  if (ctx.features.stockNotify) {
    out.push([
      'Értesítés, ha a termék újra kapható',
      'e-mail cím, a termék',
      'GDPR 6. cikk (1) a) – hozzájárulás',
      'az értesítés elküldéséig vagy a kérés visszavonásáig'
    ])
  }
  if (ctx.features.newsletter) {
    out.push(['Hírlevél', 'név, e-mail cím', 'GDPR 6. cikk (1) a) – hozzájárulás', 'a leiratkozásig'])
  }
  out.push([
    'A weboldal biztonságos működése',
    'IP-cím, időpont, a megnyitott oldal, a böngésző adatai (szervernapló)',
    'GDPR 6. cikk (1) f) – jogos érdek: biztonság, visszaélések megelőzése',
    'a tárhely-szolgáltató naplózási ideje szerint, rövid ideig'
  ])
  return out
}

export function adatkezelesDoc(ctx: LegalContext): LegalDoc {
  const s = ctx.seller
  const recipients: string[][] = ctx.processors.map((pr) => [
    pr.name,
    pr.task,
    [pr.address, pr.website].filter(Boolean).join(', ') || '—'
  ])
  for (const c of ctx.shipping.carriers) {
    if (!c.company) continue
    recipients.push([
      c.company.name,
      `csomag kézbesítése (${c.label})`,
      [c.company.address, c.company.website].filter(Boolean).join(', ') || '—'
    ])
  }
  const thirdCountry = ctx.processors.some((pr) => pr.thirdCountry)

  return {
    kind: 'adatkezeles',
    title: LEGAL_DOCS.adatkezeles.title,
    summary: [
      { label: 'Adatkezelő', value: s.name },
      ...(s.email ? [{ label: 'Kapcsolat', value: s.email }] : []),
      { label: 'Sütik', value: 'Nincs követő vagy hirdetési süti' }
    ],
    intro: [
      `Ez a tájékoztató leírja, hogy a(z) ${s.name} a webáruház használata és a vásárlás során milyen személyes adatokat, milyen célból, ` +
        'milyen jogalapon és mennyi ideig kezel, kinek adja át, és Önt milyen jogok illetik meg. A tájékoztató az Európai Unió általános ' +
        'adatvédelmi rendelete (GDPR, 2016/679/EU) és az információs önrendelkezési jogról szóló 2011. évi CXII. törvény (Infotv.) alapján készült.'
    ],
    sections: [
      section('adatkezelo', '1. Az adatkezelő', [sellerRows(ctx)]),
      section('celok', '2. Milyen adatokat, miért és meddig kezelünk?', [
        table(['Cél', 'Kezelt adatok', 'Jogalap', 'Időtartam'], purposes(ctx).map((r) => [...r])),
        p(
          'A megrendeléshez szükséges adatok megadása a szerződés megkötésének feltétele: ezek nélkül a megrendelést nem tudjuk teljesíteni. ' +
            'A hozzájáruláson alapuló adatkezeléshez (értékelés, értesítés, hírlevél) adott hozzájárulását bármikor visszavonhatja; ez a ' +
            'visszavonás előtti adatkezelés jogszerűségét nem érinti.'
        ),
        p('Automatizált döntéshozatalt és profilalkotást nem végzünk. 16 év alatti személy adatait szülői hozzájárulás nélkül nem kezeljük.')
      ]),
      section('cimzettek', '3. Kik ismerhetik meg az adatokat?', [
        p(
          'Az adatokhoz csak azok a munkatársaink férnek hozzá, akiknek a feladatukhoz szükséges. Az alábbi szolgáltatók a nevünkben, ' +
            'utasításaink szerint kezelnek adatokat (adatfeldolgozók), illetve a kiszállításhoz megkapják azokat:'
        ),
        table(['Szolgáltató', 'Feladat', 'Elérhetőség'], recipients),
        thirdCountry
          ? p(
              'Egyes szolgáltatóink az Amerikai Egyesült Államokban bejegyzett cégek. Az adattovábbítás az EU–USA adatvédelmi keretrendszer ' +
                '(Data Privacy Framework) szerinti tanúsítás vagy az Európai Bizottság általános adatvédelmi kikötései (SCC) alapján történik.'
            )
          : null,
        p('Hatósági vagy bírósági megkeresésre, jogszabály alapján az adatokat az eljáró szervnek átadhatjuk. Adatot nem értékesítünk.')
      ]),
      section('biztonsag', '4. Adatbiztonság', [
        p(
          'Az adatokat titkosított (HTTPS) kapcsolaton továbbítjuk, jogosultsághoz kötött hozzáféréssel, más webáruházak adataitól ' +
            'elkülönítve tároljuk. Adatvédelmi incidens esetén a tudomásunkra jutástól számított 72 órán belül bejelentést teszünk a NAIH-nak, ' +
            'és ha az incidens valószínűleg magas kockázattal jár, Önt is értesítjük.'
        ),
        p(`A böngészőben tárolt adatokról a ${link(LEGAL_DOCS.sutik.title, url(ctx, legalPath('sutik')))} oldal tájékoztat.`)
      ]),
      section('jogok', '5. Az Ön jogai', [
        ul([
          'Hozzáférés: tájékoztatást kérhet arról, hogy milyen adatait kezeljük, és másolatot kérhet róluk.',
          'Helyesbítés: kérheti a pontatlan adatok javítását, a hiányosak kiegészítését.',
          'Törlés: kérheti adatai törlését, ha azokra már nincs szükség, vagy visszavonta a hozzájárulását – kivéve, ha jogszabály megőrzésre kötelez (például számla).',
          'Korlátozás: kérheti, hogy az adatokat a vita rendezéséig csak tároljuk.',
          'Adathordozhatóság: a szerződés vagy hozzájárulás alapján kezelt adatait géppel olvasható formában kikérheti.',
          'Tiltakozás: a jogos érdeken alapuló adatkezelés ellen tiltakozhat.',
          'Hozzájárulás visszavonása: bármikor, indoklás nélkül.'
        ]),
        p(
          `Kérelmét ${s.email ? `a ${mail(s.email)} címen vagy ` : ''}postai úton nyújthatja be. Legkésőbb egy hónapon belül válaszolunk; ` +
            'ez indokolt esetben további két hónappal meghosszabbodhat, amiről értesítjük.'
        )
      ]),
      section('jogorvoslat', '6. Jogorvoslat', [
        p('Ha úgy érzi, hogy adatai kezelése sérti a jogait, kérjük, először forduljon hozzánk. Panaszt tehet a felügyeleti hatóságnál is:'),
        dl([
          ['Név', NAIH.name],
          ['Cím', NAIH.address],
          ['Telefon', NAIH.phone ?? null],
          ['E-mail', NAIH.email ? mail(NAIH.email) : null],
          ['Weboldal', NAIH.website ? link('naih.hu', NAIH.website) : null]
        ]),
        p('Jogai megsértése esetén bírósághoz is fordulhat; a pert a lakóhelye vagy tartózkodási helye szerinti törvényszék előtt is megindíthatja.')
      ]),
      section('modositas', '7. A tájékoztató módosítása', [
        h3('Változások'),
        p(
          'Ha az adatkezelés módja változik (például új szolgáltatót veszünk igénybe), ezt a tájékoztatót frissítjük. A hatályos változat ' +
            'dátuma az oldal alján látható, a korábbi változatok ugyanott elérhetők.'
        )
      ])
    ]
  }
}
