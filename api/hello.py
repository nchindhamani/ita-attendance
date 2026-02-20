def handler(request):
    """
    Minimal test handler to verify Vercel Python detection
    """
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": '{"message": "Python function is working!", "path": "' + str(request.get("path", "/")) + '"}'
    }


