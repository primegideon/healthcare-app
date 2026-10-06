# Patient Records System — Healthcare track

Starter code for the AWS serverless records project (Riverside General Hospital, fictional).
Follow the step-by-step guide `healthcare-guide.html`; this folder holds every file it refers to.

## Lambda functions (Python 3.13)
- `lambda/CreatePatient.py` — POST /patients
- `lambda/GetPatient.py` — GET /patients/{patientId}
- `lambda/UpdatePatient.py` — PUT /patients/{patientId}
- `lambda/DeletePatient.py` — DELETE /patients/{patientId}

## Frontend (upload to S3)
- `frontend/index.html`, `frontend/styles.css`, `frontend/app.js`
- Set `API_BASE_URL` at the top of `app.js` before uploading.

## Policies
- `policies/lambda-table-access-policy.json` — replace REGION and ACCOUNT_ID
- `policies/s3-bucket-policy.json` — replace the bucket name with yours

## Testing
- `tests/lambda-test-events/*.json` — paste into the Lambda console Test tab
- `tests/sample-data.json` — three fictional patients
- `tests/api-tests.sh` — curl commands for the deployed API

DynamoDB table: **PatientRecords** · partition key **patientId** (String)
