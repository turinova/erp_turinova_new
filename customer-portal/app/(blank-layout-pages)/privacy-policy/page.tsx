// Next Imports
import type { Metadata } from 'next'
import { Box, Container, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'

export const metadata: Metadata = {
  title: 'Adatkezelési tájékoztató',
  description: 'Turinova ERP rendszer Adatkezelési tájékoztatója'
}

const PrivacyPolicyPage = () => {
  return (
    <Box sx={{ minHeight: '100vh', py: 6, bgcolor: 'background.default' }}>
      <Container maxWidth="md">
        <Paper elevation={3} sx={{ p: { xs: 3, sm: 5 } }}>
          <Typography variant="h3" component="h1" gutterBottom sx={{ mb: 2 }}>
            Adatkezelési Tájékoztató
          </Typography>
          
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
            Hatályos: 2025.10.27-től visszavonásig
          </Typography>

          <Box sx={{ '& h5': { mt: 4, mb: 2, fontWeight: 600 }, '& p': { mb: 2, lineHeight: 1.7 }, '& ul': { mb: 2, pl: 3 }, '& li': { mb: 1 } }}>
            <Typography variant="h5" component="h2">
              1. Az adatkezelő adatai
            </Typography>
            <Typography variant="body1">
              <strong>Név:</strong> Mező Dávid (magánszemély)<br />
              <strong>E-mail:</strong> info@turinova.hu<br />
              <strong>Weboldal:</strong> turinova.hu
            </Typography>
            <Typography variant="body1">
              Az adatkezelő nem egyéni vállalkozóként, hanem magánszemélyként biztosítja a szolgáltatást, kísérleti (BETA) formában, nem üzletszerű gazdasági tevékenységként.
            </Typography>

            <Typography variant="h5" component="h2">
              2. Az adatkezelés célja
            </Typography>
            <Typography variant="body1">
              A Turinova ERP rendszer használatához és működtetéséhez szükséges:
            </Typography>
            <ul>
              <li>felhasználói fiók létrehozása és bejelentkezés biztosítása,</li>
              <li>ajánlatok szerkesztése és beküldése,</li>
              <li>értesítések küldése (e-mail vagy SMS),</li>
              <li>szolgáltatás működésének monitorozása és fejlesztése.</li>
            </ul>

            <Typography variant="h5" component="h2">
              3. Az kezelt adatok köre
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              A rendszer az alábbi adatokat kezelheti:
            </Typography>
            <TableContainer sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Adattípus</strong></TableCell>
                    <TableCell><strong>Miért szükséges?</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Név</TableCell>
                    <TableCell>Felhasználói azonosítás</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>E-mail cím</TableCell>
                    <TableCell>Bejelentkezés / értesítések</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Telefonszám</TableCell>
                    <TableCell>SMS értesítések</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Számlázási adatok (pl. cégnév, adószám, cím)</TableCell>
                    <TableCell>Ajánlat és üzleti kapcsolat kezeléséhez</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Ajánlat tartalma (anyagok, méretek, árak, leírások)</TableCell>
                    <TableCell>Ajánlatkészítés funkció működtetéséhez</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="body1">
              A rendszer nem kezel fényképet, fájl feltöltést vagy biometrikus adatot.
            </Typography>

            <Typography variant="h5" component="h2">
              4. Az adatkezelés jogalapja
            </Typography>
            <ul>
              <li><strong>GDPR 6. cikk (1) bek. a)</strong> – az érintett hozzájárulása az ÁSZF és az Adatkezelési Tájékoztató elfogadásával</li>
              <li><strong>GDPR 6. cikk (1) bek. f)</strong> – jogos érdek a rendszer működtetésében és fejlesztésében</li>
            </ul>
            <Typography variant="body1">
              A Felhasználó a rendszert kizárólag saját felelősségére használja (BETA állapot).
            </Typography>

            <Typography variant="h5" component="h2">
              5. Az adatok forrása
            </Typography>
            <ul>
              <li>A felhasználó által közvetlenül megadott adatok</li>
              <li>A kiválasztott vállalkozás azonosító adatai a rendszer belső adatbázisából</li>
            </ul>

            <Typography variant="h5" component="h2">
              6. Adatfeldolgozók
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Az adatkezelő az adatkezelés során az alábbi adatfeldolgozókat veszi igénybe:
            </Typography>
            <TableContainer sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Szolgáltató</strong></TableCell>
                    <TableCell><strong>Szerep</strong></TableCell>
                    <TableCell><strong>Ország / Régió</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Supabase</TableCell>
                    <TableCell>Adatbázis és biztonsági mentések</TableCell>
                    <TableCell>EU régió (változhat terheléstől függően)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Vercel</TableCell>
                    <TableCell>Weboldal és alkalmazás hosting</TableCell>
                    <TableCell>EU / USA régió (dinamikusan változhat)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Twilio</TableCell>
                    <TableCell>SMS értesítések küldése</TableCell>
                    <TableCell>USA (GDPR-kompatibilis adattovábbítás SCC alapján)</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="body1">
              Az adatokat ezen szolgáltatók felhő infrastruktúrái tárolják, a GDPR által előírt szerződéses és technikai garanciák mellett.
            </Typography>

            <Typography variant="h5" component="h2">
              7. Adatok megőrzési ideje
            </Typography>
            <ul>
              <li>5 évig, vagy</li>
              <li>amíg a felhasználó törlését nem kéri (amelyik előbb következik be).</li>
            </ul>

            <Typography variant="h5" component="h2">
              8. Adatok törlése
            </Typography>
            <Typography variant="body1">
              A felhasználó kérheti adatainak törlését:
            </Typography>
            <Typography variant="body1">
              E-mailben → <strong>info@turinova.hu</strong>
            </Typography>
            <Typography variant="body1">
              A törlés legkésőbb 30 napon belül megtörténik.
            </Typography>

            <Typography variant="h5" component="h2">
              9. Adatbiztonság
            </Typography>
            <ul>
              <li>A Supabase napi automatikus biztonsági mentést biztosít.</li>
              <li>A hozzáférések jelszóval és titkosítással védettek.</li>
              <li>Harmadik fél részére adat nem kerül továbbításra, kivéve, ha jogszabály előírja.</li>
            </ul>

            <Typography variant="h5" component="h2">
              10. Automatizált döntéshozatal / profilalkotás
            </Typography>
            <Typography variant="body1">
              Nem történik.
            </Typography>

            <Typography variant="h5" component="h2">
              11. Kiskorúak
            </Typography>
            <Typography variant="body1">
              A szolgáltatás nem használható 16 év alatti személyek által.
            </Typography>

            <Typography variant="h5" component="h2">
              12. Érintetti jogok (GDPR szerint)
            </Typography>
            <Typography variant="body1">
              A felhasználó jogosult:
            </Typography>
            <ul>
              <li>tájékoztatást kérni,</li>
              <li>helyesbítést kérni,</li>
              <li>törlést kérni,</li>
              <li>az adatkezelés korlátozását kérni,</li>
              <li>hozzájárulását visszavonni,</li>
              <li>panaszt tenni a NAIH-nál.</li>
            </ul>

            <Typography variant="h5" component="h2">
              13. Jogorvoslat
            </Typography>
            <Typography variant="body1">
              <strong>Nemzeti Adatvédelmi és Információszabadság Hatóság (NAIH)</strong><br />
              1125 Budapest, Szilágyi Erzsébet fasor 22/c<br />
              ugyfelszolgalat@naih.hu
            </Typography>

            <Typography variant="h5" component="h2">
              14. Irányadó jog
            </Typography>
            <Typography variant="body1">
              Az adatkezelésre a magyar jog és a GDPR rendelkezései az irányadók.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  )
}

export default PrivacyPolicyPage

