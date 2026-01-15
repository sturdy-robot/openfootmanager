# schema-change

Safely introduce or modify YAML/JSON modding schemas and save formats.

## Steps

1. Restate the schema change and why it’s needed.

2. Backward compatibility:
   - Is this additive? (preferred)
   - If breaking, define a migration strategy.

3. Define:
   - example YAML
   - example JSON
   - validation rules

4. Implement:
   - parsing
   - validation
   - friendly error messages

5. Tests:
   - valid examples
   - invalid examples
   - round-trip where applicable

6. Output:
   - schema docs snippet to add to project docs
   - any follow-up refactors required
