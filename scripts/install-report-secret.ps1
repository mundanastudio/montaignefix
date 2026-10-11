$ErrorActionPreference = "Stop"
$chars = 48..57 + 65..90 + 97..122
$secret = -join ($chars | Get-Random -Count 40 | ForEach-Object { [char]$_ })
$env:NODE_EXTRA_CA_CERTS = "C:\Users\rs07313\.certs\zscaler-root-ca.pem"
npx supabase@latest secrets set "REPORT_CRON_SECRET=$secret" --project-ref rnghppmuqbdpbkkljnsr | Out-Null
if ($LASTEXITCODE -ne 0) { throw "No se ha podido guardar el secreto de la función." }
$path = Join-Path $env:TEMP "mf-report-secret.sql"
@"
do `$`$
begin
  if exists (select 1 from vault.secrets where name = 'report_cron_secret') then
    perform vault.update_secret((select id from vault.secrets where name = 'report_cron_secret'), '$secret');
  else
    perform vault.create_secret('$secret', 'report_cron_secret', 'cron de informes');
  end if;
end
`$`$;
"@ | Set-Content -Path $path -Encoding ascii
try {
  npx supabase@latest db query --linked -f $path | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "No se ha podido guardar el secreto del cron." }
} finally {
  if (Test-Path $path) { Remove-Item $path -Force }
}
Write-Output "cron secret listo"
