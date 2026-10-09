"""
UpdatePatient - changes fields on an existing patient record
Track: Healthcare (Patient Records System)
API route: PUT /patients/{patientId}
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
        updates = json.loads(event.get("body") or "{}", parse_float=Decimal)
    except json.JSONDecodeError:
        return respond(400, {"error": "Request body must be valid JSON."})

    # The ID and creation time can never be changed.
    for protected in (KEY_NAME, "createdAt", "updatedAt"):
        updates.pop(protected, None)
    # Ignore fields sent as empty strings.
    updates = {k: v for k, v in updates.items() if not (isinstance(v, str) and v.strip() == "")}
    if not updates:
        return respond(400, {"error": "Send at least one field to update."})
    updates["updatedAt"] = now_iso()

    # Build "SET #f0 = :v0, #f1 = :v1". Placeholders avoid clashes with
    # DynamoDB reserved words such as "status".
    names, values, parts = {"#k": KEY_NAME}, {}, []
    for i, (field, value) in enumerate(updates.items()):
        names[f"#f{i}"] = field
        values[f":v{i}"] = value
        parts.append(f"#f{i} = :v{i}")

    # Determine if an ICU alert should be triggered.
    # Alert only if the ward is being explicitly changed to ICU.
    is_moving_to_icu = False
    if updates.get("ward") == "ICU":
        try:
            current_item = table.get_item(Key={KEY_NAME: record_id}).get("Item", {})
            if current_item.get("ward") != "ICU":
                is_moving_to_icu = True
        except ClientError:
            pass 

    try:
        result = table.update_item(
            Key={KEY_NAME: record_id},
            UpdateExpression="SET " + ", ".join(parts),
            ConditionExpression="attribute_exists(#k)",
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ReturnValues="ALL_NEW",
        )
    except ClientError as err:
        if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return respond(404, {"error": f"No {ENTITY.lower()} found with ID {record_id}."})
        print(f"Update failed for {record_id}: {err}")
        return respond(500, {"error": "Could not update the record. Check CloudWatch Logs."})

    # Publish alert if the patient was moved to the ICU.
    if is_moving_to_icu:
        try:
            sns = boto3.client("sns")
            account_id = context.invoked_function_arn.split(":")[4]
            region = os.environ.get("AWS_REGION", "us-east-1")
            topic_arn = f"arn:aws:sns:{region}:{account_id}:ICU-Alerts"
            
            message = f"URGENT: Patient {record_id} has been moved to the ICU."
            sns.publish(TopicArn=topic_arn, Message=message, Subject="ICU Alert")
            print(f"ICU alert sent for {record_id}")
        except Exception as e:
            print(f"Failed to send ICU alert: {e}")

    return respond(200, {"message": f"{ENTITY} {record_id} updated.", "record": result["Attributes"]})
