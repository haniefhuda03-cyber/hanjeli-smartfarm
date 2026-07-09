<#
  push-all-to-github.ps1
  Push SELURUH isi hanjeli-smartfarm ke GitHub TANPA TERKECUALI
  (.gitignore dinonaktifkan sementara via `git add --force`, termasuk .env & node_modules).

  ⚠️  PERINGATAN:
   1) .env berisi kredensial AKTIF (Gmail App Password, JWT/encryption secrets,
      DB & MQTT password, Google secret). Setelah push, ini PERMANEN di git history.
      => WAJIB rotasi semua secret tsb setelahnya.
   2) Menyertakan node_modules bisa sangat besar; GitHub menolak file > 100 MB.
      Jika push DITOLAK karena ukuran, pakai VARIAN AMAN di bagian bawah file ini.
   3) Script ini MEMINDAHKAN .git milik hanjeli-be & hanjeli-fe ke folder backup
      (di luar repo) supaya semua file mereka ikut sebagai file biasa (monorepo).

  Cara pakai (PowerShell, di mesin Anda yang sudah login GitHub):
     cd "C:\Users\Haniefu Fuda\Downloads\hanjeli-smartfarm"
     ./push-all-to-github.ps1
#>

$ErrorActionPreference = 'Stop'
$Repo = 'C:\Users\Haniefu Fuda\Downloads\hanjeli-smartfarm'
$Url  = 'https://github.com/haniefhuda03-cyber/hanjeli-smartfarm.git'
Set-Location $Repo

Write-Host '==> 1. Memindahkan .git nested (hanjeli-be / hanjeli-fe) ke backup...' -ForegroundColor Cyan
$Backup = Join-Path (Split-Path $Repo -Parent) '_hanjeli_nested_git_backup'
New-Item -ItemType Directory -Force -Path $Backup | Out-Null
foreach ($sub in 'hanjeli-be', 'hanjeli-fe') {
    $g = Join-Path $Repo "$sub\.git"
    if (Test-Path $g) {
        Move-Item $g (Join-Path $Backup "$sub.git") -Force
        Write-Host "    dipindah: $sub\.git -> $Backup\$sub.git"
    }
}

Write-Host '==> 2. Inisialisasi repo root...' -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $Repo '.git'))) { git init | Out-Null }
git branch -M main
git remote remove origin 2>$null | Out-Null
git remote add origin $Url

Write-Host '==> 3. Menambahkan SEMUA file (gitignore di-bypass, termasuk .env & node_modules)...' -ForegroundColor Cyan
Write-Host '    (bisa lama karena node_modules besar — tunggu)' -ForegroundColor DarkGray
git add --force --all .

Write-Host '==> 4. Commit...' -ForegroundColor Cyan
git commit -m 'Full snapshot: semua file termasuk .env & node_modules (gitignore dibypass)'

Write-Host '==> 5. Push ke GitHub (mungkin muncul jendela login GitHub)...' -ForegroundColor Cyan
git push -u origin main --force

Write-Host ''
Write-Host '✅ Selesai (jika tidak ada error di atas).' -ForegroundColor Green
Write-Host '   Restore .git sub-repo bila perlu:' -ForegroundColor Yellow
Write-Host "     Move-Item `"$Backup\hanjeli-be.git`"  `"$Repo\hanjeli-be\.git`"" -ForegroundColor Yellow
Write-Host "     Move-Item `"$Backup\hanjeli-fe.git`"  `"$Repo\hanjeli-fe\.git`"" -ForegroundColor Yellow
Write-Host '   ⚠️  ROTASI SEMUA SECRET di .env sekarang (sudah terekspos di history).' -ForegroundColor Red


# ════════════════════════════════════════════════════════════════════
#  VARIAN AMAN (jika push penuh DITOLAK karena node_modules > 100 MB).
#  Tetap menyertakan .env, tapi mengecualikan folder besar yang bisa
#  di-generate ulang (npm install / next build).
#  Jalankan MANUAL bila diperlukan:
# ════════════════════════════════════════════════════════════════════
# Set-Location $Repo
# @'
# node_modules/
# **/node_modules/
# .next/
# dist/
# '@ | Set-Content -Encoding utf8 (Join-Path $Repo '.gitignore')
# git rm -r --cached --quiet node_modules hanjeli-be/node_modules hanjeli-fe/node_modules hanjeli-fe/.next hanjeli-be/dist 2>$null
# git add -A .
# git commit -m 'Snapshot tanpa node_modules/.next/dist (regen via npm install)'
# git push -u origin main --force
