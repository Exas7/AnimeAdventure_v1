@echo off
rem Anime Adventure: launcher guidato (spec 038, D-063; prima spec 008 e 009).
rem Porta sempre 5173: i dati salvati in Chrome (mappe, puntate, partite)
rem appartengono a quell'indirizzo, un'altra porta partirebbe vuota.
rem Sempre Chrome (D-022): ogni browser ha i suoi dati.
rem Node si chiama con "call": se e' installato come file .cmd, senza
rem "call" il launcher si fermerebbe dopo la prima chiamata.
setlocal
cd /d "%~dp0"
title Anime Adventure
set "URL=http://localhost:5173/"

echo.
echo  ===================================
echo     ANIME ADVENTURE - avvio guidato
echo  ===================================
echo.

echo [1/5] Controllo Node.js, il programma che fa funzionare il gioco...
set "NODE_MODE=install"
where node >nul 2>nul
if errorlevel 1 (
  echo       Node.js non e' installato.
  goto :offer_node
)
call node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit((a===20&&b>=19)||(a===22&&b>=12)||a>=23?0:1)"
if errorlevel 1 (
  for /f %%v in ('node -v') do echo       Node.js %%v e' troppo vecchio: serve la versione 22 o piu' recente.
  set "NODE_MODE=upgrade"
  goto :offer_node
)
for /f %%v in ('node -v') do echo       OK, Node.js %%v.

echo [2/5] Controllo Chrome...
rem Vite apre il browser indicato qui; senza Chrome, quello predefinito.
set "BROWSER=chrome"
reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>nul
if errorlevel 1 reg query "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>nul
if errorlevel 1 (
  echo       Chrome non trovato: uso il browser predefinito, che tiene dati suoi.
  echo       Il gioco e' pensato per Chrome: se puoi, installalo.
  set "BROWSER="
) else (
  echo       OK, Chrome c'e'.
)

echo [3/5] Controllo se il gioco e' gia' acceso...
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
  echo       E' gia' acceso: apro la regia nel browser.
  if defined BROWSER (start "" chrome "%URL%") else (start "" "%URL%")
  exit /b 0
)
echo       No, lo avvio.

call node scripts\build-stamp.mjs packages
set "STATE=%errorlevel%"
if "%STATE%"=="10" goto :install
if not "%STATE%"=="0" goto :fail
echo [4/5] Pacchetti del gioco gia' installati.
goto :build_check
:install
echo [4/5] Installo i pacchetti del gioco: succede solo la prima volta o dopo un aggiornamento, e serve qualche minuto...
call npm ci
if errorlevel 1 goto :fail
call node scripts\build-stamp.mjs packages --save
if errorlevel 1 goto :fail

:build_check
call node scripts\build-stamp.mjs app
set "STATE=%errorlevel%"
if "%STATE%"=="10" goto :build
if not "%STATE%"=="0" goto :fail
echo [5/5] Il gioco e' gia' pronto: parto subito.
goto :start
:build
echo [5/5] Preparo il gioco: e' cambiato qualcosa dall'ultima volta, serve qualche secondo...
call npm run build
if errorlevel 1 goto :fail
call node scripts\build-stamp.mjs app --save
if errorlevel 1 goto :fail

:start
echo.
echo  Anime Adventure e' acceso su %URL%
echo  - Si apre la REGIA nel browser.
echo  - Per lo STREAM premi "Apri stream" in regia: catturalo con OBS
echo    oppure condividi quella finestra su Discord.
echo  - Lascia aperta questa finestra: chiudendola si spegne il gioco.
echo.
call npm run preview -- --port 5173 --strictPort --open
if errorlevel 1 (
  echo.
  echo  Il gioco non e' partito: forse la porta 5173 e' occupata da un altro programma.
  goto :fail
)
exit /b 0

:offer_node
where winget >nul 2>nul
if errorlevel 1 goto :manual_node
echo.
set "ANSWER="
set /p "ANSWER=      Vuoi che lo installi adesso con winget, lo strumento di Windows? [S/N] "
if /i not "%ANSWER%"=="S" goto :manual_node
echo       Installo Node.js LTS: Windows potrebbe chiederti il permesso.
winget %NODE_MODE% -e --id OpenJS.NodeJS.LTS
if errorlevel 1 goto :manual_node
echo.
echo       Fatto. Chiudi questa finestra e riapri il launcher, cosi' Windows trova Node.js.
pause
exit /b 0

:manual_node
echo.
echo       Scarica Node.js, versione LTS, da https://nodejs.org
echo       installalo e poi riapri questo launcher.
start "" "https://nodejs.org/it/download"
pause
exit /b 1

:fail
echo.
echo  Avvio non riuscito: leggi il messaggio qui sopra.
echo  Se non lo capisci, chiedi aiuto a un agente AI aperto in questa cartella
echo  incollandogli quello che vedi.
pause
exit /b 1
