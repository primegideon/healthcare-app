#!/usr/bin/env bash
# Replace the URL below with your own Invoke URL from API Gateway (step 15).
API="https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod"

# 1. Create the three sample patients
curl -X POST "$API/patients" -H "Content-Type: application/json" \
  -d '{"patientId": "PT-1001", "firstName": "Kwame", "lastName": "Mensah", "dateOfBirth": "1985-03-14", "bloodType": "O+", "primaryDiagnosis": "Malaria", "attendingPhysician": "Dr. Ama Boateng", "ward": "General", "admissionDate": "2026-09-20", "status": "Admitted", "weightKg": 72.5}'
curl -X POST "$API/patients" -H "Content-Type: application/json" \
  -d '{"patientId": "PT-1002", "firstName": "Abena", "lastName": "Owusu", "dateOfBirth": "1992-11-02", "bloodType": "A+", "primaryDiagnosis": "Pre-eclampsia monitoring", "attendingPhysician": "Dr. Kofi Asante", "ward": "Maternity", "admissionDate": "2026-09-22", "status": "Admitted", "weightKg": 68.0}'
curl -X POST "$API/patients" -H "Content-Type: application/json" \
  -d '{"patientId": "PT-1003", "firstName": "Yaw", "lastName": "Darko", "dateOfBirth": "2016-06-30", "bloodType": "B-", "primaryDiagnosis": "Asthma follow-up", "attendingPhysician": "Dr. Efua Mensah", "ward": "Paediatrics", "admissionDate": "2026-09-18", "status": "Outpatient", "weightKg": 24.3}'

# 2. Read one back (expect 200)
curl "$API/patients/PT-1001"

# 3. Update it (expect 200 and an updatedAt timestamp)
curl -X PUT "$API/patients/PT-1001" -H "Content-Type: application/json" \
  -d '{"status": "Discharged", "ward": "General"}'

# 4. Try to create a duplicate (expect 409)
curl -X POST "$API/patients" -H "Content-Type: application/json" \
  -d '{"patientId": "PT-1001", "firstName": "Kwame", "lastName": "Mensah", "dateOfBirth": "1985-03-14", "bloodType": "O+", "primaryDiagnosis": "Malaria", "attendingPhysician": "Dr. Ama Boateng", "ward": "General", "admissionDate": "2026-09-20", "status": "Admitted", "weightKg": 72.5}'

# 5. Send a record with a missing field (expect 400)
curl -X POST "$API/patients" -H "Content-Type: application/json" \
  -d '{"patientId": "PT-1009"}'

# 6. Delete it, then confirm it is gone (expect 200, then 404)
curl -X DELETE "$API/patients/PT-1001"
curl "$API/patients/PT-1001"
