import requests
import json

def stream_llm(prompt: str, system_prompt: str):
    """Calls Ollama mistral model locally and streams the response token by token."""
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "mistral",
            "system": system_prompt,
            "prompt": prompt,
            "stream": True,
            "format": "json"
        },
        stream=True
    )
    
    # Yield tokens as they stream in
    for line in response.iter_lines():
        if line:
            chunk = json.loads(line)
            if "response" in chunk:
                yield chunk["response"]