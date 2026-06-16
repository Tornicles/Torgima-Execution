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
Read-Docx 'c:\Users\giftr\Downloads\CURSOR_B4b_Erector_Pro_Authenticated.docx'
