Add-Type -AssemblyName System.IO.Compression.FileSystem
function Read-Docx([string]$path) {
  $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
  $entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' }
  $sr = New-Object System.IO.StreamReader($entry.Open())
  $xml = $sr.ReadToEnd()
  $sr.Close()
  $zip.Dispose()
  ($xml -replace '</w:p>', "`n") -replace '<[^>]+>', ''
}

Write-Output "===== CURSOR_B5B6B7 ====="
Read-Docx 'c:\Users\giftr\Downloads\CURSOR_B5B6B7_Blueprint_Tier_Enforcement.docx'
Write-Output "`n===== DOC_B5 ====="
Read-Docx 'c:\Users\giftr\Downloads\DOC_B5_Starter_Plan_Architecture.docx'
Write-Output "`n===== DOC_B6 ====="
Read-Docx 'c:\Users\giftr\Downloads\DOC_B6_Growth_Plan_Architecture.docx'
Write-Output "`n===== DOC_B7 ====="
Read-Docx 'c:\Users\giftr\Downloads\DOC_B7_Ultimate_Plan_Architecture.docx'
