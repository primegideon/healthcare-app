"""
DeleteAppointment - removes an appointment
API route: DELETE /patients/{patientId}/appointments/{appointmentDate}
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
    path_params = event.get("pathParameters") or {}
    record_id = (path_params.get(KEY_NAME) or "").strip().upper()
    date = (path_params.get("appointmentDate") or "").strip()
    
    if not record_id or not date:
        return respond(400, {"error": "The URL is missing the patientId or appointmentDate."})
        
    try:
        table.delete_item(
            Key={
                KEY_NAME: record_id,
                "appointmentDate": date
            },
            ConditionExpression="attribute_exists(#p)",
            ExpressionAttributeNames={"#p": KEY_NAME}
        )
    except ClientError as err:
        if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return respond(404, {"error": "Appointment not found."})
        print(f"Delete appointment failed for {record_id} on {date}: {err}")
        return respond(500, {"error": "Could not delete the appointment."})
        
    return respond(200, {"message": "Appointment deleted."})
