'use client'

import React from 'react'
import { 
  Box, 
  Chip, 
  Tooltip, 
  LinearProgress, 
  Typography
} from '@mui/material'
import { 
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material'

export interface QualityScore {
  overall_score: number
  content_score: number
  image_score: number
  technical_score: number
  performance_score: number
  completeness_score: number
  competitive_score: number
  priority_score: number
  is_parent: boolean
  issues: Array<{
    type: string
    severity: 'critical' | 'warning' | 'info'
    message: string
    points_lost: number
  }>
  blocking_issues: string[]
  last_calculated_at?: string
}

interface ProductQualityScoreProps {
  score: QualityScore | null
  size?: 'small' | 'medium' | 'large'
  showBreakdown?: boolean
  compact?: boolean
  showImprovementTips?: boolean
}

export default function ProductQualityScore({ 
  score, 
  size = 'medium',
  showBreakdown = false,
  compact = false,
  showImprovementTips = false
}: ProductQualityScoreProps) {
  if (!score) {
    return (
      <Tooltip title="Minőségi pontszám még nincs kiszámolva">
        <Chip 
          label="Nincs" 
          size={size}
          color="default"
          variant="outlined"
        />
      </Tooltip>
    )
  }

  const getScoreColor = (scoreValue: number): 'success' | 'warning' | 'error' | 'default' => {
    if (scoreValue >= 75) return 'success'
    if (scoreValue >= 60) return 'warning'
    if (scoreValue >= 45) return 'warning'
    return 'error'
  }

  const getScoreLabel = (scoreValue: number): string => {
    if (scoreValue >= 90) return 'Kiváló'
    if (scoreValue >= 75) return 'Jó'
    if (scoreValue >= 60) return 'Közepes'
    if (scoreValue >= 45) return 'Gyenge'
    return 'Kritikus'
  }

  const getScoreIcon = (scoreValue: number) => {
    if (scoreValue >= 75) return <CheckCircleIcon fontSize="small" />
    if (scoreValue >= 60) return <WarningIcon fontSize="small" />
    return <ErrorIcon fontSize="small" />
  }

  // Safely handle missing issues arrays
  const blockingIssues = score.blocking_issues || []
  const issues = score.issues || []
  
  const hasCriticalIssues = blockingIssues.length > 0
  const criticalIssuesCount = issues.filter(i => i.severity === 'critical').length
  const warningIssuesCount = issues.filter(i => i.severity === 'warning').length

  if (compact) {
    // Get critical and warning issues separately
    const criticalIssues = issues.filter(i => i.severity === 'critical')
    const warningIssues = issues.filter(i => i.severity === 'warning')
    
    return (
      <Tooltip 
        title={
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
              Minőségi pontszám: {score.overall_score}/100 ({getScoreLabel(score.overall_score)})
            </Typography>
            {criticalIssues.length > 0 && (
              <Box sx={{ mt: 0.5 }}>
                <Typography variant="caption" color="error" fontWeight={600} sx={{ display: 'block', mb: 0.25 }}>
                  {criticalIssuesCount} kritikus probléma:
                </Typography>
                {criticalIssues.map((issue, idx) => (
                  <Typography key={idx} variant="caption" color="error" sx={{ display: 'block', pl: 1 }}>
                    • {issue.message}
                  </Typography>
                ))}
              </Box>
            )}
            {warningIssues.length > 0 && (
              <Box sx={{ mt: 0.5 }}>
                <Typography variant="caption" color="warning.main" fontWeight={600} sx={{ display: 'block', mb: 0.25 }}>
                  {warningIssuesCount} figyelmeztetés:
                </Typography>
                {warningIssues.map((issue, idx) => (
                  <Typography key={idx} variant="caption" color="warning.main" sx={{ display: 'block', pl: 1 }}>
                    • {issue.message}
                  </Typography>
                ))}
              </Box>
            )}
            {!hasCriticalIssues && warningIssuesCount === 0 && (
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
                Nincs kritikus probléma
              </Typography>
            )}
          </Box>
        }
        enterDelay={300}
        leaveDelay={100}
      >
        <Chip
          icon={getScoreIcon(score.overall_score)}
          label={`${score.overall_score}`}
          size={size}
          color={getScoreColor(score.overall_score)}
          variant={hasCriticalIssues ? 'filled' : 'outlined'}
          sx={{
            fontWeight: 600,
            minWidth: 60
          }}
        />
      </Tooltip>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: showBreakdown ? 1 : 0 }}>
        <Tooltip 
          title={
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                Minőségi pontszám: {score.overall_score}/100
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                Kategóriák:
              </Typography>
              <Typography variant="caption" sx={{ display: 'block' }}>
                • Tartalom: {score.content_score} pont
              </Typography>
              <Typography variant="caption" sx={{ display: 'block' }}>
                • Képek: {score.image_score} pont
              </Typography>
              <Typography variant="caption" sx={{ display: 'block' }}>
                • Technikai: {score.technical_score} pont
              </Typography>
              <Typography variant="caption" sx={{ display: 'block' }}>
                • Teljesítmény: {score.performance_score} pont
              </Typography>
              <Typography variant="caption" sx={{ display: 'block' }}>
                • Teljesség: {score.completeness_score} pont
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                • Versenyképesség: {score.competitive_score} pont
              </Typography>
              {hasCriticalIssues && (
                <>
                  <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                    Kritikus problémák: {blockingIssues.join(', ')}
                  </Typography>
                </>
              )}
            </Box>
          }
        >
          <Chip
            icon={getScoreIcon(score.overall_score)}
            label={`${score.overall_score}/100`}
            size={size}
            color={getScoreColor(score.overall_score)}
            variant={hasCriticalIssues ? 'filled' : 'outlined'}
            sx={{
              fontWeight: 600,
              minWidth: 80
            }}
          />
        </Tooltip>
        {hasCriticalIssues && (
          <Chip
            icon={<ErrorIcon />}
            label={`${criticalIssuesCount} kritikus`}
            size="small"
            color="error"
            variant="outlined"
          />
        )}
        {warningIssuesCount > 0 && (
          <Chip
            icon={<WarningIcon />}
            label={`${warningIssuesCount} figyelmeztetés`}
            size="small"
            color="warning"
            variant="outlined"
          />
        )}
      </Box>

      {showBreakdown && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Kategória pontszámok:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption">Tartalom</Typography>
                <Typography variant="caption" fontWeight={600}>{score.content_score}/35</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(score.content_score / 35) * 100} 
                color={getScoreColor(score.content_score)}
                sx={{ height: 6, borderRadius: 1 }}
              />
            </Box>
            {score.is_parent && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption">Képek</Typography>
                  <Typography variant="caption" fontWeight={600}>{score.image_score}/25</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={(score.image_score / 25) * 100} 
                  color={getScoreColor(score.image_score)}
                  sx={{ height: 6, borderRadius: 1 }}
                />
              </Box>
            )}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption">Technikai SEO</Typography>
                <Typography variant="caption" fontWeight={600}>{score.technical_score}/{score.is_parent ? 20 : 25}</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(score.technical_score / (score.is_parent ? 20 : 25)) * 100} 
                color={getScoreColor(score.technical_score)}
                sx={{ height: 6, borderRadius: 1 }}
              />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption">Teljesítmény</Typography>
                <Typography variant="caption" fontWeight={600}>{score.performance_score}/5</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(score.performance_score / 5) * 100} 
                color={getScoreColor(score.performance_score)}
                sx={{ height: 6, borderRadius: 1 }}
              />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption">Teljesség</Typography>
                <Typography variant="caption" fontWeight={600}>{score.completeness_score}/{score.is_parent ? 10 : 50}</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(score.completeness_score / (score.is_parent ? 10 : 50)) * 100} 
                color={getScoreColor(score.completeness_score)}
                sx={{ height: 6, borderRadius: 1 }}
              />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption">Versenyképesség</Typography>
                <Typography variant="caption" fontWeight={600}>{score.competitive_score}/{score.is_parent ? 5 : 10}</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(score.competitive_score / (score.is_parent ? 5 : 10)) * 100} 
                color={getScoreColor(score.competitive_score)}
                sx={{ height: 6, borderRadius: 1 }}
              />
            </Box>
          </Box>

          {issues.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Specifikus problémák:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {issues.map((issue, index) => (
                  <Box 
                    key={index}
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      p: 1,
                      borderRadius: 1,
                      bgcolor: issue.severity === 'critical' ? 'error.light' : 
                               issue.severity === 'warning' ? 'warning.light' : 
                               'info.light',
                      border: `1px solid ${issue.severity === 'critical' ? 'error.main' : 
                                         issue.severity === 'warning' ? 'warning.main' : 
                                         'info.main'}`
                    }}
                  >
                    {issue.severity === 'critical' ? <ErrorIcon color="error" /> :
                     issue.severity === 'warning' ? <WarningIcon color="warning" /> :
                     <InfoIcon color="info" />}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {issue.message}
                      </Typography>
                    </Box>
                    <Chip
                      label={`-${issue.points_lost} pont`}
                      size="small"
                      color={issue.severity === 'critical' ? 'error' : issue.severity === 'warning' ? 'warning' : 'default'}
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
