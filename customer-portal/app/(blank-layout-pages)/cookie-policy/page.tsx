// Next Imports
import type { Metadata } from 'next'
import { Box, Container, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'

export const metadata: Metadata = {
  title: 'Süti (Cookie) szabályzat',
  description: 'Turinova ERP rendszer Süti szabályzata'
}

const CookiePolicyPage = () => {
  return (
    <Box sx={{ minHeight: '100vh', py: 6, bgcolor: 'background.default' }}>
      <Container maxWidth="md">
        <Paper elevation={3} sx={{ p: { xs: 3, sm: 5 } }}>
          <Typography variant="h3" component="h1" gutterBottom sx={{ mb: 2 }}>
            Süti (Cookie) szabályzat
          </Typography>
          
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
            Hatályos: 2025.10.27-től visszavonásig
          </Typography>

          <Box sx={{ '& h5': { mt: 4, mb: 2, fontWeight: 600 }, '& p': { mb: 2, lineHeight: 1.7 }, '& ul': { mb: 2, pl: 3 }, '& li': { mb: 1 } }}>
            <Typography variant="h5" component="h2">
              1. Mi az a süti (cookie)?
            </Typography>
            <Typography variant="body1">
              A sütik (cookies) kis szöveges fájlok, amelyeket a weboldal az Ön böngészőjében tárol el. 
              Ezek segítenek a weboldal működésében, a felhasználói élmény javításában, valamint statisztikai 
              adatok gyűjtésében.
            </Typography>

            <Typography variant="h5" component="h2">
              2. Milyen sütiket használunk?
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              A Turinova ERP rendszer az alábbi típusú sütiket használja:
            </Typography>
            
            <TableContainer sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Süti típusa</strong></TableCell>
                    <TableCell><strong>Cél</strong></TableCell>
                    <TableCell><strong>Időtartam</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Feltétlenül szükséges sütik</TableCell>
                    <TableCell>Bejelentkezés, munkamenet kezelése, biztonság</TableCell>
                    <TableCell>Munkamenet / 30 nap</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Funkcionális sütik</TableCell>
                    <TableCell>Felhasználói beállítások mentése</TableCell>
                    <TableCell>1 év</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Hozzájárulás süti</TableCell>
                    <TableCell>Cookie banner elfogadásának tárolása</TableCell>
                    <TableCell>1 év</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            <Typography variant="h5" component="h2">
              3. Konkrét sütik listája
            </Typography>
            <TableContainer sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Név</strong></TableCell>
                    <TableCell><strong>Szolgáltató</strong></TableCell>
                    <TableCell><strong>Cél</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>turinova_cookie_consent</TableCell>
                    <TableCell>Turinova</TableCell>
                    <TableCell>Cookie banner elfogadásának tárolása</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>sb-* (Supabase sütik)</TableCell>
                    <TableCell>Supabase</TableCell>
                    <TableCell>Bejelentkezési munkamenet kezelése</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            <Typography variant="h5" component="h2">
              4. Miért szükségesek a sütik?
            </Typography>
            <ul>
              <li><strong>Bejelentkezés:</strong> A rendszer megjegyzi, hogy be van-e jelentkezve</li>
              <li><strong>Biztonság:</strong> Védekezés jogosulatlan hozzáférés ellen</li>
              <li><strong>Felhasználói élmény:</strong> Beállítások mentése (pl. nyelv, téma)</li>
              <li><strong>Működés:</strong> A rendszer alapvető funkcióinak biztosítása</li>
            </ul>

            <Typography variant="h5" component="h2">
              5. Harmadik féltől származó sütik
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Az alábbi szolgáltatók sütiket használhatnak:
            </Typography>
            <ul>
              <li><strong>Supabase:</strong> Adatbázis és hitelesítés (munkamenet kezelés)</li>
              <li><strong>Vercel:</strong> Hosting és CDN (teljesítményoptimalizálás)</li>
            </ul>
            <Typography variant="body1">
              Ezek a sütik kizárólag a szolgáltatás működéséhez szükségesek, marketing célra nem használjuk őket.
            </Typography>

            <Typography variant="h5" component="h2">
              6. Hogyan törölhetem vagy tilthatom le a sütiket?
            </Typography>
            <Typography variant="body1">
              Böngészője beállításaiban bármikor törölheti vagy letilthatja a sütiket:
            </Typography>
            <ul>
              <li><strong>Chrome:</strong> Beállítások → Adatvédelem és biztonság → Sütik és más webhelyadatok</li>
              <li><strong>Firefox:</strong> Beállítások → Adatvédelem és biztonság → Sütik és webhelyadatok</li>
              <li><strong>Safari:</strong> Beállítások → Adatvédelem → Sütik kezelése</li>
              <li><strong>Edge:</strong> Beállítások → Sütik és webhelyengedélyek</li>
            </ul>
            <Typography variant="body1" sx={{ mt: 2 }}>
              <strong>Figyelem:</strong> A sütik letiltása esetén előfordulhat, hogy a rendszer egyes funkciói 
              nem működnek megfelelően (pl. nem tud bejelentkezni).
            </Typography>

            <Typography variant="h5" component="h2">
              7. Nem használunk analitikai sütiket
            </Typography>
            <Typography variant="body1">
              A Turinova ERP rendszer jelenleg <strong>nem használ</strong> analitikai (pl. Google Analytics) 
              vagy marketing célú sütiket. Kizárólag a működéshez szükséges sütiket alkalmazzuk.
            </Typography>

            <Typography variant="h5" component="h2">
              8. Hozzájárulás visszavonása
            </Typography>
            <Typography variant="body1">
              Ha korábban elfogadta a sütiket, de meggondolta magát:
            </Typography>
            <ul>
              <li>Törölheti a sütiket böngészőjében (lásd fent)</li>
              <li>A cookie banner újra megjelenik a következő látogatáskor</li>
              <li>Vagy írjon nekünk: <strong>info@turinova.hu</strong></li>
            </ul>

            <Typography variant="h5" component="h2">
              9. Változások
            </Typography>
            <Typography variant="body1">
              Fenntartjuk a jogot, hogy jelen Süti szabályzatot bármikor módosítsuk. 
              A módosításokról e-mailben vagy a weboldalon értesítjük Önt.
            </Typography>

            <Typography variant="h5" component="h2">
              10. Kapcsolat
            </Typography>
            <Typography variant="body1">
              Ha kérdése van a sütikkel kapcsolatban, kérjük, lépjen kapcsolatba velünk:
            </Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>
              <strong>E-mail:</strong> info@turinova.hu<br />
              <strong>Weboldal:</strong> turinova.hu
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  )
}

export default CookiePolicyPage

