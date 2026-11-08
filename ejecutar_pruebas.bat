@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   KONYS PIZZA - Pruebas automaticas con Selenium
echo ============================================================
echo.

rem Busca Python: primero el lanzador "py" y luego el comando "python".
set "PY=py"
%PY% --version >nul 2>nul
if errorlevel 1 (
    set "PY=python"
    %PY% --version >nul 2>nul
    if errorlevel 1 (
        echo No se encontro Python. Instala Python 3.8 o superior desde python.org
        echo y marca la opcion "Add Python to PATH".
        echo.
        pause
        exit /b 1
    )
)

rem Instala Selenium y ReportLab solo si faltan.
%PY% -c "import selenium, reportlab" >nul 2>nul
if errorlevel 1 (
    echo Instalando Selenium y ReportLab...
    %PY% -m pip install -r "pruebas\requirements.txt"
    if errorlevel 1 (
        echo.
        echo No se pudieron instalar las librerias. Revisa la conexion a internet.
        echo.
        pause
        exit /b 1
    )
)

echo Ejecutando las 30 pruebas. No cierres la ventana del navegador.
echo Opciones disponibles: --rapido   --oculto   --sin-abrir   --navegador chrome^|edge
echo.

%PY% "pruebas\pruebas_reservas.py" %*

set "CODIGO=%ERRORLEVEL%"
echo.
if "%CODIGO%"=="0" (
    echo Las pruebas terminaron correctamente.
) else (
    echo La ejecucion termino con incidencias. Revisa el reporte PDF.
)
echo.
pause
exit /b %CODIGO%
