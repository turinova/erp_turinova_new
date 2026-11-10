-- Átvételi blokk QR felirat: új alapszöveg (a régit módosítatlanul hagyó tenantek is megkapják)

alter table public.tenant_review_settings
  alter column handover_qr_text set default 'Írnál rólunk pár szót a Google-ön?';

update public.tenant_review_settings
set handover_qr_text = 'Írnál rólunk pár szót a Google-ön?',
    updated_at = now()
where handover_qr_text = 'Értékelj minket a Google-ön — 30 mp';
