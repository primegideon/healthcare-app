"""
GetPatientAppointments - lists a patient's appointments
API route: GET /patients/{patientId}/appointments
"""
import json
import os
from decimal import Decimal
import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ.get("APPOINTMENTS_TABLE", "Appointments")
KEY_NAME = "patientId"

table = boto3.resource("dynamodb").Table(TABLE_NAME)

class DecimalEncoder(json.JSONEncoder):
    """DynamoDB returns numbers as Decimal, which json.dumps cannot handle."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)

def respond(status_code, body):
    """Build the response shape API Gateway expects."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body, cls=DecimalEncoder),
    }

def lambda_handler(event, context):
    # The ID comes from the URL: /patients/{patientId}/appointments
    record_id = ((event.get("pathParameters") or {}).get(KEY_NAME) or "").strip().upper()
    
    if not record_id:
        return respond(400, {"error": f"The URL is missing the {KEY_NAME}."})
        
    try:
        # Use query instead of get_item to get all matching rows!
        result = table.query(
            KeyConditionExpression=Key(KEY_NAME).eq(record_id)
        )
    except ClientError as err:
        print(f"Query failed for {record_id}: {err}")
        return respond(500, {"error": "Could not read the appointments. Check CloudWatch Logs."})
        
    items = result.get("Items", [])
    return respond(200, items)
