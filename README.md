# Riverside General Hospital — Serverless Patient Records System 

![AWS](https://img.shields.io/badge/AWS-%23FF9900.svg?style=flat-square&logo=amazon-aws&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.13-blue?style=flat-square&logo=python&logoColor=white)
![DynamoDB](https://img.shields.io/badge/Amazon_DynamoDB-4053D6?style=flat-square&logo=amazon-dynamodb&logoColor=white)
![Serverless](https://img.shields.io/badge/Serverless-Application-success?style=flat-square)

A highly available, secure, and fully serverless web application built on AWS to manage patient records for the fictional Riverside General Hospital. This project modernizes traditional hospital administration by replacing paper files and spreadsheets with a scalable cloud-native solution.

---

## 🏗️ Architecture Overview

The system is built entirely on AWS utilizing a decoupled, serverless architecture:

- **Frontend Hosting:** Amazon S3 (Static Website Hosting)
- **Content Delivery Network (CDN):** Amazon CloudFront (Enforcing HTTPS)
- **Authentication & Security:** Amazon Cognito (User Pools & Hosted UI)
- **API Routing:** Amazon API Gateway (RESTful API with CORS & Proxy Integration)
- **Compute:** AWS Lambda (Python 3.13 on `arm64` architecture)
- **Database:** Amazon DynamoDB (NoSQL)

##  Core Features

- **Secure Staff Portal:** SSO authentication flow secured by Amazon Cognito. Unauthenticated users are strictly blocked via client-side routing and API Gateway authorizers.
- **Full CRUD Operations:**
  - **Create:** Admit new patients securely.
  - **Read:** Search and retrieve patient data instantly.
  - **Update:** Edit existing patient records.
  - **Delete:** Remove discharged patient records.
- **Ward Dashboard:** Real-time visibility into patient distribution across hospital wards.
- **HIPAA-Ready Concepts:** Least-privilege IAM policies, encrypted HTTPS transit, and isolated data access.

---

## 📂 Repository Structure

```text
.
├── frontend/               # HTML, CSS, and vanilla JS for the S3 static site
│   ├── index.html          # Main application and splash screen
│   ├── styles.css          # UI styling (Cognito-matched aesthetics)
│   └── app.js              # Auth state, DOM manipulation, and API fetching
├── lambda/                 # Serverless compute functions (Python)
│   ├── CreatePatient.py    # Handles POST requests
│   ├── GetPatient.py       # Handles GET requests
│   ├── UpdatePatient.py    # Handles PUT requests
│   └── DeletePatient.py    # Handles DELETE requests
├── policies/               # IAM JSON Policies for Infrastructure as Code
│   ├── lambda-table-access-policy.json
│   └── s3-bucket-policy.json
├── tests/                  # Testing resources
│   ├── lambda-test-events/ # JSON mocks for Lambda console testing
│   ├── sample-data.json    # Seed data for patient records
│   └── api-tests.sh        # cURL scripts for API testing
└── assets/                 # Architecture diagrams and test screenshots
```

---

##  Deployment Instructions

### 1. Database & Compute
- Create a **DynamoDB** table named `PatientRecords` with `patientId` (String) as the Partition Key.
- Create 4 **Lambda** functions using Python 3.13. Attach an IAM role using the policy in `policies/lambda-table-access-policy.json` (remember to update your Region and Account ID).
- Upload the corresponding `.py` code from the `lambda/` directory.

### 2. API Gateway
- Build a new REST API.
- Create resources (`/patients` and `/patients/{patientId}`) and methods (POST, GET, PUT, DELETE).
- Link the methods to your Lambda functions using **Lambda Proxy Integration**.
- Enable CORS and Deploy the API.

### 3. Frontend & Security
- Open `frontend/app.js` and update:
  - `API_BASE_URL` with your API Gateway Invoke URL.
  - `COGNITO_DOMAIN`, `CLIENT_ID`, and `REDIRECT_URI` with your Cognito App Client details.
- Upload the `frontend/` contents to an **S3 Bucket** configured for static website hosting.
- Set up **CloudFront** pointing to your S3 bucket.
- Configure **Cognito** to use your CloudFront distribution URL as both the *Allowed Callback URL* and *Allowed Sign-out URL*.

---

## 🧪 Testing
Use the provided `tests/api-tests.sh` script to test your endpoints via cURL, or use the `lambda-test-events/` files directly in the AWS Console to verify DynamoDB read/write permissions.

> *Built for the AWS Cloud Practitioner Capstone Project.*
