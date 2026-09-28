import { legalPath, LEGAL_DOCS, WITHDRAWAL_LABEL } from '@/lib/webshop/legal/constants'
import { link, p, section, ul } from '@/lib/webshop/legal/templates/helpers'
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
  withdrawalUrl
} from '@/lib/webshop/legal/templates/shared'
import type { LegalContext, LegalDoc } from '@/lib/webshop/legal/types'

export function aszfDoc(ctx: LegalContext): LegalDoc {
  const consumer = ctx.audience === 'consumer'
  const s = ctx.seller
  const privacy = link(LEGAL_DOCS.adatkezeles.title, url(ctx, legalPath('adatkezeles')))

  return {
    kind: 'aszf',
    title: LEGAL_DOCS.aszf.title,
    summary: summaryOf(ctx),
    intro: [
      `Ez az Általános Szerződési Feltételek (ÁSZF) a(z) ${s.name} (Szolgáltató) és a ${link(ctx.shopUrl.replace(/^https?:\/\//, ''), ctx.shopUrl)} ` +
        'webáruházban vásárló Ügyfél közötti jogokat és kötelezettségeket tartalmazza. Kérjük, megrendelése előtt figyelmesen olvassa el.'
    ],
    sections: [
      section('szolgaltato', '1. A Szolgáltató adatai', [sellerRows(ctx, { bank: true }), hostingRows(ctx)]),
      section('alapok', '2. Alapvető rendelkezések', [
        p(
          'A szerződés nyelve magyar. A szerződés elektronikus úton jön létre, nem minősül írásba foglalt szerződésnek, a Szolgáltató nem ' +
            'iktatja, és utólag nem hozzáférhető; a megrendelés adatait a visszaigazoló e-mail tartalmazza. A Szolgáltató magatartási ' +
            'kódexnek nem veti alá magát.'
        ),
        p(
          'Az ÁSZF-ben nem szabályozott kérdésekben a magyar jog, különösen a Polgári Törvénykönyvről szóló 2013. évi V. törvény, az ' +
            'elektronikus kereskedelmi szolgáltatásokról szóló 2001. évi CVIII. törvény, a fogyasztóvédelemről szóló 1997. évi CLV. törvény, ' +
            'a fogyasztó és a vállalkozás közötti szerződések részletes szabályairól szóló 45/2014. (II. 26.) Korm. rendelet és a 373/2021. ' +
            '(VI. 30.) Korm. rendelet az irányadó.'
        ),
        consumer
          ? p(
              'Fogyasztó: a szakmája, önálló foglalkozása vagy üzleti tevékenysége körén kívül eljáró természetes személy. A fogyasztókat ' +
                'megillető jogok (elállás, kellékszavatosság két éve, békéltető testület) csak őket illetik meg; vállalkozás vásárlóra a ' +
                'Polgári Törvénykönyv általános szabályai vonatkoznak.'
            )
          : p(
              'A webáruház kizárólag vállalkozások (gazdálkodó szervezetek és egyéni vállalkozók) részére értékesít. Fogyasztónak minősülő ' +
                'vásárlótól megrendelést nem fogadunk el; a vállalkozás vásárlót a fogyasztói elállási jog nem illeti meg.'
            ),
        p(
          'Az ÁSZF a közzététel napján lép hatályba, és a módosításig érvényes. Módosítás csak a hatályba lépése után leadott megrendelésekre ' +
            'vonatkozik; minden megrendelésre a leadásakor hatályos változat irányadó. A korábbi változatok az oldal alján érhetők el.'
        )
      ]),
      section('termekek', '3. Termékek és árak', [
        p(
          'A termékek lényeges tulajdonságait, árát és elérhetőségét a termékoldal mutatja. A képek illusztrációk, a termék színe a képernyő ' +
            'beállításaitól függően kissé eltérhet.'
        ),
        p(
          'Az árak magyar forintban értendők, és tartalmazzák az általános forgalmi adót. A szállítási díjat a kosár és a rendelés ' +
            'összesítője külön mutatja. Kedvezményes ár esetén feltüntetjük az árcsökkentést megelőző 30 napban alkalmazott legalacsonyabb árat is.'
        ),
        p(
          'Nyilvánvalóan hibás ár (például 0 Ft vagy a szokásos ár töredéke) esetén nem vagyunk kötelesek a hibás áron teljesíteni: ' +
            'felajánljuk a helyes áron történő teljesítést, amelynek ismeretében Ön elállhat a vásárlástól.'
        ),
        ctx.madeToOrder
          ? p(
              'Egyes termékeinket egyedi méretre gyártjuk vagy vágjuk. Ezeket a termékoldalon jelöljük; az Ön által megadott méretek ' +
                'helyességéért Ön felel.'
            )
          : null
      ]),
      section('rendeles', '4. A megrendelés menete', [
        ul([
          'Válassza ki a terméket és a mennyiséget, majd tegye a kosárba.',
          'A kosárban ellenőrizze a termékeket, a mennyiséget és a végösszeget; itt még bármit módosíthat vagy törölhet.',
          'Adja meg a nevét, elérhetőségét, a szállítási és számlázási adatokat, és válasszon szállítási és fizetési módot.',
          'Az összesítő oldalon ellenőrizze az adatokat. Adatbeviteli hibát a megrendelés elküldése előtt a „Vissza” vagy „Módosítás” gombbal javíthat.',
          'Fogadja el az ÁSZF-et, majd küldje el a megrendelést a „Megrendelés fizetési kötelezettséggel” gombbal.'
        ]),
        p(
          'A megrendelés beérkezését haladéktalanul, automatikus e-mailben visszaigazoljuk. Ha a visszaigazolás 48 órán belül nem érkezik meg, ' +
            'Ön mentesül az ajánlati kötöttség alól. A szerződés a megrendelés elfogadásával jön létre; az elfogadásról – vagy ha a terméket ' +
            'nem tudjuk teljesíteni, ennek okáról – e-mailben értesítjük.'
        ),
        p(`A megrendeléshez megadott személyes adatok kezeléséről az ${privacy} tájékoztat.`)
      ]),
      section('fizetes', '5. Fizetés', paymentNodes(ctx)),
      section('szallitas', '6. Szállítás és átvétel', shippingNodes(ctx)),
      consumer
        ? section('elallas', '7. Elállási jog', [
            p(
              `Az elállási jogot a legegyszerűbben online gyakorolhatja: ${link(WITHDRAWAL_LABEL, withdrawalUrl(ctx))}. ` +
                'A funkció regisztráció és bejelentkezés nélkül, az elállási idő teljes tartama alatt elérhető.'
            ),
            ...withdrawalInfoNodes(ctx),
            ...withdrawalExceptionNodes(ctx),
            p(`Az elállásinyilatkozat-mintát a ${link(LEGAL_DOCS.elallas.title, url(ctx, legalPath('elallas')))} oldalon találja.`)
          ])
        : section('visszaru', '7. Visszáru', [
            p(
              'Vállalkozás vásárlót törvényes elállási jog nem illet meg. Visszáruról egyedi egyeztetés alapján, az ügyfélszolgálaton ' +
                'keresztül állapodunk meg.'
            )
          ]),
      section('szavatossag', '8. Kellékszavatosság, termékszavatosság, jótállás', warrantyNodes(ctx)),
      section('panasz', '9. Panaszkezelés és jogérvényesítés', complaintNodes(ctx)),
      section('szerzoi-jog', '10. Szerzői jog', [
        p(
          'A webáruház tartalma (szövegek, képek, elrendezés) szerzői jogi védelem alatt áll. Előzetes írásbeli hozzájárulásunk nélkül ' +
            'másolni, terjeszteni vagy más módon felhasználni nem szabad.'
        )
      ]),
      section('zaro', '11. Záró rendelkezések', [
        p(
          'Ha az ÁSZF valamely rendelkezése érvénytelen, az a többi rendelkezés érvényességét nem érinti. Kérdés esetén ügyfélszolgálatunk ' +
            'szívesen segít a fenti elérhetőségeken.'
        )
      ])
    ]
  }
}
