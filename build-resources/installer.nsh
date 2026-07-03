; electron-builder custom NSIS include (picked up automatically from
; directories.buildResources). Overrides the "is the app running?" check for
; both the installer and the uninstaller.
;
; The default CHECK_APP_RUNNING matches any process from the install dir (or by
; exe name), which includes invisible zombie Electron helper processes
; (Gentoo.exe --type=gpu-process etc.) left behind by a crashy exit. With no
; window open, users hit an unfixable "Gentoo cannot be closed / Retry" loop
; when updating. Instead of prompting, force-kill anything matching the app's
; exe name and continue; updates are intentional, so closing the app is the
; desired outcome anyway.
!macro customCheckAppRunning
  nsExec::Exec `"$SYSDIR\taskkill.exe" /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
  Sleep 300
!macroend
