"""
GetPatientsByWard - Retrieves all patients currently in a specific ward
Track: Healthcare (Patient Records System)
API route: GET /wards/{ward}/patients
"""
import json
import os
from decimal import Decimal
import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ.get("TABLE_NAME", "PatientRecords")
INDEX_NAME = "ward-index"
ENTITY = "Patient"

table = boto3.resource("dynamodb").Table(TABLE_NAME)

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super().default(obj)

def respond(status_code, body):
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
    print("Received event:", json.dumps(event))
    path_params = event.get("pathParameters") or {}
    
    # Look for 'ward', but if they named the variable something else in API Gateway
    # (like {wards} or {id}), just grab whatever path parameter is there.
    ward = path_params.get("ward")
    if not ward and path_params:
        ward = list(path_params.values())[0]
        
    ward = (ward or "").strip()
    
    if not ward:
        return respond(400, {"error": f"The URL is missing the ward. Path parameters received: {json.dumps(path_params)}"})

    try:
        # Query the GSI using the ward as the partition key
        response = table.query(
            IndexName=INDEX_NAME,
            KeyConditionExpression=Key("ward").eq(ward)
        )
        patients = response.get("Items", [])
        
    except ClientError as err:
        print(f"Query failed for ward {ward}: {err}")
        return respond(500, {"error": "Could not retrieve patients. Check CloudWatch Logs."})

    return respond(200, patients)
