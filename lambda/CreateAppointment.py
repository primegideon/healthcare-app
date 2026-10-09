"""
CreateAppointment - books a new appointment
API route: POST /patients/{patientId}/appointments
"""
import json
import os
import boto3
from botocore.exceptions import ClientError

TABLE_NAME = os.environ.get("APPOINTMENTS_TABLE", "Appointments")
KEY_NAME = "patientId"

table = boto3.resource("dynamodb").Table(TABLE_NAME)

def respond(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body),
    }

def lambda_handler(event, context):
    record_id = ((event.get("pathParameters") or {}).get(KEY_NAME) or "").strip().upper()
    if not record_id:
        return respond(400, {"error": f"The URL is missing the {KEY_NAME}."})
        
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return respond(400, {"error": "Request body must be valid JSON."})
        
    date = body.get("appointmentDate", "").strip()
    reason = body.get("reason", "").strip()
    
    if not date:
        return respond(400, {"error": "appointmentDate is required."})
        
    item = {
        KEY_NAME: record_id,
        "appointmentDate": date,
        "reason": reason
    }
    
    try:
        # Prevents double-booking on the exact same date
        table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(#p)",
            ExpressionAttributeNames={"#p": KEY_NAME}
        )
    except ClientError as err:
        if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return respond(409, {"error": "An appointment is already booked for this date."})
        print(f"Create appointment failed for {record_id}: {err}")
        return respond(500, {"error": "Could not save the appointment."})
        
    return respond(201, {"message": "Appointment created."})
