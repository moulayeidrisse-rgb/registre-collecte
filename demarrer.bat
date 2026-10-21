@echo off
REM ====================================================================
REM  Registre Collecte - demarrage sur Windows (double-cliquer ce fichier)
REM  Prerequis : Node.js 22 LTS et PostgreSQL installes (voir docs\WINDOWS.md)
REM ====================================================================
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Registre Collecte

echo.
echo ===============================================
echo   Registre Collecte - demarrage
echo ===============================================
echo.

REM --- 1. Node.js present et en version 22 ou plus ---
where node >nul 2>nul
if errorlevel 1 goto pas_de_node
for /f "tokens=1 delims=v." %%a in ('node -v') do set NODEMAJ=%%a
if %NODEMAJ% LSS 22 goto vieux_node
echo [OK] Node.js detecte.

REM --- 2. Fichier de configuration .env (cree une seule fois) ---
if exist ".env" goto installer
echo.
echo Saisissez le mot de passe choisi lors de l'installation de PostgreSQL
echo (utilisateur "postgres"). Il ne sera enregistre que sur cet ordinateur.
echo.
set /p PGPW=Mot de passe PostgreSQL : 
> .env echo DATABASE_URL="postgresql://postgres:%PGPW%@localhost:5432/postgres?schema=public"
>> .env echo SESSION_TTL_HOURS=8
>> .env echo SEED_PASSWORD="Demo-Registre-2026"
set PGPW=
echo [OK] Configuration enregistree dans le fichier .env

:installer
REM --- 3. Installation des dependances (premiere fois seulement) ---
if exist "node_modules\.bin\next.cmd" goto base
echo.
echo Installation des composants (2 a 5 minutes, une seule fois)...
call npm ci
if errorlevel 1 goto erreur_install

:base
REM --- 4. Creation des tables et donnees fictives (si la base est vide) ---
echo.
echo Preparation de la base de donnees...
call npx prisma migrate deploy
if errorlevel 1 goto erreur_base
set SEED_IF_EMPTY=1
call npm run db:seed
if errorlevel 1 goto erreur_base
set SEED_IF_EMPTY=

REM --- 5. Lancement ---
echo.
echo ===============================================
echo   Application en cours de demarrage...
echo   Adresse : http://localhost:3000
echo   Compte  : admin@demo.registre.test
echo   Mot de passe : Demo-Registre-2026
echo.
echo   Laissez cette fenetre ouverte pendant l'utilisation.
echo   Pour arreter : fermez cette fenetre.
echo ===============================================
echo.
start "" cmd /c "timeout /t 12 >nul & start http://localhost:3000"
call npm run dev
goto fin

:pas_de_node
echo [ERREUR] Node.js n'est pas installe.
echo Installez la version 22 LTS depuis https://nodejs.org puis relancez ce fichier.
goto pause_fin

:vieux_node
echo [ERREUR] Node.js est trop ancien. Installez la version 22 LTS depuis https://nodejs.org
goto pause_fin

:erreur_install
echo [ERREUR] L'installation des composants a echoue. Verifiez votre connexion Internet et relancez.
goto pause_fin

:erreur_base
echo.
echo [ERREUR] Impossible d'utiliser la base de donnees.
echo  - Verifiez que PostgreSQL est installe et demarre.
echo  - Si le mot de passe saisi etait faux : supprimez le fichier .env
echo    dans ce dossier, puis relancez demarrer.bat pour le ressaisir.
goto pause_fin

:pause_fin
echo.
pause
exit /b 1

:fin
endlocal
