'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography
} from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

import { UgyfelajanlatStepPreviewMock } from './UgyfelajanlatMocks'
import UgyfelajanlatTutorialModal from './UgyfelajanlatTutorialModal'
import InomatMarketingSwatches from './InomatMarketingSwatches'

/**
 * Home „Újdonságok” — Nettfront: brand / Inomat marketing;
 * Ügyfélajánlat: lépésről lépésre mock tutorial.
 */
export default function WhatsNewSection() {
  const [tutorialOpen, setTutorialOpen] = useState(false)

  return (
    <>
      <Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'baseline' }}
          justifyContent="space-between"
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Újdonságok
              </Typography>
              <Chip label="Most jelent meg" size="small" color="success" />
            </Stack>
            <Typography variant="body1" color="text.secondary">
              Két új lehetőség a portálon — röviden elmagyarázva.
            </Typography>
          </Box>
        </Stack>

        <Grid container spacing={3}>
          {/* Nettfront — logo + Inomat marketing (no UI mock) */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                height: '100%',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: 'none',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <Box
                sx={{
                  bgcolor: '#0a0a0a',
                  px: { xs: 2.5, sm: 3 },
                  py: { xs: 2.5, sm: 3 },
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1.25
                }}
              >
                <Box
                  component="img"
                  src="/brands/nettfront-logo.svg"
                  alt="Nettfront"
                  sx={{
                    height: { xs: 36, sm: 44 },
                    width: 'auto',
                    maxWidth: '80%',
                    display: 'block',
                    filter: 'invert(1)',
                    opacity: 0.98
                  }}
                />
                <Chip
                  label="Magyarországon egyedülálló"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontWeight: 700,
                    border: '1px solid rgba(255,255,255,0.28)',
                    fontSize: '0.7rem'
                  }}
                />
              </Box>

              <CardContent
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  flex: 1,
                  bgcolor: '#fff'
                }}
              >
                <Box>
                  <Typography
                    variant="overline"
                    sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 0.6 }}
                  >
                    1 · Inomat · Nettfront
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.25, lineHeight: 1.3 }}>
                    Inomat frontok — most már online is
                  </Typography>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ mt: 1.25, lineHeight: 1.6 }}
                  >
                    Az <strong>Inomat</strong> kollekciót a portálon keresztül is megrendelheted.
                    Magyarországon ezt a lehetőséget <strong>egyedül mi</strong> biztosítjuk —
                    színválasztástól a megrendelésig, egy helyen.
                  </Typography>
                </Box>

                <InomatMarketingSwatches />

                <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.25, color: 'text.secondary' }}>
                  <Typography component="li" variant="body2">
                    Több tucat Inomat szín — matt és fényes
                  </Typography>
                  <Typography component="li" variant="body2">
                    Nincs várakozás árajánlatra: azonnal látod a bruttó árat
                  </Typography>
                  <Typography component="li" variant="body2">
                    Mentés, PDF, megrendelés — ugyaninnen
                  </Typography>
                </Stack>

                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 700,
                    color: 'text.primary',
                    lineHeight: 1.5,
                    bgcolor: 'rgba(0,0,0,0.04)',
                    borderRadius: 1.5,
                    px: 1.5,
                    py: 1.25
                  }}
                >
                  Ez Magyarországon egyedülálló: Inomat front online megrendelése asztalosoknak.
                </Typography>

                <Box sx={{ flex: 1 }} />

                <Button
                  component={Link}
                  href="/nettfront"
                  variant="contained"
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    alignSelf: { xs: 'stretch', sm: 'flex-start' },
                    bgcolor: '#0a0a0a',
                    color: '#fff',
                    fontWeight: 700,
                    px: 2.5,
                    '&:hover': { bgcolor: '#222' }
                  }}
                >
                  Nettfront megnyitása
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Ügyfélajánlat */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                height: '100%',
                border: '1px solid',
                borderColor: 'success.light',
                boxShadow: 'none',
                bgcolor: theme => `${theme.palette.success.main}08`
              }}
            >
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
                <Box>
                  <Typography
                    variant="overline"
                    sx={{ fontWeight: 700, color: 'success.dark', letterSpacing: 0.6 }}
                  >
                    2 · Ajánlat az ügyfelednek
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.25 }}>
                    Saját ajánlat PDF az ügyfelednek
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mt: 1, lineHeight: 1.55 }}>
                    A gyártótól <strong>kapott</strong> árajánlatból készíthetsz{' '}
                    <strong>saját</strong> ajánlatot: te szerepelsz ajánlat adóként, az ügyfeled a
                    vevő. Árrést és plusz tételeket (szállítás, szerelés) is hozzáadhatsz.
                  </Typography>
                </Box>

                <Box sx={{ flex: 1 }}>
                  <UgyfelajanlatStepPreviewMock />
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<HelpOutlineIcon />}
                    onClick={() => setTutorialOpen(true)}
                    sx={{ flex: 1 }}
                  >
                    Mutasd lépésről lépésre
                  </Button>
                  <Button
                    component={Link}
                    href="/saved"
                    variant="outlined"
                    color="success"
                    sx={{ flex: { sm: '0 0 auto' } }}
                  >
                    Mentett ajánlatok
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      <UgyfelajanlatTutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </>
  )
}
