#!/usr/bin/env python3
"""
Test error cases for Brutality Fitness Backend API
"""

import requests
import json

BACKEND_URL = "https://brutality-rounds.preview.emergentagent.com/api"

def test_nonexistent_session():
    """Test GET /api/workout/nonexistent-id - Should return 404"""
    response = requests.get(f"{BACKEND_URL}/workout/nonexistent-id")
    print(f"GET /api/workout/nonexistent-id:")
    print(f"  Status: {response.status_code}")
    print(f"  Response: {response.text}")
    
    if response.status_code == 404:
        print("  ✅ PASS: Correctly returned 404 for nonexistent session")
        return True
    else:
        print(f"  ❌ FAIL: Expected 404, got {response.status_code}")
        return False

def test_extreme_move_command():
    """Test POST /api/workout/move-command with extreme values"""
    params = {
        "complexity": 1.0,
        "intensity": 1.0,
        "round_number": 7
    }
    response = requests.post(f"{BACKEND_URL}/workout/move-command", params=params)
    print(f"POST /api/workout/move-command with extreme values:")
    print(f"  Status: {response.status_code}")
    print(f"  Response: {response.text[:200]}...")
    
    if response.status_code == 200:
        data = response.json()
        if "command" in data:
            print("  ✅ PASS: Successfully handled extreme values")
            print(f"  Command: {data['command']}")
            return True
        else:
            print("  ❌ FAIL: Missing command in response")
            return False
    else:
        print(f"  ❌ FAIL: Expected 200, got {response.status_code}")
        return False

if __name__ == "__main__":
    print("🧪 Testing Error Cases")
    print("=" * 40)
    
    test1 = test_nonexistent_session()
    print()
    test2 = test_extreme_move_command()
    
    print("\n" + "=" * 40)
    print("📊 Error Cases Summary:")
    print(f"  404 Error Test: {'✅ PASS' if test1 else '❌ FAIL'}")
    print(f"  Extreme Values Test: {'✅ PASS' if test2 else '❌ FAIL'}")