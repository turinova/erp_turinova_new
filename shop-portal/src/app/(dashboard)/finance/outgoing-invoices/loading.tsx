import { Box, LinearProgress, Skeleton, Stack, Paper } from '@mui/material'

export default function OutgoingInvoicesLoading() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1680, mx: 'auto' }}>
      <Skeleton variant="text" width={220} sx={{ mb: 2 }} />
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Skeleton variant="text" width={80} height={20} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={320} height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={72} sx={{ borderRadius: 1 }} />
      </Paper>
      <Stack spacing={1}>
        <LinearProgress />
        <Skeleton variant="rectangular" height={420} sx={{ borderRadius: 2 }} />
      </Stack>
    </Box>
  )
}
