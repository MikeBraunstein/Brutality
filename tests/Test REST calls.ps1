Invoke-RestMethod `
    -Method POST `
    -Uri "http://localhost:8001/api/workout/start" `
    -ContentType "application/json" `
    -Body '{"user_id":"local-test-user"}'

Invoke-RestMethod `
    -Method POST `
    -Uri "http://localhost:8001/api/workout/move-command?complexity=0.2&intensity=0.5&round_number=1"