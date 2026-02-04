# Azure'a yeni hesabı ekleme scripti

# 1. QUT hesabıyla login yapın
Write-Host "QUT hesabıyla giriş yapılıyor..." -ForegroundColor Cyan
az login --allow-no-subscriptions

# 2. Doğru subscription'ı seçin (varsa)
Write-Host "`nSubscription'ları listeleniyor..." -ForegroundColor Cyan
az account list --output table

Write-Host "`nDoğru subscription'ı seçin:"
$subscriptionId = Read-Host "Subscription ID girin"
az account set --subscription $subscriptionId

# 3. Yeni hesabı guest user olarak ekle
Write-Host "`nYeni hesap ekleniyor: serter_iyigunlu@outlook.com" -ForegroundColor Green
az ad user invite --email-address "serter_iyigunlu@outlook.com" --display-name "Serter Iyigunlu"

# 4. Contributor rolü ata
Write-Host "`nContributor rolü atanıyor..." -ForegroundColor Green
az role assignment create --assignee "serter_iyigunlu@outlook.com" --role "Contributor"

Write-Host "`n✅ Tamam! Artık serter_iyigunlu@outlook.com hesabıyla Azure Portal'a giriş yapabilirsiniz." -ForegroundColor Green
Write-Host "Gelen kutunuza davet maili gelecek - önce onu onaylamanız gerekebilir." -ForegroundColor Yellow
