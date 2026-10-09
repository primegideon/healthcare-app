$API = "https://3nuac0f5cl.execute-api.us-east-1.amazonaws.com/prod"

Write-Host "1. Adding an appointment for PT-1001..."
$body = @{
    appointmentDate = "2026-10-15"
    reason = "Follow-up checkup"
} | ConvertTo-Json
Invoke-RestMethod -Uri "$API/patients/PT-1001/appointments" -Method Post -Body $body -ContentType "application/json" | ConvertTo-Json

Write-Host "`n2. Getting appointments for PT-1001..."
Invoke-RestMethod -Uri "$API/patients/PT-1001/appointments" -Method Get | ConvertTo-Json

Write-Host "`n3. Deleting the appointment..."
Invoke-RestMethod -Uri "$API/patients/PT-1001/appointments/2026-10-15" -Method Delete | ConvertTo-Json
