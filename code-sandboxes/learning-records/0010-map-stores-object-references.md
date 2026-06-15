# Map stores object references

User learned that `Map.set(key, object)` stores a reference to the object, not a copy. Future runner-state examples can safely mutate stored sandbox objects in place, as long as the object itself is not replaced without calling `set()` again.
