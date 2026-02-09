"""
Minimal test handler for Vercel Python runtime
"""
import json

def handler(request):
    """
    Simple test handler to verify Python runtime works
    """
    try:
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "status": "ok",
                "message": "Python handler is working!",
                "request_path": request.get("path", "unknown")
            })
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "error": str(e),
                "type": type(e).__name__
            })
        }

