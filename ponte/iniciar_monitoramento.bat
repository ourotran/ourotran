@echo off
rem Liga o monitoramento com IA da OuroTran: abre o Vigia em cada camera do config.json e manda os alertas para o sistema.
cd /d "%~dp0"
python ponte.py
pause
