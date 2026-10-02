$ErrorActionPreference="Stop"
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$port=4173
$listener=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,$port)
$listener.Start()
$url="http://127.0.0.1:$port/"
Start-Process $url
Write-Host "Turtle Study Buddy preview is running at $url" -ForegroundColor Green
Write-Host "Keep this window open while testing. Press Ctrl+C to stop." -ForegroundColor Yellow

$mime=@{
  ".html"="text/html; charset=utf-8";".css"="text/css; charset=utf-8";".js"="text/javascript; charset=utf-8";
  ".json"="application/json; charset=utf-8";".png"="image/png";".ico"="image/x-icon";".svg"="image/svg+xml";
  ".xml"="application/xml; charset=utf-8";".txt"="text/plain; charset=utf-8"
}
try{
while($true){
  $client=$listener.AcceptTcpClient()
  try{
    $stream=$client.GetStream()
    $reader=[System.IO.StreamReader]::new($stream,[System.Text.Encoding]::ASCII,$false,8192,$true)
    $line=$reader.ReadLine()
    if([string]::IsNullOrWhiteSpace($line)){ $client.Close(); continue }
    $parts=$line.Split(" ")
    $method=$parts[0];$target=$parts[1]
    do{$h=$reader.ReadLine()}while($h -ne "")
    $path=([uri]("http://localhost"+$target)).AbsolutePath.TrimStart("/")
    if([string]::IsNullOrWhiteSpace($path)){$path="index.html"}
    if($path -eq "api/chat"){
      $body='{"error":"Live AI activates after Cloudflare deployment. The local Chat page will use its built-in offline tutor."}'
      $bytes=[System.Text.Encoding]::UTF8.GetBytes($body)
      $head="HTTP/1.1 503 Service Unavailable`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
      $hb=[System.Text.Encoding]::ASCII.GetBytes($head);$stream.Write($hb,0,$hb.Length);$stream.Write($bytes,0,$bytes.Length);continue
    }
    $candidate=[System.IO.Path]::GetFullPath((Join-Path $root $path.Replace("/",[System.IO.Path]::DirectorySeparatorChar)))
    if(-not $candidate.StartsWith([System.IO.Path]::GetFullPath($root)) -or -not (Test-Path $candidate -PathType Leaf)){
      $body=[System.Text.Encoding]::UTF8.GetBytes("Not found")
      $head="HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
      $hb=[System.Text.Encoding]::ASCII.GetBytes($head);$stream.Write($hb,0,$hb.Length);$stream.Write($body,0,$body.Length);continue
    }
    $bytes=[System.IO.File]::ReadAllBytes($candidate)
    $ext=[System.IO.Path]::GetExtension($candidate).ToLowerInvariant()
    $type=if($mime.ContainsKey($ext)){$mime[$ext]}else{"application/octet-stream"}
    $head="HTTP/1.1 200 OK`r`nContent-Type: $type`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
    $hb=[System.Text.Encoding]::ASCII.GetBytes($head);$stream.Write($hb,0,$hb.Length);$stream.Write($bytes,0,$bytes.Length)
  } finally { $client.Close() }
}
} finally {$listener.Stop()}
