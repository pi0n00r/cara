; AI-NOTICE:Schema-Version=0.1
; AI-NOTICE:License=MIT
; AI-NOTICE:Author=Gary Bajaj
; AI-NOTICE:Scope=file

!macro customInit
  InitPluginsDir
  File /oname=$PLUGINSDIR\stop-cara-processes.ps1 "${PROJECT_DIR}\scripts\stop-cara-processes.ps1"
  nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\stop-cara-processes.ps1" -InstallDir "$INSTDIR" -StorageDir "$APPDATA\anythingllm-desktop\storage"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    ${If} ${Silent}
      SetErrorLevel 1
      Quit
    ${Else}
      MessageBox MB_ICONSTOP|MB_OK "Cara could not stop its existing background services. Close Cara completely and retry.$\r$\n$\r$\n$1"
      Abort
    ${EndIf}
  ${EndIf}
!macroend
