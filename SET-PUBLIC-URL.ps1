param([string]$PublicUrl="")
$ErrorActionPreference="Stop"
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
if([string]::IsNullOrWhiteSpace($PublicUrl)){
  $PublicUrl=Read-Host "Paste your live Cloudflare Pages URL (example: https://your-project.pages.dev)"
}
$PublicUrl=$PublicUrl.Trim().TrimEnd("/")
if(-not ($PublicUrl -match '^https://[^/]+$')){ throw "Please enter only the HTTPS website address, with no page path." }
$old='https://turtle-study-buddy.pages.dev'
$files=Get-ChildItem -Path $root -File -Include *.html,robots.txt,sitemap.xml -Recurse
foreach($f in $files){
  $text=[System.IO.File]::ReadAllText($f.FullName)
  if($text.Contains($old)){
    $text=$text.Replace($old,$PublicUrl)
    [System.IO.File]::WriteAllText($f.FullName,$text,[System.Text.UTF8Encoding]::new($false))
  }
}
Write-Host ""
Write-Host "Updated canonical URLs, Open Graph URLs, robots.txt and sitemap.xml to:" -ForegroundColor Green
Write-Host $PublicUrl -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close"
