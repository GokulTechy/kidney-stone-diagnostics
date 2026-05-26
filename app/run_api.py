import uvicorn
import os

if __name__ == "__main__":
    # Get port from environment or default to 8000 (standard for local development)
    port = int(os.environ.get("PORT", 8000))
    
    print("------------------------------------------------------------------")
    print("  Kidney Stone Diagnostics - Clinical AI FastAPI Server Launcher  ")
    print("------------------------------------------------------------------")
    print(f"Starting server on: http://localhost:{port}")
    print("Access API documentation at: http://localhost:8000/docs")
    print("Make sure your frontend is configured to talk to this endpoint.")
    print("------------------------------------------------------------------\n")
    
    # Run backend using standard uvicorn runner
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=True)
