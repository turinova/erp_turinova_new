'use client'

import { useState } from 'react'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Link from 'next/link'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import PhoneIcon from '@mui/icons-material/Phone'
import EmailIcon from '@mui/icons-material/Email'
import LanguageIcon from '@mui/icons-material/Language'
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd'
import BusinessIcon from '@mui/icons-material/Business'
import Paper from '@mui/material/Paper'
import { toast } from 'react-toastify'

interface TenantCompanyInfo {
  name?: string | null
  country?: string | null
  postal_code?: string | null
  city?: string | null
  address?: string | null
  phone_number?: string | null
  email?: string | null
  website?: string | null
  tax_number?: string | null
  company_registration_number?: string | null
}

interface HomeClientProps {
  customerName: string
  companyName: string
  savedQuotesCount: number
  totalOrdersCount: number
  inProgressCount: number
  finishedCount: number
  companyInfo?: TenantCompanyInfo | null
}

export default function HomeClient({
  customerName,
  companyName,
  savedQuotesCount,
  totalOrdersCount,
  inProgressCount,
  finishedCount,
  companyInfo = null
}: HomeClientProps) {
  const [suggestionText, setSuggestionText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (suggestionText.trim().length < 50) {
      toast.error('A javaslat szövege legalább 50 karakter hosszú kell legyen!')
      return
    }

    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: suggestionText.trim().substring(0, 100), // Use first 100 chars as title
          suggestion_text: suggestionText.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit suggestion')
      }

      // Success
      toast.success('Javaslatod sikeresen elküldve!')
      
      // Reset form
      setSuggestionText('')
    } catch (error) {
      console.error('[Home] Error submitting suggestion:', error)
      toast.error('Hiba történt a javaslat elküldése során. Kérjük, próbáld újra!')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='flex flex-col gap-6'>
      <Grid container spacing={6} alignItems='stretch'>
        <Grid item xs={12} md={companyInfo ? 6 : 12}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <i className='ri-home-heart-line text-4xl text-primary' />
                <div>
                  <Typography variant='h4' className='font-bold'>
                    Üdvözöljük a Turinova Ügyfélportálon - {companyName}
                  </Typography>
                  <Typography variant='body1' color='text.secondary'>
                    Kezelheti árajánlatait és nyomon követheti rendeléseit
                  </Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {companyInfo && (
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%' }}>
                <Typography variant='h6' className='font-bold' sx={{ mb: 2 }}>
                  Kapcsolat
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <List disablePadding>
                      {(companyInfo.country || companyInfo.postal_code || companyInfo.city || companyInfo.address) && (
                        <ListItem disableGutters sx={{ alignItems: 'flex-start', py: 1 }}>
                          <ListItemIcon sx={{ minWidth: 42 }}><LocationOnIcon color='primary' /></ListItemIcon>
                          <ListItemText
                            primary='Cím'
                            secondary={[companyInfo.country, `${companyInfo.postal_code || ''} ${companyInfo.city || ''}`.trim(), companyInfo.address]
                              .filter(Boolean)
                              .join(' · ')}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                          />
                        </ListItem>
                      )}

                      {companyInfo.phone_number && (
                        <ListItem disableGutters sx={{ py: 1 }}>
                          <ListItemIcon sx={{ minWidth: 42 }}><PhoneIcon color='primary' /></ListItemIcon>
                          <ListItemText
                            primary='Telefon'
                            secondary={companyInfo.phone_number}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                          />
                        </ListItem>
                      )}

                      {companyInfo.email && (
                        <ListItem disableGutters sx={{ py: 1 }}>
                          <ListItemIcon sx={{ minWidth: 42 }}><EmailIcon color='primary' /></ListItemIcon>
                          <ListItemText
                            primary='E-mail'
                            secondary={
                              <Link href={`mailto:${companyInfo.email}`}>
                                {companyInfo.email}
                              </Link>
                            }
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                          />
                        </ListItem>
                      )}
                    </List>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <List disablePadding>
                      {companyInfo.website && (
                        <ListItem disableGutters sx={{ py: 1 }}>
                          <ListItemIcon sx={{ minWidth: 42 }}><LanguageIcon color='primary' /></ListItemIcon>
                          <ListItemText
                            primary='Weboldal'
                            secondary={
                              <Link href={companyInfo.website} target='_blank' rel='noopener noreferrer'>
                                {companyInfo.website}
                              </Link>
                            }
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                          />
                        </ListItem>
                      )}

                      {companyInfo.tax_number && (
                        <ListItem disableGutters sx={{ py: 1 }}>
                          <ListItemIcon sx={{ minWidth: 42 }}><AssignmentIndIcon color='primary' /></ListItemIcon>
                          <ListItemText
                            primary='Adószám'
                            secondary={companyInfo.tax_number}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                          />
                        </ListItem>
                      )}

                      {companyInfo.company_registration_number && (
                        <ListItem disableGutters sx={{ py: 1 }}>
                          <ListItemIcon sx={{ minWidth: 42 }}><BusinessIcon color='primary' /></ListItemIcon>
                          <ListItemText
                            primary='Cégjegyzékszám'
                            secondary={companyInfo.company_registration_number}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                          />
                        </ListItem>
                      )}
                    </List>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Suggestion Form Card */}
      <Grid container spacing={6}>
        <Grid item xs={12}>
          <Card
            sx={{
              borderLeft: theme => `6px solid ${theme.palette.info.main}`,
              bgcolor: theme => `${theme.palette.info.light}15`
            }}
          >
            <CardContent>
              <Typography variant='h6' className='font-bold' sx={{ mb: 2, color: 'info.main' }}>
                Javaslat küldése
              </Typography>
              <Typography 
                variant='body1' 
                sx={{ 
                  mb: 3, 
                  fontWeight: 600,
                  color: 'text.primary'
                }}
              >
                Kérlek írd meg, hogy milyen funkciók lennének még hasznosak számodra a rendszerben, illetve azt is, hogy a jelenlegi funkciók közül melyik még számodra nehezen használható és javításra szorul:
              </Typography>
              <form onSubmit={handleSubmit}>
                <Stack spacing={3}>
                  <TextField
                    label='Javaslat'
                    value={suggestionText}
                    onChange={(e) => setSuggestionText(e.target.value)}
                    required
                    multiline
                    rows={4}
                    fullWidth
                    disabled={isSubmitting}
                    helperText={`Minimum 50 karakter (${suggestionText.length} / 50)`}
                    error={suggestionText.length > 0 && suggestionText.length < 50}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      type='submit'
                      variant='contained'
                      color='info'
                      disabled={isSubmitting || suggestionText.trim().length < 50}
                      startIcon={isSubmitting ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : null}
                    >
                      {isSubmitting ? 'Küldés...' : 'Javaslat küldése'}
                    </Button>
                  </Box>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Stats Grid */}
      <Grid container spacing={6}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  backgroundColor: 'primary.main', 
                  borderRadius: 2, 
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i className='ri-file-list-3-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    {savedQuotesCount}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Mentett árajánlatok
                  </Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  backgroundColor: 'success.main', 
                  borderRadius: 2, 
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i className='ri-shopping-cart-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    {totalOrdersCount}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Elküldött rendelések
                  </Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  backgroundColor: 'warning.main', 
                  borderRadius: 2, 
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i className='ri-time-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    {inProgressCount}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Folyamatban
                  </Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ 
                  backgroundColor: 'info.main', 
                  borderRadius: 2, 
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i className='ri-check-double-line text-2xl text-white' />
                </Box>
                <div>
                  <Typography variant='h5' className='font-bold'>
                    {finishedCount}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Kész rendelések
                  </Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Order Flow Diagram */}
      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Typography variant='h5' className='font-bold'>
              Megrendelés folyamata
            </Typography>

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={{ xs: 3, md: 4 }}
              alignItems='stretch'
            >
              {/* Step 1 */}
              <Box
                sx={{
                  p: 3,
                  flex: 1,
                  border: '1px solid',
                  borderColor: 'primary.light',
                  borderRadius: 2,
                  bgcolor: 'rgba(17, 170, 136, 0.06)'
                }}
              >
                <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 1, color: 'primary.dark' }}>
                  1. Optimalizálás és ajánlat mentése
                </Typography>
                <Typography
                  variant='body1'
                  color='text.primary'
                  component='div'
                  sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}
                >
                  <span>
                    Az <Link href='/opti'>Opti</Link> oldalon adja meg a kiválasztott anyag(ok) panelméreteit, majd futtassa az optimalizálást.
                  </span>
                  <span>
                    Ha az eredmény megfelelő, kattintson az <strong>„Árajánlat mentése”</strong> gombra.
                  </span>
                  <span>
                    <strong>Fontos:</strong> A mentés még nem jelent megrendelést, csak az ajánlat elmentését.
                  </span>
                </Typography>
              </Box>

              <Stack direction='row' justifyContent='center' alignItems='center'>
                <ArrowForwardIcon sx={{ fontSize: 40, color: 'primary.main', display: { xs: 'none', md: 'block' } }} />
                <ArrowDownwardIcon sx={{ fontSize: 40, color: 'primary.main', display: { xs: 'block', md: 'none' } }} />
              </Stack>

              {/* Step 2 */}
              <Box
                sx={{
                  p: 3,
                  flex: 1,
                  border: '1px solid',
                  borderColor: 'warning.light',
                  borderRadius: 2,
                  bgcolor: 'rgba(242, 153, 74, 0.08)'
                }}
              >
                <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 1, color: 'warning.dark' }}>
                  2. Mentések kezelése és megrendelés leadása
                </Typography>
                <Typography variant='body1' color='text.primary' component='div'>
                  <span>
                    A mentett ajánlatok a <Link href='/saved'>Mentések</Link> oldalon találhatók. Itt lehet:
                  </span>
                  <Box component='ul' sx={{ pl: 3, mt: 1, mb: 2, color: 'text.secondary' }}>
                    <li>megnyitni és szerkeszteni az optimalizálást</li>
                    <li>megjegyzést fűzni az ajánlathoz</li>
                    <li>kinyomtatni az ajánlatot</li>
                    <li>megrendelést leadni</li>
                  </Box>
                  <span>
                    Ha mindennel elégedett, kattintson a <strong>„Megrendelés”</strong> gombra, válassza ki a fizetési módot, majd küldje be. Ekkor válik a mentés hivatalos megrendeléssé.
                  </span>
                  <span>
                    <strong>Figyelem:</strong> minden megrendelés csak előleg befizetése után kerül gyártásba.
                  </span>
                </Typography>
              </Box>

              <Stack direction='row' justifyContent='center' alignItems='center'>
                <ArrowForwardIcon sx={{ fontSize: 40, color: 'primary.main', display: { xs: 'none', md: 'block' } }} />
                <ArrowDownwardIcon sx={{ fontSize: 40, color: 'primary.main', display: { xs: 'block', md: 'none' } }} />
              </Stack>

              {/* Step 3 */}
              <Box
                sx={{
                  p: 3,
                  flex: 1,
                  border: '1px solid',
                  borderColor: 'info.light',
                  borderRadius: 2,
                  bgcolor: 'rgba(45, 156, 219, 0.08)'
                }}
              >
                <Typography variant='subtitle1' sx={{ fontWeight: 700, mb: 1, color: 'info.dark' }}>
                  3. Megrendelések nyomon követése
                </Typography>
                <Typography variant='body1' color='text.primary' component='div'>
                  <span>
                    A leadott megrendelések a <Link href='/orders'>Megrendelések</Link> oldalon találhatók. Itt megtekintheti:
                  </span>
                  <Box component='ul' sx={{ pl: 3, mt: 1, mb: 2, color: 'text.secondary' }}>
                    <li>a választott fizetési módot</li>
                    <li>a fizetés állapotát</li>
                    <li>a teljes megrendelés státuszát</li>
                  </Box>
                  <span>
                    A megrendelések tartalma utólag nem módosítható, de bármikor kinyomtatható.
                  </span>
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Optimization Disclaimer */}
      <Card
        sx={{
          borderLeft: theme => `6px solid ${theme.palette.error.main}`,
          bgcolor: theme => `${theme.palette.error.light}20`
        }}
      >
        <CardContent>
          <Typography variant='h6' sx={{ fontWeight: 700, color: 'error.main', mb: 1 }}>
            Fontos: a táblakiosztás csak tájékoztató jellegű
          </Typography>
          <Typography variant='body1' color='error.dark' component='div' sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span>Az optimalizálásban megjelenő táblakiosztás nem a tényleges gyártási kiosztást mutatja, csak egy szemléltető elrendezés.</span>
            <span>Minden lapszabász cég más típusú és más márkájú táblafelosztó gépet használ, valamint eltérő optimalizáló szoftvert, különböző beállításokkal és megkötésekkel.</span>
            <span>Ezért a végleges panelkiosztás a gyártás során eltérhet a rendszerben láthatótól.</span>
            <span>Rendelésnél mindig a kiválasztott cég saját optimalizálása az érvényes.</span>
          </Typography>
        </CardContent>
      </Card>

      {/* FAQ Section */}
      <Card>
        <CardContent>
          <Typography variant='h5' className='font-bold' sx={{ mb: 2 }}>
            Gyakran Ismételt Kérdések
          </Typography>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                Hogyan tudom módosítani a személyes adataimat / számlázási adataimat?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant='body1' color='text.secondary'>
                A személyes és számlázási adatokat a <Link href='/settings'>Beállítások</Link> menüpont alatt lehet módosítani.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                Hogyan tudok megjegyzést vagy kiegészítő információt megadni a rendeléshez?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant='body1' color='text.secondary'>
                A <Link href='/saved'>Mentések</Link> oldalon, az adott ajánlat megnyitása után tud megjegyzést hozzáfűzni. A megrendelés leadásakor ez a megjegyzés automatikusan továbbításra kerül a {companyName} csapatához.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                Milyen formátumban tudom letölteni az ajánlatot vagy a szabási tervet?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant='body1' color='text.secondary'>
                A <Link href='/saved'>Mentések</Link> részben található „Nyomtatás” gomb segítségével PDF formátumban töltheti le az ajánlatot és a szabási tervet, amelyet megoszthat vagy kinyomtathat.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                Mi történik, ha módosítani szeretném a leadott megrendelést?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant='body1' color='text.secondary'>
                A portálon leadott megrendelések utólag nem módosíthatók. Ha változtatni szeretne, vegye fel a kapcsolatot a {companyName} ügyfélszolgálatával, és adja meg a rendelési számot.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                Szabás méter hogyan van kiszámolva?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant='body1' color='text.secondary' component='div'>
                <p>
                  Az optimalizálás után kizárólag azok a vágások kerülnek elszámolásra, ahol a fűrészlap ténylegesen átvágta a lapterméket. Ennek köszönhetően az illeszkedő élek nem számítódnak duplán, így a megrendelő csak a valóban elvégzett vágások hosszát fizeti meg.
                </p>
                <p>
                  <strong>Fontos:</strong> Minden lapszabászati folyamat szélezéssel kezdődik, amely egy teljes hosszanti és egy teljes keresztirányú vágást foglal magában.
                </p>
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                Miért alkalmazunk hulladékszorzót és miért 65% a kihozatal küszöb?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant='body1' color='text.secondary' component='div'>
                <p>
                  A szabás során a teljes táblából dolgozunk, és bár a vágási tervet úgy optimalizáljuk, hogy a lehető legkevesebb anyag vesszen kárba, bizonyos mértékű hulladék keletkezése elkerülhetetlen. Ennek fő okai:
                </p>
                <Box component='ul' sx={{ pl: 3, mb: 2 }}>
                  <li>a fűrészlap vastagsága miatt elvesző anyag,</li>
                  <li>a kötelező szélezés,</li>
                  <li>a szabás után visszamaradó kisebb darabok, amelyek gyakran már nem hasznosíthatók.</li>
                </Box>
                <p>
                  Az anyagtól függően ezek értékesítése is kihívást jelenthet. Tapasztalataink szerint 65%-os kihozatal felett a vevő számára is előnyösebb lehet a teljes tábla megvásárlása, mivel így jobban kihasználhatja az anyagot saját igényei szerint, ráadásul ár-érték arányban is kedvezőbb megoldást jelenthet.
                </p>
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                A szabási maradék kinek a tulajdona?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant='body1' color='text.secondary'>
                Amennyiben rendelős bútorlapot választott a megrendelő, a hulladék minden esetben az övé. Ha raktári bútorlapot választ és négyzetméteres árképzéssel dolgozunk, az aktuális tábla maradéka a vállalkozás tulajdona marad.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                Hogyan tudom, hogy elkészült a rendelésem?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant='body1' color='text.secondary' component='div'>
                <p>
                  Amennyiben a Beállításokban be van állítva az SMS értesítés, az elkészült rendelésről automatikus üzenetet küldünk. Nyitvatartási időben bármikor átvehető.
                </p>
                <p>
                  Ha nincs beállítva SMS értesítés, a <Link href='/orders'>Megrendelések</Link> oldal státusz oszlopában a „Kész” státusz jelzi, hogy átvehető.
                </p>
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                Hogyan követhetem a befizetéseim állapotát?
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant='body1' color='text.secondary'>
                A <Link href='/orders'>Megrendelések</Link> oldalon minden rendelésnél megtalálja a „Fizetés állapota” sort, ahol ellenőrizheti, hogy az előleg beérkezett-e és mikor teljesült a hátralék.
              </Typography>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}

