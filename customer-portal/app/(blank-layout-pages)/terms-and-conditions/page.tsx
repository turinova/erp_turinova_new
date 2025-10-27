// Next Imports
import type { Metadata } from 'next'
import { Box, Container, Typography, Paper } from '@mui/material'

export const metadata: Metadata = {
  title: 'Általános Szerződési Feltételek',
  description: 'Turinova ERP rendszer Általános Szerződési Feltételei'
}

const TermsAndConditionsPage = () => {
  return (
    <Box sx={{ minHeight: '100vh', py: 6, bgcolor: 'background.default' }}>
      <Container maxWidth="md">
        <Paper elevation={3} sx={{ p: { xs: 3, sm: 5 } }}>
          <Typography variant="h3" component="h1" gutterBottom sx={{ mb: 2 }}>
            Általános Szerződési Feltételek (ÁSZF)
          </Typography>
          
          <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 1 }}>
            Turinova ERP rendszer (BETA verzió)
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
            Hatályos: 2025.10.27-től visszavonásig
          </Typography>

          <Box sx={{ '& h5': { mt: 4, mb: 2, fontWeight: 600 }, '& p': { mb: 2, lineHeight: 1.7 }, '& ul': { mb: 2, pl: 3 }, '& li': { mb: 1 } }}>
            <Typography variant="h5" component="h2">
              1. Szolgáltató adatai
            </Typography>
            <Typography variant="body1">
              <strong>Név:</strong> Mező Dávid<br />
              <strong>Jogállás:</strong> magánszemély<br />
              <strong>E-mail:</strong> info@turinova.hu<br />
              <strong>A szolgáltatás weboldala:</strong> turinova.hu
            </Typography>
            <Typography variant="body1">
              A Szolgáltató nem egyéni vállalkozóként, hanem magánszemélyként biztosítja a szolgáltatást, nem üzletszerű gazdasági tevékenységként, kísérleti (BETA) formában.
            </Typography>

            <Typography variant="h5" component="h2">
              2. A szolgáltatás leírása
            </Typography>
            <Typography variant="body1">
              A Turinova ERP rendszer egy felhőalapú, BETA állapotban lévő vállalatirányítási és ajánlatkezelő szoftver, amely elsősorban:
            </Typography>
            <ul>
              <li>asztalosipari vállalkozások,</li>
              <li>egyéni vállalkozók,</li>
              <li>valamint magánszemélyek</li>
            </ul>
            <Typography variant="body1">
              számára biztosít lehetőséget ajánlatok előkészítésére és beküldésére.
            </Typography>
            <Typography variant="body1">
              A rendszer jelenleg fejlesztés alatt áll, funkciói változhatnak és előfordulhatnak hibák.
            </Typography>

            <Typography variant="h5" component="h2">
              3. A szolgáltatás díja
            </Typography>
            <Typography variant="body1">
              A szoftver jelenleg ingyenesen használható.
            </Typography>
            <Typography variant="body1">
              A Szolgáltató a jövőben jogosult a díjakat, csomagokat és feltételeket egyoldalúan megváltoztatni.
            </Typography>

            <Typography variant="h5" component="h2">
              4. A rendszer BETA állapota – Hibák és működési kockázatok
            </Typography>
            <Typography variant="body1">
              A Felhasználó tudomásul veszi, hogy a rendszer:
            </Typography>
            <ul>
              <li>fejlesztési fázisban van,</li>
              <li>hibákat, pontatlanságokat tartalmazhat,</li>
              <li>időszakosan elérhetetlenné válhat,</li>
              <li>nem biztosít garantált rendelkezésre állást.</li>
            </ul>
            <Typography variant="body1">
              A Szolgáltató nem vállal felelősséget az adatok, számítások, árkalkulációk vagy ajánlatok helyességéért és teljességéért.
            </Typography>

            <Typography variant="h5" component="h2">
              5. Ajánlatok jogi státusza
            </Typography>
            <Typography variant="body1">
              A szoftverben létrehozott ajánlatok:
            </Typography>
            <ul>
              <li>nem minősülnek hivatalos, jogilag kötelező ajánlattételnek,</li>
              <li>csupán tájékoztató jellegűek,</li>
              <li>az ajánlatot fogadó vállalkozás minden esetben jogosult azokat módosítani, elutasítani vagy újraszámolni,</li>
              <li>a szoftver által készített ajánlat nem kötelezi sem a Felhasználót, sem bármely vállalkozást.</li>
            </ul>

            <Typography variant="h5" component="h2">
              6. Felelősség kizárása
            </Typography>
            <Typography variant="body1">
              A Szolgáltató:
            </Typography>
            <ul>
              <li>nem vállal semmilyen kártérítési felelősséget sem közvetlen, sem közvetett, sem elmaradt haszon, sem egyéb kár tekintetében,</li>
              <li>nem szavatolja a szoftver hibamentes működését,</li>
              <li>nem felel téves árakért, hibás kalkulációért, tévesen beküldött ajánlatokért vagy ezek gazdasági következményeiért.</li>
            </ul>
            <Typography variant="body1">
              A Felhasználó a rendszert kizárólag saját felelősségére használja.
            </Typography>

            <Typography variant="h5" component="h2">
              7. Felhasználói kötelezettségek
            </Typography>
            <Typography variant="body1">
              A Felhasználó köteles:
            </Typography>
            <ul>
              <li>saját adatait pontosan megadni,</li>
              <li>a rendszert jogszerű módon használni,</li>
              <li>minden ajánlatot további ellenőrzésnek alávetni,</li>
              <li>a szoftver eredményeit nem tekinteni hivatalos, végleges és kötelező kalkulációnak.</li>
            </ul>

            <Typography variant="h5" component="h2">
              8. Szerződés időtartama és megszűnése
            </Typography>
            <Typography variant="body1">
              A szolgáltatás igénybevétele nem hoz létre tartós szerződéses jogviszonyt.
            </Typography>
            <Typography variant="body1">
              A Szolgáltató a Felhasználó hozzáférését bármikor, indokolás és előzetes értesítés nélkül megszüntetheti.
            </Typography>

            <Typography variant="h5" component="h2">
              9. ÁSZF módosítása
            </Typography>
            <Typography variant="body1">
              A Szolgáltató az ÁSZF-et egyoldalúan jogosult módosítani.
            </Typography>
            <Typography variant="body1">
              A módosítás hatályba lépéséről a Felhasználók értesítést kapnak az e-mail címükre vagy a weboldalon.
            </Typography>

            <Typography variant="h5" component="h2">
              10. Irányadó jog
            </Typography>
            <Typography variant="body1">
              Jelen ÁSZF-re és a szolgáltatásra a magyar jog az irányadó.
            </Typography>
            <Typography variant="body1">
              Jogvita esetén a Szolgáltató lakóhelye szerinti bíróság kizárólagosan illetékes.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  )
}

export default TermsAndConditionsPage

