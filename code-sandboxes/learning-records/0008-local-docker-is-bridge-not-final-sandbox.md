# Local Docker is bridge, not final sandbox

User recognized that bind-mounting the real workspace into Docker makes local Docker closer to local spawn than a true sandbox, because container writes still affect the host workspace. Future lessons should treat local Docker as a bridge for learning port/log/container lifecycle concepts, improve it with isolated work directories, and keep remote sandbox runtime as the bigger future win.
