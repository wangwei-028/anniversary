@echo off
rem Double-click to play: starts a tiny local server (PowerShell, no install needed) and opens the browser.
rem Reason: Chrome/Edge block ES modules on file:// pages.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve.ps1"
