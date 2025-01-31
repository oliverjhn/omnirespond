# Example test script
import requests
import json

def test_chunking_strategies():
    url = "http://localhost:8000/evaluate/chunking-strategies"
    
    test_queries = [
        # "What is the most commonly used gradient estimator?",
        # "Explain the conclusion and findings.",
        # "What PPO hyperparameters were used in the Atari experiments?",
        "What Horizon hyperparameter was used in the Atari experiments?",
        "What Horizon hyperparameter was used in the Mujoco 1 million timestep benchmark?",
        # "What does this paper seek to do?"
    ]

    ground_truth = [
        "The Horizon hyperparameter used in the Atari experiments was 128."
        "The Horizon hyperparameter used in the Mujoco 1 million timestep benchmark was 2048."
        
    ]
    
    files = {
        'test_file': ('reinforcement.pdf', open('pdfs/reinforcement.pdf', 'rb'))
    }
    
    data = {
        'test_queries': json.dumps(test_queries),
        'ground_truth': json.dumps(ground_truth),
        'collection_prefix': 'chunking_test_'
    }
    
    try:
        response = requests.post(url, files=files, data=data)
        response.raise_for_status()  # Raise an exception for bad status codes
        results = response.json()
        
        print("Evaluation Results:")
        print(json.dumps(results, indent=2))
        
    except requests.exceptions.RequestException as e:
        print(f"Error during request: {e}")
        if hasattr(e.response, 'text'):
            print(f"Response content: {e.response.text}")
    except json.JSONDecodeError as e:
        print(f"Error decoding response: {e}")
        print(f"Raw response: {response.text}")
    except Exception as e:
        print(f"Unexpected error: {e}")

if __name__ == "__main__":
    test_chunking_strategies()
