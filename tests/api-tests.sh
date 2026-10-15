#!/usr/bin/env bash
# Configure API Gateway Invoke URL for integration testing
API="https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod"

# 1. Seed sample patient records (POST /patients)
curl -X POST "$API/patients" -H "Content-Type: application/json" \
  -d '{"patientId": "PT-1001", "firstName": "Kwame", "lastName": "Mensah", "dateOfBirth": "1985-03-14", "bloodType": "O+", "primaryDiagnosis": "Malaria", "attendingPhysician": "Dr. Ama Boateng", "ward": "General", "admissionDate": "2026-09-20", "status": "Admitted", "weightKg": 72.5}'
curl -X POST "$API/patients" -H "Content-Type: application/json" \
  -d '{"patientId": "PT-1002", "firstName": "Abena", "lastName": "Owusu", "dateOfBirth": "1992-11-02", "bloodType": "A+", "primaryDiagnosis": "Pre-eclampsia monitoring", "attendingPhysician": "Dr. Kofi Asante", "ward": "Maternity", "admissionDate": "2026-09-22", "status": "Admitted", "weightKg": 68.0}'
curl -X POST "$API/patients" -H "Content-Type: application/json" \
  -d '{"patientId": "PT-1003", "firstName": "Yaw", "lastName": "Darko", "dateOfBirth": "2016-06-30", "bloodType": "B-", "primaryDiagnosis": "Asthma follow-up", "attendingPhysician": "Dr. Efua Mensah", "ward": "Paediatrics", "admissionDate": "2026-09-18", "status": "Outpatient", "weightKg": 24.3}'

# 2. Retrieve patient record by ID (GET /patients/{id} -> 200 OK)
curl "$API/patients/PT-1001"

# 3. Update patient status & ward (PUT /patients/{id} -> 200 OK)
curl -X PUT "$API/patients/PT-1001" -H "Content-Type: application/json" \
  -d '{"status": "Discharged", "ward": "General"}'

# 4. Validate duplicate rejection (POST /patients -> 409 Conflict)
curl -X POST "$API/patients" -H "Content-Type: application/json" \
  -d '{"patientId": "PT-1001", "firstName": "Kwame", "lastName": "Mensah", "dateOfBirth": "1985-03-14", "bloodType": "O+", "primaryDiagnosis": "Malaria", "attendingPhysician": "Dr. Ama Boateng", "ward": "General", "admissionDate": "2026-09-20", "status": "Admitted", "weightKg": 72.5}'

# 5. Validate schema enforcement on missing fields (POST /patients -> 400 Bad Request)
curl -X POST "$API/patients" -H "Content-Type: application/json" \
  -d '{"patientId": "PT-1009"}'

# 6. Validate discharge deletion & subsequent lookup (DELETE -> 200, GET -> 404)
curl -X DELETE "$API/patients/PT-1001"
curl "$API/patients/PT-1001"
