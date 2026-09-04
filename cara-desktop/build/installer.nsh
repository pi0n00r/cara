; AI-NOTICE:Schema-Version=0.1
; AI-NOTICE:License=MIT
; AI-NOTICE:Author=Gary Bajaj
; AI-NOTICE:Scope=file

!macro customInit
  ${If} $hasPerUserInstallation == "0"
  ${AndIf} $hasPerMachineInstallation == "0"
    Goto cara_preflight_done
  ${EndIf}
  InitPluginsDir
  File /oname=$PLUGINSDIR\stop-cara-processes.ps1 "${PROJECT_DIR}\scripts\stop-cara-processes.ps1"
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$PLUGINSDIR\stop-cara-processes.ps1" -StorageDir "$APPDATA\anythingllm-desktop\storage"' $0
  ${If} $0 != 0
    ${If} ${Silent}
      SetErrorLevel 1
      Quit
    ${Else}
      MessageBox MB_ICONSTOP|MB_OK "Cara could not stop its existing background services. Close Cara completely and retry."
      Abort
    ${EndIf}
  ${EndIf}
cara_preflight_done:
!macroend
