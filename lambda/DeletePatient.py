"""
DeletePatient - removes a patient record
Track: Healthcare (Patient Records System)
API route: DELETE /patients/{patientId}
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
    record_id = ((event.get("pathParameters") or {}).get(KEY_NAME) or "").strip().upper()
    if not record_id:
        return respond(400, {"error": f"The URL is missing the {KEY_NAME}."})

    try:
        table.delete_item(
            Key={KEY_NAME: record_id},
            ConditionExpression="attribute_exists(#k)",
            ExpressionAttributeNames={"#k": KEY_NAME},
        )
    except ClientError as err:
        if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return respond(404, {"error": f"No {ENTITY.lower()} found with ID {record_id}."})
        print(f"Delete failed for {record_id}: {err}")
        return respond(500, {"error": "Could not delete the record. Check CloudWatch Logs."})

    return respond(200, {"message": f"{ENTITY} {record_id} deleted."})
