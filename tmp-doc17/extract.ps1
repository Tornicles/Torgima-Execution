$raw = Get-Content -Raw "c:\Users\giftr\Downloads\TORGIMA-20260405T111220Z-1-001\Torgima-Execution\tmp-doc17\word\document.xml"
$matches = [regex]::Matches($raw, '<w:t[^>]*>([^<]*)</w:t>')
$lines = foreach ($m in $matches) { $m.Groups[1].Value }
$lines | Set-Content "c:\Users\giftr\Downloads\TORGIMA-20260405T111220Z-1-001\Torgima-Execution\tmp-doc17-extracted.txt"
