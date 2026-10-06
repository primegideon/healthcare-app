"""
CreatePatient - adds a new patient record
Track: Healthcare (Patient Records System)
API route: POST /patients
"""
import json
import os
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

# ---------------------------------------------------------------------------
# Track configuration: this block is the ONLY part that differs between the
# Healthcare, Finance and HR versions of the project.
# ---------------------------------------------------------------------------
TABLE_NAME = os.environ.get("TABLE_NAME", "PatientRecords")
KEY_NAME = "patientId"
ENTITY = "Patient"
REQUIRED_FIELDS = ["firstName", "lastName", "dateOfBirth", "bloodType", "primaryDiagnosis", "attendingPhysician", "ward", "admissionDate", "status", "weightKg"]
# ---------------------------------------------------------------------------

table = boto3.resource("dynamodb").Table(TABLE_NAME)


class DecimalEncoder(json.JSONEncoder):
    """DynamoDB returns numbers as Decimal, which json.dumps cannot handle."""

    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)


def respond(status_code, body):
    """Build the response shape API Gateway expects from a proxy integration."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body, cls=DecimalEncoder),
    }


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def lambda_handler(event, context):
    # 1. Read the JSON body. parse_float=Decimal lets DynamoDB store decimals.
    try:
        record = json.loads(event.get("body") or "{}", parse_float=Decimal)
    except json.JSONDecodeError:
        return respond(400, {"error": "Request body must be valid JSON."})

    # 2. Check every required field is present and not blank.
    missing = [f for f in [KEY_NAME] + REQUIRED_FIELDS if str(record.get(f, "")).strip() == ""]
    if missing:
        return respond(400, {"error": "Missing required fields: " + ", ".join(missing)})

    # 3. Normalise the ID so "pt-1001" and "PT-1001" are the same record.
    record[KEY_NAME] = str(record[KEY_NAME]).strip().upper()
    record["createdAt"] = now_iso()

    # 4. Save it, but refuse to overwrite an existing record with the same ID.
    try:
        table.put_item(
            Item=record,
            ConditionExpression="attribute_not_exists(#k)",
            ExpressionAttributeNames={"#k": KEY_NAME},
        )
    except ClientError as err:
        if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return respond(409, {"error": f"{ENTITY} {record[KEY_NAME]} already exists."})
        # Never print a whole patient record to CloudWatch Logs. Log only the patient ID and the error.
        print(f"Create failed for {record[KEY_NAME]}: {err}")
        return respond(500, {"error": "Could not save the record. Check CloudWatch Logs."})

    return respond(201, {"message": f"{ENTITY} created.", KEY_NAME: record[KEY_NAME]})
