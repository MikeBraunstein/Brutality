#!/usr/bin/env python3
"""
Brutality Fitness Backend API Test Suite
Tests all backend endpoints for the fitness app
"""

import requests
import json
import base64
import time
from datetime import datetime
import uuid

# Get backend URL from frontend .env
BACKEND_URL = "https://boxing-beats.preview.emergentagent.com/api"

class BrutalityBackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.session_id = None
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def test_basic_api(self):
        """Test basic API endpoint"""
        try:
            response = self.session.get(f"{BACKEND_URL}/")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "Brutality" in data["message"]:
                    self.log_test("Basic API Test", True, f"Response: {data}")
                    return True
                else:
                    self.log_test("Basic API Test", False, f"Unexpected response format: {data}")
                    return False
            else:
                self.log_test("Basic API Test", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Basic API Test", False, f"Exception: {str(e)}")
            return False
    
    def test_workout_session_start(self):
        """Test starting a workout session"""
        try:
            payload = {"user_id": "alex_fighter_2025"}
            response = self.session.post(f"{BACKEND_URL}/workout/start", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "user_id", "start_time", "rounds_completed", "total_rounds"]
                
                if all(field in data for field in required_fields):
                    if data["user_id"] == "alex_fighter_2025" and data["total_rounds"] == 7:
                        self.session_id = data["id"]  # Store for later tests
                        self.log_test("Workout Session Start", True, f"Session ID: {self.session_id}")
                        return True
                    else:
                        self.log_test("Workout Session Start", False, f"Invalid data values: {data}")
                        return False
                else:
                    self.log_test("Workout Session Start", False, f"Missing required fields: {data}")
                    return False
            else:
                self.log_test("Workout Session Start", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Workout Session Start", False, f"Exception: {str(e)}")
            return False
    
    def test_workout_session_get(self):
        """Test retrieving a workout session"""
        if not self.session_id:
            self.log_test("Workout Session Get", False, "No session ID available from previous test")
            return False
            
        try:
            response = self.session.get(f"{BACKEND_URL}/workout/{self.session_id}")
            
            if response.status_code == 200:
                data = response.json()
                if data["id"] == self.session_id and data["user_id"] == "alex_fighter_2025":
                    self.log_test("Workout Session Get", True, f"Retrieved session: {data['id']}")
                    return True
                else:
                    self.log_test("Workout Session Get", False, f"Session data mismatch: {data}")
                    return False
            else:
                self.log_test("Workout Session Get", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Workout Session Get", False, f"Exception: {str(e)}")
            return False
    
    def test_workout_session_complete(self):
        """Test completing a workout session"""
        if not self.session_id:
            self.log_test("Workout Session Complete", False, "No session ID available from previous test")
            return False
            
        try:
            response = self.session.post(f"{BACKEND_URL}/workout/{self.session_id}/complete")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "completed" in data["message"].lower():
                    self.log_test("Workout Session Complete", True, f"Response: {data}")
                    return True
                else:
                    self.log_test("Workout Session Complete", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Workout Session Complete", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Workout Session Complete", False, f"Exception: {str(e)}")
            return False
    
    def test_move_command_simple(self):
        """Test simple move command generation (complexity=0.0, intensity=0.0)"""
        try:
            params = {
                "complexity": 0.0,
                "intensity": 0.0,
                "round_number": 1
            }
            response = self.session.post(f"{BACKEND_URL}/workout/move-command", params=params)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["command", "complexity_score", "intensity_score", "duration_ms", "round_number"]
                
                if all(field in data for field in required_fields):
                    # For complexity 0.0, should be single number (1-4)
                    if data["command"] in ["1", "2", "3", "4"] and data["complexity_score"] == 0.0:
                        self.log_test("Move Command Simple", True, f"Command: {data['command']}, Duration: {data['duration_ms']}ms")
                        return True
                    else:
                        self.log_test("Move Command Simple", False, f"Unexpected command format: {data}")
                        return False
                else:
                    self.log_test("Move Command Simple", False, f"Missing required fields: {data}")
                    return False
            else:
                self.log_test("Move Command Simple", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Move Command Simple", False, f"Exception: {str(e)}")
            return False
    
    def test_move_command_moderate(self):
        """Test moderate move command generation (complexity=0.5, intensity=0.3)"""
        try:
            params = {
                "complexity": 0.5,
                "intensity": 0.3,
                "round_number": 3
            }
            response = self.session.post(f"{BACKEND_URL}/workout/move-command", params=params)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["command", "complexity_score", "intensity_score", "duration_ms", "round_number"]
                
                if all(field in data for field in required_fields):
                    # Should be more complex than simple commands
                    if data["complexity_score"] == 0.5 and data["round_number"] == 3:
                        self.log_test("Move Command Moderate", True, f"Command: {data['command']}, Duration: {data['duration_ms']}ms")
                        return True
                    else:
                        self.log_test("Move Command Moderate", False, f"Incorrect parameters: {data}")
                        return False
                else:
                    self.log_test("Move Command Moderate", False, f"Missing required fields: {data}")
                    return False
            else:
                self.log_test("Move Command Moderate", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Move Command Moderate", False, f"Exception: {str(e)}")
            return False
    
    def test_move_command_complex(self):
        """Test complex move command generation (complexity=1.0, intensity=0.8)"""
        try:
            params = {
                "complexity": 1.0,
                "intensity": 0.8,
                "round_number": 7
            }
            response = self.session.post(f"{BACKEND_URL}/workout/move-command", params=params)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["command", "complexity_score", "intensity_score", "duration_ms", "round_number"]
                
                if all(field in data for field in required_fields):
                    # Should be most complex commands
                    if data["complexity_score"] == 1.0 and data["round_number"] == 7:
                        self.log_test("Move Command Complex", True, f"Command: {data['command']}, Duration: {data['duration_ms']}ms")
                        return True
                    else:
                        self.log_test("Move Command Complex", False, f"Incorrect parameters: {data}")
                        return False
                else:
                    self.log_test("Move Command Complex", False, f"Missing required fields: {data}")
                    return False
            else:
                self.log_test("Move Command Complex", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Move Command Complex", False, f"Exception: {str(e)}")
            return False
    
    def test_tts_basic(self):
        """Test basic TTS generation"""
        try:
            payload = {
                "text": "Welcome to Brutality",
                "voice": "onyx"
            }
            response = self.session.post(f"{BACKEND_URL}/tts/generate", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["audio_base64", "text", "voice"]
                
                if all(field in data for field in required_fields):
                    if data["text"] == "Welcome to Brutality" and data["voice"] == "onyx":
                        # Verify base64 audio data exists and is valid
                        try:
                            audio_data = base64.b64decode(data["audio_base64"])
                            if len(audio_data) > 0:
                                self.log_test("TTS Basic", True, f"Generated {len(audio_data)} bytes of audio")
                                return True
                            else:
                                self.log_test("TTS Basic", False, "Empty audio data")
                                return False
                        except Exception as decode_error:
                            self.log_test("TTS Basic", False, f"Invalid base64 audio: {decode_error}")
                            return False
                    else:
                        self.log_test("TTS Basic", False, f"Incorrect text/voice: {data}")
                        return False
                else:
                    self.log_test("TTS Basic", False, f"Missing required fields: {data}")
                    return False
            else:
                self.log_test("TTS Basic", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("TTS Basic", False, f"Exception: {str(e)}")
            return False
    
    def test_tts_with_speed(self):
        """Test TTS generation with custom speed"""
        try:
            payload = {
                "text": "Defense and 3",
                "voice": "onyx",
                "speed": 1.2
            }
            response = self.session.post(f"{BACKEND_URL}/tts/generate", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["audio_base64", "text", "voice"]
                
                if all(field in data for field in required_fields):
                    if data["text"] == "Defense and 3" and data["voice"] == "onyx":
                        # Verify base64 audio data exists
                        try:
                            audio_data = base64.b64decode(data["audio_base64"])
                            if len(audio_data) > 0:
                                self.log_test("TTS With Speed", True, f"Generated {len(audio_data)} bytes of audio with speed 1.2")
                                return True
                            else:
                                self.log_test("TTS With Speed", False, "Empty audio data")
                                return False
                        except Exception as decode_error:
                            self.log_test("TTS With Speed", False, f"Invalid base64 audio: {decode_error}")
                            return False
                    else:
                        self.log_test("TTS With Speed", False, f"Incorrect text/voice: {data}")
                        return False
                else:
                    self.log_test("TTS With Speed", False, f"Missing required fields: {data}")
                    return False
            else:
                self.log_test("TTS With Speed", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("TTS With Speed", False, f"Exception: {str(e)}")
            return False
    
    def test_audio_tracks_get(self):
        """Test getting audio tracks"""
        try:
            response = self.session.get(f"{BACKEND_URL}/audio/tracks")
            
            if response.status_code == 200:
                data = response.json()
                # Should return a list (even if empty)
                if isinstance(data, list):
                    self.log_test("Audio Tracks Get", True, f"Retrieved {len(data)} tracks")
                    return True
                else:
                    self.log_test("Audio Tracks Get", False, f"Expected list, got: {type(data)}")
                    return False
            else:
                self.log_test("Audio Tracks Get", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Audio Tracks Get", False, f"Exception: {str(e)}")
            return False
    
    def test_audio_upload(self):
        """Test uploading an audio track"""
        try:
            # Create sample base64 audio data (minimal MP3 header)
            sample_audio = base64.b64encode(b"fake_mp3_data_for_testing").decode('utf-8')
            
            payload = {
                "name": "Intense Workout Beat",
                "artist": "DJ Brutality",
                "audio_base64": sample_audio,
                "duration_ms": 180000  # 3 minutes
            }
            response = self.session.post(f"{BACKEND_URL}/audio/upload", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "name", "artist", "audio_base64", "duration_ms", "genre", "created_at"]
                
                if all(field in data for field in required_fields):
                    if data["name"] == "Intense Workout Beat" and data["artist"] == "DJ Brutality":
                        self.log_test("Audio Upload", True, f"Uploaded track ID: {data['id']}")
                        return True
                    else:
                        self.log_test("Audio Upload", False, f"Incorrect track data: {data}")
                        return False
                else:
                    self.log_test("Audio Upload", False, f"Missing required fields: {data}")
                    return False
            else:
                self.log_test("Audio Upload", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Audio Upload", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🥊 Starting Brutality Fitness Backend API Tests")
        print(f"🎯 Testing against: {BACKEND_URL}")
        print("=" * 60)
        
        # Test sequence
        tests = [
            self.test_basic_api,
            self.test_workout_session_start,
            self.test_workout_session_get,
            self.test_workout_session_complete,
            self.test_move_command_simple,
            self.test_move_command_moderate,
            self.test_move_command_complex,
            self.test_tts_basic,
            self.test_tts_with_speed,
            self.test_audio_tracks_get,
            self.test_audio_upload
        ]
        
        for test in tests:
            test()
            time.sleep(0.5)  # Small delay between tests
        
        # Summary
        print("\n" + "=" * 60)
        print("🏁 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        for result in self.test_results:
            print(f"{result['status']}: {result['test']}")
            if result['details'] and not result['success']:
                print(f"   ❗ {result['details']}")
        
        print(f"\n📊 Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! Backend is working correctly.")
        else:
            print(f"⚠️  {total - passed} tests failed. Check details above.")
        
        return passed == total

if __name__ == "__main__":
    tester = BrutalityBackendTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)